// Balance analysis: damage share by source, hero usage, end reasons, match length. Usage: node tests/analyze.mjs [runs]
import { Match } from '../js/sim.js';
import { CpuBrain } from '../js/ai.js';
import { MAPS, RIVALS, HEROES } from '../js/data.js';
const runs = +process.argv[2] || 6;
const HSET = process.argv[3] === 'early' ? ['KING', 'MAGE', 'MONK'] : HEROES.map(h => h.id);
const heroShare = {};
const allHeroes = HEROES.map(h => h.id);
const human = { think: 1.0, skill: 0.7, spell: 5, mistakes: 0.08 };
const agg = { dmg: {}, spells: {}, reasons: {}, summons: 0, n: 0, time: 0, wave: 0, maxLvl: 0, trainSpent: 0 };
const perMap = {};
for (const mp of MAPS) {
  const rivals = RIVALS.filter(r => r.map === mp.id);
  for (const r of rivals) for (let i = 0; i < runs; i++) {
    const m = new Match({ mapId: mp.id, seed: 500 + i * 13, fx: false, player: { unlockedHeroes: HSET }, rival: { unlockedHeroes: allHeroes, cpuBonus: r.power } }); m.sides[0].autoPick = true;
    const A = new CpuBrain(m.sides[0], human), B = new CpuBrain(m.sides[1], r);
    let g = 0; while (m.state === 'running' && g++ < 30 * 60 * 30) { A.update(1 / 30); B.update(1 / 30); m.update(1 / 30); m.sides[0].events.length = 0; m.sides[1].events.length = 0; }
    const s = m.sides[0];
    const tot = Object.values(s.stats.dmgBy).reduce((a, b) => a + b, 0) || 1;
    for (const [k, v] of Object.entries(s.stats.dmgBy)) agg.dmg[k] = (agg.dmg[k] || 0) + v / tot;
    for (const h of s.stats.spelled) agg.spells[h] = (agg.spells[h] || 0) + 1;
    for (const h of new Set(s.stats.spelled)) { const hs = heroShare[h] = heroShare[h] || { n: 0, share: 0, wave: 0 }; hs.n++; hs.share += ((s.stats.dmgBy[h] || 0) + (s.stats.dmgBy[h + '*'] || 0)) / tot; }
    const reason = m.overtime ? 'overtime' : m.endReason;
    agg.reasons[reason] = (agg.reasons[reason] || 0) + 1;
    agg.summons += s.summons; agg.n++; agg.time += m.time; agg.wave += m.wave; agg.maxLvl += s.stats.maxLevel;
    const pm = perMap[mp.id] = perMap[mp.id] || { n: 0, time: 0, win: 0, wave: 0 }; pm.n++; pm.time += m.time; pm.wave += m.wave; if (m.winner === 0) pm.win++;
  }
}
console.log('matches', agg.n, 'avg summons', (agg.summons / agg.n).toFixed(1), 'avg time', (agg.time / agg.n / 60).toFixed(1) + 'm', 'avg wave', (agg.wave / agg.n).toFixed(1), 'avg best lvl', (agg.maxLvl / agg.n).toFixed(1));
console.log('damage share (player):', Object.entries(agg.dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / agg.n * 100).toFixed(1)}%`).join(' | '));
console.log('heroes spelled per match:', Object.entries(agg.spells).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / agg.n).toFixed(2)}`).join(' | '));
console.log('hero dmg share when spelled:', Object.entries(heroShare).map(([k, v]) => `${k} ${(v.share / v.n * 100).toFixed(1)}% (n=${v.n})`).join(' | '));
console.log('end reasons:', JSON.stringify(agg.reasons));
for (const [k, v] of Object.entries(perMap)) console.log(' ', k.padEnd(6), 'win', `${v.win}/${v.n}`, 'avg wave', (v.wave / v.n).toFixed(1), 'avg', (v.time / v.n / 60).toFixed(1) + 'm');
