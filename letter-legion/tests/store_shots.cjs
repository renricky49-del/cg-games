// Captures store screenshots at 1920x1080 (1280x720 @1.5x)
const { chromium } = require('playwright');
const OUT = __dirname + '/../store/screenshots/';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await p.route('**/sdk.crazygames.com/**', r => r.abort());
  p.on('pageerror', e => console.log('PAGEERR', e.message)); await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForSelector('#play'); await p.waitForTimeout(600); console.log('loaded');
  await p.screenshot({ path: OUT + '1_title.jpg', quality: 88 });
  await p.evaluate(() => { const P = __LL.P; P.tutorialDone = true; P.level = 6; P.ladder = 5; P.coins = 640;
    P.weapons = [{ uid: 1, hero: 'MAGE', rarity: 'purple', name: 'Arcane Crystal Staff' }, { uid: 2, hero: 'KING', rarity: 'gold', name: 'Sunborn Scepter' }]; P.equipped = { MAGE: 1, KING: 2 };
    P.loadout = { active: [{ id: 'frost', r: 2 }, { id: 'bomb', r: 1 }], passive: [{ id: 'quills', r: 2 }, { id: 'goldink', r: 3 }] }; });
  await p.evaluate(() => __LL.show('prematch', { mode: 'ladder', rivalIndex: 3 })); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '5_prematch.jpg', quality: 88 });
  await p.click('#go'); await p.waitForTimeout(500);
  await p.evaluate(async () => { const mod = await import('./js/ai.js'); const ctl = __LL.ctl; const br = new mod.CpuBrain(ctl.match.sides[0], { think: 0.4, skill: 1, spell: 5, mistakes: 0 }); const o = ctl.update.bind(ctl); window.__spelled = 0; ctl.match.sides[0].script = ['S','gold:M','B','gold:A','S','L','gold:G','K','gold:E','B','S','gold:K','gold:I','L','gold:N','gold:G'];
    ctl.update = dt => { const n = ctl.match.sides[0].stats.heroes; if (!ctl.paused) br.update(dt * ctl.speed); o(dt); if (ctl.match.sides[0].stats.heroes > n) window.__spelled = performance.now(); }; ctl.speed = 3; });
  console.log('match started'); // wait for a hero spell moment
  for (let i = 0; i < 90; i++) { await p.waitForTimeout(1000); const st = await p.evaluate(() => ({ s: window.__spelled, t: __LL.ctl.match.time | 0, fps: Math.round(window.__fps), h: __LL.ctl.match.sides[0].stats.heroes })); if (i % 5 === 0) console.log(JSON.stringify(st)); if (st.s > 0) break; }
  await p.evaluate(() => { __LL.ctl.speed = 1; }); await p.waitForTimeout(650);
  await p.screenshot({ path: OUT + '2_spell_hero.jpg', quality: 88 });
  await p.evaluate(() => { __LL.ctl.speed = 3; }); await p.waitForTimeout(25000);
  await p.evaluate(() => { __LL.ctl.speed = 1; }); await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '3_battle.jpg', quality: 88 });
  await p.evaluate(() => { __LL.ctl.speed = 3; }); await p.waitForTimeout(25000);
  await p.evaluate(() => { __LL.ctl.speed = 1; }); await p.waitForTimeout(1200);
  await p.screenshot({ path: OUT + '4_late_battle.jpg', quality: 88 });
  await p.evaluate(() => { __LL.ctl.match.finish(0, "The rival's ward fell"); }); await p.waitForSelector('.results'); await p.waitForTimeout(1300);
  await p.screenshot({ path: OUT + '6_victory.jpg', quality: 88 });
  await p.click('#cont'); await p.waitForTimeout(1500);
  for (const [s, f] of [['spellbook', '7_spellbook'], ['shop', '8_shop'], ['hub', '9_hub']]) { await p.evaluate(s => __LL.show(s), s); await p.waitForTimeout(500); await p.screenshot({ path: OUT + f + '.jpg', quality: 88 }); }
  await b.close();
})();
