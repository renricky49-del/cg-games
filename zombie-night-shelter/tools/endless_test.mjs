import { Game } from '../js/sim.js';
import { ENDLESS } from '../js/data.js';
for (let i = 0; i < 6; i++) {
  const g = new Game({ night: ENDLESS, seed: 50 + i, autoPlayer: true, perks: { start: 3, door: 3, dmg: 3, bed: 3, fix: 2 } });
  let t = 0;
  while (g.phase !== 'lost' && t < 3000) { g.tick(1 / 30); g.events.length = 0; t += 1 / 30; }
  const r = g.results();
  console.log(`endless seed ${i}: phase ${g.phase} waves ${r.wave - 1} time ${Math.round(r.time)}s boss ${g.boss.variant} lv${g.boss.lvl}`);
}
