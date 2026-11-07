// Auto-tune each night's `diff` so the balanced AI hits a target score curve (score = win% + 0.5 * kill-all%).
// usage: node tools/tune.mjs [runs] [fromNight] [toNight]
// Nights 1-12 are tuned with no perks; 13-17 with perks at level 4 (fix 3); 18-22 with maxed perks.
import { Game } from '../js/sim.js';
import { NIGHTS, PERSONALITIES } from '../js/data.js';
const runs = +(process.argv[2] || 20), from = +(process.argv[3] || 1), to = +(process.argv[4] || NIGHTS.length);
const TARGET = { 1: 147, 2: 142, 3: 137, 4: 132, 5: 127, 6: 115, 7: 105, 8: 80, 9: 52, 10: 40, 11: 29, 12: 23,
  13: 115, 14: 105, 15: 95, 16: 85, 17: 75, 18: 80, 19: 70, 20: 60, 21: 50, 22: 40 };
const PERKS_MID = { start: 4, door: 4, dmg: 4, bed: 4, fix: 3 }, PERKS_MAX = { start: 5, door: 5, dmg: 5, bed: 5, fix: 4 };
const perksFor = (n) => (n <= 12 ? {} : n <= 17 ? PERKS_MID : PERKS_MAX);
function score(night, diff) {
  let w = 0, k = 0;
  for (let i = 0; i < runs; i++) {
    const g = new Game({ night: { ...night, diff }, seed: 5000 + i * 31 + night.n, autoPlayer: true, perks: perksFor(night.n) });
    g.player.pers = PERSONALITIES.find((p) => p.id === 'balanced');
    let t = 0;
    while (g.phase !== 'won' && g.phase !== 'lost' && t < 3000) { g.tick(1 / 30); g.events.length = 0; t += 1 / 30; }
    const r = g.results(); if (r.won) w++; if (r.killed) k++;
  }
  return (100 * w + 50 * k) / runs;
}
const out = [];
for (const night of NIGHTS.filter((n) => n.n >= from && n.n <= to)) {
  const tgt = TARGET[night.n];
  let lo = 0.2, hi = 8;
  for (let it = 0; it < 10; it++) { const mid = (lo + hi) / 2; if (score(night, mid) > tgt) lo = mid; else hi = mid; }
  const d = +((lo + hi) / 2).toFixed(2);
  out.push([night.n, d]);
  console.log(`N${night.n} count ${night.kinds ? night.kinds.length : night.count} lvl ${night.lvl}: diff ${d} (score ${score(night, d).toFixed(0)} target ${tgt})`);
}
console.log(JSON.stringify(out));
