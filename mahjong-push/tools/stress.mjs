// Logic stress test: property checks + worst-case timing of hint (solve) and shuffle on every level,
// both at level start and at random mid-game states. node tools/stress.mjs
import * as L from '../js/logic.js';
import { LEVELS } from '../js/levels-data.js';
const rnd = L.mulberry32(42);
let worstHint = 0, worstShuffle = 0, fails = [], hintAbort = 0, deadNoMoveShuffle = 0, total = 0;
const counts = (c) => { const m = {}; for (const v of c) if (v >= 0) m[v & 63] = (m[v & 63] || 0) + 1; return m; };
LEVELS.forEach((lv, k) => {
  const b = L.decode(lv.s);
  // property: all faces appear an even number of times
  for (const [f, n] of Object.entries(counts(b.cells))) if (n % 2) fails.push(`L${k + 1} odd face ${f}`);
  for (let run = 0; run < 6; run++) {
    let c = b.cells.slice();
    const steps = Math.floor(rnd() * (L.tileCount(c) / 2));
    for (let s = 0; s < steps; s++) {
      const ms = L.allMoves(c, b.w, b.h); if (!ms.length) break;
      const m = ms[Math.floor(rnd() * ms.length)];
      const before = L.tileCount(c);
      const nc = L.applyMove(c, b.w, m);
      // properties: exactly 2 tiles removed, stones unchanged, counts stay even
      if (L.tileCount(nc) !== before - 2) fails.push(`L${k + 1} move removed ${before - L.tileCount(nc)}`);
      for (let i = 0; i < c.length; i++) if ((c[i] === L.STONE) !== (nc[i] === L.STONE)) fails.push(`L${k + 1} stone moved`);
      for (const [f, n] of Object.entries(counts(nc))) if (n % 2) fails.push(`L${k + 1} odd after move`);
      c = nc;
    }
    total++;
    let t = performance.now(); const r = L.solve(c, b.w, b.h, 12000, 120); const th = performance.now() - t;
    if (r.aborted) hintAbort++;
    worstHint = Math.max(worstHint, th);
    t = performance.now(); const sc = L.shuffleBoard(c, b.w, b.h, rnd); const ts = performance.now() - t;
    worstShuffle = Math.max(worstShuffle, ts);
    if (L.tileCount(c) && !L.hasMove(sc, b.w, b.h)) deadNoMoveShuffle++;
    if (th > 250 || ts > 250) console.log(`slow L${k + 1} tiles=${L.tileCount(c)} hint ${th.toFixed(0)}ms (aborted ${r.aborted}) shuffle ${ts.toFixed(0)}ms`);
  }
});
console.log(`states ${total}; worst hint ${worstHint.toFixed(0)} ms (aborted ${hintAbort}); worst shuffle ${worstShuffle.toFixed(0)} ms; shuffles leaving no move: ${deadNoMoveShuffle}`);
console.log(fails.length ? 'PROPERTY FAILURES:\n' + [...new Set(fails)].join('\n') : 'all properties hold');
// last-pair trap: two identical tiles that can never meet by permutation
const trap = L.decode('a#../.#../.#.a');
console.log('last-pair trap: hasMove', L.hasMove(trap.cells, trap.w, trap.h), '-> shuffle hasMove', L.hasMove(L.shuffleBoard(trap.cells, trap.w, trap.h, rnd), trap.w, trap.h));
