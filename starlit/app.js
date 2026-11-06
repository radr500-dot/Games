(function () {
  'use strict';
  const E = window.Engine, P = window.Pictures;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('sl-' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('sl-' + key, JSON.stringify(value)); } catch (e) { /* ignore */ } },
  };
  const settings = Object.assign({ appearance: 'auto', mistakes: true, autoX: true, haptics: true }, store.get('settings', {}));
  const progress = Object.assign({ done: {}, current: null, freeSeed: {}, freeCur: {} }, store.get('progress', {}));
  let saves = store.get('saves', {});
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => settings.appearance === 'dark' || (settings.appearance === 'auto' && darkQuery && darkQuery.matches);

  /* ---------- Puzzles ---------- */
  function picById(id) {
    const m = /^(\w+)-(\d+)$/.exec(id); if (!m) return null;
    const ci = P.CHAPTERS.findIndex((c) => c.id === m[1]); if (ci < 0) return null;
    const pic = P.CHAPTERS[ci].pictures[+m[2]]; if (!pic) return null;
    return { ci, index: +m[2], chapter: P.CHAPTERS[ci], pic };
  }
  function loadPuzzle(id) {
    const fm = /^free-(\d+)-(\d+)$/.exec(id);
    if (fm) {
      const size = +fm[1], seed = +fm[2];
      const { sol } = E.makeRandom(size, seed);
      return { id, kind: 'free', size, seed, sol, title: 'Stardust ' + seed, sub: `${size} × ${size}` };
    }
    const p = picById(id); if (!p) return null;
    return { id, kind: 'pic', ci: p.ci, index: p.index, sol: E.parse(p.pic.rows), name: p.pic.name, rows: p.pic.rows,
      title: `${p.chapter.name} ${p.index + 1}`, sub: p.chapter.size };
  }
  function picSvg(sol) {
    const h = sol.length, w = sol[0].length;
    let r = '';
    sol.forEach((row, y) => row.forEach((v, x) => { if (v) r += `<rect x="${x + .06}" y="${y + .06}" width=".88" height=".88" rx=".18"/>`; }));
    return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">${r}</svg>`;
  }

  /* ---------- Home ---------- */
  function renderHome() {
    const wrap = $('chapters'); wrap.innerHTML = '';
    P.CHAPTERS.forEach((ch) => {
      const doneCount = ch.pictures.filter((_, i) => progress.done[`${ch.id}-${i}`]).length;
      const h = document.createElement('h2'); h.className = 'section';
      h.innerHTML = `${ch.name} · ${ch.size} <span class="section-note">${doneCount} of ${ch.pictures.length} found</span>`;
      wrap.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'levels';
      ch.pictures.forEach((pic, i) => {
        const id = `${ch.id}-${i}`;
        const b = document.createElement('button'); b.className = 'lvl';
        if (progress.done[id]) { b.innerHTML = picSvg(E.parse(pic.rows)); b.setAttribute('aria-label', `${pic.name}, solved`); }
        else { b.textContent = i + 1; b.setAttribute('aria-label', `${ch.name} puzzle ${i + 1}`); if (saves[id]) b.classList.add('started'); }
        if (progress.current === id) b.classList.add('current');
        b.onclick = () => start(id);
        grid.appendChild(b);
      });
      wrap.appendChild(grid);
    });
    const sizes = $('sizes'); sizes.innerHTML = '';
    P.FREE.forEach((f) => {
      const b = document.createElement('button'); b.className = 'size-btn';
      b.innerHTML = `<b>${f.name}</b><span>${f.sub}</span>`;
      b.onclick = () => startFree(f.size);
      sizes.appendChild(b);
    });
    const cur = progress.current && !progress.done[progress.current] && saves[progress.current] ? loadPuzzle(progress.current) : null;
    $('resumeBtn').hidden = !cur;
    if (cur) { $('resumeSub').textContent = `${cur.title} · ${cur.sub}`; $('resumeBtn').onclick = () => start(cur.id); }
  }
  function startFree(size) {
    const curId = progress.freeCur[size];
    if (curId && saves[curId] && !progress.done[curId]) return start(curId);
    const seed = (progress.freeSeed[size] || 0) + 1;
    progress.freeSeed[size] = seed;
    const id = `free-${size}-${seed}`;
    progress.freeCur[size] = id;
    store.set('progress', progress);
    start(id);
  }
  function show(screen) {
    $('home').hidden = screen !== 'home'; $('game').hidden = screen !== 'game';
    if (screen === 'home') { renderHome(); window.scrollTo(0, 0); }
  }

  /* ---------- Game ---------- */
  let G = null; // current game
  let cellEls = [], rowClueEls = [], colClueEls = [];
  let wrongTimer = 0, cursor = null;

  function start(id) {
    const pz = loadPuzzle(id); if (!pz) return;
    const h = pz.sol.length, w = pz.sol[0].length;
    const clues = E.cluesFor(pz.sol);
    let state = Array.from({ length: h }, () => new Array(w).fill(0));
    const saved = saves[id];
    if (saved && saved.length === w * h && !progress.done[id]) state = state.map((row, r) => row.map((_, c) => +saved[r * w + c] || 0));
    G = Object.assign(pz, { w, h, clues, state, history: [], solved: false });
    progress.current = id; store.set('progress', progress);
    $('gameTitle').textContent = pz.title;
    $('gameSub').textContent = pz.sub;
    closeHint();
    say('');
    buildBoard();
    show('game');
    layout();
    refreshAll();
    if (!store.get('seenHow', false)) { store.set('seenHow', true); $('howDlg').showModal(); }
  }
  function save() {
    if (!G) return;
    if (G.solved) delete saves[G.id];
    else if (G.state.some((r) => r.some((v) => v))) saves[G.id] = G.state.map((r) => r.join('')).join('');
    else delete saves[G.id];
    store.set('saves', saves);
  }

  function buildBoard() {
    const board = $('board');
    board.innerHTML = ''; board.className = 'board';
    cellEls = []; rowClueEls = []; colClueEls = [];
    const { w, h, clues } = G;
    board.appendChild(Object.assign(document.createElement('div'), { className: 'corner' }));
    for (let c = 0; c < w; c++) {
      const d = document.createElement('div'); d.className = 'cclue';
      d.innerHTML = (clues.cols[c].length ? clues.cols[c] : [0]).map((n) => `<span>${n}</span>`).join('');
      board.appendChild(d); colClueEls.push(d);
    }
    for (let r = 0; r < h; r++) {
      const d = document.createElement('div'); d.className = 'rclue';
      d.innerHTML = (clues.rows[r].length ? clues.rows[r] : [0]).map((n) => `<span>${n}</span>`).join('');
      board.appendChild(d); rowClueEls.push(d);
      const rowEls = [];
      for (let c = 0; c < w; c++) {
        const e = document.createElement('div');
        let cls = 'cell';
        if (c === 0) cls += ' c0'; if (r === 0) cls += ' r0';
        if ((c + 1) % 5 === 0 || c === w - 1) cls += ' cb';
        if ((r + 1) % 5 === 0 || r === h - 1) cls += ' rb';
        if (r === 0 && c === 0) cls += ' tl'; if (r === 0 && c === w - 1) cls += ' tr';
        if (r === h - 1 && c === 0) cls += ' bl'; if (r === h - 1 && c === w - 1) cls += ' br';
        e.className = cls; e.dataset.r = r; e.dataset.c = c;
        board.appendChild(e); rowEls.push(e);
      }
      cellEls.push(rowEls);
    }
  }

  function layout() {
    if (!G || $('game').hidden) return;
    const wrap = $('boardWrap');
    const W = wrap.clientWidth - 4, H = wrap.clientHeight - 16;
    const { clues, w, h } = G;
    const rowUnits = Math.max(...clues.rows.map((cl) => { const a = cl.length ? cl : [0]; return a.join('').length * 0.31 + (a.length - 1) * 0.23; }));
    const colUnits = Math.max(...clues.cols.map((cl) => (cl.length || 1) * 0.55));
    let size = Math.min((W - 10) / (w + rowUnits), (H - 8) / (h + colUnits), 54);
    size = Math.max(14, Math.floor(size));
    const fs = Math.max(10, Math.round(size * 0.5));
    const rowW = Math.ceil(rowUnits * fs * 2) + 10;
    const colH = Math.ceil(colUnits * fs * 2) + 6;
    const board = $('board');
    board.style.gridTemplateColumns = `${rowW}px repeat(${w}, ${size}px)`;
    board.style.gridTemplateRows = `${colH}px repeat(${h}, ${size}px)`;
    board.style.fontSize = fs + 'px';
    board.style.setProperty('--cs', size + 'px');
  }

  /* ---------- Drawing ---------- */
  function lineFills(isRow, i) { return isRow ? G.state[i].map((v) => (v === 1 ? 1 : 0)) : G.state.map((r) => (r[i] === 1 ? 1 : 0)); }
  function sameClue(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
  function lineDone(isRow, i) { return sameClue(E.lineClue(lineFills(isRow, i)), isRow ? G.clues.rows[i] : G.clues.cols[i]); }
  function paintCell(r, c) {
    const e = cellEls[r][c], v = G.state[r][c];
    e.classList.toggle('f', v === 1); e.classList.toggle('x', v === 2);
    const ok = (v === 1) === !!G.sol[r][c] || v === 0;
    if (ok || (v === 2 && !G.sol[r][c])) e.classList.remove('wrong');
  }
  function refreshClues() {
    for (let r = 0; r < G.h; r++) rowClueEls[r].classList.toggle('done', lineDone(true, r));
    for (let c = 0; c < G.w; c++) colClueEls[c].classList.toggle('done', lineDone(false, c));
  }
  function refreshAll() {
    for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) paintCell(r, c);
    refreshClues(); scheduleWrong(true); updateTools();
  }
  function scheduleWrong(now) {
    clearTimeout(wrongTimer);
    const run = () => {
      if (!G) return;
      for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) {
        const v = G.state[r][c];
        const bad = settings.mistakes && !G.solved && ((v === 1 && !G.sol[r][c]) || (v === 2 && G.sol[r][c]));
        cellEls[r][c].classList.toggle('wrong', bad);
      }
    };
    if (now) run(); else wrongTimer = setTimeout(run, 1500);
  }
  function updateTools() { $('undoBtn').disabled = !G.history.length || G.solved; $('hintBtn').disabled = G.solved; $('clearBtn').disabled = G.solved; }
  function buzz(ms) { if (settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  function say(t) { $('status').textContent = t; }

  // A "stroke" collects changes so one Undo takes it all back.
  let stroke = null;
  function beginStroke() { stroke = { changes: [], touchedRows: new Set(), touchedCols: new Set() }; }
  function setCell(r, c, v) {
    const prev = G.state[r][c]; if (prev === v) return;
    stroke.changes.push([r, c, prev]); G.state[r][c] = v;
    stroke.touchedRows.add(r); stroke.touchedCols.add(c);
    paintCell(r, c);
  }
  function endStroke() {
    const s = stroke; stroke = null;
    if (!s || !s.changes.length) return;
    if (settings.autoX) {
      stroke = s;
      // Only finish lines whose filled squares are all right, so a slip doesn't spread more wrong ✕s.
      const rowOk = (r) => G.state[r].every((v, c) => v !== 1 || G.sol[r][c]);
      const colOk = (c) => G.state.every((row, r) => row[c] !== 1 || G.sol[r][c]);
      s.touchedRows.forEach((r) => { if (lineDone(true, r) && rowOk(r)) for (let c = 0; c < G.w; c++) if (G.state[r][c] === 0) setCell(r, c, 2); });
      s.touchedCols.forEach((c) => { if (lineDone(false, c) && colOk(c)) for (let r = 0; r < G.h; r++) if (G.state[r][c] === 0) setCell(r, c, 2); });
      stroke = null;
    }
    G.history.push(s.changes);
    if (G.history.length > 300) G.history.shift();
    refreshClues(); scheduleWrong(false); updateTools(); save(); checkWin();
  }

  /* ---------- Touch and mouse ---------- */
  let mode = 'fill';
  function setMode(m) {
    mode = m;
    $('modeFill').classList.toggle('on', m === 'fill'); $('modeMark').classList.toggle('on', m === 'mark');
    $('modeFill').setAttribute('aria-pressed', String(m === 'fill')); $('modeMark').setAttribute('aria-pressed', String(m === 'mark'));
  }
  let drag = null;
  function cellFromPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.classList && el.classList.contains('cell') ? [+el.dataset.r, +el.dataset.c] : null;
  }
  function onDown(e) {
    if (!G || G.solved) return;
    const cell = cellFromPoint(e.clientX, e.clientY); if (!cell) return;
    e.preventDefault();
    if (!$('hintBox').hidden) closeHint();
    const m = e.button === 2 ? 'mark' : mode;
    const [r, c] = cell;
    const from = G.state[r][c];
    const target = m === 'fill' ? (from === 1 ? 0 : 1) : (from === 2 ? 0 : 2);
    drag = { r, c, from, target, axis: null, id: e.pointerId };
    beginStroke(); setCell(r, c, target); buzz(8);
    cursor = null; clearCursor();
    try { $('board').setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const cell = cellFromPoint(e.clientX, e.clientY); if (!cell) return;
    let [r, c] = cell;
    if (r === drag.r && c === drag.c) return;
    if (!drag.axis) drag.axis = Math.abs(r - drag.r) >= Math.abs(c - drag.c) ? 'col' : 'row';
    if (drag.axis === 'row') r = drag.r; else c = drag.c;
    const r0 = Math.min(r, drag.r), r1 = Math.max(r, drag.r), c0 = Math.min(c, drag.c), c1 = Math.max(c, drag.c);
    let changed = false;
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
      if (G.state[y][x] === drag.from) { setCell(y, x, drag.target); changed = true; }
    }
    if (changed) buzz(5);
  }
  function onUp(e) { if (!drag || (e && e.pointerId !== drag.id)) return; drag = null; endStroke(); }

  function undo() {
    if (!G || !G.history.length || G.solved) return;
    const ch = G.history.pop();
    for (let i = ch.length - 1; i >= 0; i--) { const [r, c, v] = ch[i]; G.state[r][c] = v; paintCell(r, c); }
    closeHint(); refreshClues(); scheduleWrong(false); updateTools(); save();
  }
  function clearAll() {
    G.state = G.state.map((r) => r.map(() => 0)); G.history = [];
    closeHint(); refreshAll(); save(); say('A fresh start.');
  }

  /* ---------- Keyboard (computer) ---------- */
  function clearCursor() { document.querySelectorAll('.cell.cursor').forEach((e) => e.classList.remove('cursor')); }
  function showCursor() { clearCursor(); if (cursor) cellEls[cursor[0]][cursor[1]].classList.add('cursor'); }
  function keyAct(target) {
    if (!cursor || G.solved) return;
    const [r, c] = cursor; beginStroke();
    const v = G.state[r][c];
    setCell(r, c, target === null ? 0 : (v === target ? 0 : target)); endStroke();
  }
  document.addEventListener('keydown', (e) => {
    if (!G || $('game').hidden || document.querySelector('dialog[open]')) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[k]) {
      e.preventDefault();
      if (!cursor) cursor = [0, 0];
      else cursor = [Math.max(0, Math.min(G.h - 1, cursor[0] + moves[k][0])), Math.max(0, Math.min(G.w - 1, cursor[1] + moves[k][1]))];
      showCursor(); return;
    }
    if (k === ' ' || k === 'Enter' || k === 'f' || k === 'F') { e.preventDefault(); keyAct(mode === 'mark' && (k === ' ' || k === 'Enter') ? 2 : 1); }
    else if (k === 'x' || k === 'X') keyAct(2);
    else if (k === 'Backspace' || k === 'Delete') keyAct(null);
    else if (k === 'Tab') { e.preventDefault(); setMode(mode === 'fill' ? 'mark' : 'fill'); }
    else if (k === 'h' || k === 'H') hint();
  });

  /* ---------- Hints ---------- */
  let hintState = null;
  function clearHintMarks() {
    document.querySelectorAll('.cell.hl, .cell.target, .rclue.hl, .cclue.hl').forEach((e) => e.classList.remove('hl', 'target'));
  }
  function closeHint() { hintState = null; clearHintMarks(); $('hintBox').hidden = true; $('game').classList.remove('hint-open'); }
  function openHint(title, text, btn) {
    $('hintTitle').textContent = title; $('hintText').textContent = text;
    $('hintDo').textContent = btn; $('hintDo').hidden = !btn;
    $('hintBox').hidden = false; $('game').classList.add('hint-open');
  }
  function highlightLine(isRow, idx) {
    if (isRow) { rowClueEls[idx].classList.add('hl'); cellEls[idx].forEach((e) => e.classList.add('hl')); }
    else { colClueEls[idx].classList.add('hl'); cellEls.forEach((row) => row[idx].classList.add('hl')); }
  }
  function hint() {
    if (!G || G.solved) return;
    if (hintState && hintState.stage === 1) return hintStep();
    clearHintMarks();
    const h = E.findHint(G.clues, G.state, G.sol);
    if (!h) return;
    hintState = { h, stage: 1 };
    if (h.kind === 'mistake') {
      h.cells.forEach(([r, c]) => cellEls[r][c].classList.add('target'));
      const one = h.cells.length === 1;
      const [r, c] = h.cells[0];
      const what = G.state[r][c] === 1 ? 'filled square isn\'t part of the picture' : '✕ is on a square that belongs to the picture';
      openHint(one ? 'One square to fix' : `${h.cells.length} squares to fix`,
        one ? `This ${what}. Fixing it first keeps the numbers honest, so the rest is easier to work out.`
          : `The outlined squares don't match the picture. Fixing them first keeps the numbers honest, so the rest is easier to work out.`,
        one ? 'Fix it' : 'Fix them');
      hintState.stage = 2;
    } else if (h.kind === 'line') {
      highlightLine(h.isRow, h.idx);
      openHint('A nudge', `Try ${h.name}, with the numbers ${h.clueText}. Some of its squares can be worked out right now.`, 'Show me which squares');
    } else {
      const [r, c] = h.cell;
      cellEls[r][c].classList.add('target');
      openHint('A free square', h.fill ? 'This square is part of the picture.' : 'This square stays empty.', h.fill ? 'Fill it in' : 'Mark it');
      hintState.stage = 2;
    }
  }
  function hintStep() {
    const { h } = hintState;
    if (hintState.stage === 1 && h.kind === 'line') {
      hintState.stage = 2;
      h.fill.forEach(([r, c]) => cellEls[r][c].classList.add('target'));
      h.empty.forEach(([r, c]) => cellEls[r][c].classList.add('target'));
      const btn = h.fill.length && h.empty.length ? 'Fill and mark them' : h.fill.length ? (h.fill.length === 1 ? 'Fill it in' : 'Fill them in') : (h.empty.length === 1 ? 'Mark it' : 'Mark them');
      openHint(`${h.name}`, h.why, btn);
      return;
    }
    // apply
    beginStroke();
    if (h.kind === 'mistake') h.cells.forEach(([r, c]) => setCell(r, c, 0));
    else if (h.kind === 'line') { h.fill.forEach(([r, c]) => setCell(r, c, 1)); h.empty.forEach(([r, c]) => setCell(r, c, 2)); }
    else setCell(h.cell[0], h.cell[1], h.fill ? 1 : 2);
    closeHint(); endStroke();
  }

  /* ---------- Win ---------- */
  function checkWin() {
    for (let r = 0; r < G.h; r++) for (let c = 0; c < G.w; c++) if ((G.state[r][c] === 1) !== !!G.sol[r][c]) return;
    G.solved = true;
    progress.done[G.id] = true; store.set('progress', progress);
    save(); closeHint(); updateTools(); scheduleWrong(true);
    $('board').classList.add('solved');
    buzz(30);
    const name = G.kind === 'pic' ? G.name : null;
    say(name ? `You found the ${name.toLowerCase()}!` : 'All the stardust is in place.');
    $('winPic').innerHTML = picSvg(G.sol);
    $('winTitle').textContent = name ? `You found the ${name.toLowerCase()}!` : 'Lovely pattern!';
    $('winText').textContent = name ? `${G.title} is solved.` : `${G.title} (${G.sub}) is solved.`;
    setTimeout(() => { if (G && G.solved && !$('game').hidden) $('winDlg').showModal(); }, 900);
  }
  function nextId() {
    if (G.kind === 'free') { progress.freeCur[G.size] = null; return null; }
    // next unsolved in this chapter, then later chapters, then anywhere
    const order = [];
    for (let k = 0; k < P.CHAPTERS.length; k++) {
      const c = P.CHAPTERS[(G.ci + k) % P.CHAPTERS.length];
      c.pictures.forEach((_, i) => { if (k > 0 || i > G.index) order.push(`${c.id}-${i}`); });
    }
    return order.find((id) => !progress.done[id]) || null;
  }

  /* ---------- Look ---------- */
  function applyTheme() {
    const dark = isDark();
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#161a2e' : '#eeedf6');
    document.querySelectorAll('.mode-btn').forEach((b) => {
      b.innerHTML = dark
        ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
      b.setAttribute('aria-label', dark ? 'Switch to Dawn (light)' : 'Switch to Midnight (dark)');
    });
    document.querySelectorAll('#appearance button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === settings.appearance)));
  }
  function setAppearance(m) { settings.appearance = m; store.set('settings', settings); applyTheme(); }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', () => { if (settings.appearance === 'auto') applyTheme(); });

  /* ---------- Wiring ---------- */
  const board = $('board');
  board.addEventListener('pointerdown', onDown);
  board.addEventListener('pointermove', onMove);
  board.addEventListener('pointerup', onUp);
  board.addEventListener('pointercancel', onUp);
  board.addEventListener('contextmenu', (e) => e.preventDefault());
  $('modeFill').onclick = () => setMode('fill');
  $('modeMark').onclick = () => setMode('mark');
  $('undoBtn').onclick = undo;
  $('hintBtn').onclick = hint;
  $('hintDo').onclick = hintStep;
  $('hintClose').onclick = closeHint;
  $('clearBtn').onclick = () => { if (G.state.some((r) => r.some((v) => v))) $('confirmDlg').showModal(); };
  $('confirmNo').onclick = () => $('confirmDlg').close();
  $('confirmYes').onclick = () => { $('confirmDlg').close(); clearAll(); };
  $('backBtn').onclick = () => { closeHint(); show('home'); };
  $('helpBtn').onclick = () => $('howDlg').showModal();
  $('howBtn').onclick = () => $('howDlg').showModal();
  $('winHome').onclick = () => { $('winDlg').close(); show('home'); };
  $('winNext').onclick = () => {
    $('winDlg').close();
    if (G.kind === 'free') { const size = G.size; progress.freeCur[size] = null; startFree(size); return; }
    const id = nextId();
    if (id) start(id); else startFree(10);
  };
  $('settingsBtn').onclick = () => $('settingsDlg').showModal();
  document.querySelectorAll('#appearance button').forEach((b) => { b.onclick = () => setAppearance(b.dataset.mode); });
  document.querySelectorAll('.mode-btn').forEach((b) => { b.onclick = () => setAppearance(isDark() ? 'light' : 'dark'); });
  const opt = (id, key, after) => { const el = $(id); el.checked = settings[key]; el.onchange = () => { settings[key] = el.checked; store.set('settings', settings); if (after) after(); }; };
  opt('optMistakes', 'mistakes', () => { if (G) scheduleWrong(true); });
  opt('optAutoX', 'autoX');
  opt('optHaptics', 'haptics');
  if (window.ResizeObserver) new ResizeObserver(() => layout()).observe($('boardWrap'));
  window.addEventListener('resize', layout);

  applyTheme();
  setMode('fill');
  show('home');
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
