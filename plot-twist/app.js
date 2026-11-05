/* Plot Twist: game screen, controls, saving and stats. */
(function () {
  'use strict';

  const SIZES = [
    { n: 6, name: 'Sprout' },
    { n: 7, name: 'Patch' },
    { n: 8, name: 'Garden' },
    { n: 9, name: 'Meadow' },
    { n: 10, name: 'Wilds' },
  ];
  const DAILY_SIZE = 8;
  const EMPTY = 0, PEBBLE = 1, BLOOM = 2;

  const BLOOM_SVG = (() => {
    let petals = '';
    for (let i = 0; i < 5; i++) {
      petals += `<ellipse class="petal" rx="17" ry="26" transform="rotate(${i * 72}) translate(0 -22)"/>`;
    }
    return `<svg class="bloom" viewBox="-50 -50 100 100" aria-hidden="true">${petals}<circle class="heart" r="15"/></svg>`;
  })();

  const $ = (id) => document.getElementById(id);
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('pt-' + key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem('pt-' + key, JSON.stringify(value)); } catch (e) { /* ignore */ } },
    del(key) { try { localStorage.removeItem('pt-' + key); } catch (e) { /* ignore */ } },
  };

  const settings = Object.assign({ auto: false, conflicts: true, haptics: true, timer: true }, store.get('settings', {}));
  const stats = Object.assign({ solved: 0, best: {}, daily: {}, streak: 0, bestStreak: 0, lastDaily: null }, store.get('stats', {}));

  let game = null;          // current game state
  let cells = [];           // cell elements
  let timerHandle = null;

  /* ---------- Puzzle generation (in a worker when possible) ---------- */
  let worker = null, reqId = 0;
  const pending = new Map();
  try {
    worker = new Worker('worker.js');
    worker.onmessage = (e) => {
      const cb = pending.get(e.data.id);
      if (cb) { pending.delete(e.data.id); cb(e.data); }
    };
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }

  function makePuzzle(size, seed) {
    return new Promise((resolve, reject) => {
      const done = (d) => (d.error ? reject(new Error(d.error)) : resolve(d.puzzle));
      if (worker) {
        const id = ++reqId;
        pending.set(id, done);
        worker.postMessage({ id, size, seed });
      } else {
        setTimeout(() => {
          try { resolve(window.PlotTwistEngine.generate(size, seed)); } catch (err) { reject(err); }
        }, 30);
      }
    });
  }

  /* ---------- Dates ---------- */
  function todayKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function seedFromKey(key) {
    let h = 2166136261;
    for (const ch of 'plot-twist:' + key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function fmtTime(s) {
    const m = Math.floor(s / 60), r = s % 60;
    return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
  }

  /* ---------- Screens ---------- */
  function showHome() {
    stopTimer();
    saveGame();
    $('game').hidden = true;
    $('home').hidden = false;
    renderHome();
  }

  function renderHome() {
    const key = todayKey();
    const doneToday = stats.daily[key];
    $('dailySub').textContent = doneToday
      ? `Done in ${fmtTime(doneToday)} · streak ${stats.streak} 🌼`
      : `${DAILY_SIZE} × ${DAILY_SIZE} · a new garden every day`;

    const wrap = $('sizes');
    wrap.innerHTML = '';
    for (const s of SIZES) {
      const b = document.createElement('button');
      b.className = 'size-btn';
      const best = stats.best[s.n];
      b.innerHTML = `<b>${s.name}</b><span>${s.n} × ${s.n}</span><span class="best">${best ? '★ ' + fmtTime(best) : ''}</span>`;
      b.onclick = () => startGame({ mode: 'free', size: s.n });
      wrap.appendChild(b);
    }

    const saved = store.get('current', null);
    const resume = $('resumeBtn');
    if (saved && !saved.solved && (saved.mode !== 'daily' || saved.dailyKey === key)) {
      resume.hidden = false;
      $('resumeSub').textContent = `${saved.title} · ${fmtTime(saved.elapsed)}`;
      resume.onclick = () => openGame(saved);
    } else {
      resume.hidden = true;
    }
  }

  async function startGame({ mode, size }) {
    const key = todayKey();
    if (mode === 'daily') {
      const saved = store.get('current', null);
      if (saved && saved.mode === 'daily' && saved.dailyKey === key) return openGame(saved);
    }
    $('home').hidden = true;
    $('game').hidden = false;
    $('board').innerHTML = '';
    $('board').classList.remove('solved');
    $('loading').hidden = false;
    $('status').textContent = '';
    const title = mode === 'daily' ? "Today's garden" : SIZES.find((s) => s.n === size).name;
    $('gameTitle').textContent = title;
    $('timer').textContent = '';
    try {
      const seed = mode === 'daily' ? seedFromKey(key) : undefined;
      const puzzle = await makePuzzle(size, seed);
      openGame({
        mode, title, dailyKey: mode === 'daily' ? key : null,
        size: puzzle.size, regions: puzzle.regions, solution: puzzle.solution,
        marks: new Array(puzzle.size * puzzle.size).fill(EMPTY),
        elapsed: 0, hints: 0, solved: false, history: [],
      });
    } catch (err) {
      $('loading').hidden = true;
      $('status').textContent = 'Something went wrong planting that garden. Tap New to try again.';
    }
  }

  function openGame(state) {
    game = state;
    game.history = game.history || [];
    $('home').hidden = true;
    $('game').hidden = false;
    $('loading').hidden = true;
    $('gameTitle').textContent = game.title;
    buildBoard();
    render();
    $('status').textContent = game.solved ? 'Solved! 🌼' : 'Tap once for a pebble, twice for a bloom.';
    saveGame();
    if (!game.solved) startTimer();
  }

  /* ---------- Board ---------- */
  function buildBoard() {
    const n = game.size, R = game.regions;
    const board = $('board');
    board.style.setProperty('--n', n);
    board.classList.toggle('solved', !!game.solved);
    board.innerHTML = '';
    cells = [];
    cursor = -1;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c, reg = R[i];
        const el = document.createElement('div');
        el.className = 'cell';
        el.dataset.i = i;
        el.setAttribute('role', 'gridcell');
        el.style.background = `var(--p${reg % 10})`;
        if (r > 0 && R[i - n] !== reg) el.classList.add('bt');
        if (c > 0 && R[i - 1] !== reg) el.classList.add('bl');
        if (r < n - 1 && R[i + n] !== reg) el.classList.add('bb');
        if (c < n - 1 && R[i + 1] !== reg) el.classList.add('br');
        board.appendChild(el);
        cells.push(el);
      }
    }
  }

  function clashes() {
    const n = game.size, M = game.marks, R = game.regions;
    const blooms = [];
    M.forEach((v, i) => { if (v === BLOOM) blooms.push(i); });
    const bad = new Set();
    for (let a = 0; a < blooms.length; a++) {
      for (let b = a + 1; b < blooms.length; b++) {
        const i = blooms[a], j = blooms[b];
        const ri = Math.floor(i / n), ci = i % n, rj = Math.floor(j / n), cj = j % n;
        if (ri === rj || ci === cj || R[i] === R[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) {
          bad.add(i); bad.add(j);
        }
      }
    }
    return { blooms, bad };
  }

  function render() {
    const { bad } = clashes();
    game.marks.forEach((v, i) => {
      const el = cells[i];
      const want = v === BLOOM ? 'b' : v === PEBBLE ? 'p' : '';
      if (el.dataset.v !== want) {
        el.dataset.v = want;
        el.innerHTML = v === BLOOM ? BLOOM_SVG : v === PEBBLE ? '<div class="pebble"></div>' : '';
      }
      el.classList.toggle('clash', settings.conflicts && bad.has(i));
      el.setAttribute('aria-label', v === BLOOM ? 'bloom' : v === PEBBLE ? 'pebble' : 'empty');
    });
    $('undoBtn').disabled = !game.history.length || game.solved;
    $('hintBtn').disabled = game.solved;
    $('clearBtn').disabled = game.solved;
  }

  /* ---------- Moves ---------- */
  function applyChanges(changes) {
    const real = changes.filter((ch) => ch.from !== ch.to);
    if (!real.length) return;
    real.forEach((ch) => { game.marks[ch.i] = ch.to; });
    game.history.push(real);
    if (game.history.length > 300) game.history.shift();
  }

  function autoPebbles(i) {
    const n = game.size, R = game.regions, M = game.marks;
    const r0 = Math.floor(i / n), c0 = i % n, out = [];
    for (let j = 0; j < n * n; j++) {
      if (j === i || M[j] !== EMPTY) continue;
      const r = Math.floor(j / n), c = j % n;
      if (r === r0 || c === c0 || R[j] === R[i] || (Math.abs(r - r0) <= 1 && Math.abs(c - c0) <= 1)) {
        out.push({ i: j, from: EMPTY, to: PEBBLE });
      }
    }
    return out;
  }

  function tap(i) {
    const from = game.marks[i];
    const to = from === EMPTY ? PEBBLE : from === PEBBLE ? BLOOM : EMPTY;
    const changes = [{ i, from, to }];
    if (to === BLOOM && settings.auto) changes.push(...autoPebbles(i));
    applyChanges(changes);
    buzz(to === BLOOM ? 15 : 6);
    afterMove();
  }

  function toggleBloom(i) {
    const from = game.marks[i];
    const to = from === BLOOM ? EMPTY : BLOOM;
    const changes = [{ i, from, to }];
    if (to === BLOOM && settings.auto) changes.push(...autoPebbles(i));
    applyChanges(changes);
    afterMove();
  }

  // Keyboard play on a computer: arrows move, Space cycles, B bloom, X pebble.
  let cursor = -1;
  function setCursor(i, show) {
    if (cursor >= 0 && cells[cursor]) cells[cursor].classList.remove('cursor');
    cursor = i;
    if (show && cells[i]) cells[i].classList.add('cursor');
  }
  function onKey(e) {
    if (!game || $('game').hidden || document.querySelector('dialog[open]')) return;
    const n = game.size, k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === 'z') { e.preventDefault(); undo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'u') return undo();
    if (k === 'h') return hint();
    if (game.solved) return;
    const moves = { arrowup: -n, arrowdown: n, arrowleft: -1, arrowright: 1 };
    if (k in moves) {
      e.preventDefault();
      if (cursor < 0) return setCursor(0, true);
      const r = Math.floor(cursor / n), c = cursor % n;
      const nr = Math.min(n - 1, Math.max(0, r + (k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0)));
      const nc = Math.min(n - 1, Math.max(0, c + (k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0)));
      return setCursor(nr * n + nc, true);
    }
    if (cursor < 0) return;
    if (k === ' ' || k === 'enter') { e.preventDefault(); tap(cursor); }
    else if (k === 'b') toggleBloom(cursor);
    else if (k === 'x' || k === '.') {
      const from = game.marks[cursor];
      applyChanges([{ i: cursor, from, to: from === PEBBLE ? EMPTY : PEBBLE }]);
      afterMove();
    } else if (k === 'backspace' || k === 'delete') {
      applyChanges([{ i: cursor, from: game.marks[cursor], to: EMPTY }]);
      afterMove();
    }
    if (cells[cursor]) cells[cursor].classList.add('cursor');
  }

  function afterMove() {
    render();
    checkWin();
    saveGame();
  }

  function buzz(ms) {
    if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  // Touch: a quick tap cycles one square; dragging paints (or erases) pebbles.
  let drag = null;
  function cellAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const cell = el && el.closest && el.closest('.cell');
    return cell ? Number(cell.dataset.i) : -1;
  }
  function onDown(e) {
    if (!game || game.solved) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    // Right-click on a computer: toggle a bloom straight away.
    if (e.button === 2) { toggleBloom(i); return; }
    setCursor(i, false);
    $('board').setPointerCapture && $('board').setPointerCapture(e.pointerId);
    drag = { start: i, last: i, moved: false, erase: game.marks[i] === PEBBLE, changes: [] };
  }
  function paint(i) {
    const from = game.marks[i];
    if (drag.erase ? from === PEBBLE : from === EMPTY) {
      const to = drag.erase ? EMPTY : PEBBLE;
      game.marks[i] = to;
      drag.changes.push({ i, from, to });
      render();
      buzz(4);
    }
  }
  function onMove(e) {
    if (!drag) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0 || i === drag.last) return;
    if (!drag.moved) { drag.moved = true; paint(drag.start); }
    drag.last = i;
    paint(i);
  }
  function onUp() {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) { tap(d.start); return; }
    // Changes were applied live; record them as one undo step.
    if (d.changes.length) { game.history.push(d.changes); }
    afterMove();
  }

  function undo() {
    if (!game.history.length || game.solved) return;
    const last = game.history.pop();
    for (let k = last.length - 1; k >= 0; k--) game.marks[last[k].i] = last[k].from;
    render();
    saveGame();
  }

  function clearBoard() {
    if (game.solved) return;
    const changes = [];
    game.marks.forEach((v, i) => { if (v !== EMPTY) changes.push({ i, from: v, to: EMPTY }); });
    applyChanges(changes);
    $('status').textContent = 'Fresh soil. Undo brings it all back.';
    afterMove();
  }

  function flash(i) {
    const el = cells[i];
    el.classList.remove('hint');
    void el.offsetWidth;
    el.classList.add('hint');
    setTimeout(() => el.classList.remove('hint'), 3700);
  }

  function hint() {
    if (game.solved) return;
    const n = game.size, sol = new Set(game.solution.map((c, r) => r * n + c));
    const M = game.marks;
    game.hints++;
    // 1) A bloom in the wrong place.
    const wrong = M.findIndex((v, i) => v === BLOOM && !sol.has(i));
    if (wrong >= 0) {
      flash(wrong);
      $('status').textContent = 'That flashing bloom is in the wrong spot.';
      return saveGame();
    }
    // 2) A pebble sitting on a bloom spot.
    const covered = M.findIndex((v, i) => v === PEBBLE && sol.has(i));
    if (covered >= 0) {
      flash(covered);
      $('status').textContent = 'A bloom belongs under that flashing pebble.';
      return saveGame();
    }
    // 3) Plant the bloom for the plot with the fewest open squares.
    let best = -1, bestOpen = Infinity;
    for (const i of sol) {
      if (M[i] === BLOOM) continue;
      const open = game.regions.filter((reg, j) => reg === game.regions[i] && M[j] === EMPTY).length;
      if (open < bestOpen) { bestOpen = open; best = i; }
    }
    if (best >= 0) {
      const changes = [{ i: best, from: M[best], to: BLOOM }];
      if (settings.auto) changes.push(...autoPebbles(best));
      applyChanges(changes);
      render();
      flash(best);
      $('status').textContent = 'Planted one bloom for you.';
      checkWin();
      saveGame();
    }
  }

  function checkWin() {
    const { blooms, bad } = clashes();
    if (blooms.length !== game.size || bad.size) return;
    const n = game.size;
    const ok = game.solution.every((c, r) => game.marks[r * n + c] === BLOOM);
    if (!ok) return;
    game.solved = true;
    stopTimer();
    // Clear leftover pebbles for a tidy finished garden.
    game.marks = game.marks.map((v) => (v === BLOOM ? BLOOM : EMPTY));
    render();
    $('board').classList.add('solved');
    $('status').textContent = 'Solved! 🌼';
    recordWin();
    saveGame();
    buzz(40);
    setTimeout(showWin, 700);
  }

  function recordWin() {
    stats.solved++;
    const t = game.elapsed;
    let isBest = false;
    if (game.mode === 'free' && game.hints === 0 && (!stats.best[game.size] || t < stats.best[game.size])) {
      stats.best[game.size] = t; isBest = true;
    }
    if (game.mode === 'daily' && !stats.daily[game.dailyKey]) {
      stats.daily[game.dailyKey] = t;
      const y = new Date(); y.setDate(y.getDate() - 1);
      stats.streak = stats.lastDaily === todayKey(y) ? stats.streak + 1 : 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
      stats.lastDaily = game.dailyKey;
    }
    store.set('stats', stats);
    game.newBest = isBest;
  }

  function showWin() {
    const lines = [`Finished in ${fmtTime(game.elapsed)}`];
    if (game.hints) lines.push(`${game.hints} hint${game.hints > 1 ? 's' : ''} used`);
    if (game.newBest) lines.push('New best time! ★');
    if (game.mode === 'daily') lines.push(`Daily streak: ${stats.streak} 🌼`);
    $('winTitle').textContent = game.mode === 'daily' ? "Today's garden is in bloom!" : 'Garden complete!';
    $('winText').innerHTML = lines.join('<br>');
    $('winNext').textContent = game.mode === 'daily' ? 'Free play' : 'Next garden';
    $('winDlg').querySelector('.win-flower').innerHTML = BLOOM_SVG;
    $('winDlg').showModal();
  }

  /* ---------- Timer & saving ---------- */
  function startTimer() {
    stopTimer();
    const show = () => { $('timer').textContent = settings.timer ? fmtTime(game.elapsed) : ''; };
    show();
    timerHandle = setInterval(() => {
      if (document.hidden || !game || game.solved || $('game').hidden) return;
      game.elapsed++;
      show();
      if (game.elapsed % 5 === 0) saveGame();
    }, 1000);
  }
  function stopTimer() { if (timerHandle) clearInterval(timerHandle); timerHandle = null; }
  function saveGame() { if (game) store.set('current', game); }

  /* ---------- Dialogs ---------- */
  function openStats() {
    const days = Object.keys(stats.daily).length;
    let rows = '';
    for (const s of SIZES) {
      rows += `<tr><td>${s.name} (${s.n}×${s.n})</td><td>${stats.best[s.n] ? fmtTime(stats.best[s.n]) : '—'}</td></tr>`;
    }
    $('statsBody').innerHTML = `
      <div class="stat-grid">
        <div class="stat"><b>${stats.solved}</b><span>gardens solved</span></div>
        <div class="stat"><b>${days}</b><span>daily gardens</span></div>
        <div class="stat"><b>${stats.streak}</b><span>current streak</span></div>
        <div class="stat"><b>${stats.bestStreak}</b><span>best streak</span></div>
      </div>
      <table class="stat-table"><tr><th>Size</th><th>Best time (no hints)</th></tr>${rows}</table>`;
    $('statsDlg').showModal();
  }

  function bindSettings() {
    const map = { optAuto: 'auto', optConflicts: 'conflicts', optHaptics: 'haptics', optTimer: 'timer' };
    for (const [id, key] of Object.entries(map)) {
      const box = $(id);
      box.checked = !!settings[key];
      box.onchange = () => {
        settings[key] = box.checked;
        store.set('settings', settings);
        if (game && !$('game').hidden) {
          render();
          $('timer').textContent = settings.timer ? fmtTime(game.elapsed) : '';
        }
      };
    }
  }

  // Tapping outside a sheet closes it.
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d && d.id !== 'winDlg') d.close(); });
  });

  /* ---------- Wire up ---------- */
  $('dailyBtn').onclick = () => startGame({ mode: 'daily', size: DAILY_SIZE });
  $('howBtn').onclick = $('helpBtn').onclick = () => $('howDlg').showModal();
  $('statsBtn').onclick = openStats;
  $('settingsBtn').onclick = () => $('settingsDlg').showModal();
  $('backBtn').onclick = showHome;
  $('undoBtn').onclick = undo;
  $('hintBtn').onclick = hint;
  $('clearBtn').onclick = clearBoard;
  $('newBtn').onclick = () => startGame({ mode: 'free', size: game && game.mode === 'free' ? game.size : DAILY_SIZE });
  $('winHome').onclick = () => { $('winDlg').close(); showHome(); };
  $('winNext').onclick = () => {
    $('winDlg').close();
    startGame({ mode: 'free', size: game.mode === 'daily' ? DAILY_SIZE : game.size });
  };

  const board = $('board');
  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  // Stop iOS double-tap zoom and pinch gestures inside the app.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  bindSettings();
  renderHome();
  if (!store.get('seenHow', false)) { store.set('seenHow', true); $('howDlg').showModal(); }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Exposed for automated tests only.
  window.__plotTwist = { get game() { return game; }, tap: (i) => tap(i) };
})();
