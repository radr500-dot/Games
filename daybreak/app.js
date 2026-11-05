/* Daybreak: game screen, controls, hints, saving and stats. */
(function () {
  'use strict';
  const E = window.DaybreakEngine;
  const { EMPTY, SUN, MOON, NAME, PLURAL } = E;

  const SIZES = [
    { n: 6, name: 'Dawn', level: 1, sub: 'gentle' },
    { n: 8, name: 'Midday', level: 2, sub: 'thoughtful' },
    { n: 10, name: 'Dusk', level: 2, sub: 'unhurried' },
  ];
  const DAILY = { n: 6, level: 2 };

  /* ---------- Pieces ---------- */
  const rays = (() => { let s = ''; for (let a = 0; a < 360; a += 45) s += `<line x1="0" y1="-36" x2="0" y2="-24" transform="rotate(${a})"/>`; return s; })();
  const SUN_SVG = `<svg class="piece is-sun" viewBox="-50 -50 100 100" aria-hidden="true"><g class="sun-rays">${rays}</g><circle class="sun-core" r="18"/></svg>`;
  const MOON_SVG = `<svg class="piece is-moon" viewBox="-50 -50 100 100" aria-hidden="true"><path class="moon-body" d="M12 -32a34 34 0 1 0 22 50 27 27 0 1 1 -22 -50z"/></svg>`;
  const pieceSvg = (v) => (v === SUN ? SUN_SVG : v === MOON ? MOON_SVG : '');

  const $ = (id) => document.getElementById(id);
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('db-' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('db-' + key, JSON.stringify(value)); } catch (e) { /* ignore */ } },
  };
  const settings = Object.assign({ appearance: 'auto', conflicts: true, haptics: true, timer: false }, store.get('settings', {}));
  try { const q = new URLSearchParams(location.search).get('mode'); if (q === 'dark' || q === 'light') settings.appearance = q; } catch (e) { /* ignore */ }
  const stats = Object.assign({ solved: 0, best: {}, daily: {}, streak: 0, bestStreak: 0, lastDaily: null }, store.get('stats', {}));
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => settings.appearance === 'dark' || (settings.appearance === 'auto' && darkQuery && darkQuery.matches);

  let game = null, cells = [], signs = [], timerHandle = null, cursor = -1, hintState = null;

  /* ---------- Dates & seeds ---------- */
  function todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function seedFrom(text) {
    let h = 2166136261;
    for (const ch of 'daybreak:' + text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
  }

  /* ---------- Screens ---------- */
  function showHome() {
    stopTimer(); saveGame(); closeHint();
    $('game').hidden = true; $('home').hidden = false;
    renderHome();
  }
  function renderHome() {
    const key = todayKey(), done = stats.daily[key];
    $('dailySub').textContent = done != null
      ? `Done today${stats.streak > 1 ? ` · ${stats.streak} days in a row ☀️` : ' ☀️'}`
      : `${DAILY.n} × ${DAILY.n} · a new one every day`;
    const wrap = $('sizes');
    wrap.innerHTML = '';
    for (const s of SIZES) {
      const b = document.createElement('button');
      b.className = 'size-btn';
      const best = stats.best[s.n];
      b.innerHTML = `<b>${s.name}</b><span>${s.n} × ${s.n}</span><span>${s.sub}</span><span class="best">${best && settings.timer ? '★ ' + fmtTime(best) : ''}</span>`;
      b.onclick = () => startGame({ mode: 'free', size: s.n });
      wrap.appendChild(b);
    }
    const saved = store.get('current', null), resume = $('resumeBtn');
    if (saved && !saved.solved && (saved.mode !== 'daily' || saved.dailyKey === key)) {
      resume.hidden = false;
      const filled = saved.grid.filter(Boolean).length;
      $('resumeSub').textContent = `${saved.title} · ${Math.round((filled / saved.grid.length) * 100)}% filled`;
      resume.onclick = () => openGame(saved);
    } else resume.hidden = true;
  }

  function startGame({ mode, size }) {
    let seed, title, level;
    if (mode === 'daily') {
      seed = seedFrom(todayKey()); title = "Today's sky"; size = DAILY.n; level = DAILY.level;
    } else {
      const s = SIZES.find((x) => x.n === size);
      seed = (Math.random() * 4294967296) >>> 0; title = s.name; level = s.level;
    }
    const p = E.generate(size, seed, level);
    openGame({
      mode, title, n: size, dailyKey: mode === 'daily' ? todayKey() : null,
      givens: p.givens, clues: p.clues, solution: p.solution,
      grid: p.givens.slice(), history: [], elapsed: 0, hints: 0, solved: false,
    });
  }

  function openGame(state) {
    game = state;
    $('home').hidden = true; $('game').hidden = false;
    $('gameTitle').textContent = game.title;
    closeHint();
    buildBoard(); render(); startTimer();
    $('status').textContent = game.solved ? 'Solved!' : 'Tap once for a sun, twice for a moon.';
  }

  function buildBoard() {
    const board = $('board'), n = game.n;
    board.style.setProperty('--n', n);
    board.classList.remove('solved');
    board.innerHTML = '';
    cells = []; signs = [];
    for (let i = 0; i < n * n; i++) {
      const c = document.createElement('div');
      c.className = 'cell';
      const r = Math.floor(i / n), col = i % n;
      if (i === 0) c.classList.add('c-tl');
      if (i === n - 1) c.classList.add('c-tr');
      if (i === n * (n - 1)) c.classList.add('c-bl');
      if (i === n * n - 1) c.classList.add('c-br');
      if (game.givens[i]) c.classList.add('given');
      c.setAttribute('role', 'gridcell');
      c.dataset.i = i;
      c.setAttribute('aria-label', `Row ${r + 1}, column ${col + 1}`);
      board.appendChild(c);
      cells.push(c);
    }
    for (const cl of game.clues) {
      const s = document.createElement('div');
      s.className = 'sign';
      s.textContent = cl.t === '=' ? '=' : '≠';
      const ra = Math.floor(cl.a / n), ca = cl.a % n, horizontal = cl.b === cl.a + 1;
      // Centre of the shared edge, as a share of the board.
      const x = horizontal ? (ca + 1) / n : (ca + 0.5) / n;
      const y = horizontal ? (ra + 0.5) / n : (ra + 1) / n;
      s.style.left = (x * 100) + '%';
      s.style.top = (y * 100) + '%';
      board.appendChild(s);
      signs.push(s);
    }
    sizeSigns();
  }
  function sizeSigns() {
    const board = $('board');
    if (!game) return;
    board.style.setProperty('--cellpx', (board.clientWidth / game.n) + 'px');
  }

  // Rule-break stripes wait a moment after each tap, so a second tap (sun -> moon) can land first.
  const CLASH_DELAY = 1500;
  let clashHold = false, clashTimer = null, shownCells = new Set(), shownClues = new Set();
  function holdClashes() {
    clashHold = true;
    clearTimeout(clashTimer);
    clashTimer = setTimeout(() => {
      clashHold = false;
      if (game && !$('game').hidden) { render(); if (!game.solved) updateStatus(); }
    }, CLASH_DELAY);
  }
  // Rule breaks to show right now: while holding, only ones that were already on screen.
  function visibleViolations() {
    if (!settings.conflicts) return [];
    const all = E.violations(game.grid, game.n, game.clues);
    if (!clashHold) return all;
    return all.filter((v) => v.cells.every((i) => shownCells.has(i)) && (!v.clue || shownClues.has(v.clue)));
  }
  function render() {
    const bad = visibleViolations();
    const badCells = new Set(), badClues = new Set();
    for (const v of bad) { v.cells.forEach((i) => badCells.add(i)); if (v.clue) badClues.add(v.clue); }
    shownCells = badCells; shownClues = badClues;
    for (let i = 0; i < cells.length; i++) {
      const v = game.grid[i], c = cells[i];
      if (c.dataset.v !== String(v)) { c.innerHTML = pieceSvg(v); c.dataset.v = v; }
      c.classList.toggle('clash', badCells.has(i));
      c.setAttribute('aria-label', `Row ${Math.floor(i / game.n) + 1}, column ${i % game.n + 1}: ${v ? NAME[v] : 'empty'}${game.givens[i] ? ', fixed' : ''}`);
    }
    game.clues.forEach((cl, k) => signs[k].classList.toggle('bad', badClues.has(cl)));
    $('undoBtn').disabled = !game.history.length || game.solved;
    $('hintBtn').disabled = game.solved;
    $('clearBtn').disabled = game.solved;
  }

  /* ---------- Moves ---------- */
  function setCell(i, v) {
    if (game.solved || game.givens[i] || game.grid[i] === v) return;
    game.history.push([i, game.grid[i]]);
    game.grid[i] = v;
    afterMove();
  }
  function tap(i, backwards) {
    if (game.givens[i]) {
      cells[i].classList.remove('lock-tap'); void cells[i].offsetWidth; cells[i].classList.add('lock-tap');
      $('status').textContent = 'Shaded squares come with the puzzle, so they stay put.';
      return;
    }
    const cur = game.grid[i];
    const next = backwards ? (cur === EMPTY ? MOON : cur === MOON ? SUN : EMPTY) : (cur === EMPTY ? SUN : cur === SUN ? MOON : EMPTY);
    setCell(i, next);
  }
  function afterMove() {
    buzz(8);
    closeHint();
    holdClashes();
    render(); saveGame(); checkWin();
    if (!game.solved) updateStatus();
  }
  function updateStatus() {
    const bad = visibleViolations();
    if (bad.length) { $('status').textContent = describeViolation(bad[0]); return; }
    const left = game.grid.filter((v) => !v).length;
    $('status').textContent = left ? `${left} square${left > 1 ? 's' : ''} to go.` : '';
  }
  function describeViolation(v) {
    if (v.kind === 'triple') return `Three ${PLURAL[v.v]} in a row in ${E.lineName(v.line)}.`;
    if (v.kind === 'count') return `${cap(E.lineName(v.line))} has ${v.cells.length} ${PLURAL[v.v]}, but only ${game.n / 2} fit.`;
    return v.clue.t === '=' ? 'Those two squares have an = sign, so they should match.' : 'Those two squares have a ≠ sign, so they should be opposites.';
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function undo() {
    if (!game.history.length || game.solved) return;
    const [i, v] = game.history.pop();
    game.grid[i] = v;
    closeHint(); holdClashes(); render(); saveGame(); updateStatus();
  }
  function clearBoard() {
    if (game.solved) return;
    if (!game.grid.some((v, i) => v && !game.givens[i])) return;
    if (!confirm('Clear your moves and start this puzzle over?')) return;
    game.grid = game.givens.slice(); game.history = [];
    closeHint(); render(); saveGame(); updateStatus();
  }
  function buzz(ms) { if (settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  /* ---------- Hints ---------- */
  function clearHintMarks() { cells.forEach((c) => c.classList.remove('why', 'target')); }
  function closeHint() {
    hintState = null;
    $('hintBox').hidden = true;
    $('game').classList.remove('hint-open');
    clearHintMarks();
  }
  function showHint(title, text, why, targets, action) {
    clearHintMarks();
    why.forEach((i) => cells[i].classList.add('why'));
    targets.forEach((i) => cells[i].classList.add('target'));
    $('hintTitle').textContent = title;
    $('hintText').textContent = text;
    $('hintDo').textContent = action ? action.label : 'Got it';
    hintState = action;
    $('hintBox').hidden = false;
    $('game').classList.add('hint-open');
  }
  function hint() {
    if (game.solved) return;
    const n = game.n;
    // 1. Anything visibly breaking a rule.
    const bad = E.violations(game.grid, n, game.clues);
    if (bad.length) {
      const v = bad[0], fix = v.cells.filter((i) => !game.givens[i]);
      let text;
      if (v.kind === 'triple') text = `These are three ${PLURAL[v.v]} in a row in ${E.lineName(v.line)}. No more than two of the same can sit side by side, so one of them needs to change.`;
      else if (v.kind === 'count') text = `${cap(E.lineName(v.line))} has ${v.cells.length} ${PLURAL[v.v]}. Each row and column gets exactly ${n / 2} of each, so one of these needs to change.`;
      else text = v.clue.t === '=' ? `The = sign between these squares means they must match, but right now they're different.` : `The ≠ sign between these squares means they must be opposites, but right now they're the same.`;
      showHint('Something to fix', text, [], fix.length ? fix : v.cells, null);
      return;
    }
    // 2. A square that doesn't fit the answer, even if no rule shows it yet.
    const wrong = game.grid.findIndex((v, i) => v && v !== game.solution[i]);
    if (wrong >= 0) {
      const v = game.grid[wrong];
      showHint('A step went off course',
        `Nothing is breaking a rule yet, but this ${NAME[v]} can't be right: following the rules from here would lead to a dead end later. It should be a ${NAME[3 - v]}.`,
        [], [wrong], { label: `Make it a ${NAME[3 - v]}`, cells: [wrong], v: 3 - v });
      return;
    }
    // 3. The next logical step, explained.
    const step = E.nextStep(game.grid, n, game.clues);
    if (!step) return;
    game.hints++;
    const what = step.cells.length > 1 ? `${step.cells.length} ${PLURAL[step.v]}` : `a ${NAME[step.v]}`;
    showHint(step.rule, step.text, step.why, step.cells, { label: `Place ${what}`, cells: step.cells, v: step.v });
    saveGame();
  }
  function runHintAction() {
    const a = hintState;
    closeHint();
    if (!a) return;
    for (const i of a.cells) if (!game.givens[i] && game.grid[i] !== a.v) { game.history.push([i, game.grid[i]]); game.grid[i] = a.v; }
    afterMove();
  }

  /* ---------- Winning ---------- */
  function checkWin() {
    if (game.grid.some((v) => !v)) return;
    if (E.violations(game.grid, game.n, game.clues).length) return;
    if (!game.grid.every((v, i) => v === game.solution[i])) return;
    game.solved = true;
    stopTimer(); recordWin(); render(); saveGame();
    $('board').classList.add('solved');
    $('status').textContent = 'Solved!';
    buzz(30);
    setTimeout(showWin, 700);
  }
  function recordWin() {
    stats.solved++;
    if (!game.hints && (!stats.best[game.n] || game.elapsed < stats.best[game.n])) stats.best[game.n] = game.elapsed;
    if (game.mode === 'daily' && stats.daily[game.dailyKey] == null) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      stats.streak = stats.lastDaily === todayKey(y) ? stats.streak + 1 : 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      stats.lastDaily = game.dailyKey;
      stats.daily[game.dailyKey] = game.elapsed;
    }
    store.set('stats', stats);
  }
  const WIN_LINES = ['Every row and column in balance.', 'The sky is all sorted.', 'Sun and moon, side by side.', 'A calm, clear sky.'];
  function showWin() {
    $('winTitle').textContent = game.mode === 'daily' ? "Today's sky is done!" : 'Perfect balance!';
    let t = WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)];
    if (settings.timer) t += ` Time: ${fmtTime(game.elapsed)}.`;
    $('winText').textContent = t;
    $('winNext').textContent = game.mode === 'daily' ? 'Free play' : 'Next puzzle';
    $('winDlg').showModal();
  }

  /* ---------- Timer (counts quietly, shown only if turned on) ---------- */
  function startTimer() {
    stopTimer(); showTime();
    if (game.solved) return;
    timerHandle = setInterval(() => { if (!document.hidden) { game.elapsed++; showTime(); } }, 1000);
  }
  function showTime() { $('timer').textContent = settings.timer && game ? fmtTime(game.elapsed) : ''; }
  function stopTimer() { if (timerHandle) clearInterval(timerHandle); timerHandle = null; }
  function saveGame() { if (game) store.set('current', game); }

  /* ---------- Keyboard ---------- */
  function setCursor(i) {
    if (cursor >= 0 && cells[cursor]) cells[cursor].classList.remove('cursor');
    cursor = i;
    if (i >= 0) cells[i].classList.add('cursor');
  }
  function onKey(e) {
    if ($('game').hidden || document.querySelector('dialog[open]')) return;
    const n = game.n;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const moves = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[k] != null) {
      e.preventDefault();
      if (cursor < 0) { setCursor(0); return; }
      const r = Math.floor(cursor / n), c = cursor % n;
      if ((k === 'ArrowLeft' && c === 0) || (k === 'ArrowRight' && c === n - 1) || (k === 'ArrowUp' && r === 0) || (k === 'ArrowDown' && r === n - 1)) return;
      setCursor(cursor + moves[k]);
      return;
    }
    if (k.toLowerCase() === 'h') { hint(); return; }
    if (k === 'Escape') { closeHint(); return; }
    if (cursor < 0) return;
    if (k === ' ' || k === 'Enter') { e.preventDefault(); tap(cursor); }
    else if (k.toLowerCase() === 's') setCell(cursor, SUN);
    else if (k.toLowerCase() === 'm') setCell(cursor, MOON);
    else if (k === 'Backspace' || k === 'Delete' || k === '0') setCell(cursor, EMPTY);
  }

  /* ---------- Stats ---------- */
  function openStats() {
    const rows = SIZES.map((s) => `<tr><td>${s.name}</td><td>${s.n} × ${s.n}</td><td>${stats.best[s.n] ? fmtTime(stats.best[s.n]) : '–'}</td></tr>`).join('');
    $('statsBody').innerHTML = `
      <div class="stat-grid">
        <div class="stat"><b>${stats.solved}</b><span>puzzles solved</span></div>
        <div class="stat"><b>${Object.keys(stats.daily).length}</b><span>daily skies done</span></div>
        <div class="stat"><b>${stats.streak}</b><span>days in a row</span></div>
        <div class="stat"><b>${stats.bestStreak}</b><span>longest run</span></div>
      </div>
      <table class="stat-table"><tr><th>Size</th><th></th><th>Best time (no hints)</th></tr>${rows}</table>`;
    $('statsDlg').showModal();
  }

  /* ---------- Look ---------- */
  function applyTheme() {
    const dark = isDark();
    document.documentElement.dataset.theme = dark ? 'night' : 'day';
    const color = dark ? '#121a33' : '#fbf3e4';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', color);
    document.querySelectorAll('.mode-btn').forEach((b) => {
      // Show what you'd switch to.
      b.innerHTML = dark
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
      b.setAttribute('aria-label', dark ? 'Switch to day' : 'Switch to night');
    });
    document.querySelectorAll('#appearance button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === settings.appearance)));
  }
  function setAppearance(mode) { settings.appearance = mode; store.set('settings', settings); applyTheme(); }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (settings.appearance === 'auto') applyTheme(); });

  function bindSettings() {
    const bind = (id, key, after) => {
      const el = $(id);
      el.checked = settings[key];
      el.onchange = () => { settings[key] = el.checked; store.set('settings', settings); if (after) after(); };
    };
    bind('optConflicts', 'conflicts', () => { if (game && !$('game').hidden) { render(); updateStatus(); } });
    bind('optHaptics', 'haptics');
    bind('optTimer', 'timer', () => { showTime(); renderHome(); });
    document.querySelectorAll('#appearance button').forEach((b) => { b.onclick = () => setAppearance(b.dataset.mode); });
  }

  /* ---------- Wiring ---------- */
  document.querySelectorAll('.mini.sun').forEach((m) => { m.innerHTML = SUN_SVG; });
  document.querySelectorAll('.mini.moon').forEach((m) => { m.innerHTML = MOON_SVG; });
  $('winDlg').querySelector('.win-sun').innerHTML = SUN_SVG;
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d && d.id !== 'winDlg') d.close(); });
  });
  $('dailyBtn').onclick = () => {
    const saved = store.get('current', null);
    if (saved && saved.mode === 'daily' && saved.dailyKey === todayKey()) openGame(saved);
    else startGame({ mode: 'daily' });
  };
  $('howBtn').onclick = () => $('howDlg').showModal();
  $('helpBtn').onclick = () => $('howDlg').showModal();
  $('statsBtn').onclick = openStats;
  $('settingsBtn').onclick = () => $('settingsDlg').showModal();
  $('backBtn').onclick = showHome;
  $('undoBtn').onclick = undo;
  $('hintBtn').onclick = hint;
  $('clearBtn').onclick = clearBoard;
  $('newBtn').onclick = () => {
    if (game.mode === 'daily') { showHome(); return; }
    if (!game.solved && game.grid.some((v, i) => v && !game.givens[i]) && !confirm('Start a new puzzle? This one will be set aside.')) return;
    startGame({ mode: 'free', size: game.n });
  };
  $('hintClose').onclick = closeHint;
  $('hintDo').onclick = runHintAction;
  $('winHome').onclick = () => { $('winDlg').close(); showHome(); };
  $('winNext').onclick = () => {
    $('winDlg').close();
    if (game.mode === 'daily') showHome(); else startGame({ mode: 'free', size: game.n });
  };
  document.querySelectorAll('.mode-btn').forEach((b) => { b.onclick = () => setAppearance(isDark() ? 'light' : 'dark'); });

  const board = $('board');
  board.addEventListener('click', (e) => {
    const c = e.target.closest('.cell');
    if (c) { setCursor(-1); tap(+c.dataset.i, false); }
  });
  board.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const c = e.target.closest('.cell');
    if (c) tap(+c.dataset.i, true);
  });
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', () => saveGame());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('resize', sizeSigns);

  applyTheme(); bindSettings(); renderHome();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
