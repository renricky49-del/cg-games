// How involved is the player? Share of boss damage dealt by the player's turrets, and the share of night time
// in which the player's turrets were shooting at something, especially while the boss attacks other rooms.
import { Game } from '../js/sim.js';
import { NIGHTS, BUILDINGS, turretStats } from '../js/data.js';
const out = [];
for (const n of [0, 2, 4, 7]) {
  let dmgP = 0, dmgAll = 0, busy = 0, total = 0, busyElse = 0, totalElse = 0;
  for (let i = 0; i < 12; i++) {
    const g = new Game({ night: NIGHTS[n], seed: 900 + i, autoPlayer: true, perks: { start: 2, door: 2, dmg: 2, bed: 2, fix: 2 } });
    let t = 0;
    while (g.phase !== 'won' && g.phase !== 'lost' && t < 2000) {
      g.tick(1 / 60); t += 1 / 60;
      let fired = false;
      for (const ev of g.events) {
        if (ev.type === 'hit' && ev.e.kind === 'boss') { dmgAll += ev.dmg; if (ev.player) dmgP += ev.dmg; }
        if ((ev.type === 'shoot' || ev.type === 'flame' || ev.type === 'zap') && ev.b && ev.b.room === g.player.room) fired = true;
      }
      g.events.length = 0;
      if (g.phase === 'night') {
        total++; if (fired) busy++;
        const b = g.bosses.find((q) => q.alive && q.state === 'attack' && q.target && q.target.room !== g.player.room) || g.boss;
        const r = g.player.room;
        const reach = r && r.buildings.some((q) => BUILDINGS[q.type].kind === 'turret' && Math.hypot(q.x - b.x, q.y - b.y) <= turretStats(q.type, q.lvl).range + b.r * 0.5);
        if (b.alive && b.state === 'attack' && b.target && b.target.room !== r) { totalElse++; if (reach) busyElse++; }
      }
    }
  }
  console.log(`Night ${n + 1}: player's share of boss damage ${(100 * dmgP / dmgAll).toFixed(0)}%, while boss hits OTHER rooms the boss is inside the player's turret range ${(100 * busyElse / totalElse).toFixed(0)}% of frames`);
}
