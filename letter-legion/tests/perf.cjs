// Soak test: long match (Crimson Bay) at 1x then 4x, samples FPS and JS heap to catch leaks.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/sdk.crazygames.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForSelector('#play');
  await p.evaluate(() => { __LL.P.tutorialDone = true; __LL.P.ladder = 4; __LL.show('prematch', { mode: 'ladder', rivalIndex: 4 }); });
  await p.click('#go'); await p.waitForTimeout(500);
  await p.evaluate(async () => { const mod = await import('./js/ai.js'); const ctl = __LL.ctl; ctl.match.sides[0].autoPick = true; const br = new mod.CpuBrain(ctl.match.sides[0], { think: 0.5, skill: 1, spell: 5, mistakes: 0 }); const o = ctl.update.bind(ctl); ctl.update = dt => { if (!ctl.paused) br.update(dt * ctl.speed); o(dt); }; });
  const samples = [];
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(3000);
    const s = await p.evaluate(() => ({ fps: Math.round(window.__fps), heap: Math.round(performance.memory.usedJSHeapSize / 1048576), wave: __LL.ctl?.match.wave, en: __LL.ctl ? __LL.ctl.match.sides[0].enemies.length + __LL.ctl.match.sides[1].enemies.length : 0, parts: __LL.view.parts.length, fx: __LL.view.fx.length }));
    samples.push(s);
    if (i === 10) await p.evaluate(() => { __LL.ctl.speed = 4; });
    if (await p.$('.results')) break;
  }
  console.log(samples.map(s => `w${s.wave} fps${s.fps} heap${s.heap}MB en${s.en} p${s.parts} fx${s.fx}`).join('\n'));
  console.log('errors', errs);
  await b.close();
})();
