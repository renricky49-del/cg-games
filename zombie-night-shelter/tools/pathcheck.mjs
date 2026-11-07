// Every frame, check that no boss or minion stands inside an apartment or wall (they must stay in the stairwell/hallway).
import { Game } from '../js/sim.js';
import { NIGHTS } from '../js/data.js';
let bad = 0, frames = 0;
for (const ni of [0, 2, 5, 9, 13, 21]) for (let seed = 0; seed < 4; seed++) {
  const g = new Game({ night: NIGHTS[ni], seed: 77 + seed, autoPlayer: true, perks: { start: 3, door: 3, dmg: 3, bed: 3, fix: 2 } });
  let t = 0;
  while (g.phase !== 'won' && g.phase !== 'lost' && t < 2500) {
    g.tick(1 / 60); g.events.length = 0; t += 1 / 60; frames++;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      const inLair = e.x >= 1 && e.x < 5 && e.y >= 1 && e.y < 16;
      const inHall = e.x >= 1 && e.x < g.map.W - 1 && e.y >= 6.9 && e.y < 10.1; // door fronts sit right at the walls
      if (!inLair && !inHall) { if (bad < 5) console.log(`N${ni + 1} ${e.kind} ${e.variant || ''} at ${e.x.toFixed(2)},${e.y.toFixed(2)} state ${e.state}`); bad++; }
    }
  }
}
console.log(`${frames} frames checked, ${bad} enemy positions outside the stairwell/hallway`);
