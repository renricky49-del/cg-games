// Headless balance simulation: CPU vs CPU on each map. Usage: node tests/balance.mjs [runs]
import { Match } from '../js/sim.js';
import { CpuBrain } from '../js/ai.js';
import { MAPS, RIVALS, HEROES } from '../js/data.js';
const runs = +process.argv[2] || 4;
const allHeroes = HEROES.map(h => h.id);
function duel(mapId, pa, pb, seed, cfgA = {}, cfgB = {}) {
  const m = new Match({ mapId, seed, fx: false, player: { unlockedHeroes: allHeroes, ...cfgA }, rival: { unlockedHeroes: allHeroes, ...cfgB } });
  const A = new CpuBrain(m.sides[0], pa), B = new CpuBrain(m.sides[1], pb);
  const dt = 1 / 30; let guard = 0;
  const deathWave = [null, null];
  while (m.state === 'running' && guard++ < 30 * 60 * 25) {
    A.update(dt); B.update(dt); m.update(dt);
    for (const s of m.sides) s.events.length = 0;
  }
  return { winner: m.winner, wave: m.wave, lives: m.sides.map(s => s.lives), time: m.time | 0, heroes: m.sides.map(s => s.stats.heroes), maxLvl: m.sides.map(s => s.stats.maxLevel), reason: m.endReason, sum: m.sides.map(s=>s.summons) };
}
function solo(mapId, pa, seed) {
  const m = new Match({ mapId, seed, fx: false, player: { unlockedHeroes: allHeroes }, rival: {} });
  m.sides[1].lives = 1e9; m.mapDef = { ...m.mapDef, waves: 999 };
  const A = new CpuBrain(m.sides[0], pa); const dt = 1 / 30; let g = 0;
  while (m.state === 'running' && g++ < 30 * 60 * 30) { A.update(dt); m.update(dt); m.sides[0].events.length = 0; m.sides[1].events.length = 0; m.sides[1].enemies.length = 0; }
  return { wave: m.wave, heroes: m.sides[0].stats.heroes };
}
const mode = process.argv[3] || 'ladder';
if (mode === 'ladder') {
  // "player" modelled as a decent human (skill .7) vs each rival on its map
  const human = { think: 1.0, skill: 0.7, spell: 5, mistakes: 0.08 };
  for (const r of RIVALS) {
    let w = 0, waves = 0, t = 0;
    for (let i = 0; i < runs; i++) { const res = duel(r.map, human, r, 100 + i, {}, { cpuBonus: r.power }); if (res.winner === 0) w++; waves += res.wave; t += res.time; }
    console.log(r.name.padEnd(18), r.map.padEnd(6), `human win ${w}/${runs}`, 'avg wave', (waves / runs).toFixed(1), 'avg time', (t / runs / 60).toFixed(1) + 'm');
  }
} else if (mode === 'solo') {
  for (const mp of MAPS) { const line = [];
    for (const r of [RIVALS[0], RIVALS[2], RIVALS[4], {name:'human',think:1.0,skill:0.7,spell:5,mistakes:0.08}, RIVALS[8]]) {
      let wsum = 0, hs = 0; for (let i = 0; i < runs; i++) { const res = solo(mp.id, r, 50 + i); wsum += res.wave; hs += res.heroes; }
      line.push(r.name.split(' ').pop() + ':' + (wsum / runs).toFixed(1) + '/h' + (hs / runs).toFixed(1));
    }
    console.log(mp.id.padEnd(6), 'final', mp.waves, line.join('  '));
  }
} else {
  for (const mp of MAPS) for (const r of [RIVALS[0], RIVALS[4], RIVALS[8]]) {
    const res = duel(mp.id, r, r, 7);
    console.log(mp.id, r.name, JSON.stringify(res));
  }
}
