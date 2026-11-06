// Regression test for the last-pair soft-lock: after the only direct match, the last pair sits behind
// stones where no permutation can help. Shuffle in the stuck dialog must relocate tiles so play continues.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForFunction(() => window.__tts && ['s-title', 's-game'].includes(window.__tts.state.screen));
  await p.evaluate(() => {
    window.__tts.startLevel(5);
    const bv = window.__tts.board(); const L = window.__tts.L;
    bv.start(L.decode('bb#a/##../a#..'), bv.cb); // b-b match leaves a/a trapped
    bv.tiles.forEach((t) => { t.intro = 1; t.alpha = 1; });
  });
  await p.waitForTimeout(300);
  const c = (i) => p.evaluate((i) => { const bv = window.__tts.board(); return { x: bv.sx(i % bv.w, (i / bv.w) | 0) + bv.cw / 2, y: bv.sy(i % bv.w, (i / bv.w) | 0) + bv.ch / 2 }; }, i);
  const a = await c(0), d = await c(1);
  await p.mouse.click(a.x, a.y); await p.mouse.click(d.x, d.y);
  await p.waitForSelector('#st-shuffle', { state: 'visible', timeout: 3000 });
  console.log('stuck dialog shown');
  await p.click('#st-shuffle'); await p.waitForTimeout(800);
  const ok = await p.evaluate(() => { const bv = window.__tts.board(); return window.__tts.L.hasMove(bv.cells(), bv.w, bv.h); });
  console.log('after shuffle a move exists:', ok);
  // finish it
  await p.evaluate(() => { const bv = window.__tts.board(); const L = window.__tts.L; const m = L.allMoves(bv.cells(), bv.w, bv.h)[0]; bv._commitMatch(m); });
  await p.waitForSelector('#w-map', { state: 'visible', timeout: 3000 });
  console.log('level completed after rescue;', errs.length ? 'ERRORS ' + errs.join(';') : 'no errors');
  await b.close();
})();
