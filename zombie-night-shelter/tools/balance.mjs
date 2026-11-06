// Headless fast-forward simulation: the player slot is driven by the same AI as the survivors.
// usage: node tools/balance.mjs [runsPerNight] [personality]
import { Game } from '../js/sim.js';
import { NIGHTS, PERSONALITIES } from '../js/data.js';
const runs = +(process.argv[2] || 20);
const persId = process.argv[3] || 'balanced';
const perks = JSON.parse(process.argv[4] || '{}');
for (const night of NIGHTS) {
  let wins = 0, kills = 0, stars = 0, aiDeaths = 0, bossLvl = 0, lostAt = [], tKill = [];
  for (let i = 0; i < runs; i++) {
    const g = new Game({ night, seed: 1000 + i * 77 + night.n, autoPlayer: true, perks });
    g.player.pers = PERSONALITIES.find((p) => p.id === persId);
    let t = 0;
    while (g.phase !== 'won' && g.phase !== 'lost' && t < 2000) { g.tick(1 / 60); g.events.length = 0; t += 1 / 30; }
    const r = g.results();
    if (r.won) wins++; else lostAt.push(Math.round(r.time));
    if (r.killed) { kills++; tKill.push(Math.round(r.time)); }
    stars += r.stars;
    aiDeaths += g.survivors.filter((s) => !s.isPlayer && s.state === 'dead').length;
    bossLvl += r.bossLvl;
  }
  console.log(`N${night.n} ${night.boss.padEnd(7)} win ${(100 * wins / runs).toFixed(0).padStart(3)}%  kill ${(100 * kills / runs).toFixed(0).padStart(3)}%  stars ${(stars / runs).toFixed(2)}  aiDead ${(aiDeaths / runs).toFixed(1)}  bossLv ${(bossLvl / runs).toFixed(1)}  killT ${tKill.slice(0,6)} lostAt ${lostAt.slice(0, 6)}`);
}
