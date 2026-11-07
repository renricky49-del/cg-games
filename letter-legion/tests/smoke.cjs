// Playwright smoke test. Usage: node tests/smoke.cjs [url] [outdir]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const OUT = process.argv[3] || '/tmp/claude-0/shots';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.route('**/sdk.crazygames.com/**', r => r.abort());
  await page.goto(URL);
  await page.waitForSelector('.title-screen', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/01_title.png' });
  await page.evaluate(() => { __LL.P.tutorialDone = true; __LL.show('hub'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/02_hub.png' });
  await page.click('#fight'); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/03_prematch.png' });
  await page.click('#go'); await page.waitForTimeout(1500);
  // play a bit with the CPU brain on our side
  await page.evaluate(async () => {
    const { ctl } = __LL; const mod = await import('./js/ai.js');
    ctl.match.sides[0].autoPick = true; window.__pb = new mod.CpuBrain(ctl.match.sides[0], { think: 0.8, skill: 0.8, spell: 5, mistakes: 0 });
    const orig = ctl.update.bind(ctl);
    ctl.update = dt => { if (!ctl.paused) window.__pb.update(dt * ctl.speed); orig(dt); };
    ctl.speed = 2;
  });
  await page.waitForTimeout(20000);
  await page.screenshot({ path: OUT + '/04_match.png' });
  const st = await page.evaluate(() => ({ wave: __LL.ctl.match.wave, fps: window.__fps, me: __LL.ctl.match.sides[0].lives, cpu: __LL.ctl.match.sides[1].lives }));
  console.log(st);
  console.log('errors:', errors);
  await browser.close();
})();
