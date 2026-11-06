// Plays the tutorial with real mouse input (summon, drag, merge, spell KING), then lets a helper brain finish the match.
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
  await page.waitForSelector('#play');
  await page.click('#play');
  await page.waitForTimeout(800);
  const btn = id => page.evaluate(id => __LL.view.btnCenter(id), id);
  const tray = i => page.evaluate(i => __LL.view.trayCenter(i), i);
  const cell = id => page.evaluate(id => { const c = __LL.ctl.match.sides[0].cells[id]; const r = __LL.view.cellRect(0, c); return [r.x + r.w / 2, r.y + r.h / 2]; }, id);
  const step = () => page.evaluate(() => __LL.ctl.tut.step);
  const click = async ([x, y]) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(150); };
  const drag = async ([x0, y0], [x1, y1]) => { await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await page.mouse.up(); await page.waitForTimeout(200); };
  await page.screenshot({ path: OUT + '/10_tut_start.png' });
  await click(await btn('summon')); await page.waitForTimeout(700);
  console.log('step after summon', await step());
  const hl = await page.evaluate(() => __LL.ctl.highlightCells);
  await page.screenshot({ path: OUT + '/11_tut_place.png' });
  await drag(await tray(0), await cell(hl[1]));
  console.log('step after place', await step());
  await click(await btn('summon')); await page.waitForTimeout(700);
  const sCell = await page.evaluate(() => __LL.ctl.highlightCells[0]);
  await drag(await tray(0), await cell(sCell));
  console.log('step after merge', await step());
  for (let i = 0; i < 3; i++) { await click(await btn('summon')); await page.waitForTimeout(500); }
  console.log('step after gold summons', await step());
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/12_tut_spell.png' });
  const row = await page.evaluate(() => __LL.ctl.highlightCells.slice().sort((a, b) => __LL.ctl.match.sides[0].cells[a].col - __LL.ctl.match.sides[0].cells[b].col));
  const word = 'KING';
  for (let k = 0; k < 4; k++) {
    let ti = await page.evaluate(L => __LL.ctl.match.sides[0].tray.findIndex(t => t && t.letter === L), word[k]);
    if (ti < 0) { await click(await btn('summon')); await page.waitForTimeout(600); ti = await page.evaluate(L => __LL.ctl.match.sides[0].tray.findIndex(t => t && t.letter === L), word[k]); }
    await drag(await tray(ti), await cell(row[k]));
  }
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/13_tut_spelled.png' });
  console.log('step after spell', await step(), 'heroes', await page.evaluate(() => __LL.ctl.match.sides[0].stats.heroes));
  // finish with a helper brain
  await page.evaluate(async () => { const mod = await import('./js/ai.js'); const ctl = __LL.ctl; const b = new mod.CpuBrain(ctl.match.sides[0], { think: 0.8, skill: 0.8, spell: 5, mistakes: 0 }); const o = ctl.update.bind(ctl); ctl.update = dt => { if (!ctl.paused) b.update(dt * ctl.speed); o(dt); }; ctl.speed = 2; });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: OUT + '/14_tut_battle.png' });
  await page.waitForSelector('.results', { timeout: 240000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/15_tut_result.png' });
  console.log('result', await page.evaluate(() => document.querySelector('.res-title').textContent));
  await page.click('#cont'); await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + '/16_after.png' });
  console.log('tutorialDone', await page.evaluate(() => __LL.P.tutorialDone), 'errors', errors);
  await browser.close();
})();
