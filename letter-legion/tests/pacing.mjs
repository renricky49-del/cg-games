// Opening-pace metrics for a decent player on the first ladder map. Usage: node tests/pacing.mjs [runs]
import { Match } from '../js/sim.js';
import { CpuBrain } from '../js/ai.js';
import { RIVALS } from '../js/data.js';
const runs = +process.argv[2] || 20;
const CALL = process.argv[3] === 'call'; // model an active player who calls waves early when the board is clear
const human = { think: 1.0, skill: 0.7, spell: 4, mistakes: 0.08 };
const acc = { firstEnemy: 0, firstMerge: 0, firstHero: 0, heroN: 0, idle120: 0, summons60: 0, wave120: 0, matchTime: 0, merges120: 0 };
const med = { firstHero: [] };
for (let i = 0; i < runs; i++) {
  const m = new Match({ mapId: 'ember', seed: 300 + i, fx: false, player: { unlockedHeroes: ['KING', 'MAGE', 'MONK'] }, rival: { cpuBonus: RIVALS[0].power, unlockedHeroes: ['KING', 'MAGE', 'MONK'] } }); m.sides[0].autoPick = true;
  const A = new CpuBrain(m.sides[0], human), B = new CpuBrain(m.sides[1], RIVALS[0]);
  let fe = null, fm = null, fh = null, idle = 0, s60 = null, w120 = null, mg120 = null; const dt = 1 / 30;
  while (m.state === 'running' && m.time < 1800) {
    A.update(dt); B.update(dt); if (CALL && m.canCallWave(0)) m.callWave(0); m.update(dt);
    const s = m.sides[0];
    for (const e of s.events) { if (e.t === 'merge' && fm === null) fm = m.time; if (e.t === 'spell' && fh === null) fh = m.time; }
    s.events.length = 0; m.sides[1].events.length = 0;
    if (fe === null && s.enemies.some(e => e.hp > 0)) fe = m.time;
    if (m.time <= 120 && !s.enemies.some(e => e.hp > 0)) idle += dt;
    if (s60 === null && m.time >= 60) s60 = s.summons;
    if (w120 === null && m.time >= 120) { w120 = m.wave; mg120 = s.stats.merges; }
  }
  acc.firstEnemy += fe; acc.firstMerge += fm ?? 120; acc.idle120 += idle; acc.summons60 += s60 ?? 0; acc.wave120 += w120 ?? m.wave; acc.matchTime += m.time; acc.merges120 += mg120 ?? 0;
  med.firstHero.push(fh ?? 999);
}
med.firstHero.sort((a, b) => a - b);
const f = k => (acc[k] / runs).toFixed(1);
console.log(`first enemy ${f('firstEnemy')}s | first merge ${f('firstMerge')}s | first hero (median) ${med.firstHero[runs >> 1].toFixed(0)}s | idle in first 120s ${f('idle120')}s | summons by 60s ${f('summons60')} | merges by 120s ${f('merges120')} | wave at 120s ${f('wave120')} | match ${(acc.matchTime / runs / 60).toFixed(1)}m`);
