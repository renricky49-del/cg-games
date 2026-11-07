const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://localhost:8123/index.html');
  await page.evaluate(() => { localStorage.clear(); }); await page.reload();
  await page.waitForSelector('#title.show');
  await page.evaluate(() => { const d = document.getElementById('daily'); if (d) d.classList.remove('show'); });
  await page.click('#btn-play'); await page.waitForSelector('#intro.show'); await page.click('#btn-start');
  await sleep(300);
  // put the player straight into a free room via the sim
  await page.evaluate(() => { window.__app.game.autoPlayer = true; });
  for (let i = 0; i < 300; i++) { const ok = await page.evaluate(() => { const g = window.__app.game; return g.player.state === 'inroom' && g.survivors.filter((s) => !s.isPlayer && s.state === 'inroom').length > 0; }); if (ok) break;
    await sleep(200); }
  await page.evaluate(() => { window.__app.game.autoPlayer = false; });
  const st = await page.evaluate(() => { const g = window.__app.game; return { phase: g.phase, ps: g.player.state, allies: g.survivors.filter((s) => !s.isPlayer && s.state === 'inroom').length }; });
  console.log('state', JSON.stringify(st));
  let okClicks = 0; const N = 12;
  for (let i = 0; i < N; i++) {
    await page.evaluate(() => { const a = window.__app, g = a.game; g.player.scrap = 5000; g.player.giftCd = 0; const r = g.map.rooms.find((r) => r.owner && !r.owner.isPlayer && r.alive && r.owner.state === 'inroom'); a.hud.openInfo({ kind: 'ally', room: r }, 640, 360); window.__s0 = g.player.scrap; });
    await sleep(120);
    const bt = await page.$('#info-panel [data-a="gift"]'); const bb = await bt.boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await sleep(250 + (i % 4) * 150); await page.mouse.up();
    await sleep(100);
    const d = await page.evaluate(() => window.__s0 - window.__app.game.player.scrap);
    if (d > 0) okClicks++;
    await page.evaluate(() => window.__app.hud.closeMenus());
  }
  console.log(`gift clicks registered: ${okClicks}/${N}`, errs.length ? errs : '');
  await b.close();
})();
