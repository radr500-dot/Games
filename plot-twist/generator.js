/* Plot Twist puzzle engine: generator + solver.
   Rules: one bloom per row, per column and per garden plot (region);
   blooms may not touch, not even diagonally. Every generated puzzle
   has exactly one solution. Works in the browser and in Node. */
(function (root) {
  'use strict';

  // Small seeded RNG (mulberry32) so daily puzzles are the same all day.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Random placement: one per row and column, never touching.
  function randomPlacement(n, rng) {
    const cols = new Array(n);
    const used = new Array(n).fill(false);
    function place(r) {
      if (r === n) return true;
      const order = shuffle([...Array(n).keys()], rng);
      for (const c of order) {
        if (used[c]) continue;
        if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
        used[c] = true; cols[r] = c;
        if (place(r + 1)) return true;
        used[c] = false;
      }
      return false;
    }
    return place(0) ? cols : null;
  }

  // Count solutions (stops at `cap`). regions: flat array n*n of region ids.
  function countSolutions(n, regions, cap, out) {
    let count = 0;
    const cols = new Array(n);
    function go(r, colMask, regMask, prev) {
      if (r === n) {
        count++;
        if (out && count === 1) out.solution = cols.slice();
        return count >= cap;
      }
      const base = r * n;
      for (let c = 0; c < n; c++) {
        if (colMask & (1 << c)) continue;
        if (prev >= 0 && (c === prev - 1 || c === prev + 1)) continue;
        const reg = regions[base + c];
        if (regMask & (1 << reg)) continue;
        cols[r] = c;
        if (go(r + 1, colMask | (1 << c), regMask | (1 << reg), c)) return true;
      }
      return false;
    }
    go(0, 0, 0, -1);
    return count;
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // Grow n regions from the seed cells by random flood fill.
  function growRegions(n, seeds, rng) {
    const regions = new Array(n * n).fill(-1);
    const frontier = [];
    seeds.forEach((cell, id) => { regions[cell] = id; frontier.push(cell); });
    let filled = n;
    while (filled < n * n) {
      // Pick a random frontier cell, try to expand into a random neighbour.
      const idx = Math.floor(rng() * frontier.length);
      const cell = frontier[idx];
      const r = Math.floor(cell / n), c = cell % n;
      const opts = [];
      for (const [dr, dc] of DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && regions[rr * n + cc] === -1) opts.push(rr * n + cc);
      }
      if (!opts.length) { frontier.splice(idx, 1); continue; }
      const next = opts[Math.floor(rng() * opts.length)];
      regions[next] = regions[cell];
      frontier.push(next);
      filled++;
    }
    return regions;
  }

  // Is region `id` still connected if `skip` is removed from it?
  function connectedWithout(n, regions, id, skip) {
    let start = -1, total = 0;
    for (let i = 0; i < n * n; i++) {
      if (regions[i] === id && i !== skip) { total++; if (start < 0) start = i; }
    }
    if (total === 0) return false;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const cell = stack.pop();
      const r = Math.floor(cell / n), c = cell % n;
      for (const [dr, dc] of DIRS) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const nb = rr * n + cc;
        if (nb !== skip && regions[nb] === id && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    return seen.size === total;
  }

  // Generate a puzzle with a unique solution.
  function generate(n, seed) {
    const rng = makeRng(seed == null ? (Math.random() * 2 ** 32) >>> 0 : seed);
    const CAP = 60;
    for (let attempt = 0; attempt < 200; attempt++) {
      const cols = randomPlacement(n, rng);
      const seeds = cols.map((c, r) => r * n + c);
      const isSeed = new Set(seeds);
      let regions = growRegions(n, seeds, rng);
      let count = countSolutions(n, regions, CAP);
      // Keep plots reasonably balanced so no single plot swallows the board.
      const maxSize = Math.ceil(n * 2.4);
      const sizes = new Array(n).fill(0);
      regions.forEach(id => sizes[id]++);
      // Hill-climb: move boundary cells between plots until only one solution is left.
      for (let step = 0; step < 4000 && count > 1; step++) {
        const cell = Math.floor(rng() * n * n);
        if (isSeed.has(cell)) continue;
        const r = Math.floor(cell / n), c = cell % n;
        const from = regions[cell];
        const nbRegs = [];
        for (const [dr, dc] of DIRS) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
          const reg = regions[rr * n + cc];
          if (reg !== from && !nbRegs.includes(reg)) nbRegs.push(reg);
        }
        if (!nbRegs.length) continue;
        if (!connectedWithout(n, regions, from, cell)) continue;
        const to = nbRegs[Math.floor(rng() * nbRegs.length)];
        if (sizes[to] >= maxSize) continue;
        regions[cell] = to;
        const nc = countSolutions(n, regions, CAP);
        if (nc <= count || rng() < 0.02) { count = nc; sizes[from]--; sizes[to]++; }
        else regions[cell] = from;
      }
      if (count === 1) {
        // Reject puzzles with a tiny one-cell plot too often; they're less fun.
        if (Math.max(...sizes) > maxSize + 2) continue;
        const singles = sizes.filter(s => s === 1).length;
        if (singles > 1) continue;
        return { size: n, regions: regions, solution: cols };
      }
    }
    throw new Error('Could not generate a puzzle');
  }

  const api = { generate, countSolutions, makeRng };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PlotTwistEngine = api;
})(typeof self !== 'undefined' ? self : this);
