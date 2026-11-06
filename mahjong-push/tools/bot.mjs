// Casual-player bot shared by build-levels and balance: prefers direct matches, avoids moves that
// leave no move at all (1-ply lookahead), otherwise random. Returns win rate over `runs` plays.
import * as L from '../js/logic.js';
export function botWinRate(b, runs, seed) {
  const rnd = L.mulberry32(seed);
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    let c = b.cells.slice();
    for (;;) {
      if (L.tileCount(c) === 0) { wins++; break; }
      const dm = L.directMatches(c, b.w, b.h), pm = L.pushMoves(c, b.w, b.h);
      let opts = dm.length && rnd() < 0.8 ? dm : dm.concat(pm);
      if (!opts.length) break;
      const safe = opts.filter((m) => { const n = L.applyMove(c, b.w, m); return L.tileCount(n) === 0 || L.hasMove(n, b.w, b.h); });
      if (safe.length) opts = safe;
      c = L.applyMove(c, b.w, opts[Math.floor(rnd() * opts.length)]);
    }
  }
  return wins / runs;
}
