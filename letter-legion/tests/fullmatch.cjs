// Plays full ladder matches with a scripted helper brain driving the player's side: one WIN and one LOSS.
// Usage: node tests/fullmatch.cjs [win|lose|both] [width] [height]
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8123/index.html';
const OUT = '/tmp/claude-0/shots';
const which = process.argv[2] || 'both';
const W = +process.argv[3] || 1280, H = +process.argv[4] || 720;
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.route('**/sdk.crazygames.com/**', r => r.abort());
  await page.goto(URL);
  await page.waitForSelector('#play');
  await page.evaluate(() => { __LL.P.tutorialDone = true; });
  async function play(win, tag) {
    await page.evaluate(() => __LL.show('hub'));
    await page.click('#fight'); await page.waitForTimeout(200); await page.click('#go'); await page.waitForTimeout(500);
    await page.evaluate(async (win) => {
      const mod = await import('./js/ai.js'); const ctl = __LL.ctl;
      // WIN: strong helper; LOSS: helper that does nothing
      ctl.match.sides[0].autoPick = true; const b = win ? new mod.CpuBrain(ctl.match.sides[0], { think: 0.5, skill: 1, spell: 5, mistakes: 0 }) : null;
      const o = ctl.update.bind(ctl); ctl.update = dt => { if (b && !ctl.paused) b.update(dt * ctl.speed); o(dt); }; ctl.speed = 4;
      // allow 4x for tests by stepping more
    }, win);
    const t0 = Date.now(); let shot = false;
    while (!(await page.$('.results'))) {
      await page.waitForTimeout(1000);
      if (!shot && Date.now() - t0 > 25000) { await page.screenshot({ path: `${OUT}/20_${tag}_mid.png` }); shot = true; }
      if (Date.now() - t0 > 600000) throw new Error('match too long');
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/21_${tag}_result.png` });
    const r = await page.evaluate(() => ({ title: document.querySelector('.res-title').textContent, coins: __LL.P.coins, ladder: __LL.P.ladder, weapons: __LL.P.weapons.length, lvl: __LL.P.level }));
    console.log(tag, JSON.stringify(r), 'secs', Math.round((Date.now() - t0) / 1000));
    await page.click('#cont'); await page.waitForTimeout(1600);
  }
  if (which !== 'lose') await play(true, 'win');
  if (which !== 'win') await play(false, 'lose');
  await page.screenshot({ path: `${OUT}/22_hub_after.png` });
  console.log('errors', errors);
  await browser.close();
})();
