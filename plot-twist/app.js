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

  // Visual themes. Each has its own piece; the rules never change.
  const svg = (inner) => `<svg class="piece" viewBox="-50 -50 100 100" aria-hidden="true">${inner}</svg>`;
  const flower = (() => {
    let petals = '';
    for (let i = 0; i < 5; i++) petals += `<ellipse class="pa" rx="17" ry="26" transform="rotate(${i * 72}) translate(0 -22)"/>`;
    return svg(`${petals}<circle class="pb" r="15"/>`);
  })();
  const starPath = (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 19 : 44, a = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a) + 3).toFixed(1)}`);
    }
    return pts.join(' ');
  })();
  // Light mode is the Garden, dark mode is the Night Sky. The rules never change.
  const THEMES = {
    garden: { piece: 'bloom', pieces: 'blooms', svg: flower, color: '#f5efe3',
      plots: ['green', 'orange', 'purple', 'yellow', 'blue', 'pink', 'mint', 'gray', 'lime', 'tan'] },
    night: { piece: 'star', pieces: 'stars', color: '#0f1526', svg: svg(`<polygon class="pa" points="${starPath}"/>`),
      plots: ['blue', 'violet', 'teal', 'rose', 'green', 'amber', 'slate', 'cyan', 'red', 'olive'] },
  };
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => settings.appearance === 'dark' || (settings.appearance === 'auto' && darkQuery && darkQuery.matches);
  const theme = () => (isDark() ? THEMES.night : THEMES.garden);
  const tapHint = () => `Tap once for an ✕, twice for a ${theme().piece}.`;

  const $ = (id) => document.getElementById(id);
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('pt-' + key); return v == null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem('pt-' + key, JSON.stringify(value)); } catch (e) { /* ignore */ } },
    del(key) { try { localStorage.removeItem('pt-' + key); } catch (e) { /* ignore */ } },
  };

  const settings = Object.assign({ appearance: 'auto', auto: false, conflicts: true, haptics: true, timer: false }, store.get('settings', {}));
  delete settings.theme; // from an earlier version
  // ?mode=dark or ?mode=light previews a look without saving it.
  try { const q = new URLSearchParams(location.search).get('mode'); if (q === 'dark' || q === 'light') settings.appearance = q; } catch (e) { /* ignore */ }
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
          try { resolve(window.PlotTwistEngine.generateCasual(size, seed, window.PlotTwistHints)); } catch (err) { reject(err); }
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
    closeHint();
    $('status').textContent = game.solved ? 'Solved! 🌼' : tapHint();
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
        el.innerHTML = v === BLOOM ? theme().svg : v === PEBBLE ? '<div class="mark"></div>' : '';
      }
      el.classList.toggle('clash', settings.conflicts && bad.has(i));
      el.setAttribute('aria-label', v === BLOOM ? theme().piece : v === PEBBLE ? 'not here' : 'empty');
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
    if (hintShown) closeHint();
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

  /* ---------- Hints that explain the logic ---------- */
  let hintShown = null; // { place, eliminate, cells }
  const cellName = (i) => `row ${Math.floor(i / game.size) + 1}, column ${(i % game.size) + 1}`;
  function groupName(g, cap) {
    const t = g.type === 'plot' ? `the ${theme().plots[g.idx % 10]} plot` : g.type === 'row' ? `row ${g.idx + 1}` : `column ${g.idx + 1}`;
    return cap ? t[0].toUpperCase() + t.slice(1) : t;
  }
  const lineName = (type, idx) => groupName({ type, idx });
  function listNames(arr) { return arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]; }

  function clearHintMarks() {
    cells.forEach((el) => el.classList.remove('why', 'target', 'hint'));
  }
  function closeHint() {
    hintShown = null;
    clearHintMarks();
    $('hintBox').hidden = true;
    $('status').hidden = false;
    $('game').classList.remove('hint-open');
  }
  function showHint(title, text, why, targets, action) {
    clearHintMarks();
    why.forEach((i) => cells[i].classList.add('why'));
    targets.forEach((i) => { cells[i].classList.remove('why'); cells[i].classList.add('target'); });
    hintShown = action || {};
    $('hintTitle').textContent = title;
    $('hintText').textContent = text;
    const doBtn = $('hintDo');
    doBtn.hidden = !action;
    if (action) doBtn.textContent = action.label;
    $('status').hidden = true;
    $('hintBox').hidden = false;
    $('game').classList.add('hint-open');
  }

  function hint() {
    if (game.solved) return;
    const n = game.size, M = game.marks, P = theme().piece, PS = theme().pieces;
    const sol = new Set(game.solution.map((c, r) => r * n + c));
    game.hints++;
    saveGame();

    // Mistakes first, explained with the rule they break when possible.
    const blooms = [];
    M.forEach((v, i) => { if (v === BLOOM) blooms.push(i); });
    for (let x = 0; x < blooms.length; x++) {
      for (let y = x + 1; y < blooms.length; y++) {
        const a = blooms[x], b = blooms[y];
        const ra = Math.floor(a / n), rb = Math.floor(b / n), ca = a % n, cb = b % n;
        let why = null;
        if (ra === rb) why = `both in row ${ra + 1}. Each row gets exactly one`;
        else if (ca === cb) why = `both in column ${ca + 1}. Each column gets exactly one`;
        else if (game.regions[a] === game.regions[b]) why = `both in ${groupName({ type: 'plot', idx: game.regions[a] })}. Each plot gets exactly one`;
        else if (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) why = 'touching. They need a square of space all around, even at the corners';
        if (why) return showHint('Two ' + PS + ' clash', `The highlighted ${PS} are ${why}. One of them has to go.`, [], [a, b], null);
      }
    }
    const wrong = M.findIndex((v, i) => v === BLOOM && !sol.has(i));
    if (wrong >= 0) {
      return showHint('Not quite', `The ${P} at ${cellName(wrong)} doesn't break a rule yet, but it isn't part of the answer, so it will block another ${P} later. Remove it and ask again.`,
        [], [wrong], { label: 'Remove it', run: () => applyChanges([{ i: wrong, from: BLOOM, to: EMPTY }]) });
    }
    const covered = M.findIndex((v, i) => v === PEBBLE && sol.has(i));
    if (covered >= 0) {
      return showHint('One ✕ is hiding a ' + P, `The ✕ at ${cellName(covered)} is covering a square that needs a ${P}. Clear it and ask again.`,
        [], [covered], { label: 'Clear it', run: () => applyChanges([{ i: covered, from: PEBBLE, to: EMPTY }]) });
    }

    // Logic: what we know is your pieces and your ✕ marks (all correct by now).
    const H = window.PlotTwistHints;
    const B = H.makeBoard(n, game.regions);
    const cand = M.map((v) => (v === PEBBLE ? 0 : 1));
    const placed = M.map((v) => (v === BLOOM ? 1 : 0));
    const step = H.nextStep(B, cand, placed);
    const markAll = (cellsToMark) => ({
      label: 'Mark them ✕',
      run: () => applyChanges(cellsToMark.filter((j) => M[j] === EMPTY).map((j) => ({ i: j, from: EMPTY, to: PEBBLE }))),
    });
    const placeIt = (i) => ({
      label: 'Place it',
      run: () => {
        const ch = [{ i, from: M[i], to: BLOOM }];
        if (settings.auto) ch.push(...autoPebbles(i));
        applyChanges(ch);
      },
    });

    if (!step) {
      // Rare: the next step needs trial and error. Give a piece for free.
      let best = -1, bestOpen = Infinity;
      for (const i of sol) {
        if (M[i] === BLOOM) continue;
        const open = game.regions.filter((reg, j) => reg === game.regions[i] && M[j] === EMPTY).length;
        if (open < bestOpen) { bestOpen = open; best = i; }
      }
      return showHint('A tricky spot', `There's no simple rule that settles the next move here, so here's a free ${P} to keep you going.`, [], [best], placeIt(best));
    }

    const d = step.data;
    switch (step.rule) {
      case 'zone':
        return showHint('Make room around your ' + P,
          `Rule: ${PS} can't share a row, column or plot, and can't touch, not even at the corners. Your ${P} at ${cellName(d.cell)} rules out every highlighted square.`,
          [d.cell], step.eliminate, markAll(step.eliminate));
      case 'single':
        return showHint('Only one square left',
          `Rule: every row, column and plot needs exactly one ${P}. ${groupName(d.group, true)} has just one open square left, so its ${P} must go there.`,
          d.group.cells.filter((i) => i !== step.place), [step.place], placeIt(step.place));
      case 'claim': {
        const where = lineName(d.lineType, d.line);
        const owner = groupName(d.group);
        return showHint(`${groupName(d.group, true)} claims ${where}`,
          `Every open square in ${owner} is inside ${where}. So ${owner}'s ${P} will land somewhere in ${where}, and since ${where} can only hold one ${P}, the other squares in ${where} can't have one.`,
          step.reason, step.eliminate, markAll(step.eliminate));
      }
      case 'block':
        return showHint('This square would block ' + groupName(d.group),
          `Imagine a ${P} at ${cellName(d.cell)}. It would rule out every open square left in ${groupName(d.group)} (they share its row, column or plot, or touch it), leaving ${groupName(d.group)} with nowhere to go. So this square gets an ✕.`,
          step.reason, step.eliminate, markAll(step.eliminate));
      case 'squeeze': {
        const k = d.groups.length;
        const names = listNames(d.groups.map((g) => groupName(g)));
        const lines = listNames(d.lines.map((L) => lineName(d.lineType, L)));
        const kind = d.lineType === 'plot' ? 'plots' : d.lineType + 's';
        return showHint(`${k} fit in ${k}`,
          `${names[0].toUpperCase() + names.slice(1)} only have open squares inside ${lines}. Those ${k} ${kind} must hold all ${k} of their ${PS}, which uses them up. So no other square in ${lines} can have a ${P}.`,
          step.reason, step.eliminate, markAll(step.eliminate));
      }
    }
  }

  function runHintAction() {
    if (!hintShown || !hintShown.run) return closeHint();
    hintShown.run();
    closeHint();
    afterMove();
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
    $('winDlg').querySelector('.win-flower').innerHTML = theme().svg;
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

  function applyTheme() {
    const dark = isDark(), t = theme();
    document.documentElement.dataset.theme = dark ? 'night' : 'garden';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', t.color));
    document.querySelectorAll('[data-word]').forEach((el) => { el.textContent = t[el.dataset.word]; });
    document.querySelectorAll('.mode-btn').forEach((b) => {
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.innerHTML = dark ? SUN : MOON;
    });
    document.querySelectorAll('#appearance button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === settings.appearance)));
    if (game && !$('game').hidden) {
      cells.forEach((el) => { el.dataset.v = 'x'; });
      render();
      if (!game.solved && !hintShown) $('status').textContent = tapHint();
    }
  }
  const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  function setAppearance(mode) {
    settings.appearance = mode;
    store.set('settings', settings);
    applyTheme();
  }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (settings.appearance === 'auto') applyTheme(); });

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
  $('hintDo').onclick = runHintAction;
  $('hintClose').onclick = closeHint;
  document.querySelectorAll('.mode-btn').forEach((b) => { b.onclick = () => setAppearance(isDark() ? 'light' : 'dark'); });
  document.querySelectorAll('#appearance button').forEach((b) => { b.onclick = () => setAppearance(b.dataset.mode); });
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
  window.addEventListener('pagehide', () => saveGame());
  // Stop iOS double-tap zoom and pinch gestures inside the app.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  applyTheme();
  bindSettings();
  renderHome();
  if (!store.get('seenHow', false)) { store.set('seenHow', true); $('howDlg').showModal(); }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Exposed for automated tests only.
  window.__plotTwist = { get game() { return game; }, tap: (i) => tap(i) };
})();
