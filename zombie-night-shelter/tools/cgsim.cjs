// Platform simulation: the packaged game runs in a cross-origin iframe with the REAL CrazyGames SDK talking to a
// scripted parent page (the same postMessage handshake the site uses), so the "crazygames" code path is tested:
// loading time, loadingStart/Stop + gameplayStart events, Basic Launch (ads disabled) and Full Launch (ads on),
// missing files, and things browsers block inside game iframes (confirm()).
// usage: node tools/cgsim.cjs [gameDir=. | path to unzipped build]      (needs internet for sdk.crazygames.com)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const gameDir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', woff2: 'font/woff2' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (ok, label, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };

async function run(b, flow) {
  console.log(`--- launch flow: ${flow} (${flow === 'basic' ? 'ads disabled, what QA reviews first' : 'ads enabled'}) ---`);
  const W = 907, H = 510;
  const ctx = await b.newContext({ viewport: { width: W + 40, height: H + 40 } });
  const page = await ctx.newPage();
  const notFound = [], errs = [];
  await ctx.route('http://cg-parent.test/**', (r) => r.fulfill({ contentType: r.request().url().endsWith('.js') ? 'text/javascript' : 'text/html', body: r.request().url().endsWith('.js') ? '/* no ads script in the simulation */' : `<!doctype html><body style="margin:0;background:#111">
<iframe id="g" src="http://cg-game.test/index.html" width="${W}" height="${H}" style="border:0;margin:20px" allow="autoplay; fullscreen"></iframe>
<script>
const F = document.getElementById('g'), flow = ${JSON.stringify(flow)}; window.msgs = []; const send = (m) => F.contentWindow.postMessage(m, '*');
addEventListener('message', (e) => { const d = e.data; if (!d || !d.type) return; window.msgs.push({ t: performance.now(), type: d.type, data: d.data });
  if (d.type === 'checkCrazyGamesGF') send({ type: 'crazyGamesGFConfirmation' });
  if (d.type === 'init-js-sdk') { send({ type: 'initialized', data: { gameLink: 'https://www.crazygames.com/preview/sim', gameId: 'sim', launchFlow: flow,
      systemInfo: { applicationType: 'web', countryCode: 'US', browser: { name: 'Chrome', version: '1' }, os: { name: 'Linux', version: '1' }, device: { type: 'desktop' } },
      userAccountAvailable: true, dataModule: { isEnabled: true }, rafvertizingUrl: 'http://cg-parent.test/noads.js', clientInfo: {}, configCatValues: {} } });
    send({ type: 'initialUserSet', messageTarget: 'sdk', data: { user: null } }); }
  // the adblock check is never answered on purpose: loading must not wait for it
  if (d.type === 'requestAd') { setTimeout(() => send({ type: 'adStarted', messageTarget: 'sdk' }), 300); setTimeout(() => send({ type: 'adFinished', messageTarget: 'sdk' }), 1500); }
});
</script></body>` }));
  await ctx.route('http://cg-game.test/**', (r) => { let p = decodeURIComponent(new URL(r.request().url()).pathname); if (p === '/') p = '/index.html'; const f = path.join(gameDir, p);
    if (!f.startsWith(gameDir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { notFound.push(p); return r.fulfill({ status: 404, body: '' }); }
    r.fulfill({ contentType: MIME[f.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  page.on('pageerror', (e) => errs.push(e.message));
  const t0 = Date.now();
  await page.goto('http://cg-parent.test/');
  let f = null; for (let i = 0; i < 100 && !f; i++) { f = page.frames().find((q) => q.url().includes('cg-game.test')); await sleep(50); }
  await f.waitForSelector('#title.show', { timeout: 20000 });
  const loadS = (Date.now() - t0) / 1000;
  check(loadS < 3.5, 'title screen reachable quickly on the platform', loadS.toFixed(2) + ' s');
  const cg = () => f.evaluate(() => import('./js/cg.js').then((m) => ({ sdk: !!m.CG.sdk, env: m.CG.env, adsOff: m.CG.adsOff })));
  const st = await cg();
  check(st.sdk && st.env === 'crazygames', 'real SDK initialised in the crazygames environment', JSON.stringify(st));
  check(st.adsOff === (flow === 'basic'), flow === 'basic' ? 'ads known to be off before any button is shown' : 'ads available');
  await f.click('#btn-play'); await sleep(1300);
  check(await f.evaluate(() => window.__app.screen === 'game'), 'one click from the title into gameplay');
  // lose on purpose
  await f.evaluate(() => { const A = window.__app, g = A.game; g.autoPlayer = true; A.speed = 6; });
  for (let i = 0; i < 400 && !(await f.evaluate(() => window.__app.game.phase === 'night')); i++) await sleep(100);
  await f.evaluate(() => { const A = window.__app, g = A.game; A.speed = 1; g.autoPlayer = false; g._breakRoom(g.player.room, g.bosses[0]); });
  for (let i = 0; i < 100 && !(await f.evaluate(() => ['continue', 'results'].includes(window.__app.screen))); i++) await sleep(100);
  const after = await f.evaluate(() => window.__app.screen);
  if (flow === 'basic') {
    check(after === 'results', 'loss goes straight to results when ads cannot play (no dead "continue" offer)', after);
    const adBtns = await f.evaluate(() => [...document.querySelectorAll('.screen.show .ad')].filter((el) => el.getBoundingClientRect().width > 0).length);
    check(adBtns === 0, 'no rewarded-ad button visible');
  } else {
    check(after === 'continue', 'loss offers a rewarded continue', after);
    await f.click('#btn-continue'); await sleep(2400);
    check(await f.evaluate(() => window.__app.screen === 'game' && window.__app.game.phase === 'night'), 'rewarded continue resumes the night');
  }
  // settings -> reset (confirm() is blocked in cross-origin iframes)
  await f.evaluate(() => { const A = window.__app; A.save.medals = 77; A.save.lastDaily = new Date().toISOString().slice(0, 10); A.persist(); A.showTitle(); });
  await f.click('#btn-settings'); await f.click('#btn-reset'); await sleep(150); await f.click('#btn-reset'); await sleep(300);
  check(await f.evaluate(() => window.__app.save.medals === 0), 'Reset progress works inside the iframe');
  const msgs = await page.evaluate(() => window.msgs.map((m) => m.type));
  const iLS = msgs.indexOf('sdkGameLoadingStart'), iLE = msgs.indexOf('sdkGameLoadingStop'), iGS = msgs.indexOf('gameplayStart');
  check(iLS >= 0 && iLE > iLS, 'loadingStart then loadingStop reported');
  check(iGS > iLE, 'gameplayStart reported after loading');
  check(msgs.includes('gameplayStop'), 'gameplayStop reported on the break');
  check(!msgs.includes('missingGameResourceError') && notFound.length === 0, 'no missing files', notFound.join(', '));
  const real = errs.filter((e) => !/Unexpected token|Script error/.test(e));
  check(real.length === 0, 'no page errors', real.join(' | '));
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  await run(b, 'basic'); await run(b, 'full');
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'all platform checks passed');
  process.exit(fails ? 1 : 0);
})();
