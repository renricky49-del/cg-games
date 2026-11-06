// Auto-tune each night's `diff` so the balanced AI (no perks) hits a target win% / boss-kill% curve.
// usage: node tools/tune.mjs [runs]   -> prints the tuned diff list
import { Game } from '../js/sim.js';
import { NIGHTS, PERSONALITIES } from '../js/data.js';
const runs = +(process.argv[2] || 20);
// target score = win% + 0.5 * kill%  (the curve the game had with one boss, which played well)
const TARGET = [147, 142, 137, 132, 127, 115, 105, 80, 52, 40, 29, 23];
function score(night, diff) {
  let w = 0, k = 0;
  for (let i = 0; i < runs; i++) {
    const g = new Game({ night: { ...night, diff }, seed: 5000 + i * 31 + night.n, autoPlayer: true });
    g.player.pers = PERSONALITIES.find((p) => p.id === 'balanced');
    let t = 0;
    while (g.phase !== 'won' && g.phase !== 'lost' && t < 2000) { g.tick(1 / 30); g.events.length = 0; t += 1 / 30; }
    const r = g.results(); if (r.won) w++; if (r.killed) k++;
  }
  return (100 * w + 50 * k) / runs;
}
const out = [];
for (const night of NIGHTS) {
  const tgt = TARGET[night.n - 1];
  let lo = 0.2, hi = 4;
  for (let it = 0; it < 9; it++) { const mid = (lo + hi) / 2; if (score(night, mid) > tgt) lo = mid; else hi = mid; }
  const d = +((lo + hi) / 2).toFixed(2);
  out.push(d);
  console.log(`N${night.n} count ${night.count} lvl ${night.lvl}: diff ${d} (score ${score(night, d).toFixed(0)} target ${tgt})`);
}
console.log(JSON.stringify(out));
