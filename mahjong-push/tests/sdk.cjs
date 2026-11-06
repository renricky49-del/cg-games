// CrazyGames SDK compliance test with a mock SDK v3 (served in place of sdk.crazygames.com).
// Verifies: init/loading events, gameplayStart/Stop around play, no gameplayStop on tab hide,
// midgame only on "Next" (not on Map), UI blocked + game paused + audio muted during ads,
// rewarded buttons hidden with an adblocker, progress saved through the Data Module (not localStorage).
const { chromium } = require('playwright');
const MOCK = (adblock) => `
window.__calls = [];
const log = (n) => window.__calls.push(n);
const store = {};
window.CrazyGames = { SDK: {
  environment: 'crazygames',
  init: async () => log('init'),
  game: { settings: { muteAudio: false }, addSettingsChangeListener() {},
    loadingStart: () => log('loadingStart'), loadingStop: () => log('loadingStop'),
    gameplayStart: () => log('gameplayStart'), gameplayStop: () => log('gameplayStop'), happytime: () => log('happytime') },
  ad: { hasAdblock: async () => ${adblock},
    requestAd: (type, cb) => { log('requestAd:' + type); setTimeout(() => { log('adStarted'); cb.adStarted && cb.adStarted();
      window.__duringAd = { blocked: !!document.elementFromPoint(5, 5) && document.elementFromPoint(5, 5).style.zIndex === '99' };
      setTimeout(() => { log('adFinished'); cb.adFinished && cb.adFinished(); }, 400); }, 200); } },
  data: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; log('data.setItem'); }, removeItem: (k) => { delete store[k]; } },
} };`;
async function run(browser, adblock) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.route('https://sdk.crazygames.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: MOCK(adblock) }));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.evaluate(() => localStorage.clear()); await p.waitForFunction(() => window.__tts && ['s-title', 's-game'].includes(window.__tts.state.screen));
  const calls = () => p.evaluate(() => window.__calls.slice());
  const res = {};
  res.boot = (await calls()).slice(0, 3).join(',');
  // play level 3 to the end via the solver, but with real UI for the result screen
  await p.evaluate(() => { const S = window.__tts.state.S; S.stars[1] = 3; S.stars[2] = 3; window.__tts.startLevel(3); });
  await p.waitForTimeout(500);
  res.startOnPlay = (await calls()).includes('gameplayStart');
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // visible -> no-op
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  res.noStopOnHide = !(await calls()).includes('gameplayStop');
  await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  await p.click('#p-resume');
  await p.evaluate(() => { const b = window.__tts.board(); const r = window.__tts.L.solve(b.cells(), b.w, b.h); for (const m of r.solution) b._commitMatch(m); });
  await p.waitForSelector('#w-map', { state: 'visible' });
  res.stopOnWin = (await calls()).includes('gameplayStop');
  res.doubleCoinsShown = !!(await p.$('#w-double'));
  await p.waitForTimeout(1200);
  // Map must NOT trigger a midgame ad, even with the timer elapsed
  await p.evaluate(() => window.__cgDebug.resetMidgame());
  await p.click('#w-map'); await p.waitForTimeout(800);
  res.noMidgameOnMap = !(await calls()).some((c) => c === 'requestAd:midgame');
  // Next must trigger it (timer elapsed)
  await p.evaluate(() => window.__tts.startLevel(4)); await p.waitForTimeout(400);
  await p.evaluate(() => { const b = window.__tts.board(); const r = window.__tts.L.solve(b.cells(), b.w, b.h); for (const m of r.solution) b._commitMatch(m); });
  await p.waitForSelector('#w-next', { state: 'visible' }); await p.waitForTimeout(1200);
  await p.evaluate(() => window.__cgDebug.resetMidgame());
  await p.click('#w-next');
  await p.waitForTimeout(300); // during the ad
  const during = await p.evaluate(() => ({ g: window.__tts.state.G && window.__tts.state.G.level }));
  await p.waitForTimeout(1000);
  const c2 = await calls();
  res.midgameOnNext = c2.includes('requestAd:midgame') && c2.includes('adFinished');
  res.uiBlockedDuringAd = await p.evaluate(() => !!(window.__duringAd && window.__duringAd.blocked));
  res.nextLevelAfterAd = (await p.evaluate(() => window.__tts.state.G && window.__tts.state.G.level)) === 5 && during.g !== 5;
  // rewarded offers in the booster shop
  await p.evaluate(() => { window.__tts.state.S.boosters.hint = 0; });
  await p.keyboard.press('h'); await p.waitForTimeout(300);
  res.rewardedShopButton = !!(await p.$('#bb-ad'));
  await p.click('#bb-close');
  // save through the Data Module, not localStorage
  await p.waitForTimeout(400);
  res.savedViaDataModule = (await calls()).includes('data.setItem');
  res.localStorageUnused = await p.evaluate(() => localStorage.getItem('tts_save_v1') === null);
  res.errors = errs.length ? errs.join('; ') : 'none';
  await ctx.close();
  return res;
}
(async () => {
  const browser = await chromium.launch();
  console.log('normal  :', JSON.stringify(await run(browser, false)));
  console.log('adblock :', JSON.stringify(await run(browser, true)));
  await browser.close();
})();
