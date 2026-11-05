/* Daybreak engine: puzzle generation, a logic-only solver, and hints that explain themselves.
   Values: 0 = empty, 1 = sun, 2 = moon. Rules: each row and column holds the same number of suns
   and moons, never three of the same in a row, and = / ≠ signs mean "same" / "different". */
(function (root) {
  'use strict';
  const EMPTY = 0, SUN = 1, MOON = 2;
  const opp = (v) => 3 - v;
  const NAME = { 1: 'sun', 2: 'moon' };
  const PLURAL = { 1: 'suns', 2: 'moons' };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(a, r) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- Board geometry ---------- */
  const geoCache = {};
  function geo(n) {
    if (geoCache[n]) return geoCache[n];
    const lines = [];
    for (let r = 0; r < n; r++) { const l = []; for (let c = 0; c < n; c++) l.push(r * n + c); lines.push({ kind: 'row', num: r + 1, cells: l }); }
    for (let c = 0; c < n; c++) { const l = []; for (let r = 0; r < n; r++) l.push(r * n + c); lines.push({ kind: 'column', num: c + 1, cells: l }); }
    return (geoCache[n] = { n, lines });
  }
  const lineName = (line) => `${line.kind} ${line.num}`;
  const clueKey = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
  function clueMap(clues) { const m = new Map(); for (const c of clues) m.set(clueKey(c.a, c.b), c.t); return m; }

  /* ---------- Full solutions ---------- */
  function fullSolution(n, r) {
    const g = new Array(n * n).fill(EMPTY), half = n / 2;
    const rowCnt = [], colCnt = [];
    for (let i = 0; i < n; i++) { rowCnt.push([0, 0, 0]); colCnt.push([0, 0, 0]); }
    let steps = 0;
    function ok(i, v) {
      const row = Math.floor(i / n), col = i % n;
      if (rowCnt[row][v] >= half || colCnt[col][v] >= half) return false;
      if (col >= 2 && g[i - 1] === v && g[i - 2] === v) return false;
      if (row >= 2 && g[i - n] === v && g[i - 2 * n] === v) return false;
      return true;
    }
    function go(i) {
      if (i === n * n) return true;
      if (++steps > 200000) return false;
      const row = Math.floor(i / n), col = i % n;
      const order = r() < 0.5 ? [SUN, MOON] : [MOON, SUN];
      for (const v of order) {
        if (!ok(i, v)) continue;
        g[i] = v; rowCnt[row][v]++; colCnt[col][v]++;
        if (go(i + 1)) return true;
        g[i] = EMPTY; rowCnt[row][v]--; colCnt[col][v]--;
      }
      return false;
    }
    if (!go(0)) return null;
    return g;
  }

  /* ---------- Rule checks ---------- */
  // Problems in the current grid that anyone could see: three in a row, too many of one kind, a broken sign.
  function violations(grid, n, clues) {
    const out = [], half = n / 2;
    for (const line of geo(n).lines) {
      const cs = line.cells;
      for (let k = 0; k + 2 < cs.length; k++) {
        const v = grid[cs[k]];
        if (v && grid[cs[k + 1]] === v && grid[cs[k + 2]] === v) {
          out.push({ kind: 'triple', v, line, cells: [cs[k], cs[k + 1], cs[k + 2]] });
        }
      }
      for (const v of [SUN, MOON]) {
        const have = cs.filter((i) => grid[i] === v);
        if (have.length > half) out.push({ kind: 'count', v, line, cells: have });
      }
    }
    for (const c of clues) {
      const x = grid[c.a], y = grid[c.b];
      if (x && y && ((c.t === '=') !== (x === y))) out.push({ kind: 'sign', clue: c, cells: [c.a, c.b] });
    }
    return out;
  }

  /* ---------- Deductions ---------- */
  // Each finder returns deductions: { cells: [index], v, rule, why: [index], text, line? }
  function signSteps(grid, clues, n) {
    const out = [];
    for (const c of clues) {
      const x = grid[c.a], y = grid[c.b];
      if ((x && y) || (!x && !y)) continue;
      const known = x ? c.a : c.b, open = x ? c.b : c.a, kv = grid[known];
      const v = c.t === '=' ? kv : opp(kv);
      const text = c.t === '='
        ? `The = sign between these two squares means they match. One of them is already a ${NAME[kv]}, so the other must be a ${NAME[v]} too.`
        : `The ≠ sign between these two squares means they're opposites. One of them is a ${NAME[kv]}, so the other must be a ${NAME[v]}.`;
      out.push({ cells: [open], v, rule: c.t === '=' ? 'Same sign' : 'Opposite sign', why: [known], text });
    }
    return out;
  }
  function pairSteps(grid, n) {
    const out = [];
    for (const line of geo(n).lines) {
      const cs = line.cells;
      for (let k = 0; k + 1 < cs.length; k++) {
        const v = grid[cs[k]];
        if (!v || grid[cs[k + 1]] !== v) continue;
        const ends = [];
        if (k > 0 && !grid[cs[k - 1]]) ends.push(cs[k - 1]);
        if (k + 2 < cs.length && !grid[cs[k + 2]]) ends.push(cs[k + 2]);
        if (!ends.length) continue;
        out.push({
          cells: ends, v: opp(v), rule: 'No three in a row', why: [cs[k], cs[k + 1]], line,
          text: `Two ${PLURAL[v]} already sit side by side in ${lineName(line)}. Another ${NAME[v]} right next to them would make three in a row, so ${ends.length > 1 ? 'the squares on both ends have' : 'the square next to them has'} to be ${ends.length > 1 ? PLURAL[opp(v)] : 'a ' + NAME[opp(v)]}.`,
        });
      }
    }
    return out;
  }
  function gapSteps(grid, n) {
    const out = [];
    for (const line of geo(n).lines) {
      const cs = line.cells;
      for (let k = 0; k + 2 < cs.length; k++) {
        const v = grid[cs[k]];
        if (!v || grid[cs[k + 2]] !== v || grid[cs[k + 1]]) continue;
        out.push({
          cells: [cs[k + 1]], v: opp(v), rule: 'No three in a row', why: [cs[k], cs[k + 2]], line,
          text: `There's a ${NAME[v]} on both sides of this square in ${lineName(line)}. A ${NAME[v]} in the middle would make three in a row, so it must be a ${NAME[opp(v)]}.`,
        });
      }
    }
    return out;
  }
  function countSteps(grid, n) {
    const out = [], half = n / 2;
    for (const line of geo(n).lines) {
      const cs = line.cells, open = cs.filter((i) => !grid[i]);
      if (!open.length) continue;
      for (const v of [SUN, MOON]) {
        const have = cs.filter((i) => grid[i] === v);
        if (have.length !== half) continue;
        out.push({
          cells: open, v: opp(v), rule: 'Even split', why: have, line,
          text: `Every row and column gets exactly ${half} suns and ${half} moons. ${cap(lineName(line))} already has all ${half} of its ${PLURAL[v]}, so the ${open.length > 1 ? 'empty squares left in it must all be ' + PLURAL[opp(v)] : 'last empty square must be a ' + NAME[opp(v)]}.`,
        });
      }
    }
    return out;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function basicSteps(grid, n, clues) {
    return [].concat(signSteps(grid, clues, n), pairSteps(grid, n), gapSteps(grid, n), countSteps(grid, n));
  }

  /* ---------- Whole-line reasoning ---------- */
  // Every legal way to finish one line, given what's placed and the signs inside it.
  function lineCompletions(vals, inner, half, limit) {
    const n = vals.length, cur = vals.slice(), res = [];
    const cnt = [0, 0, 0];
    function go(k) {
      if (res.length >= limit) return;
      if (k === n) { if (cnt[SUN] === half && cnt[MOON] === half) res.push(cur.slice()); return; }
      const opts = vals[k] ? [vals[k]] : [SUN, MOON];
      for (const v of opts) {
        if (cnt[v] >= half) continue;
        if (k >= 2 && cur[k - 1] === v && cur[k - 2] === v) continue;
        if (k >= 1 && inner[k - 1] && ((inner[k - 1] === '=') !== (cur[k - 1] === v))) continue;
        cur[k] = v; cnt[v]++;
        go(k + 1);
        cnt[v]--; cur[k] = vals[k];
      }
    }
    go(0);
    return res;
  }
  function innerSigns(line, cm) {
    const s = [];
    for (let k = 0; k + 1 < line.cells.length; k++) s.push(cm.get(clueKey(line.cells[k], line.cells[k + 1])) || null);
    return s;
  }
  function lineSteps(grid, n, clues, cm, firstOnly) {
    const out = [], half = n / 2;
    for (const line of geo(n).lines) {
      const cs = line.cells, vals = cs.map((i) => grid[i]);
      if (!vals.includes(EMPTY)) continue;
      const inner = innerSigns(line, cm);
      const comps = lineCompletions(vals, inner, half, 100000);
      if (!comps.length) continue;
      for (let k = 0; k < cs.length; k++) {
        if (vals[k]) continue;
        const v = comps[0][k];
        if (comps.every((c) => c[k] === v)) {
          out.push(Object.assign({ cells: [cs[k]], v, rule: 'Think it through', line }, explainLine(grid, n, line, inner, k, v)));
          if (firstOnly) return out;
        }
      }
    }
    return out;
  }
  // Explain a whole-line deduction by trying the other symbol and following the simple rules until something breaks.
  function explainLine(grid, n, line, inner, k, v) {
    const half = n / 2, cs = line.cells, wrong = opp(v);
    const vals = cs.map((i) => grid[i]);
    vals[k] = wrong;
    const story = [];
    let broke = null;
    for (let guard = 0; guard < 40 && !broke; guard++) {
      broke = lineProblem(vals, inner, half);
      if (broke) break;
      const s = lineForce(vals, inner, half);
      if (!s) break;
      for (const p of s.pos) vals[p] = s.v;
      story.push(s.say);
    }
    const why = [];
    const head = `Try it the other way: suppose this square were a ${NAME[wrong]}.`;
    if (broke) {
      for (const p of broke.pos) why.push(cs[p]);
      let mid = '';
      if (story.length === 1) mid = ` Then ${story[0]}.`;
      else if (story.length === 2) mid = ` Then ${story[0]}, and ${story[1]}.`;
      else if (story.length > 2) mid = ` Then ${story[0]}, ${story[1]}, and the rest of ${lineName(line)} falls into place from there.`;
      return { why, text: `${head}${mid} That ends with ${broke.say(lineName(line))}, which breaks a rule. So it must be a ${NAME[v]}.` };
    }
    return {
      why: cs.filter((i, p) => p !== k && grid[i]),
      text: `${head} Then there's no way to finish ${lineName(line)} with ${half} of each and no three in a row${inner.some(Boolean) ? ' while keeping its signs' : ''}. Every way that works has a ${NAME[v]} here, so it must be a ${NAME[v]}.`,
    };
  }
  function lineProblem(vals, inner, half) {
    for (let k = 0; k + 2 < vals.length; k++) {
      const v = vals[k];
      if (v && vals[k + 1] === v && vals[k + 2] === v) return { pos: [k, k + 1, k + 2], say: (L) => `three ${PLURAL[v]} in a row in ${L}` };
    }
    for (const v of [SUN, MOON]) {
      const pos = []; vals.forEach((x, p) => { if (x === v) pos.push(p); });
      if (pos.length > half) return { pos, say: (L) => `${pos.length} ${PLURAL[v]} in ${L}, but only ${half} are allowed` };
    }
    for (let k = 0; k + 1 < vals.length; k++) {
      const s = inner[k], a = vals[k], b = vals[k + 1];
      if (s && a && b && ((s === '=') !== (a === b))) return { pos: [k, k + 1], say: (L) => `a ${s === '=' ? '=' : '≠'} sign in ${L} that no longer holds` };
    }
    return null;
  }
  function lineForce(vals, inner, half) {
    const L = vals.length;
    for (let k = 0; k + 1 < L; k++) {
      const s = inner[k], a = vals[k], b = vals[k + 1];
      if (s && (a ? !b : b)) {
        const known = a || b, v = s === '=' ? known : opp(known);
        return { pos: [a ? k + 1 : k], v, say: `the ${s === '=' ? '=' : '≠'} sign makes its neighbor a ${NAME[v]}` };
      }
    }
    for (let k = 0; k + 1 < L; k++) {
      const v = vals[k];
      if (!v || vals[k + 1] !== v) continue;
      const pos = [];
      if (k > 0 && !vals[k - 1]) pos.push(k - 1);
      if (k + 2 < L && !vals[k + 2]) pos.push(k + 2);
      if (pos.length) return { pos, v: opp(v), say: `the two ${PLURAL[v]} together force a ${NAME[opp(v)]} beside them` };
    }
    for (let k = 0; k + 2 < L; k++) {
      const v = vals[k];
      if (v && vals[k + 2] === v && !vals[k + 1]) return { pos: [k + 1], v: opp(v), say: `the gap between two ${PLURAL[v]} has to be a ${NAME[opp(v)]}` };
    }
    for (const v of [SUN, MOON]) {
      const c = vals.filter((x) => x === v).length, open = [];
      vals.forEach((x, p) => { if (!x) open.push(p); });
      if (c === half && open.length) return { pos: open, v: opp(v), say: `that makes ${half} ${PLURAL[v]}, so the rest of the open squares must be ${PLURAL[opp(v)]}` };
    }
    return null;
  }

  /* ---------- Solver ---------- */
  // level 1: simple rules only. level 2: also whole-line reasoning.
  function solve(givens, n, clues, level) {
    const grid = givens.slice(), cm = clueMap(clues);
    for (let guard = 0; guard < n * n * 4; guard++) {
      if (!grid.includes(EMPTY)) return grid;
      let steps = basicSteps(grid, n, clues);
      if (!steps.length && level >= 2) steps = lineSteps(grid, n, clues, cm, false);
      if (!steps.length) return null;
      for (const s of steps) for (const i of s.cells) if (!grid[i]) grid[i] = s.v;
      if (violations(grid, n, clues).length) return null;
    }
    return null;
  }

  // The next step a person could take from this (mistake-free) grid.
  function nextStep(grid, n, clues) {
    const order = [signSteps(grid, clues, n), pairSteps(grid, n), gapSteps(grid, n), countSteps(grid, n)];
    for (const list of order) if (list.length) return list[0];
    const ls = lineSteps(grid, n, clues, clueMap(clues), true);
    return ls[0] || null;
  }

  /* ---------- Generator ---------- */
  function generate(n, seed, level) {
    const r = rng(seed);
    let sol = null;
    while (!sol) sol = fullSolution(n, r);
    // Candidate signs between neighboring squares.
    const pairs = [];
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
      const i = row * n + col;
      if (col + 1 < n) pairs.push([i, i + 1]);
      if (row + 1 < n) pairs.push([i, i + n]);
    }
    shuffle(pairs, r);
    const clues = pairs.slice(0, Math.round(n * n * 0.22)).map(([a, b]) => ({ a, b, t: sol[a] === sol[b] ? '=' : 'x' }));
    const givens = sol.slice();
    // Take things away one at a time, keeping only removals that still leave a logic-only path.
    // Squares go first so the puzzle keeps a good sprinkling of signs.
    const cellItems = [];
    for (let i = 0; i < n * n; i++) cellItems.push({ cell: i });
    const items = shuffle(cellItems, r).concat(shuffle(clues.map((c) => ({ clue: c })), r));
    let live = clues.slice();
    for (const it of items) {
      if (it.cell != null) {
        const keep = givens[it.cell];
        givens[it.cell] = EMPTY;
        if (!solve(givens, n, live, level)) givens[it.cell] = keep;
      } else {
        const trial = live.filter((c) => c !== it.clue);
        if (solve(givens, n, trial, level)) live = trial;
      }
    }
    return { n, givens, clues: live, solution: sol };
  }

  root.DaybreakEngine = { EMPTY, SUN, MOON, NAME, PLURAL, generate, solve, nextStep, violations, geo, lineName, clueKey };
})(typeof self !== 'undefined' ? self : this);
