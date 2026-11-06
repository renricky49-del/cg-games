// Renders every teahouse area before (0/5) and after (5/5) restoration: OUT=<dir> node tests/areas.cjs
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:8123/index.html'); await p.waitForFunction(() => window.__tts && ['s-title', 's-game'].includes(window.__tts.state.screen));
  const n = await p.evaluate(() => window.__tts.state.S.areas.length);
  for (let a = 0; a < n; a++) {
    for (const full of [false, true]) {
      await p.evaluate(([a, full]) => { const S = window.__tts.state.S; S.areas = S.areas.map(() => [full, full, full, full, full]); for (let i = 1; i <= 84; i++) S.stars[i] = 3; window.__tts.openHouse(a); }, [a, full]);
      await p.waitForTimeout(1300);
      await p.locator('#scene').screenshot({ path: process.env.OUT + `/area${a + 1}_${full ? 'after' : 'before'}.png` });
    }
  }
  await p.screenshot({ path: process.env.OUT + '/house_full.png' });
  await b.close();
})();
