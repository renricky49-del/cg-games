// Capture store screenshots (1280x720) of key moments.
const { chromium } = require('playwright');
const OUT = 'store/screenshots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(p, fn, ms = 90000) { const t = Date.now(); while (Date.now() - t < ms) { if (await p.evaluate(fn)) return; await sleep(200); } throw new Error('timeout ' + fn); }
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#title.show');
  await p.evaluate(() => { const A = window.__app; A.save.tutDone = true; A.save.stars = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1, 6: 1, 7: 1, 8: 1 }; A.save.medals = 40; A.persist(); });
  await sleep(800);
  await p.screenshot({ path: OUT + '/01_title.png' });
  // rush on night 3
  await p.evaluate(() => window.__app.startNight(2, true)); await p.waitForSelector('#intro.show'); await sleep(700);
  await p.screenshot({ path: OUT + '/02_intro.png' });
  await p.click('#btn-start'); await sleep(2600);
  await p.evaluate(() => { const g = window.__app.game; const r = g.map.rooms.slice().sort((a, b) => b.support - a.support)[0]; g.goToRoom(g.player, r); });
  await sleep(1400);
  await p.screenshot({ path: OUT + '/03_rush.png' });
  // fast forward into the night with AI help, then build menu
  await p.evaluate(() => { const A = window.__app; A.game.autoPlayer = true; A.game.perks = { start: 3, door: 3, dmg: 3, bed: 3 }; A.speed = 8; });
  await until(p, () => window.__app.game.phase === 'night' && window.__app.game.stats.timeSurvived > 35);
  await p.evaluate(() => { const A = window.__app; A.speed = 1; A.game.autoPlayer = false; });
  await sleep(1500);
  await p.screenshot({ path: OUT + '/04_night.png' });
  const t = await p.evaluate(() => { const A = window.__app, g = A.game, r = g.player.room; const q = r.tiles.find((q) => g.tileFree(r, q.tx, q.ty)); return q ? A.renderer.worldToScreen(q.tx + 0.5, q.ty + 0.5) : null; });
  if (t) { await p.mouse.click(t.x, t.y); await sleep(200); await p.hover('.bm-item[data-type="bow"]'); await sleep(300); await p.screenshot({ path: OUT + '/05_build.png' }); await p.keyboard.press('Escape'); }
  // late game night 8 with tesla
  await p.evaluate(() => window.__app.startNight(7, true)); await p.waitForSelector('#intro.show'); await p.click('#btn-start');
  await p.evaluate(() => { const A = window.__app; A.game.autoPlayer = true; A.game.perks = { start: 5, door: 5, dmg: 5, bed: 5, fix: 4 }; A.speed = 8; });
  await until(p, () => window.__app.game.phase === 'night' && window.__app.game.stats.timeSurvived > 80 || window.__app.isOver(), 120000);
  await p.evaluate(() => { window.__app.speed = 1; });
  await sleep(1200);
  await p.screenshot({ path: OUT + '/06_late.png' });
  await p.evaluate(() => { window.__app.speed = 8; });
  await until(p, () => window.__app.screen === 'results' || window.__app.screen === 'continue', 160000);
  if (await p.evaluate(() => window.__app.screen === 'continue')) await p.click('#btn-giveup');
  await sleep(1800);
  await p.screenshot({ path: OUT + '/07_results.png' });
  await p.click('#btn-res-menu'); await p.click('#btn-nights'); await sleep(400);
  await p.screenshot({ path: OUT + '/08_nights.png' });
  await b.close();
})();
