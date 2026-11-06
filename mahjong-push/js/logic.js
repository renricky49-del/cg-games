// Core rules, solver and level generator for Teahouse Tile Slide.
// Pure functions, no DOM — used by the game and by the node build tools.
//
// Board: { w, h, cells } where cells is an array of length w*h:
//   EMPTY (-1), STONE (-2) or a tile type id (>= 0).

export const EMPTY = -1;
export const STONE = -2;
// dirs: 0 up, 1 down, 2 left, 3 right
export const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

export function shuffleArr(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

export const isTile = (v) => v >= 0;

export function tileCount(cells) {
  let n = 0;
  for (let i = 0; i < cells.length; i++) if (cells[i] >= 0) n++;
  return n;
}

// First non-empty cell index from i (exclusive) in direction d, or -1 (edge).
function scan(cells, w, h, i, d) {
  const [dx, dy] = DIRS[d];
  let x = i % w + dx, y = (i / w | 0) + dy;
  while (x >= 0 && y >= 0 && x < w && y < h) {
    const j = y * w + x;
    if (cells[j] !== EMPTY) return j;
    x += dx; y += dy;
  }
  return -1;
}

// All tiles of the same type with a clear line to i. Sorted nearest first, then by dir order.
export function partnersOf(cells, w, h, i) {
  const t = cells[i];
  const out = [];
  if (t < 0) return out;
  for (let d = 0; d < 4; d++) {
    const j = scan(cells, w, h, i, d);
    if (j >= 0 && cells[j] === t) {
      const dist = Math.abs((j % w) - (i % w)) + Math.abs((j / w | 0) - (i / w | 0));
      out.push({ j, dist, d });
    }
  }
  out.sort((a, b) => a.dist - b.dist || a.d - b.d);
  return out.map((o) => o.j);
}

export function directMatches(cells, w, h) {
  const out = [];
  for (let i = 0; i < cells.length; i++) {
    const t = cells[i];
    if (t < 0) continue;
    for (const d of [1, 3]) { // down & right only to avoid duplicates
      const j = scan(cells, w, h, i, d);
      if (j >= 0 && cells[j] === t) out.push({ type: 'match', a: i, b: j });
    }
  }
  return out;
}

// Chain of contiguous tiles starting at i in direction d, plus how far it can slide.
export function pushInfo(cells, w, h, i, d) {
  const [dx, dy] = DIRS[d];
  const chain = [];
  let x = i % w, y = i / w | 0;
  while (x >= 0 && y >= 0 && x < w && y < h && cells[y * w + x] >= 0) {
    chain.push(y * w + x); x += dx; y += dy;
  }
  let free = 0;
  while (x >= 0 && y >= 0 && x < w && y < h && cells[y * w + x] === EMPTY) {
    free++; x += dx; y += dy;
  }
  return { chain, maxK: free };
}

export function applyPush(cells, w, chain, d, k) {
  const out = cells.slice();
  const [dx, dy] = DIRS[d];
  const off = (dy * w + dx) * k;
  for (const c of chain) out[c] = EMPTY;
  for (const c of chain) out[c + off] = cells[c];
  return out;
}

// Try a push; returns move object if it commits (dragged tile gets a partner), else null.
export function tryPush(cells, w, h, i, d, k, info) {
  info = info || pushInfo(cells, w, h, i, d);
  if (k < 1 || k > info.maxK) return null;
  const moved = applyPush(cells, w, info.chain, d, k);
  const [dx, dy] = DIRS[d];
  const to = i + (dy * w + dx) * k;
  const ps = partnersOf(moved, w, h, to);
  if (!ps.length) return null;
  return { type: 'push', from: i, dir: d, k, to, partner: ps[0], chain: info.chain, moved };
}

export function pushMoves(cells, w, h, firstOnly = false) {
  const out = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] < 0) continue;
    for (let d = 0; d < 4; d++) {
      const info = pushInfo(cells, w, h, i, d);
      for (let k = 1; k <= info.maxK; k++) {
        const m = tryPush(cells, w, h, i, d, k, info);
        if (m) { out.push(m); if (firstOnly) return out; }
      }
    }
  }
  return out;
}

export function allMoves(cells, w, h) {
  return directMatches(cells, w, h).concat(pushMoves(cells, w, h));
}

export function hasMove(cells, w, h) {
  return directMatches(cells, w, h).length > 0 || pushMoves(cells, w, h, true).length > 0;
}

// Result cells after performing a move (pair removed).
export function applyMove(cells, w, m) {
  if (m.type === 'match') {
    const out = cells.slice(); out[m.a] = EMPTY; out[m.b] = EMPTY; return out;
  }
  const out = (m.moved || applyPush(cells, w, m.chain, m.dir, m.k)).slice();
  out[m.to] = EMPTY; out[m.partner] = EMPTY;
  return out;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Depth-first solver with memo of dead states. Returns { solution: [moves] | null, nodes, aborted }.
// maxMs (optional) is a wall-clock budget so in-game calls never freeze a frame for long.
export function solve(cells, w, h, maxNodes = 200000, maxMs = Infinity) {
  const deadline = now() + maxMs;
  const dead = new Set();
  let nodes = 0, aborted = false;
  const path = [];
  function rec(c) {
    if (tileCount(c) === 0) return true;
    if (++nodes > maxNodes || ((nodes & 63) === 0 && now() > deadline)) { aborted = true; return false; }
    const key = c.join(',');
    if (dead.has(key)) return false;
    const moves = directMatches(c, w, h);
    const pm = pushMoves(c, w, h);
    pm.sort((a, b) => a.k - b.k);
    const seen = new Set();
    for (const m of moves.concat(pm)) {
      const nc = applyMove(c, w, m);
      const nk = nc.join(',');
      if (seen.has(nk)) continue;
      seen.add(nk);
      path.push(m);
      if (rec(nc)) return true;
      path.pop();
      if (aborted) return false;
    }
    dead.add(key);
    return false;
  }
  const ok = rec(cells.slice());
  return { solution: ok ? path.slice() : null, nodes, aborted };
}

// Difficulty metrics via random playouts. Players favour direct matches, so we weight them.
export function analyze(cells, w, h, runs = 40, seed = 1) {
  const rnd = mulberry32(seed);
  let deadEnds = 0, branchSum = 0, branchN = 0, pushNeeded = 0;
  for (let r = 0; r < runs; r++) {
    let c = cells.slice();
    for (;;) {
      if (tileCount(c) === 0) break;
      const dm = directMatches(c, w, h);
      const pm = pushMoves(c, w, h);
      const n = dm.length + pm.length;
      if (n === 0) { deadEnds++; break; }
      branchSum += n; branchN++;
      let m;
      if (dm.length && rnd() < 0.7) m = dm[Math.floor(rnd() * dm.length)];
      else { const all = dm.concat(pm); m = all[Math.floor(rnd() * all.length)]; }
      if (!dm.length) pushNeeded++;
      c = applyMove(c, w, m);
    }
  }
  return {
    deadRatio: deadEnds / runs,
    branch: branchN ? branchSum / branchN : 0,
    pushRatio: branchN ? pushNeeded / branchN : 0,
  };
}

// Random board: w x h, `pairs` pairs drawn from `types` tile types, `stones` stone blockers.
export function generateBoard({ w, h, pairs, types, stones = 0, typeOffset = 0, typePool = null }, seed) {
  const rnd = mulberry32(seed);
  const n = w * h;
  const cells = new Array(n).fill(EMPTY);
  const order = shuffleArr([...Array(n).keys()], rnd);
  // stones avoid the outer ring corners a bit to look tidy; just random interior bias
  let si = 0;
  const stoneCells = [];
  for (const i of order) {
    if (stoneCells.length >= stones) break;
    const x = i % w, y = i / w | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) continue;
    stoneCells.push(i);
  }
  for (const i of stoneCells) cells[i] = STONE;
  const free = order.filter((i) => cells[i] === EMPTY);
  const pool = typePool || [...Array(types).keys()].map((t) => t + typeOffset);
  const tileList = [];
  // each type at least once (if pairs allow), then random extra pairs
  const typeOrder = shuffleArr(pool.slice(), rnd);
  for (let p = 0; p < pairs; p++) {
    const t = p < typeOrder.length ? typeOrder[p] : typeOrder[Math.floor(rnd() * typeOrder.length)];
    tileList.push(t, t);
  }
  shuffleArr(tileList, rnd);
  for (let k = 0; k < tileList.length && k < free.length; k++) cells[free[k]] = tileList[k];
  si = 0;
  return { w, h, cells };
}

// Re-arrange the remaining tiles so the board can be played on. Guarantees at least one move whenever
// 2+ tiles remain, and prefers a layout the solver proves clearable, within a time budget (~150 ms).
// 1) permute faces over the current positions; 2) if that can't work (e.g. the last pair is stuck on
// fixed cells) scatter the tiles over all free cells; 3) last resort: place one pair side by side.
export function shuffleBoard(cells, w, h, rnd, maxTries = 40, budgetMs = 150) {
  const t0 = now();
  const pos = [], types = [], free = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] >= 0) { pos.push(i); types.push(cells[i]); }
    if (cells[i] !== STONE) free.push(i);
  }
  if (types.length < 2) return cells.slice();
  let fallback = null;
  const attempt = (nc) => {
    if (!hasMove(nc, w, h)) return false;
    if (!fallback) fallback = nc;
    const left = budgetMs - (now() - t0);
    return left > 5 && !!solve(nc, w, h, 6000, Math.min(40, left)).solution;
  };
  for (let t = 0; t < maxTries && now() - t0 < budgetMs; t++) {
    const scatter = t >= maxTries / 2 || t >= 8 && !fallback;
    shuffleArr(types, rnd);
    const nc = cells.map((v) => (v === STONE ? STONE : EMPTY));
    const where = scatter ? shuffleArr(free.slice(), rnd).slice(0, types.length) : pos;
    where.forEach((p, k) => { nc[p] = types[k]; });
    if (attempt(nc)) return nc;
  }
  if (fallback) return fallback;
  // guaranteed move: put two identical tiles next to each other
  const nc = cells.map((v) => (v === STONE ? STONE : EMPTY));
  const byFace = {};
  types.forEach((f) => { byFace[f] = (byFace[f] || 0) + 1; });
  const f0 = +Object.keys(byFace).find((f) => byFace[f] >= 2);
  let pair = null;
  for (const i of free) { const x = i % w; if (x + 1 < w && cells[i + 1] !== STONE) { pair = [i, i + 1]; break; } if (i + w < cells.length && cells[i + w] !== STONE) { pair = [i, i + w]; break; } }
  if (!pair) return cells.slice();
  nc[pair[0]] = f0; nc[pair[1]] = f0;
  const rest = types.slice(); rest.splice(rest.indexOf(f0), 1); rest.splice(rest.indexOf(f0), 1);
  const spots = shuffleArr(free.filter((i) => i !== pair[0] && i !== pair[1]), rnd);
  rest.forEach((f, k) => { nc[spots[k]] = f; });
  return nc;
}

// Level string encoding: rows joined by '/', cells: '.' empty, '#' stone, 'a'..'z','A'..'Z' types 0..51
const ALPH = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function encode(b) {
  const rows = [];
  for (let y = 0; y < b.h; y++) {
    let s = '';
    for (let x = 0; x < b.w; x++) {
      const v = b.cells[y * b.w + x];
      s += v === EMPTY ? '.' : v === STONE ? '#' : ALPH[v];
    }
    rows.push(s);
  }
  return rows.join('/');
}
export function decode(str) {
  const rows = str.split('/');
  const h = rows.length, w = rows[0].length;
  const cells = [];
  for (const r of rows) for (const ch of r) cells.push(ch === '.' ? EMPTY : ch === '#' ? STONE : ALPH.indexOf(ch));
  return { w, h, cells };
}
