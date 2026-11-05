(function () {
  'use strict';
  const E = window.BeachEngine;
  const $ = (id) => document.getElementById(id);

  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('bd-' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('bd-' + key, JSON.stringify(value)); } catch (e) { /* ignore */ } },
  };

  const COLOR_NAMES = ['coral', 'sunny yellow', 'teal', 'periwinkle blue', 'orchid pink', 'driftwood brown', 'seagrass green'];
  const SHELL_SVG = '<svg viewBox="0 0 100 100"><path d="M50 86 C24 84 10 62 14 42 C18 24 34 14 50 14 C66 14 82 24 86 42 C90 62 76 84 50 86Z" fill="var(--sand-0)" stroke="var(--ink)" stroke-width="3"/><path d="M50 84 L50 18 M50 84 L30 22 M50 84 L70 22 M50 84 L18 38 M50 84 L82 38" stroke="var(--ink)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M38 86 h24 l-4 8 h-16z" fill="var(--sand-1)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/></svg>';

  const settings = Object.assign({ appearance: 'auto', haptics: true, numbers: false }, store.get('settings', {}));
  const progress = Object.assign({ done: [] }, store.get('progress', {}));
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => settings.appearance === 'dark' || (settings.appearance === 'auto' && darkQuery && darkQuery.matches);

  let game = null;      // { level, start, tubes, extra, history, pours, hinted, won }
  let selected = -1;
  let hintMove = null;  // { a, b } while a hint is showing
  let statusTimer = 0;
  let busy = false;
  let animToken = 0;    // bumps when a pour animation is cut short by the next tap
  let plan = null;      // the rest of the solution the last hint came from     // true while a pour is animating

  const highest = () => progress.done.reduce((m, l) => Math.max(m, l), 0);
  const nextLevel = () => highest() + 1;
  const sandVar = (c) => `var(--sand-${c})`;
  const swatch = (c) => `<span class="swatch" style="--c:${sandVar(c)}"></span>`;
  const colorWord = (c) => `${swatch(c)} <b>${COLOR_NAMES[c]}</b>`;

  /* ---------- Sand grain texture (made once, so pages stay light) ---------- */
  function makeGrain() {
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const ctx = cv.getContext('2d'); const img = ctx.createImageData(64, 64);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 212 + Math.floor(Math.random() * 43);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      document.documentElement.style.setProperty('--grain', `url(${cv.toDataURL()})`);
    } catch (e) { /* plain color is fine */ }
  }

  /* ---------- Home ---------- */
  function renderHome() {
    const nl = nextLevel();
    const saved = store.get('current', null);
    const resume = saved && !saved.won;
    const lvl = resume ? saved.level : nl;
    $('playTitle').textContent = resume ? `Keep going: level ${lvl}` : `Play level ${lvl}`;
    $('playSub').textContent = `${E.colorsFor(lvl)} colors`;
    const show = Math.max(10, Math.ceil((nl + 1) / 5) * 5);
    const done = new Set(progress.done);
    let html = '';
    for (let l = 1; l <= show; l++) {
      const cls = ['lvl'];
      if (done.has(l)) cls.push('done');
      if (l === nl) cls.push('current');
      html += `<button class="${cls.join(' ')}" data-l="${l}" ${l > nl ? 'disabled' : ''} aria-label="Level ${l}">${l}</button>`;
    }
    $('levels').innerHTML = html;
  }

  function showHome() {
    saveGame(); closeHint(); selected = -1;
    $('game').hidden = true; $('home').hidden = false; renderHome();
  }

  /* ---------- Game ---------- */
  function startLevel(level) {
    const L = E.makeLevel(level);
    game = { level, start: L.tubes, tubes: L.tubes.map((t) => t.slice()), extra: false, history: [], pours: 0, hinted: false, won: false };
    openGame();
  }
  function openGame(saved) {
    if (saved) game = saved;
    selected = -1; hintMove = null;
    $('home').hidden = true; $('game').hidden = false;
    $('gameTitle').textContent = `Level ${game.level}`;
    corked = new Set(game.tubes.map((t, i) => (t.length && E.isDone(t) ? i : -1)));
    closeHint(); layout(); render(); updateStatus(); saveGame();
  }
  function saveGame() { if (game) store.set('current', game); }

  function snapshot() { return { tubes: game.tubes.map((t) => t.slice()), extra: game.extra, pours: game.pours }; }
  function pushHistory() { game.history.push(snapshot()); if (game.history.length > 300) game.history.shift(); }

  // Size the bottles to fit the screen, trying 1, 2 or 3 rows.
  function layout() {
    if (!game) return;
    const wrap = $('boardWrap');
    const W = Math.max(200, wrap.clientWidth - 8), H = Math.max(200, wrap.clientHeight - 16);
    const n = game.tubes.length;
    let best = null;
    for (let rows = 1; rows <= 3; rows++) {
      const cols = Math.ceil(n / rows);
      if (rows > 1 && Math.ceil(n / (rows - 1)) === cols) continue;
      const byW = W / (cols + 0.32 * (cols - 1));
      // tube height ≈ 3.62 × width, plus row gaps, tags and the lift space on top
      const byH = (H - 26 - rows * 28) / (rows * 3.62 + (rows - 1) * 0.7);
      const tw = Math.min(72, byW, byH);
      if (!best || tw > best.tw + 0.5) best = { rows, cols, tw };
    }
    const tw = Math.floor(best.tw);
    const b = $('board');
    b.style.setProperty('--cols', best.cols);
    b.style.setProperty('--tw', tw + 'px');
    b.style.setProperty('--gap', Math.round(tw * 0.32) + 'px');
    b.style.setProperty('--unit', Math.round(tw * 0.78) + 'px');
    b.style.setProperty('--neck', Math.round(tw * 0.5) + 'px');
  }

  let corked = new Set(); // bottles already showing a cork, so only new corks drop in
  function render() {
    const b = $('board');
    let html = '';
    const nowCorked = new Set();
    game.tubes.forEach((t, i) => {
      const cls = ['tube'];
      if (i === selected) cls.push('lifted');
      if (t.length && E.isDone(t)) { cls.push('done'); if (!corked.has(i)) cls.push('just-done'); nowCorked.add(i); }
      if (hintMove && hintMove.a === i) cls.push('why');
      if (hintMove && hintMove.b === i) cls.push('target');
      let layers = '';
      t.forEach((c, k) => {
        layers += sandDiv(c, k);
      });
      let tag = '';
      if (hintMove && hintMove.a === i) tag = '<span class="tag hint-tag">From</span>';
      else if (hintMove && hintMove.b === i) tag = '<span class="tag hint-tag">To</span>';
      else if (settings.numbers) tag = `<span class="tag">${i + 1}</span>`;
      const label = t.length ? `Bottle ${i + 1}: ${t.map((c) => COLOR_NAMES[c]).join(', ')} (bottom to top)` : `Bottle ${i + 1}: empty`;
      html += `<button class="${cls.join(' ')}" data-i="${i}" aria-label="${label}"><span class="rim"></span><span class="cork"></span><div class="glass">${layers}</div>${tag}</button>`;
    });
    b.innerHTML = html;
    corked = nowCorked;
    $('undoBtn').disabled = !game.history.length;
    $('tubeBtn').disabled = game.extra || game.won;
    $('gameSub').textContent = game.pours ? `${game.pours} pour${game.pours === 1 ? '' : 's'}` : `${E.colorsFor(game.level)} colors`;
  }
  const sandDiv = (c, k, extra) => `<div class="sand" style="--c:${sandVar(c)};background-position:0 ${-k * 37}px;${extra || ''}"></div>`;

  /* ---------- Pouring animation ----------
     The bottle lifts over the target, tips toward it, and a stream of loose grains
     falls from its mouth while the sand level drops in one bottle and rises in the other. */
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  function cssColor(c) {
    return getComputedStyle(document.documentElement).getPropertyValue(`--sand-${c}`).trim() || '#e8c070';
  }
  function shade(hex, amt) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    const n = parseInt(m[1], 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  async function animatePour(a, b, count, color, destBefore, token) {
    const stale = () => token !== animToken;
    const board = $('board');
    const src = board.children[a], dst = board.children[b];
    if (!src || !dst || reduceMotion) return;
    const br = board.getBoundingClientRect();
    const sr = src.getBoundingClientRect(), dr = dst.getBoundingClientRect();
    const unit = parseFloat(getComputedStyle(board).getPropertyValue('--unit')) || 40;
    const side = (sr.left + sr.width / 2) <= (dr.left + dr.width / 2) ? 1 : -1;

    // A floating copy of the source bottle does the pouring; the real one is hidden meanwhile.
    const fly = src.cloneNode(true);
    fly.classList.remove('lifted', 'why', 'target');
    fly.classList.add('flying');
    fly.removeAttribute('data-i');
    fly.querySelectorAll('.tag').forEach((t) => t.remove());
    Object.assign(fly.style, { left: (sr.left - br.left) + 'px', top: (sr.top - br.top) + 'px', width: sr.width + 'px', height: sr.height + 'px' });
    board.appendChild(fly);
    src.style.opacity = '0'; // stays tappable, so a quick next tap still lands on it

    // The mouth (top centre) ends up just above and slightly to the near side of the target's mouth.
    const mouthX = dr.left - br.left + dr.width / 2 - side * dr.width * 0.12;
    const mouthY = dr.top - br.top - unit * 0.35;
    const dx = mouthX - (sr.left - br.left + sr.width / 2);
    const dy = mouthY - (sr.top - br.top);
    const tilt = side * 112;
    const moveMs = 170, flowMs = 110 + 80 * count, fallMs = 110, backMs = 160;

    // As the bottle tips past level, its sand slides down toward the mouth. A spacer at the
    // bottom of the copy grows to push the layers there, and keeps growing as sand pours out.
    const flyGlass = fly.querySelector('.glass');
    const srcLen = game.history.length ? game.history[game.history.length - 1].tubes[a].length : count;
    const empty = Math.max(0, flyGlass.clientHeight - 3 - srcLen * unit - 2);
    flyGlass.insertAdjacentHTML('afterbegin', '<div class="spacer" style="height:0px"></div>');
    const spacer = flyGlass.firstElementChild;

    await nextFrame();
    spacer.style.transition = `height ${moveMs}ms ease-in ${moveMs * 0.35}ms`;
    spacer.style.height = empty + 'px';
    fly.style.transition = `transform ${moveMs}ms cubic-bezier(.45,.05,.3,1)`;
    fly.style.transform = `translate(${dx}px, ${dy}px) rotate(${tilt}deg)`;
    await wait(moveMs - 30);
    if (stale()) return;

    // Sand leaves the tipped bottle...
    const flyLayers = [...fly.querySelectorAll('.sand')].slice(-count);
    flyLayers.forEach((el) => { el.style.transition = `height ${flowMs}ms linear`; el.style.height = '0px'; });
    spacer.style.transition = `height ${flowMs}ms linear`;
    spacer.style.height = (empty + count * unit) + 'px';
    // ...and builds up in the target a moment later.
    const glass = dst.querySelector('.glass');
    const added = [];
    for (let i = 0; i < count; i++) {
      glass.insertAdjacentHTML('beforeend', sandDiv(color, destBefore + i, 'height:0px'));
      added.push(glass.lastElementChild);
    }
    void glass.offsetHeight;
    added.forEach((el) => { el.style.transition = `height ${flowMs}ms linear ${fallMs * 0.6}ms`; el.style.height = unit + 'px'; });

    // Falling grains, drawn on a canvas over the board.
    const surface0 = dr.bottom - br.top - 5 - destBefore * unit;
    await grains({ x: mouthX, y: mouthY + 2, surface0, rise: count * unit, flowMs, fallMs, color: cssColor(color), side, stale });
    if (stale()) return;

    fly.style.transition = `transform ${backMs}ms cubic-bezier(.45,.05,.3,1)`;
    fly.style.transform = 'none';
    spacer.style.transition = `height ${backMs * 0.8}ms ease-out`;
    spacer.style.height = '0px';
    await wait(backMs);
  }

  function grains(o) {
    return new Promise((resolve) => {
      const board = $('board');
      const cv = document.createElement('canvas');
      const W = board.clientWidth, H = board.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = W * dpr; cv.height = H * dpr; cv.className = 'grain-canvas';
      board.appendChild(cv);
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      const tones = [o.color, shade(o.color, -28), shade(o.color, 22), shade(o.color, -12)];
      const parts = [];
      const t0 = performance.now();
      let last = t0;
      function frame(now) {
        const dt = Math.min(32, now - last) / 16.7; last = now;
        const el = now - t0;
        const flowing = el < o.flowMs;
        // The stream starts thin, swells, and thins out again at the end.
        const k = flowing ? Math.sin(Math.PI * Math.min(1, el / o.flowMs)) : 0;
        const spawn = flowing ? Math.round((8 + 14 * k) * dt) : 0;
        const wob = Math.sin(el / 50) * 1.2;
        for (let i = 0; i < spawn; i++) {
          parts.push({
            x: o.x + wob + (Math.random() - .5) * (1.5 + 2.5 * k),
            y: o.y + Math.random() * 3,
            vx: o.side * (0.25 + Math.random() * 0.35) * (1 - el / o.flowMs) + (Math.random() - .5) * 0.15,
            vy: 1.6 + Math.random() * 1.2,
            s: 1.1 + Math.random() * 1.5,
            c: tones[(Math.random() * tones.length) | 0],
          });
        }
        // The landing spot rises as the target fills.
        const fill = Math.max(0, Math.min(1, (el - o.fallMs * 0.6) / o.flowMs));
        const surface = o.surface0 - o.rise * fill;
        ctx.clearRect(0, 0, W, H);
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.vy += 0.85 * dt; p.vx *= 0.97;
          p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y >= surface - Math.random() * 3) {
            parts.splice(i, 1);
            continue;
          }
          ctx.fillStyle = p.c;
          ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s * 1.2);
        }
        // A soft puff where the grains land.
        if (flowing && el > o.fallMs * 0.5) {
          ctx.globalAlpha = 0.35 * k;
          ctx.fillStyle = o.color;
          ctx.beginPath(); ctx.ellipse(o.x, surface - 1, 4 + 4 * k, 2, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (o.stale()) { cv.remove(); resolve(); }
        else if (flowing || parts.length) requestAnimationFrame(frame);
        else { cv.remove(); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  function buzz(ms) { if (settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  function say(text, delay) {
    clearTimeout(statusTimer);
    if (delay) { statusTimer = setTimeout(() => { $('status').innerHTML = text; }, delay); }
    else $('status').innerHTML = text;
  }

  function tap(i) {
    if (busy) finishNow();
    if (!game || game.won) return;
    const t = game.tubes[i];
    if (!t) return;
    if (selected === -1) {
      if (!t.length) { say('That bottle is empty. Pick one with sand in it first.'); return; }
      if (E.isDone(t)) { say(`That bottle is all ${COLOR_NAMES[t[0]]} and finished. Nice!`); return; }
      selected = i; buzz(5); render(); say(`Now tap where the ${colorWord(t[t.length - 1])} should go.`);
      return;
    }
    if (selected === i) { selected = -1; render(); updateStatus(); return; }
    const n = E.pourAmount(game.tubes, selected, i);
    if (n) { doPour(selected, i); return; }
    // Not a valid pour: gently explain, and pick up the tapped bottle instead if it has sand.
    const src = game.tubes[selected];
    const c = src[src.length - 1];
    let why;
    if (t.length >= E.CAP) why = 'That bottle is already full.';
    else why = `The top of that bottle is ${colorWord(t[t.length - 1])}, so ${COLOR_NAMES[c]} can't go on it.`;
    if (t.length && !E.isDone(t)) {
      selected = i; render();
      say(`${why} I picked that bottle up instead.`);
    } else { selected = -1; render(); say(why); }
  }

  async function doPour(a, b) {
    if (busy) finishNow();
    closeHint();
    pushHistory();
    const destBefore = game.tubes[b].length;
    const r = E.pour(game.tubes, a, b);
    game.tubes = r.tubes; game.pours++;
    selected = -1;
    saveGame();
    buzz(12);
    busy = true;
    const token = ++animToken;
    say('');
    try { await animatePour(a, b, r.count, r.color, destBefore, token); } catch (e) { /* drawing problems never block play */ }
    if (token !== animToken) return; // a newer tap already took over
    afterPour();
  }
  function afterPour() {
    busy = false;
    render();
    if (E.isWon(game.tubes)) { win(); return; }
    updateStatus();
  }
  // Jump straight to the end of a running pour so the next tap acts right away.
  function finishNow() {
    if (!busy) return;
    animToken++;
    document.querySelectorAll('.flying, .grain-canvas').forEach((el) => el.remove());
    afterPour();
  }

  function updateStatus() {
    if (!game) return;
    const t = game.tubes;
    const anyPour = t.some((_, a) => t.some((__, b) => E.pourAmount(t, a, b) > 0));
    if (!anyPour) { say('No pours left from here. Try <b>Undo</b>, or add a <b>Spare</b> bottle.', 600); return; }
    const done = t.filter((x) => x.length && E.isDone(x)).length;
    if (!game.pours) say('Tap a bottle to pick it up, then tap where to pour.');
    else if (done) say(`${done} of ${E.colorsFor(game.level)} colors sorted.`);
    else say('');
    // Quietly check whether this mix can still be finished (after a pause, never instantly).
    const snap = key();
    setTimeout(() => {
      if (!game || game.won || key() !== snap) return;
      if (!E.solve(game.tubes, 60000)) say('This mix has gotten tangled and can’t be sorted from here. Tap <b>Hint</b> and I’ll take you back, or add a <b>Spare</b> bottle.');
    }, 1500);
  }
  const key = () => game ? JSON.stringify(game.tubes) : '';

  function undo() {
    if (busy) finishNow();
    if (!game || !game.history.length || game.won) return;
    const s = game.history.pop();
    game.tubes = s.tubes; game.extra = s.extra; game.pours = s.pours;
    selected = -1; closeHint(); layout(); render(); updateStatus(); saveGame();
  }

  function addTube() {
    if (busy) finishNow();
    if (!game || game.extra || game.won) return;
    pushHistory();
    game.tubes.push([]); game.extra = true; selected = -1;
    closeHint(); layout(); render();
    say('Here’s a spare empty bottle for this level. Use it to park a color while you untangle the rest.');
    saveGame();
  }

  function restart() {
    if (busy) finishNow();
    if (!game || game.won) return;
    if (!game.history.length) return;
    pushHistory();
    game.tubes = game.start.map((t) => t.slice()); game.extra = false; game.pours = 0;
    selected = -1; closeHint(); layout(); render(); updateStatus(); saveGame();
    say('Back to the start. Undo brings your pours back if you change your mind.');
  }

  /* ---------- Hints ---------- */
  function hint() {
    if (busy) finishNow();
    if (!game || game.won) return;
    selected = -1;
    // Follow one solution plan while the player keeps to it, so hints never go in circles.
    const here = JSON.stringify(game.tubes);
    let sol;
    if (plan && plan.at === here) sol = plan.moves;
    else sol = E.solve(game.tubes);
    plan = null;
    if (sol && sol.length) {
      const after = E.pour(game.tubes, sol[0].a, sol[0].b);
      plan = { at: JSON.stringify(after.tubes), moves: sol.slice(1) };
    }
    if (!sol) {
      // Find the most recent point that can still be finished.
      let steps = 0;
      for (let i = game.history.length - 1; i >= 0; i--) {
        steps++;
        if (E.solve(game.history[i].tubes, 60000)) break;
      }
      hintMove = null; render();
      $('hintTitle').textContent = 'Let’s back up a little';
      const canExtra = !game.extra;
      $('hintText').innerHTML = `Right now there’s no way to finish: every free spot is blocked by a color that has nowhere to go. ` +
        (game.history.length ? `Going back ${steps} pour${steps === 1 ? '' : 's'} gets you to a mix that can still be sorted.` : '') +
        (canExtra ? ' A spare bottle would also give you room to move.' : '');
      $('hintDo').textContent = game.history.length ? `Take me back ${steps} pour${steps === 1 ? '' : 's'}` : 'Add a spare bottle';
      $('hintDo').onclick = () => {
        closeHint();
        if (!game.history.length) { addTube(); return; }
        for (let i = 0; i < steps; i++) { const s = game.history.pop(); game.tubes = s.tubes; game.extra = s.extra; game.pours = s.pours; }
        layout(); render(); updateStatus(); saveGame();
        say('Back to a mix that works. Tap <b>Hint</b> again any time.');
      };
      openHint();
      return;
    }
    if (!sol.length) return;
    const m = sol[0];
    hintMove = m; game.hinted = true;
    const src = game.tubes[m.a], dst = game.tubes[m.b];
    const c = src[src.length - 1];
    const n = E.pourAmount(game.tubes, m.a, m.b);
    const below = src[src.length - n - 1];
    const layers = n === 1 ? 'layer' : `${n} layers`;
    let text;
    if (dst.length) {
      const fills = E.uniform(dst) && dst.length + n === E.CAP;
      text = `Pour the ${colorWord(c)} ${n === 1 ? 'sand' : 'sand (' + layers + ')'} from the <b>From</b> bottle onto the ${COLOR_NAMES[c]} in the <b>To</b> bottle. Matching colors can stack, and `;
      if (fills) text += `that fills the bottle with only ${COLOR_NAMES[c]}, so it’s finished.`;
      else if (below !== undefined) text += `it uncovers the ${colorWord(below)} underneath so that can move next.`;
      else text += 'it empties the From bottle, giving you a free bottle to work with.';
    } else {
      text = `Pour the ${colorWord(c)} into the empty <b>To</b> bottle. Nothing on top of the other bottles matches it yet, so parking it there `;
      text += below !== undefined ? `uncovers the ${colorWord(below)} underneath, which can then join its match.` : 'frees up the From bottle.';
    }
    $('hintTitle').textContent = 'A good next pour';
    $('hintText').innerHTML = text;
    $('hintDo').textContent = 'Pour it for me';
    $('hintDo').onclick = () => { const mv = hintMove; closeHint(); if (mv) doPour(mv.a, mv.b); };
    render(); openHint();
  }
  function openHint() { $('hintBox').hidden = false; $('game').classList.add('hint-open'); say(''); }
  function closeHint() {
    $('hintBox').hidden = true; $('game').classList.remove('hint-open');
    if (hintMove) { hintMove = null; if (game && !$('game').hidden) render(); }
  }

  /* ---------- Win ---------- */
  function win() {
    game.won = true;
    if (!progress.done.includes(game.level)) progress.done.push(game.level);
    store.set('progress', progress);
    saveGame();
    say('All sorted!');
    $('winTitle').textContent = 'All sorted!';
    $('winText').textContent = `Level ${game.level} finished in ${game.pours} pours. Every bottle is one color.`;
    setTimeout(() => $('winDlg').showModal(), 450);
  }

  /* ---------- Look ---------- */
  function applyTheme() {
    const dark = isDark();
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#14262e' : '#eef5f3');
    document.querySelectorAll('.mode-btn').forEach((b) => {
      b.innerHTML = dark
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
      b.setAttribute('aria-label', dark ? 'Switch to Shoreline (light)' : 'Switch to Moonlit Bay (dark)');
    });
    document.querySelectorAll('#appearance button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === settings.appearance)));
  }
  function setAppearance(mode) { settings.appearance = mode; store.set('settings', settings); applyTheme(); }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (settings.appearance === 'auto') applyTheme(); });

  function bindSettings() {
    const bind = (id, k, after) => {
      const el = $(id);
      el.checked = settings[k];
      el.onchange = () => { settings[k] = el.checked; store.set('settings', settings); if (after) after(); };
    };
    bind('optHaptics', 'haptics');
    bind('optNumbers', 'numbers', () => { if (game && !$('game').hidden) render(); });
    document.querySelectorAll('#appearance button').forEach((b) => { b.onclick = () => setAppearance(b.dataset.mode); });
  }

  /* ---------- Wiring ---------- */
  $('winDlg').querySelector('.win-shell').innerHTML = SHELL_SVG;
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d && d.id !== 'winDlg') d.close(); });
  });
  $('playBtn').onclick = () => {
    const saved = store.get('current', null);
    if (saved && !saved.won) openGame(saved); else startLevel(nextLevel());
  };
  $('levels').addEventListener('click', (e) => {
    const b = e.target.closest('.lvl');
    if (!b || b.disabled) return;
    const l = +b.dataset.l;
    const saved = store.get('current', null);
    if (saved && !saved.won && saved.level === l) openGame(saved); else startLevel(l);
  });
  $('howBtn').onclick = () => $('howDlg').showModal();
  $('helpBtn').onclick = () => $('howDlg').showModal();
  $('settingsBtn').onclick = () => $('settingsDlg').showModal();
  $('backBtn').onclick = showHome;
  $('undoBtn').onclick = undo;
  $('hintBtn').onclick = hint;
  $('tubeBtn').onclick = addTube;
  $('restartBtn').onclick = restart;
  $('hintClose').onclick = closeHint;
  $('winHome').onclick = () => { $('winDlg').close(); showHome(); };
  $('winNext').onclick = () => { $('winDlg').close(); startLevel(game.level + 1); };
  document.querySelectorAll('.mode-btn').forEach((b) => { b.onclick = () => setAppearance(isDark() ? 'light' : 'dark'); });

  $('board').addEventListener('click', (e) => {
    const t = e.target.closest('.tube');
    if (t) tap(+t.dataset.i);
  });
  document.addEventListener('keydown', (e) => {
    if ($('game').hidden || document.querySelector('dialog[open]')) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) { tap(+e.key - 1); return; }
    if (e.key === '0') { tap(9); return; }
    if (e.key.toLowerCase() === 'h') hint();
    if (e.key.toLowerCase() === 'u') undo();
    if (e.key === 'Escape') { if (!$('hintBox').hidden) closeHint(); else if (selected !== -1) { selected = -1; render(); updateStatus(); } }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', () => saveGame());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  window.addEventListener('resize', () => { if (game && !$('game').hidden) { layout(); } });

  makeGrain(); applyTheme(); bindSettings(); renderHome();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    // When an update takes over, reload once so the new version shows right away
    // (progress is saved). Also look for updates whenever the app comes back to the front.
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
    });
  }
})();
