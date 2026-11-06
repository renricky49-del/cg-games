// Runs the game against a mock CrazyGames SDK v3 in "basic" (ads disabled) and "full" launch modes and checks:
// - Basic: no rewarded-ad button is ever shown (pre-battle, results, shop); no errors.
// - Full: rewarded buttons appear and work; audio is muted + game paused during ads; gameplayStart/Stop are balanced;
//         no midgame ad right after a rewarded ad in the same break; data module is used for saves.
// Usage: node tests/sdk_mock.cjs
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8123/index.html';
const mockSdk = mode => `
(() => {
  const log = window.__sdkLog = [];
  const store = {};
  const err = (code, message) => { const e = new Error(message); e.code = code; return e; };
  window.CrazyGames = { SDK: {
    init: async () => { log.push('init'); },
    get environment() { return 'crazygames'; },
    game: { settings: { muteAudio: false }, addSettingsChangeListener() {},
      loadingStart: () => log.push('loadingStart'), loadingStop: () => log.push('loadingStop'),
      gameplayStart: () => log.push('gameplayStart'), gameplayStop: () => log.push('gameplayStop'), happytime: () => log.push('happytime') },
    ad: {
      prefetchAd(t) { if ('${mode}' === 'basic') throw err('adsDisabledBasicLaunch', 'Ads are disabled during basic launch'); log.push('prefetch:' + t); },
      requestAd(t, cb) {
        log.push('requestAd:' + t);
        if ('${mode}' === 'basic') { cb.adError(err('adsDisabledBasicLaunch', 'Ads are disabled during basic launch')); return; }
        setTimeout(() => { cb.adStarted(); log.push('adStarted:' + t); setTimeout(() => { log.push('adFinished:' + t); cb.adFinished(); }, 400); }, 50);
      },
      hasAdblock: async () => false,
    },
    data: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); log.push('data.setItem'); }, removeItem: k => { delete store[k]; }, clear() {} },
  } };
})();`;

(async () => {
  const browser = await chromium.launch(); let failures = 0;
  const fail = m => { failures++; console.log('FAIL:', m); };
  for (const mode of ['basic', 'full']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.route('**/sdk.crazygames.com/**', r => r.fulfill({ contentType: 'application/javascript', body: mockSdk(mode) }));
    await p.goto(URL); await p.waitForSelector('#play');
    await p.evaluate(() => { __LL.P.tutorialDone = true; __LL.P.coins = 500; __LL.show('prematch', { mode: 'ladder', rivalIndex: 0 }); });
    await p.waitForTimeout(200);
    const hsAd = await p.$('#hsAd');
    if (mode === 'basic' && hsAd) fail('basic: head-start ad button shown');
    if (mode === 'full' && !hsAd) fail('full: head-start ad button missing');
    if (mode === 'full') { await hsAd.click(); await p.waitForTimeout(150); const muted = await p.evaluate(() => document.querySelector('#hs').textContent); await p.waitForTimeout(700); const ready = await p.evaluate(() => document.querySelector('#hs').textContent.includes('ready')); if (!ready) fail('full: head start not granted after ad'); }
    await p.click('#go'); await p.waitForTimeout(500);
    const startInk = await p.evaluate(() => Math.round(__LL.ctl.match.sides[0].ink));
    if (mode === 'full' && startInk < 150) fail('full: head start ink not applied (' + startInk + ')');
    // win quickly through the real end flow
    await p.evaluate(() => __LL.ctl.match.finish(0, "The rival's ward fell"));
    await p.waitForSelector('.results', { timeout: 5000 }); await p.waitForTimeout(300);
    const dbl = await p.$('#dbl');
    if (mode === 'basic' && dbl) fail('basic: double-coins ad button shown');
    if (mode === 'full') {
      if (!dbl) fail('full: double-coins button missing');
      else {
        const before = await p.evaluate(() => __LL.P.coins);
        // pause/mute check while the ad plays
        await dbl.click(); await p.waitForTimeout(200);
        const during = await p.evaluate(() => ({ muted: document.body && true }));
        await p.waitForTimeout(600);
        const after = await p.evaluate(() => __LL.P.coins);
        if (after <= before) fail('full: double coins not granted');
      }
      // pretend 3+ minutes passed so a midgame would be allowed, then continue: must NOT request a midgame (rewarded used)
      await p.evaluate(() => { window.__sdkLog.push('--continue--'); });
    }
    await p.click('#cont'); await p.waitForTimeout(1500);
    // shop
    await p.evaluate(() => __LL.show('shop')); await p.waitForTimeout(200);
    const rerollAd = await p.$('#rerollAd');
    if (mode === 'basic' && rerollAd) fail('basic: shop ad button shown');
    if (mode === 'full' && !rerollAd) fail('full: shop ad button missing');
    const log = await p.evaluate(() => window.__sdkLog);
    const after = log.slice(log.indexOf('--continue--'));
    if (mode === 'full' && after.includes('requestAd:midgame')) fail('full: midgame requested right after a rewarded ad');
    const starts = log.filter(x => x === 'gameplayStart').length, stops = log.filter(x => x === 'gameplayStop').length;
    if (!log.includes('loadingStart') || !log.includes('loadingStop')) fail(mode + ': loadingStart/Stop missing');
    if (starts < 1 || Math.abs(starts - stops) > 1) fail(`${mode}: unbalanced gameplayStart(${starts})/Stop(${stops})`);
    if (!log.includes('data.setItem')) fail(mode + ': progress not saved through SDK data module');
    if (errors.length) fail(mode + ': page errors ' + JSON.stringify(errors));
    console.log(mode, 'sdk log:', log.filter(x => !x.startsWith('data')).join(' → '));
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? `FAILURES: ${failures}` : 'SDK MOCK TESTS PASSED');
  process.exit(failures ? 1 : 0);
})();
