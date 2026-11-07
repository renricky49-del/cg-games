// Regression tests for v1.1 edge cases found in review. Usage: node tests/edge_cases.mjs
import { Match } from '../js/sim.js';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

{ // a ward falls on the same tick a draft wave starts: the draft is void and can't be picked
  const m = new Match({ mapId: 'ember', seed: 9, player: { unlockedHeroes: ['KING'] }, rival: { unlockedHeroes: ['KING'] } });
  const me = m.sides[0];
  while (m.wave < 2) { for (const s of m.sides) { s.lives = 7; s.enemies.length = 0; } m.update(1 / 60); }
  m.spawnIdx = m.curWave.list.length; m.waveT = m.curWave.dur - 1e-4; for (const s of m.sides) s.enemies.length = 0;
  me.lives = 1; const e = me.spawn({ type: 'wolf', hp: 1e6 }); e.dist = me.map.len - 0.001;
  m.update(1 / 60);
  ok(m.state === 'over' && !m.draft && !me.offers && m.sides.every(s => !s.offers), 'draft opened on the final tick is cleared');
  ok(m.pickBoon(0, 0) === false && me.boons.length === 0 && me.lives === 0, 'no blessing can be picked after the match ended');
  ok(m.rerollBoons(0) === false, 'no reroll after the match ended');
}
{ // a Hex fired once the final wave is cleared still arrives before the match is judged
  const m = new Match({ mapId: 'ember', seed: 3, player: { unlockedHeroes: ['KING'] }, rival: { unlockedHeroes: ['KING'] } });
  m.sides[0].autoPick = true;
  while (m.wave < m.finalWave) { for (const s of m.sides) { s.enemies.length = 0; s.lives = 7; } m.update(1 / 60); }
  m.spawnIdx = m.curWave.list.length; for (const s of m.sides) s.enemies.length = 0;
  m.sides[0].lives = 5; m.sides[1].lives = 4;
  const cpu = m.sides[1]; cpu.hex = cpu.hexNeed(); cpu.sendHex();
  m.update(1 / 60);
  ok(m.state === 'running' && m.sides[0].enemies.some(e => e.elite && e.hp > 0), 'last-second Brute spawns instead of being dropped');
}
{ // shields block leaks without costing lives, and never trigger a sudden-death loss
  const m = new Match({ mapId: 'ember', seed: 4, player: { unlockedHeroes: ['KING'] }, rival: { unlockedHeroes: ['KING'] } });
  const me = m.sides[0]; me.applyBoon('guard'); m.overtime = 1;
  const e = me.spawn({ type: 'goblin', hp: 1e9 }); e.dist = me.map.len - 0.001;
  m.update(1 / 60);
  ok(me.lives === me.maxLives && me.shield === 1 && m.state === 'running', 'shield blocks a sudden-death leak');
}
{ // free summons don't cost ink or raise the price
  const m = new Match({ mapId: 'ember', seed: 5, player: { unlockedHeroes: ['KING', 'MAGE', 'MONK'] }, rival: {} });
  const me = m.sides[0]; m.update(1 / 60); me.applyBoon('gilded'); me.ink = 0;
  const got = []; for (let i = 0; i < 3; i++) { got.push(me.summon()); me.tray.fill(null); }
  ok(got.every(x => x && x.kind === 'gold') && me.ink === 0 && me.summons === 0 && !me.summon(), 'Gilded Quill gives exactly 3 free golden letters');
}
{ // stacking floors
  const m = new Match({ mapId: 'ember', seed: 6, player: {}, rival: {} }); const me = m.sides[0];
  for (let i = 0; i < 12; i++) for (const id of ['cheap', 'chill', 'tempo', 'crit']) me.applyBoon(id);
  ok(me.mods.summonCost >= 0.5 && me.mods.enemySpeed >= 0.6 && me.mods.heroCd >= 0.35 && me.mods.crit <= 0.6, 'stacked blessings stay within their floors');
}
console.log(fails ? `${fails} FAILED` : 'ALL EDGE CASES OK'); process.exit(fails ? 1 : 0);
