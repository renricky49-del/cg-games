// Balance check: a "casual player" bot (prefers direct matches, 1-ply lookahead to avoid instant
// dead ends, otherwise random) plays every campaign level N times without boosters.
// Prints win rate per level so the difficulty curve can be eyeballed. node tools/balance.mjs
import * as L from '../js/logic.js';
import { LEVELS } from '../js/levels-data.js';
const RUNS = 40;
function play(b, rnd) {
  let c = b.cells.slice(), moves = 0;
  for (;;) {
    if (L.tileCount(c) === 0) return { win: true, moves };
    const dm = L.directMatches(c, b.w, b.h), pm = L.pushMoves(c, b.w, b.h);
    let opts = dm.length && rnd() < 0.8 ? dm : dm.concat(pm);
    if (!opts.length) return { win: false, moves };
    const safe = opts.filter((m) => { const n = L.applyMove(c, b.w, m); return L.tileCount(n) === 0 || L.hasMove(n, b.w, b.h); });
    if (safe.length) opts = safe;
    c = L.applyMove(c, b.w, opts[Math.floor(rnd() * opts.length)]); moves++;
  }
}
const rows = [];
LEVELS.forEach((lv, k) => {
  const b = L.decode(lv.s), rnd = L.mulberry32(k + 99);
  let wins = 0; for (let r = 0; r < RUNS; r++) if (play(b, rnd).win) wins++;
  rows.push({ level: k + 1, size: `${b.w}x${b.h}`, tiles: L.tileCount(b.cells), stones: b.cells.filter((v) => v === L.STONE).length, d: lv.d, botWin: wins / RUNS });
});
for (const r of rows) console.log(String(r.level).padStart(2), r.size.padEnd(5), String(r.tiles).padStart(2), 'tiles', r.stones, 'stones  d=' + r.d.toFixed(2).padStart(5), ' bot win', (r.botWin * 100).toFixed(0).padStart(3) + '%', '#'.repeat(Math.round(r.botWin * 30)));
const ch = [0, 1, 2, 3, 4, 5, 6].map((c) => rows.slice(c * 12, c * 12 + 12).reduce((s, r) => s + r.botWin, 0) / 12);
console.log('chapter avg bot win:', ch.map((x) => (x * 100).toFixed(0) + '%').join('  '));
