// Does helping allies matter? Same seeds, player slot driven by the AI, with and without the player's aid actions.
import { Game } from '../js/sim.js';
import { NIGHTS, PERSONALITIES } from '../js/data.js';
const runs = +(process.argv[2] || 24);
for (const n of [4, 6, 7, 8, 9]) {
  const res = {};
  for (const help of [false, true]) {
    let alliesDead = 0, wins = 0, kills = 0, two = 0;
    for (let i = 0; i < runs; i++) {
      const g = new Game({ night: NIGHTS[n], seed: 4200 + i * 13, autoPlayer: true });
      g.player.pers = PERSONALITIES.find((p) => p.id === 'balanced');
      if (!help) { const orig = g.canAid.bind(g); g.canAid = (s, r, k) => (s.isPlayer ? { ok: false } : orig(s, r, k)); }
      let t = 0;
      while (g.phase !== 'won' && g.phase !== 'lost' && t < 2000) { g.tick(1 / 30); g.events.length = 0; t += 1 / 30; }
      const r = g.results();
      alliesDead += g.survivors.filter((s) => !s.isPlayer && s.state === 'dead').length;
      if (r.won) wins++; if (r.killed) kills++; if (r.stars >= 2) two++;
    }
    res[help] = `allies lost ${(alliesDead / runs).toFixed(2)}/3, win ${(100 * wins / runs).toFixed(0)}%, all bosses killed ${(100 * kills / runs).toFixed(0)}%, ★★+ ${(100 * two / runs).toFixed(0)}%`;
  }
  console.log(`Night ${n + 1}\n  never helps : ${res.false}\n  helps allies: ${res.true}`);
}
