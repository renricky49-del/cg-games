// Sim fuzzer: both sides take random (often invalid) actions every tick; invariants are checked every step.
// Usage: node tests/fuzz_sim.mjs [matches]
import { Match, TRAY_SIZE } from '../js/sim.js';
import { CpuBrain } from '../js/ai.js';
import { MAPS, HEROES, RIVALS, ITEMS, MAX_LEVEL, HERO_MAX_LEVEL } from '../js/data.js';
import { RNG } from '../js/rng.js';

const N = +process.argv[2] || 60;
const allHeroes = HEROES.map(h => h.id);
let failures = 0;
const fail = (msg, ctx) => { failures++; if (failures <= 25) console.log('FAIL:', msg, ctx || ''); };

function check(m, tag) {
  for (const s of m.sides) {
    if (!Number.isFinite(s.ink) || s.ink < -1e-6) fail('bad ink', `${tag} ink=${s.ink}`);
    if (!Number.isFinite(s.hex) || s.hex < 0 || s.hex > s.hexNeed() + 1e-6) fail('bad hex', `${tag} hex=${s.hex}/${s.hexNeed()}`);
    if (s.offers && !m.draft) fail('offers without a draft', tag);
    if (s.boons.length !== s.stats.boons) fail('boon count mismatch', tag);
    if (!Number.isInteger(s.lives) || s.lives < 0 || s.lives > s.maxLives) fail('bad lives', `${tag} lives=${s.lives}/${s.maxLives}`);
    if (s.shovels < 0) fail('negative shovels', tag);
    const seen = new Set();
    const units = [...s.cells.map(c => c.unit), ...s.tray].filter(Boolean);
    for (const u of units) {
      if (seen.has(u)) fail('same unit object in two places', `${tag} ${u.letter}`);
      seen.add(u);
      if (u.kind === 'basic' && (u.level < 1 || u.level > MAX_LEVEL)) fail('bad level', `${tag} ${u.letter}${u.level}`);
      if (u.kind === 'hero' && (u.level < 1 || u.level > HERO_MAX_LEVEL)) fail('bad hero level', `${tag} ${u.heroId}${u.level}`);
      if (!Number.isFinite(u.cd)) fail('bad cd', `${tag} ${u.kind} ${u.letter} cd=${u.cd}`);
    }
    for (const c of s.cells) if (c.locked && c.unit) fail('unit on locked cell', tag);
    for (const t of s.tray) if (t && t.kind === 'hero') fail('hero in tray', tag);
    if (s.tray.length !== TRAY_SIZE) fail('tray size changed', tag);
    const heroIds = s.cells.filter(c => c.unit && c.unit.kind === 'hero').map(c => c.unit.heroId);
    if (new Set(heroIds).size !== heroIds.length) fail('duplicate hero on board', `${tag} ${heroIds}`);
    for (const e of s.enemies) if (!Number.isFinite(e.hp) || !Number.isFinite(e.x) || !Number.isFinite(e.dist)) fail('bad enemy', `${tag} ${e.type} hp=${e.hp} x=${e.x}`);
  }
}

function randomAction(s, rng) {
  const r = rng.next();
  const anySrc = () => rng.next() < 0.4 ? { tray: rng.int(TRAY_SIZE + 1) } : { cell: rng.int(s.cells.length + 2) - 1 };
  if (r < 0.25) s.summon(rng.next() < 0.05);
  else if (r < 0.6) s.place(anySrc(), rng.int(s.cells.length + 2) - 1);
  else if (r < 0.68) s.sell(anySrc());
  else if (r < 0.75) s.dig(rng.int(s.cells.length + 1));
  else if (r < 0.8) s.doTrain(['S', 'L', 'B', 'K', 'X'][rng.int(5)]);
  else if (r < 0.83) s.useItem(rng.int(4) - 1);
  else if (r < 0.85) s.shovels += 1;
  else if (r < 0.88) s.sendHex();
  else if (r < 0.9) s.match.rerollBoons(s.idx);
  else if (r < 0.95) s.match.pickBoon(s.idx, rng.int(4) - 0);
  else if (r < 0.96) s.match.callWave(s.idx);
}

let totalWaves = 0, overtimes = 0, t0 = Date.now();
for (let i = 0; i < N; i++) {
  const rng = new RNG(1000 + i);
  const map = MAPS[i % MAPS.length].id;
  const actives = [ITEMS[0], ITEMS[1], ITEMS[2], ITEMS[3], ITEMS[4], ITEMS[5]].map(d => ({ id: d.id, r: rng.int(5) })).slice(0, 2 + (i % 3));
  const passives = ITEMS.filter(d => d.type === 'passive').map(d => ({ id: d.id, r: rng.int(5) })).slice(0, 3);
  const m = new Match({ mapId: map, seed: 77 + i, fx: i % 2 === 0, player: { unlockedHeroes: allHeroes, actives, passives, weapons: { MAGE: { rarity: 'gold' }, KING: { rarity: 'purple' } }, dailyBuff: ['gold', 'ink', 'hero', null][i % 4] }, rival: { unlockedHeroes: allHeroes, cpuBonus: 1.2 } });
  // mix: side 0 random monkey (sometimes with a brain), side 1 brain or monkey
  const brainA = i % 3 === 0 ? new CpuBrain(m.sides[0], RIVALS[8]) : null;
  const brainB = i % 2 === 0 ? new CpuBrain(m.sides[1], RIVALS[i % RIVALS.length]) : null;
  if (i % 4 === 1) m.sides[0].autoPick = true; // otherwise the monkey must pick its blessings itself
  if (i % 5 === 2) m.sides[1].autoPick = false;
  let steps = 0;
  try {
    while (m.state === 'running' && steps < 60 * 60 * 30) {
      const dt = 1 / 60;
      for (let k = 0; k < 2; k++) if (rng.next() < 0.3) randomAction(m.sides[0], rng);
      if ((!brainB || !m.sides[1].autoPick) && rng.next() < 0.3) randomAction(m.sides[1], rng);
      if (brainA) brainA.update(dt);
      if (brainB) brainB.update(dt);
      m.update(dt);
      for (const s of m.sides) s.events.length = 0;
      steps++;
      if (steps % 30 === 0) check(m, `match${i} ${map} t=${m.time.toFixed(1)}`);
    }
  } catch (err) { fail('EXCEPTION ' + err.message, `match${i} ${map} t=${m.time.toFixed(1)}\n${err.stack.split('\n').slice(0, 4).join('\n')}`); }
  if (m.state === 'running') fail('match did not end', `match${i} ${map} wave=${m.wave}`);
  check(m, `match${i} end`);
  totalWaves += m.wave; if (m.overtime) overtimes++;
}
console.log(`${N} fuzz matches, avg wave ${(totalWaves / N).toFixed(1)}, overtime ${overtimes}, ${((Date.now() - t0) / 1000).toFixed(1)}s, failures: ${failures}`);
process.exit(failures ? 1 : 0);
