// Captures store screenshots at 1920x1080 (1280x720 @1.5x)
const { chromium } = require('playwright');
const OUT = __dirname + '/../store/screenshots/';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  await p.route('**/sdk.crazygames.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForSelector('#play'); await p.waitForTimeout(600);
  await p.screenshot({ path: OUT + '1_title.jpg', quality: 88 });
  await p.evaluate(() => { const P = __LL.P; P.tutorialDone = true; P.level = 6; P.ladder = 5; P.coins = 640;
    P.weapons = [{ uid: 1, hero: 'MAGE', rarity: 'purple', name: 'Arcane Crystal Staff' }, { uid: 2, hero: 'KING', rarity: 'gold', name: 'Sunborn Scepter' }]; P.equipped = { MAGE: 1, KING: 2 };
    P.loadout = { active: [{ id: 'frost', r: 2 }, { id: 'bomb', r: 1 }], passive: [{ id: 'quills', r: 2 }, { id: 'goldink', r: 3 }] }; });
  await p.evaluate(() => __LL.show('prematch', { mode: 'ladder', rivalIndex: 3 })); await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + '5_prematch.jpg', quality: 88 });
  await p.click('#go'); await p.waitForTimeout(500);
  await p.evaluate(async () => { const mod = await import('./js/ai.js'); const ctl = __LL.ctl; const br = new mod.CpuBrain(ctl.match.sides[0], { think: 0.4, skill: 1, spell: 5, mistakes: 0 }); const o = ctl.update.bind(ctl); window.__spelled = 0; ctl.match.sides[0].script = ['S','gold:M','B','gold:A','S','L','gold:G','K','gold:E','B','S','gold:K','gold:I','L','gold:N','gold:G'];
    ctl.update = dt => { if (!ctl.paused) br.update(dt * ctl.speed); const n = ctl.match.sides[0].stats.heroes; o(dt); if (ctl.match.sides[0].stats.heroes > n) window.__spelled = performance.now(); }; ctl.speed = 3; });
  // wait for a hero spell moment
  await p.waitForFunction(() => window.__spelled > 0, null, { timeout: 180000 });
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
