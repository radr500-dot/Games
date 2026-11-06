// Screens, saving, the coin shop and settings. The 3D run lives in game.js.
import { Game } from './game.js';
import { ERAS, STAGES_PER_ERA, UPGRADES, TIPS, upgradeCost, eraIndex, stageLabel } from './eras.js';
import { play, unlockAudio, setSound } from './audio.js';

const $ = (id) => document.getElementById(id);
const KEY = 'wayfarers-save-v1';
let game = null;

const save = (() => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { s = null; }
  const d = { coins: 0, level: 0, up: {}, theme: null, speed: 1, sound: true, runs: 0, tip: 0, seenHow: false, rests: 0 };
  s = Object.assign(d, s || {});
  for (const u of UPGRADES) s.up[u.key] = s.up[u.key] || 0;
  return s;
})();
let saveTimer = 0;
function persist(now = false) {
  clearTimeout(saveTimer);
  const w = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* private mode */ } };
  if (now) w(); else saveTimer = setTimeout(w, 400);
}

function stats() {
  const u = save.up, ei = eraIndex(save.level);
  return {
    band: 4 + u.band,
    power: Math.pow(1.09, u.power) * Math.pow(1.3, ei),
    rate: 2.2 * (1 + 0.07 * u.rate),
    range: 16 + 1.2 * u.range,
    coinMult: 1 + 0.1 * u.coins,
    magnet: 1.2 + 0.45 * u.magnet,
  };
}

// ---------- theme ----------
const isDark = () => document.documentElement.dataset.theme === 'dark';
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]').content = t === 'dark' ? '#1c2240' : '#9fd3ef';
  game?.setTheme(t === 'dark');
  document.querySelectorAll('#themeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === t)));
}
function setTheme(t) { save.theme = t; persist(); applyTheme(t); }
applyTheme(save.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

// ---------- HUD helpers ----------
const bubble = $('countBubble'), countNum = $('countNum');
let lastCount = -1;
function fmt(n) {
  n = Math.max(0, Math.round(n));
  if (n < 10000) return n.toLocaleString('en-US');
  if (n < 1e6) return (n / 1000).toFixed(n < 100000 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
}
function showCoins() {
  $('homeCoins').textContent = fmt(save.coins);
  $('hudCoins').textContent = fmt(save.coins);
  $('shopCoins').textContent = fmt(save.coins);
  $('shopDot').hidden = !UPGRADES.some((u) => save.up[u.key] < u.max && upgradeCost(u, save.up[u.key]) <= save.coins);
}
let bumpT = 0;
function bumpCoins() {
  const c = $('hudCoinChip');
  if (performance.now() - bumpT < 200) return;
  bumpT = performance.now();
  c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
}
let lastBand = { x: 0, y: 0 };
function toast(text, kind) {
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || '');
  t.textContent = text;
  t.style.left = lastBand.x + 'px';
  t.style.top = (lastBand.y - 40) + 'px';
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 950);
}

// ---------- the game ----------
let screen = 'home';
const hooks = {
  sound: play,
  onCount(n) {
    if (n !== lastCount) {
      countNum.textContent = fmt(n);
      bubble.classList.remove('pulse'); void bubble.offsetWidth; bubble.classList.add('pulse');
      lastCount = n;
    }
  },
  onFrame(p, n) {
    lastBand = p;
    bubble.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    bubble.style.opacity = n > 0 ? 1 : 0;
  },
  onProgress(f) { $('progFill').style.width = (f * 100).toFixed(1) + '%'; },
  onCoin(v) { save.coins += v; showCoins(); bumpCoins(); play('coin'); persist(); },
  onToast: toast,
  onStart() { $('steerHint').hidden = true; },
  onEnd(r) { finishRun(r); },
};

function loadStage() {
  game.loadLevel(save.level, stats(), Math.max(0.45, Math.pow(0.8, save.rests)));
  game.speedSetting = save.speed;
  $('homeEra').textContent = stageLabel(save.level);
  $('hudEra').textContent = stageLabel(save.level);
  drawEraTrack();
}

function drawEraTrack() {
  const ei = eraIndex(save.level);
  const within = save.level - ei * STAGES_PER_ERA;
  $('eraTrack').innerHTML = ERAS.map((e, i) => {
    const f = i < ei ? 1 : i > ei ? 0 : Math.min(1, within / STAGES_PER_ERA);
    return `<i title="${e.name}"><b style="transform:scaleX(${f})"></b></i>`;
  }).join('');
}

function showHome() {
  screen = 'home';
  hideModals();
  $('home').hidden = false; $('hud').hidden = true;
  $('homeTip').textContent = 'Tip: ' + TIPS[save.tip % TIPS.length];
  showCoins();
  game.showMenu();
}

function startRun() {
  unlockAudio();
  hideModals();
  screen = 'run';
  $('home').hidden = true; $('hud').hidden = false;
  $('steerHint').hidden = false;
  lastCount = -1;
  game.resetRun();
  game.ready();
  showCoins();
  if (!save.seenHow) { save.seenHow = true; persist(); open('howModal'); game.pause(); }
}

function finishRun(r) {
  save.runs++;
  save.tip++;
  if (r.success) {
    save.coins += r.bonus;
    save.rests = 0;
    const prevEra = eraIndex(save.level);
    save.level++;
    persist(true);
    play('win');
    $('resultBadge').textContent = '🏁';
    $('resultTitle').textContent = 'Stage cleared!';
    $('resultSub').textContent = stageLabel(save.level - 1);
    $('rcBonusLine').hidden = false;
    $('rcBonusLabel').textContent = `Bonus stairs ×${r.mult.toFixed(1)}`;
    $('rcBonus').textContent = '+' + fmt(r.bonus);
    $('nextBtn').textContent = 'Next stage';
    $('resultTip').textContent = '';
    pendingEra = eraIndex(save.level) !== prevEra ? eraIndex(save.level) : -1;
  } else {
    save.rests++;
    persist(true);
    play('rest');
    $('resultBadge').textContent = '⛺';
    $('resultTitle').textContent = 'Time for a rest';
    $('resultSub').textContent = 'Your band ran out before the finish. Nothing is lost, and you keep every coin.';
    $('rcBonusLine').hidden = true;
    $('nextBtn').textContent = 'Try again';
    $('resultTip').textContent = save.rests <= 4
      ? 'Rested and ready: the walls and rival bands on this stage will be a little softer next time.'
      : 'Tip: ' + TIPS[save.tip % TIPS.length];
    pendingEra = -1;
  }
  $('rcPicked').textContent = fmt(r.coins);
  $('rcTotal').textContent = fmt(save.coins);
  showCoins();
  open('resultModal');
}
let pendingEra = -1;

function nextFromResult() {
  hideModals();
  if (pendingEra >= 0) {
    const e = ERAS[pendingEra];
    $('eraName').textContent = e.name;
    $('eraBlurb').textContent = e.blurb;
    open('eraModal');
    pendingEra = -1;
    loadStage();
    game.showMenu();
    return;
  }
  loadStage();
  startRun();
}

// ---------- modals ----------
function open(id) { $(id).hidden = false; }
function hideModals() { document.querySelectorAll('.modal').forEach((m) => (m.hidden = true)); }

// ---------- shop ----------
const ICONS = {
  band: '<svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="8" r="2.4"/><path d="M15.5 13.6c3 .1 5.5 2.6 5.5 5.9"/></svg>',
  power: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  rate: '<svg viewBox="0 0 24 24"><path d="M3 12h4M3 7h7M3 17h7"/><path d="M13 5l7 7-7 7"/></svg>',
  range: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/></svg>',
  coins: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
  magnet: '<svg viewBox="0 0 24 24"><path d="M6 3v8a6 6 0 0 0 12 0V3"/><path d="M6 7h3M15 7h3"/></svg>',
};
function renderShop(flashKey) {
  $('shopList').innerHTML = UPGRADES.map((u) => {
    const l = save.up[u.key];
    const max = l >= u.max;
    const cost = upgradeCost(u, l);
    return `<div class="up ${flashKey === u.key ? 'bought' : ''}">
      <div class="up-ico">${ICONS[u.key]}</div>
      <div class="up-text"><div class="up-name">${u.name}<span class="up-lvl">Lv ${l + 1}</span></div><div class="up-desc">${u.desc(l)}${max ? '' : ` <span style="white-space:nowrap">→ <b>${u.next(l)}</b></span>`}</div></div>
      ${max ? '<button class="buy max" disabled>Maxed</button>' : `<button class="buy" data-k="${u.key}" ${cost > save.coins ? 'disabled' : ''}><span class="coin-ico"></span>${fmt(cost)}</button>`}
    </div>`;
  }).join('');
  $('shopList').querySelectorAll('.buy[data-k]').forEach((b) => {
    b.onclick = () => {
      const u = UPGRADES.find((x) => x.key === b.dataset.k);
      const cost = upgradeCost(u, save.up[u.key]);
      if (cost > save.coins || save.up[u.key] >= u.max) return;
      save.coins -= cost; save.up[u.key]++;
      persist(true); play('buy');
      showCoins(); renderShop(u.key);
      game.stats = stats();
      if (u.key === 'band' && (game.state === 'idle' || game.state === 'ready')) game.resetRun(), screen === 'home' ? game.showMenu() : game.ready();
    };
  });
}
function openShop() { unlockAudio(); renderShop(); showCoins(); open('shopModal'); }

// ---------- settings ----------
function syncSettings() {
  document.querySelectorAll('#speedSeg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.v === save.speed)));
  document.querySelectorAll('#soundSeg button').forEach((b) => b.setAttribute('aria-pressed', String(!!+b.dataset.v === save.sound)));
  document.querySelectorAll('#themeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === (isDark() ? 'dark' : 'light'))));
}

// ---------- wire up ----------
function init() {
  try {
    game = new Game($('view'), hooks);
  } catch (e) {
    $('loading').innerHTML = '<p>This device could not start the 3D view. Try updating your browser.</p>';
    return;
  }
  game.setTheme(isDark());
  setSound(save.sound);
  loadStage();
  showHome();
  $('loading').hidden = true;

  $('playBtn').onclick = () => { play('tap'); startRun(); };
  $('shopBtn').onclick = openShop;
  $('resultShopBtn').onclick = openShop;
  $('shopDone').onclick = () => {
    $('shopModal').hidden = true;
    if (screen === 'run' && game.state === 'done') open('resultModal');
  };
  $('settingsBtn').onclick = () => { syncSettings(); open('settingsModal'); };
  $('settingsDone').onclick = () => { $('settingsModal').hidden = true; };
  $('howBtn').onclick = () => { open('howModal'); };
  $('howDone').onclick = () => { $('howModal').hidden = true; if (screen === 'run' && game.state === 'paused' && $('pauseModal').hidden) game.resume(); };
  $('resetBtn').onclick = () => open('confirmModal');
  $('confirmNo').onclick = () => { $('confirmModal').hidden = true; };
  $('confirmYes').onclick = () => {
    save.coins = 0; save.level = 0; save.rests = 0; for (const u of UPGRADES) save.up[u.key] = 0;
    persist(true); hideModals(); loadStage(); showHome();
  };
  document.querySelectorAll('#speedSeg button').forEach((b) => { b.onclick = () => { save.speed = +b.dataset.v; game.speedSetting = save.speed; persist(); syncSettings(); }; });
  document.querySelectorAll('#soundSeg button').forEach((b) => { b.onclick = () => { save.sound = !!+b.dataset.v; setSound(save.sound); unlockAudio(); persist(); syncSettings(); }; });
  document.querySelectorAll('#themeSeg button').forEach((b) => { b.onclick = () => { setTheme(b.dataset.v); syncSettings(); }; });
  document.querySelectorAll('.mode-btn').forEach((b) => { b.onclick = () => setTheme(isDark() ? 'light' : 'dark'); });
  $('pauseModeBtn').onclick = () => setTheme(isDark() ? 'light' : 'dark');

  $('pauseBtn').onclick = () => { if (game.state === 'done') return; game.pause(); open('pauseModal'); };
  $('resumeBtn').onclick = () => { $('pauseModal').hidden = true; game.resume(); };
  $('restartBtn').onclick = () => { $('pauseModal').hidden = true; loadStage(); startRun(); };
  $('menuBtn').onclick = () => { $('pauseModal').hidden = true; loadStage(); showHome(); };
  $('nextBtn').onclick = () => { play('tap'); nextFromResult(); };
  $('eraBtn').onclick = () => { $('eraModal').hidden = true; startRun(); };

  // Escape / P pauses on a computer
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && screen === 'run') {
      if (game.state === 'paused' && !$('pauseModal').hidden) { $('pauseModal').hidden = true; game.resume(); }
      else if (game.state === 'run' || game.state === 'ready') { game.pause(); open('pauseModal'); }
    } else if ((e.key === 'Enter' || e.key === ' ') && screen === 'home' && document.querySelectorAll('.modal:not([hidden])').length === 0) {
      e.preventDefault(); startRun();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persist(true);
      if (screen === 'run' && game.state === 'run') { game.pause(); open('pauseModal'); }
      game.running = false;
    } else { game.running = true; game.last = performance.now(); }
  });
  window.addEventListener('pagehide', () => persist(true));
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // Offline support and updates
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // When an update takes over, reload once so the new version shows right away
    // (progress is saved). Also look for updates whenever the app comes back to the front.
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; persist(true); location.reload(); } });
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
    });
  }
}

init();
window.__wayfarers = { get game() { return game; }, save, stats };
