/* Starlit engine: clues, a line solver, a whole-puzzle solver, hints and puzzle making.
   Cells: 0 = unknown, 1 = filled, 2 = empty (marked). Works in the browser and in Node. */
(function (root) {
  'use strict';

  /* ---------- Clues ---------- */
  function lineClue(cells) {
    const out = []; let run = 0;
    for (const v of cells) { if (v === 1) run++; else if (run) { out.push(run); run = 0; } }
    if (run) out.push(run);
    return out;
  }
  function cluesFor(sol) {
    const h = sol.length, w = sol[0].length;
    const rows = sol.map((r) => lineClue(r));
    const cols = [];
    for (let c = 0; c < w; c++) cols.push(lineClue(sol.map((r) => r[c])));
    return { rows, cols, w, h };
  }

  /* ---------- Line solver ----------
     For a line with known cells, find which unknown cells are filled (or empty)
     in every arrangement of the blocks that fits. Returns null if nothing fits. */
  function solveLine(clue, cells) {
    const n = cells.length, k = clue.length;
    // canEmpty/Fill prefix checks
    const filledBefore = new Int32Array(n + 1), emptyBefore = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) {
      filledBefore[i + 1] = filledBefore[i] + (cells[i] === 1 ? 1 : 0);
      emptyBefore[i + 1] = emptyBefore[i] + (cells[i] === 2 ? 1 : 0);
    }
    const noFilled = (a, b) => filledBefore[b] - filledBefore[a] === 0; // [a,b)
    const noEmpty = (a, b) => emptyBefore[b] - emptyBefore[a] === 0;
    // f[i][j]: can cells i.. be completed with blocks j.. (cell i is the start of free space)
    const f = []; for (let i = 0; i <= n + 1; i++) f.push(new Int8Array(k + 1).fill(-1));
    function can(i, j) {
      if (i > n) i = n + 1;
      if (i >= n) return j === k ? 1 : 0;
      if (f[i][j] !== -1) return f[i][j];
      let ok = 0;
      if (j === k) ok = noFilled(i, n) ? 1 : 0;
      else {
        // leave cell i empty
        if (cells[i] !== 1 && can(i + 1, j)) ok = 1;
        // place block j at i
        const L = clue[j];
        if (!ok && i + L <= n && noEmpty(i, i + L) && (i + L === n || cells[i + L] !== 1) && can(i + L + 1, j + 1)) ok = 1;
      }
      f[i][j] = ok; return ok;
    }
    if (!can(0, 0)) return null;
    const mayFill = new Int8Array(n), mayEmpty = new Int8Array(n);
    // forward walk over reachable states
    const seen = []; for (let i = 0; i <= n + 1; i++) seen.push(new Int8Array(k + 1));
    const stack = [[0, 0]]; seen[0][0] = 1;
    while (stack.length) {
      const [i, j] = stack.pop();
      if (i >= n) continue;
      if (j === k) { for (let t = i; t < n; t++) mayEmpty[t] = 1; continue; }
      if (cells[i] !== 1 && can(i + 1, j)) {
        mayEmpty[i] = 1;
        if (!seen[i + 1][j]) { seen[i + 1][j] = 1; stack.push([i + 1, j]); }
      }
      const L = clue[j];
      if (i + L <= n && noEmpty(i, i + L) && (i + L === n || cells[i + L] !== 1) && can(i + L + 1, j + 1)) {
        for (let t = i; t < i + L; t++) mayFill[t] = 1;
        if (i + L < n) mayEmpty[i + L] = 1;
        const ni = Math.min(i + L + 1, n + 1);
        if (!seen[ni][j + 1]) { seen[ni][j + 1] = 1; stack.push([ni, j + 1]); }
      }
    }
    const out = cells.slice();
    for (let i = 0; i < n; i++) {
      if (out[i] !== 0) continue;
      if (mayFill[i] && !mayEmpty[i]) out[i] = 1;
      else if (mayEmpty[i] && !mayFill[i]) out[i] = 2;
    }
    return out;
  }

  function getLine(grid, isRow, idx) { return isRow ? grid[idx].slice() : grid.map((r) => r[idx]); }
  function setLine(grid, isRow, idx, line) { line.forEach((v, i) => { if (isRow) grid[idx][i] = v; else grid[i][idx] = v; }); }

  /* Solve by line logic only. Returns { grid, solved, steps }. */
  function solve(clues, start) {
    const { w, h } = clues;
    const grid = start ? start.map((r) => r.slice()) : Array.from({ length: h }, () => new Array(w).fill(0));
    let changed = true, steps = 0;
    while (changed) {
      changed = false;
      for (const isRow of [true, false]) {
        const count = isRow ? h : w;
        for (let i = 0; i < count; i++) {
          const line = getLine(grid, isRow, i);
          if (!line.includes(0)) continue;
          const res = solveLine(isRow ? clues.rows[i] : clues.cols[i], line);
          if (!res) return { grid, solved: false, broken: true, steps };
          if (res.some((v, t) => v !== line[t])) { setLine(grid, isRow, i, res); changed = true; steps++; }
        }
      }
    }
    const solved = grid.every((r) => r.every((v) => v !== 0));
    return { grid, solved, steps };
  }

  /* ---------- Hints ----------
     Find the line where logic gives the most new squares right now. */
  function describe(isRow, idx, clue, line, res, n) {
    const name = (isRow ? 'Row ' : 'Column ') + (idx + 1);
    const clueText = clue.length ? clue.join(' · ') : '0';
    const newFill = [], newEmpty = [];
    res.forEach((v, i) => { if (line[i] === 0 && v === 1) newFill.push(i); if (line[i] === 0 && v === 2) newEmpty.push(i); });
    const known = line.filter((v) => v !== 0).length;
    const sum = clue.reduce((a, b) => a + b, 0);
    const minLen = sum + Math.max(0, clue.length - 1);
    const unit = isRow ? 'squares across' : 'squares down';
    let why;
    if (!clue.length) why = `${name} has a clue of 0, so none of its squares are filled. Every square in it can get an ✕.`;
    else if (line.filter((v) => v === 1).length === sum && newFill.length === 0) why = `${name} already has all ${sum} of its filled squares (${clueText}). Everything else in it must be empty, so those squares get an ✕.`;
    else if (known === 0 && clue.length === 1 && clue[0] === n) why = `${name} has a block of ${n}, and it has ${n} squares, so every square in it is filled.`;
    else if (known === 0 && minLen === n) why = `${name}'s clue ${clueText} needs exactly ${n} ${unit}, counting one gap between blocks. There's only one way to fit it, so the whole line is decided.`;
    else if (known === 0 && clue.length === 1) why = `${name} has one block of ${clue[0]} in ${n} squares. Slide it as far ${isRow ? 'left' : 'up'} as it goes, then as far ${isRow ? 'right' : 'down'}: the squares it covers both times are always filled.`;
    else if (known === 0) why = `${name}'s blocks ${clueText} take up at least ${minLen} of its ${n} squares, leaving only ${n - minLen} spare. Pushing all the blocks to one end and then the other, some squares are covered by the same block both times, so they're always filled.`;
    else if (newFill.length && !newEmpty.length) why = `Look at ${name} (clue ${clueText}) together with the squares you've already worked out. Every way the blocks can fit still fills ${newFill.length === 1 ? 'the outlined square' : 'the outlined squares'}.`;
    else if (newEmpty.length && !newFill.length) why = `Look at ${name} (clue ${clueText}) together with the squares you've already worked out. No block can reach ${newEmpty.length === 1 ? 'the outlined square' : 'the outlined squares'}, so ${newEmpty.length === 1 ? 'it gets' : 'they get'} an ✕.`;
    else why = `Look at ${name} (clue ${clueText}) together with the squares you've already worked out. However the blocks fit, some outlined squares are always filled and the others can never be reached.`;
    return { name, clueText, newFill, newEmpty, why };
  }

  /* state: player grid (0/1/2), sol: solution (1/0). */
  function findHint(clues, state, sol) {
    const { w, h } = clues;
    // 1) Mistakes first.
    const wrong = [];
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const v = state[r][c];
      if ((v === 1 && !sol[r][c]) || (v === 2 && sol[r][c])) wrong.push([r, c]);
    }
    if (wrong.length) return { kind: 'mistake', cells: wrong };
    // 2) Best line.
    let best = null;
    for (const isRow of [true, false]) {
      const count = isRow ? h : w;
      for (let i = 0; i < count; i++) {
        const line = getLine(state, isRow, i);
        if (!line.includes(0)) continue;
        const clue = isRow ? clues.rows[i] : clues.cols[i];
        const res = solveLine(clue, line);
        if (!res) continue;
        const gain = res.filter((v, t) => v !== line[t]).length;
        if (!gain) continue;
        const known = line.filter((v) => v !== 0).length;
        // Prefer lines that give filled squares, then bigger gains, then emptier lines (easier to see).
        const fills = res.filter((v, t) => v === 1 && line[t] === 0).length;
        const score = gain + fills * 0.5 - known * 0.05;
        if (!best || score > best.score) best = { score, isRow, idx: i, line, res, clue };
      }
    }
    if (best) {
      const n = best.isRow ? w : h;
      const d = describe(best.isRow, best.idx, best.clue, best.line, best.res, n);
      const toCell = (t) => (best.isRow ? [best.idx, t] : [t, best.idx]);
      return {
        kind: 'line', isRow: best.isRow, idx: best.idx, name: d.name, clueText: d.clueText, why: d.why,
        fill: d.newFill.map(toCell), empty: d.newEmpty.map(toCell),
      };
    }
    // 3) Fallback: reveal one filled square.
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (state[r][c] === 0) return { kind: 'reveal', cell: [r, c], fill: !!sol[r][c] };
    return null;
  }

  /* ---------- Puzzles ---------- */
  function parse(rows) { return rows.map((s) => s.split('').map((ch) => (ch === '#' ? 1 : 0))); }

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  /* A random "stardust" pattern that can be solved by logic alone. */
  function makeRandom(size, seed) {
    const rand = rng(seed * 2654435761 + size);
    for (let tries = 0; tries < 400; tries++) {
      const density = 0.52 + rand() * 0.12;
      const sol = Array.from({ length: size }, () => Array.from({ length: size }, () => (rand() < density ? 1 : 0)));
      // soften: avoid all-empty lines
      const clues = cluesFor(sol);
      if (clues.rows.some((c) => !c.length) || clues.cols.some((c) => !c.length)) continue;
      if (solve(clues).solved) return { sol, clues, tries };
    }
    // fall back to a simple solvable pattern
    const sol = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => ((r + c) % 3 ? 1 : 0)));
    return { sol, clues: cluesFor(sol) };
  }

  const api = { lineClue, cluesFor, solveLine, solve, findHint, parse, makeRandom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(this);
