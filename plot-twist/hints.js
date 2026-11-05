/* Plot Twist hint engine: finds the next logical step and explains it.
   Works on "what we know": squares that can still hold a piece (candidates)
   and pieces already placed. Each step says which rule it uses, which
   squares are the reason, and which squares it changes. */
(function (root) {
  'use strict';

  function makeBoard(n, regions) {
    const rows = [], cols = [], plots = [];
    for (let k = 0; k < n; k++) { rows.push([]); cols.push([]); plots.push([]); }
    for (let i = 0; i < n * n; i++) {
      rows[Math.floor(i / n)].push(i);
      cols[i % n].push(i);
      plots[regions[i]].push(i);
    }
    const groups = [];
    for (let k = 0; k < n; k++) groups.push({ type: 'plot', idx: k, cells: plots[k] });
    for (let k = 0; k < n; k++) groups.push({ type: 'row', idx: k, cells: rows[k] });
    for (let k = 0; k < n; k++) groups.push({ type: 'col', idx: k, cells: cols[k] });
    // Squares a piece at i rules out: its row, column, plot and the 8 touching squares.
    const zone = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, z = [];
      for (let j = 0; j < n * n; j++) {
        if (j === i) continue;
        const rr = Math.floor(j / n), cc = j % n;
        if (rr === r || cc === c || regions[j] === regions[i] || (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1)) z.push(j);
      }
      zone.push(z);
    }
    return { n, regions, rows, cols, plots, groups, zone };
  }

  function combos(arr, k, start, acc, out, limit) {
    if (out.length >= limit) return;
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = start; i < arr.length; i++) { acc.push(arr[i]); combos(arr, k, i + 1, acc, out, limit); acc.pop(); }
  }

  /* Find the next step. cand: array of 0/1, placed: array of 0/1.
     Returns { rule, place, eliminate[], reason[], data } or null. */
  function nextStep(B, cand, placed) {
    const { n, groups, zone } = B;
    const open = (cells) => cells.filter((i) => cand[i] && !placed[i]);
    const hasPiece = (cells) => cells.some((i) => placed[i]);

    // 1. A placed piece rules out its surroundings.
    for (let i = 0; i < n * n; i++) {
      if (!placed[i]) continue;
      const elim = zone[i].filter((j) => cand[j]);
      if (elim.length) return { rule: 'zone', place: -1, eliminate: elim, reason: [i], data: { cell: i } };
    }
    // 2. A plot, row or column with just one open square.
    for (const g of groups) {
      if (hasPiece(g.cells)) continue;
      const o = open(g.cells);
      if (o.length === 1) return { rule: 'single', place: o[0], eliminate: [], reason: g.cells, data: { group: g } };
    }
    // 3. A group whose open squares all sit in one line (or one plot) claims that line.
    const lineOf = (i, type) => (type === 'row' ? Math.floor(i / n) : type === 'col' ? i % n : B.regions[i]);
    const groupCells = (type, idx) => (type === 'row' ? B.rows[idx] : type === 'col' ? B.cols[idx] : B.plots[idx]);
    for (const g of groups) {
      if (hasPiece(g.cells)) continue;
      const o = open(g.cells);
      if (!o.length) continue;
      for (const t of ['row', 'col', 'plot']) {
        if (t === g.type) continue;
        const first = lineOf(o[0], t);
        if (!o.every((i) => lineOf(i, t) === first)) continue;
        const elim = groupCells(t, first).filter((j) => cand[j] && !placed[j] && !g.cells.includes(j));
        if (elim.length) return { rule: 'claim', place: -1, eliminate: elim, reason: o, data: { group: g, lineType: t, line: first } };
      }
    }
    // 4. A square that would leave some plot, row or column with no room.
    for (let i = 0; i < n * n; i++) {
      if (!cand[i] || placed[i]) continue;
      const z = new Set(zone[i]);
      for (const g of groups) {
        if (g.cells.includes(i) || hasPiece(g.cells)) continue;
        const o = open(g.cells);
        if (o.length && o.every((j) => z.has(j))) {
          return { rule: 'block', place: -1, eliminate: [i], reason: o, data: { cell: i, group: g } };
        }
      }
    }
    // 5. k plots squeezed into k rows (or columns), and the reverse.
    for (let k = 2; k <= Math.min(4, n - 2); k++) {
      for (const [aType, bType] of [['plot', 'row'], ['plot', 'col'], ['row', 'plot'], ['col', 'plot']]) {
        const free = groups.filter((g) => g.type === aType && !hasPiece(g.cells) && open(g.cells).length);
        const sets = [];
        combos(free, k, 0, [], sets, 4000);
        for (const set of sets) {
          const lines = new Set();
          for (const g of set) for (const i of open(g.cells)) lines.add(lineOf(i, bType));
          if (lines.size !== k) continue;
          const inside = new Set(set.flatMap((g) => g.cells));
          const elim = [];
          for (const L of lines) for (const j of groupCells(bType, L)) if (cand[j] && !placed[j] && !inside.has(j)) elim.push(j);
          if (elim.length) {
            return { rule: 'squeeze', place: -1, eliminate: elim, reason: set.flatMap((g) => open(g.cells)),
              data: { groups: set, lineType: bType, lines: [...lines].sort((a, b) => a - b) } };
          }
        }
      }
    }
    return null;
  }

  function apply(B, cand, placed, step) {
    if (step.place >= 0) placed[step.place] = 1;
    for (const j of step.eliminate) cand[j] = 0;
  }

  // Can the puzzle be finished with these steps alone (no guessing)?
  function solvableByLogic(n, regions) {
    const B = makeBoard(n, regions);
    const cand = new Array(n * n).fill(1), placed = new Array(n * n).fill(0);
    for (let guard = 0; guard < n * n * 4; guard++) {
      if (placed.reduce((a, b) => a + b, 0) === n) return true;
      const s = nextStep(B, cand, placed);
      if (!s) return false;
      apply(B, cand, placed, s);
    }
    return false;
  }

  const api = { makeBoard, nextStep, apply, solvableByLogic };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlotTwistHints = api;
})(typeof self !== 'undefined' ? self : this);
