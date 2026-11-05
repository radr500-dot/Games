// Beach Day engine: sand-sorting rules, a seeded level maker and a solver for hints.
// A tube is an array of color numbers, bottom first. Every tube holds CAP layers.
(function (root) {
  const CAP = 4;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const top = (t) => t[t.length - 1];
  // How many layers of the top color sit together at the top of a tube.
  function topRun(t) {
    if (!t.length) return 0;
    const c = top(t); let n = 0;
    for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
    return n;
  }
  const isDone = (t) => t.length === 0 || (t.length === CAP && topRun(t) === CAP);
  const isWon = (tubes) => tubes.every(isDone);
  const uniform = (t) => t.length > 0 && topRun(t) === t.length;

  // How many layers would move from tube a to tube b (0 means the pour isn't allowed).
  function pourAmount(tubes, a, b) {
    if (a === b) return 0;
    const s = tubes[a], d = tubes[b];
    if (!s.length || d.length >= CAP) return 0;
    if (d.length && top(d) !== top(s)) return 0;
    return Math.min(topRun(s), CAP - d.length);
  }

  function pour(tubes, a, b) {
    const n = pourAmount(tubes, a, b);
    if (!n) return null;
    const next = tubes.map((t) => t.slice());
    const c = top(next[a]);
    for (let i = 0; i < n; i++) { next[a].pop(); next[b].push(c); }
    return { tubes: next, count: n, color: c };
  }

  const key = (tubes) => tubes.map((t) => t.join('')).sort().join('|');

  // Sensible moves only: skip pours that just shuffle a one-color tube into an empty one.
  function moves(tubes) {
    const out = [];
    let emptyTried = false;
    for (let a = 0; a < tubes.length; a++) {
      const s = tubes[a];
      if (!s.length || isDone(s)) continue;
      const run = topRun(s);
      for (let b = 0; b < tubes.length; b++) {
        const n = pourAmount(tubes, a, b);
        if (!n) continue;
        const d = tubes[b];
        if (!d.length) {
          if (uniform(s)) continue;
          out.push({ a, b, n, score: 0 });
        } else {
          // Prefer pours that move the whole run and build taller single-color stacks.
          let score = 2 + (n === run ? 2 : 0) + (uniform(d) ? 2 : 0) + (d.length + n === CAP && uniform(d) ? 3 : 0);
          out.push({ a, b, n, score });
        }
      }
    }
    // Only one "into an empty tube" choice per source matters (all empty tubes are alike).
    const seen = new Set();
    const filtered = out.filter((m) => {
      if (tubes[m.b].length) return true;
      const k = m.a; if (seen.has(k)) return false; seen.add(k); return true;
    });
    void emptyTried;
    return filtered.sort((x, y) => y.score - x.score);
  }

  // Depth-first search with memory. Returns a list of {a, b} moves, [] if already solved,
  // or null if it can't be solved (or the search ran too long).
  function solve(tubes, limit = 150000) {
    const seen = new Set();
    const path = [];
    let nodes = 0;
    function dfs(state) {
      if (isWon(state)) return true;
      if (++nodes > limit) return false;
      const k = key(state);
      if (seen.has(k)) return false;
      seen.add(k);
      for (const m of moves(state)) {
        const r = pour(state, m.a, m.b);
        path.push({ a: m.a, b: m.b });
        if (dfs(r.tubes)) return true;
        path.pop();
      }
      return false;
    }
    const ok = dfs(tubes.map((t) => t.slice()));
    return ok ? path : null;
  }

  function colorsFor(level) {
    if (level <= 2) return 3;
    if (level <= 5) return 4;
    if (level <= 9) return 5;
    if (level <= 14) return 6;
    return 7;
  }

  // Levels are made from the level number, so level 12 is always the same puzzle.
  function makeLevel(level) {
    const k = colorsFor(level);
    for (let attempt = 0; attempt < 500; attempt++) {
      const r = rng(level * 7919 + attempt * 104729 + 17);
      const pool = [];
      for (let c = 0; c < k; c++) for (let i = 0; i < CAP; i++) pool.push(c);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const tubes = [];
      for (let t = 0; t < k; t++) tubes.push(pool.slice(t * CAP, t * CAP + CAP));
      tubes.push([], []);
      // Avoid tubes that start already sorted or nearly sorted.
      if (tubes.some((t) => t.length && topRun(t) >= 3)) continue;
      const sol = solve(tubes);
      if (!sol || sol.length < k + 2) continue;
      return { level, colors: k, tubes };
    }
    // Fallback (not expected): a simple, always-solvable layout.
    const tubes = [];
    for (let t = 0; t < k; t++) tubes.push([t, (t + 1) % k, t, (t + 1) % k]);
    tubes.push([], []);
    return { level, colors: k, tubes };
  }

  root.BeachEngine = { CAP, topRun, isDone, isWon, uniform, pourAmount, pour, moves, solve, makeLevel, colorsFor };
})(typeof window !== 'undefined' ? window : globalThis);
