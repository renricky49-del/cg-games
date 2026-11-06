const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#s-title.show');
  for (let a = 0; a < 5; a++) {
    await p.evaluate((a) => { const S = window.__tts.state.S; S.areas = S.areas.map(() => [true, true, true, true, true]); for (let i = 1; i <= 60; i++) S.stars[i] = 3; window.__tts.openHouse(a); }, a);
    await p.waitForTimeout(1200);
    await p.locator('#scene').screenshot({ path: process.env.OUT + `/area${a + 1}.png` });
  }
  await b.close();
})();
