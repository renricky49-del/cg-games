// Full-flow Playwright test: tutorial night win via real UI input + fast-forward, a loss with the
// continue prompt, mobile screenshots, and a long-run performance/leak check.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || '.';
const URL = 'http://localhost:8123/index.html';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
function watch(page) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
}
async function worldClick(page, x, y) {
  for (let i = 0; i < 40 && await page.evaluate(() => window.__app.renderer.cam.tz != null); i++) await sleep(100);
  const p = await page.evaluate(([x, y]) => window.__app.renderer.worldToScreen(x, y), [x, y]);
  await page.mouse.click(p.x, p.y);
}
async function waitFor(page, fn, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await page.evaluate(fn)) return true; await sleep(200); }
  throw new Error('timeout waiting for ' + fn);
}

(async () => {
  const browser = await chromium.launch();
  // ---------------------------------------------------------------- desktop win
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); watch(page);
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#title.show');
  await page.click('#btn-play'); // first play: straight into the tutorial night
  await page.waitForFunction(() => window.__app.screen === 'game');
  await sleep(400);
  // pick the room with best neighbour support
  const room = await page.evaluate(() => { const g = window.__app.game, p = g.player; const r = g.map.rooms.filter((r) => !r.owner && !g.survivors.some((o) => o.targetRoom === r)).sort((a, b) => Math.abs(a.doors[0].fx - p.x) - Math.abs(b.doors[0].fx - p.x))[0]; return { x: r.doors[0].ix, y: r.doors[0].iy, id: r.id }; });
  await worldClick(page, room.x, room.y);
  await waitFor(page, () => window.__app.game.player.state === 'inroom' && !document.getElementById('hud-bottom').classList.contains('hidden'));
  await sleep(700);
  const bed = await page.evaluate(() => { const r = window.__app.game.player.room; return { x: r.bed.x, y: r.bed.y }; });
  await worldClick(page, bed.x, bed.y);
  await waitFor(page, () => window.__app.game.player.lying);
  await page.screenshot({ path: OUT + '/10_lying.png' });
  await waitFor(page, () => window.__app.game.player.scrap >= 20);
  await page.keyboard.press('b');
  await waitFor(page, () => window.__app.game.player.room.bedLvl === 2);
  await waitFor(page, () => window.__app.game.player.scrap >= 30);
  // click a free tile near the door -> build menu -> nail gun
  const tile = await page.evaluate(() => { const g = window.__app.game, r = g.player.room, d = r.doors[0]; const t = r.tiles.filter((q) => g.tileFree(r, q.tx, q.ty)).sort((a, b) => Math.hypot(a.tx - d.tx, a.ty - d.ty) - Math.hypot(b.tx - d.tx, b.ty - d.ty))[0]; return { x: t.tx + 0.5, y: t.ty + 0.5 }; });
  await worldClick(page, tile.x, tile.y);
  await page.waitForSelector('#build-menu:not(.hidden)');
  await page.hover('.bm-item[data-type="nail"]');
  await sleep(150);
  await page.screenshot({ path: OUT + '/11_buildmenu.png' });
  await page.click('.bm-item[data-type="nail"]');
  await waitFor(page, () => window.__app.game.player.room.buildings.length === 1);
  // open the turret info panel
  await worldClick(page, tile.x, tile.y);
  await page.waitForSelector('#info-panel:not(.hidden)');
  await page.screenshot({ path: OUT + '/12_infopanel.png' });
  await page.keyboard.press('Escape');
  // fast-forward with the AI brain driving the player slot
  await page.evaluate(() => { const A = window.__app; A.game.autoPlayer = true; A.speed = 6; });
  await waitFor(page, () => window.__app.game.phase === 'night', 30000);
  await page.evaluate(() => { window.__app.speed = 1; });
  await sleep(4000);
  await page.screenshot({ path: OUT + '/13_night.png' });
  await page.evaluate(() => { window.__app.speed = 8; });
  await waitFor(page, () => window.__app.screen === 'results' || window.__app.screen === 'continue', 120000);
  await sleep(1600);
  await page.screenshot({ path: OUT + '/14_results.png' });
  const res = await page.evaluate(() => { const r = window.__app.game.results(); return { won: r.won, stars: r.stars, killed: r.killed, save: window.__app.save }; });
  console.log('NIGHT1', JSON.stringify(res));
  // ---------------------------------------------------------------- loss + continue flow
  await page.evaluate(() => { window.__app.save.stars = { 1: 3, 2: 2 }; window.__app.startNight(2, true); });
  await page.waitForSelector('#intro.show');
  await page.click('#btn-start');
  await page.evaluate(() => { const g = window.__app.game; const r = g.map.rooms.find((r) => !r.owner && !g.survivors.some((o) => o !== g.player && o.targetRoom === r)) || g.map.rooms.find((r) => !r.owner); g.goToRoom(g.player, r); window.__app.speed = 8; });
  await waitFor(page, () => window.__app.screen === 'continue' || window.__app.screen === 'results', 180000);
  const scr = await page.evaluate(() => window.__app.screen);
  await page.screenshot({ path: OUT + '/15_continue.png' });
  if (scr === 'continue') {
    await page.click('#btn-continue');
    await waitFor(page, () => window.__app.screen === 'game' && window.__app.game.phase === 'night', 5000);
    console.log('CONTINUE ok, door hp', await page.evaluate(() => Math.round(window.__app.game.player.room.doors[0].hp)));
    await waitFor(page, () => window.__app.screen === 'continue' || window.__app.screen === 'results', 180000);
    if (await page.evaluate(() => window.__app.screen === 'continue')) await page.click('#btn-giveup');
  }
  await page.waitForSelector('#results.show');
  await page.screenshot({ path: OUT + '/16_loss.png' });
  console.log('LOSS', JSON.stringify(await page.evaluate(() => window.__app.game.results())));
  // menus
  await page.click('#btn-res-menu');
  if (await page.$('#daily.show')) { await page.click('#btn-daily'); console.log('DAILY claimed', await page.evaluate(() => window.__app.save.medals)); }
  await page.click('#btn-nights'); await sleep(300); await page.screenshot({ path: OUT + '/17_nights.png' });
  await page.click('#nights .close'); await page.click('#btn-perks'); await sleep(300); await page.screenshot({ path: OUT + '/18_perks.png' });
  await page.click('#perks .close'); await page.click('#btn-skins'); await sleep(300); await page.screenshot({ path: OUT + '/19_skins.png' });
  await page.click('#skins .close');
  // ---------------------------------------------------------------- performance: long endless-ish run
  await page.evaluate(() => { window.__app.save.stars[6] = 1; window.__app.startNight(5, true); });
  await page.click('#btn-start');
  await page.evaluate(() => { const A = window.__app; A.game.autoPlayer = true; A.speed = 1; });
  const perf = await page.evaluate(async () => {
    const A = window.__app; A.speed = 3;
    const frames = []; let last = performance.now();
    await new Promise((res) => {
      const f = (t) => { frames.push(t - last); last = t; if (frames.length < 900) requestAnimationFrame(f); else res(); };
      requestAnimationFrame(f);
    });
    frames.sort((a, b) => a - b);
    const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
    return { avgMs: avg.toFixed(2), p95: frames[Math.floor(frames.length * 0.95)].toFixed(2), particles: A.renderer.particles.length, enemies: A.game.enemies.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, phase: A.game.phase };
  });
  console.log('PERF', JSON.stringify(perf));
  await page.screenshot({ path: OUT + '/20_late.png' });
  await ctx.close();
  // ---------------------------------------------------------------- mobile portrait
  const m = await browser.newContext({ ...devices['iPhone 13'] });
  const mp = await m.newPage(); watch(mp);
  await mp.goto(URL);
  await mp.waitForSelector('#title.show');
  await mp.screenshot({ path: OUT + '/30_m_title.png' });
  await mp.tap('#btn-play');
  await mp.waitForFunction(() => window.__app.screen === 'game');
  await sleep(500);
  await mp.screenshot({ path: OUT + '/31_m_rush.png' });
  const r2 = await mp.evaluate(() => { const g = window.__app.game; const r = g.map.rooms.find((r) => !r.owner && !g.survivors.some((o) => o !== g.player && o.targetRoom === r)) || g.map.rooms.find((r) => !r.owner); g.goToRoom(g.player, r); return true; });
  await waitFor(mp, () => window.__app.game.player.state === 'inroom');
  await sleep(1500);
  await mp.screenshot({ path: OUT + '/32_m_room.png' });
  await m.close();
  // mobile landscape
  const ml = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const lp = await ml.newPage(); watch(lp);
  await lp.goto(URL); await lp.waitForSelector('#title.show');
  await lp.tap('#btn-play'); await lp.waitForFunction(() => window.__app.screen === 'game');
  await lp.evaluate(() => { const g = window.__app.game; const r = g.map.rooms.find((r) => !r.owner && !g.survivors.some((o) => o !== g.player && o.targetRoom === r)) || g.map.rooms.find((r) => !r.owner); g.goToRoom(g.player, r); });
  await waitFor(lp, () => window.__app.game.player.state === 'inroom'); await sleep(1200);
  await lp.screenshot({ path: OUT + '/33_m_land.png' });
  await ml.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); console.log(errors.join('\n')); process.exit(1); });
