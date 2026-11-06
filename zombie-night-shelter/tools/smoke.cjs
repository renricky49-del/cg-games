// Quick smoke test: load, start night 1, claim a room, screenshot.
const { chromium } = require('playwright');
const OUT = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.waitForSelector('#title.show', { timeout: 15000 });
  await page.screenshot({ path: OUT + '/01_title.png' });
  await page.click('#btn-play');
  await page.waitForSelector('#intro.show');
  await page.screenshot({ path: OUT + '/02_intro.png' });
  await page.click('#btn-start');
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/03_rush.png' });
  // click the nearest free room
  const pt = await page.evaluate(() => {
    const A = window.__app, g = A.game, p = g.player;
    const r = g.map.rooms.filter((r) => !r.owner).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
    return A.renderer.worldToScreen(r.x + r.w / 2, r.y + 2.5);
  });
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: OUT + '/04_inroom.png' });
  console.log(await page.evaluate(() => { const g = window.__app.game; return JSON.stringify({ phase: g.phase, state: g.player.state, scrap: g.player.scrap }); }));
  console.log(errors.join('\n') || 'no console errors');
  await browser.close();
})();
