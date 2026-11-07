// CrazyGames SDK rules during a full v1.1 battle (mock SDK, Full Launch):
// - no ad request of any kind from battle start to the results screen (blessing draft, Hex, quests included)
// - the blessing draft reports gameplayStop and the pick reports gameplayStart again
// - a midgame ad plays only after Continue, only when 3+ minutes have passed, with audio muted and nothing running
// - claiming a daily quest never triggers an ad
// Usage: node tests/sdk_battle.cjs
const { chromium } = require('playwright');
const URL = 'http://127.0.0.1:8123/index.html';
const mock = `(() => {
  const log = window.__sdkLog = []; const store = {};
  const real = Date.now.bind(Date); window.__skew = 0; Date.now = () => real() + window.__skew;
  window.CrazyGames = { SDK: { init: async () => log.push('init'), get environment() { return 'crazygames'; },
    game: { settings: { muteAudio: false }, addSettingsChangeListener() {}, loadingStart: () => log.push('loadingStart'), loadingStop: () => log.push('loadingStop'),
      gameplayStart: () => log.push('gameplayStart'), gameplayStop: () => log.push('gameplayStop'), happytime: () => log.push('happytime') },
    ad: { prefetchAd: t => log.push('prefetch:' + t), hasAdblock: async () => false,
      requestAd(t, cb) { log.push('requestAd:' + t); setTimeout(() => { cb.adStarted(); log.push('adStarted:' + t); window.__during = { muted: window.__audioMuted && window.__audioMuted(), ctl: !!(window.__LL && __LL.ctl) }; setTimeout(() => { log.push('adFinished:' + t); cb.adFinished(); }, 400); }, 50); } },
    data: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, clear() {} } } };
})();`;
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.route('**/sdk.crazygames.com/**', r => r.fulfill({ contentType: 'application/javascript', body: mock }));
  await p.goto(URL); await p.waitForSelector('#play');
  await p.evaluate(async () => { const { Audio } = await import('./js/audio.js'); window.__audioMuted = () => !!Audio.state.adMuted; });
  await p.evaluate(() => { __LL.P.tutorialDone = true; __LL.P.ladder = 2; __LL.show('prematch', { mode: 'ladder', rivalIndex: 2 }); });
  await p.waitForTimeout(300); await p.click('#go'); await p.waitForTimeout(500);
  const mark = await p.evaluate(() => { __sdkLog.push('--battle--'); return __sdkLog.length; });
  await p.evaluate(async () => { const mod = await import('./js/ai.js'); const ctl = __LL.ctl; const br = new mod.CpuBrain(ctl.match.sides[0], { think: 0.5, skill: 0.9, spell: 5, mistakes: 0 }); const o = ctl.update.bind(ctl); ctl.update = dt => { if (!ctl.paused) br.update(dt * ctl.speed); o(dt); }; ctl.speed = 3; });
  await p.waitForSelector('.modal.draft .boon-card', { timeout: 60000 }); await p.waitForTimeout(300);
  const atDraft = await p.evaluate(() => __sdkLog.slice(-1)[0]);
  ok(atDraft === 'gameplayStop', `blessing draft reports gameplayStop (last event: ${atDraft})`);
  await p.waitForTimeout(600); await p.keyboard.press('1'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => __sdkLog.slice(-1)[0]) === 'gameplayStart', 'picking a blessing reports gameplayStart');
  await p.evaluate(() => { const me = __LL.ctl.me; me.hex = me.hexNeed(); }); await p.keyboard.press('h'); await p.waitForTimeout(400);
  ok(await p.evaluate(() => __LL.ctl.me.stats.hexes) >= 1, 'Hex sent with the H key');
  await p.waitForTimeout(4000);
  await p.evaluate(() => __LL.ctl.match.finish(0, "The rival's ward fell"));
  await p.waitForSelector('.results', { timeout: 8000 }); await p.waitForTimeout(300);
  const battle = await p.evaluate(m => __sdkLog.slice(m), mark);
  ok(!battle.some(x => x.startsWith('requestAd')), 'no ad requested during the battle: ' + battle.join(' → '));
  ok(battle[battle.length - 1] === 'gameplayStop' || battle.slice(-2).includes('gameplayStop'), 'results screen is outside gameplay');
  // 4 minutes later, Continue (no rewarded ad used) → one midgame, muted, with no battle running
  await p.evaluate(() => { window.__skew += 4 * 60 * 1000; __sdkLog.push('--continue--'); });
  await p.click('#cont'); await p.waitForTimeout(1600);
  const after = await p.evaluate(() => __sdkLog.slice(__sdkLog.indexOf('--continue--')));
  ok(after.filter(x => x === 'requestAd:midgame').length === 1, 'exactly one midgame after Continue: ' + after.join(' → '));
  const during = await p.evaluate(() => window.__during);
  ok(during && during.muted && !during.ctl, `audio muted and no battle running during the ad (${JSON.stringify(during)})`);
  await p.waitForSelector('.hub', { timeout: 8000 });
  // a quest claim never shows an ad
  await p.evaluate(() => { __LL.P.quests.list[0].prog = 999; __LL.show('hub'); __sdkLog.push('--claim--'); }); await p.waitForTimeout(200);
  await p.click('[data-claim="0"]'); await p.waitForTimeout(600);
  ok(!(await p.evaluate(() => __sdkLog.slice(__sdkLog.indexOf('--claim--')))).some(x => x.startsWith('requestAd')), 'claiming a quest shows no ad');
  // straight into another battle right away: no midgame within 3 minutes of the last one
  await p.click('#fight'); await p.waitForTimeout(300); await p.click('#go'); await p.waitForTimeout(400);
  await p.evaluate(() => { __sdkLog.push('--second--'); __LL.ctl.match.finish(1, 'Your ward fell'); });
  await p.waitForSelector('.results', { timeout: 8000 }); await p.waitForTimeout(300); await p.click('#cont'); await p.waitForTimeout(1500);
  ok(!(await p.evaluate(() => __sdkLog.slice(__sdkLog.indexOf('--second--')))).includes('requestAd:midgame'), 'no second midgame within 3 minutes');
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await b.close(); console.log(fails ? `${fails} FAILED` : 'SDK BATTLE RULES OK'); process.exit(fails ? 1 : 0);
})();
