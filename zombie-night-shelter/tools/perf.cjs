// Performance / leak check: late night (lots of turrets, minions, particles), measure frame times and heap.
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#title.show');
  await p.evaluate(() => { const A = window.__app; A.save.tutDone = true; A.startNight(10, true); });
  await p.waitForSelector('#intro.show'); await p.click('#btn-start');
  await p.evaluate(() => { const A = window.__app; A.game.autoPlayer = true; A.game.perks = { start: 5, door: 5, dmg: 5, bed: 5, fix: 4 }; A.speed = 8; });
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) { const ok = await p.evaluate(() => window.__app.game.phase === 'night' && window.__app.game.stats.timeSurvived > 60 || window.__app.isOver()); if (ok) break; await sleep(300); }
  const measure = () => p.evaluate(async () => {
    const A = window.__app; A.speed = 2;
    const fr = []; let last = performance.now();
    await new Promise((res) => { const f = (t) => { fr.push(t - last); last = t; if (fr.length < 600) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    fr.sort((a, b) => a - b);
    return { avg: +(fr.reduce((a, b) => a + b, 0) / fr.length).toFixed(2), p95: +fr[570].toFixed(2), max: +fr[599].toFixed(1), heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6), ent: A.game.enemies.length, bld: A.game.buildings.length, proj: A.game.projectiles.length, parts: A.renderer.particles.length, phase: A.game.phase };
  });
  console.log('m1', JSON.stringify(await measure()));
  await p.screenshot({ path: (process.argv[2] || require('os').tmpdir()) + '/21_perf.png' });
  console.log('m2', JSON.stringify(await measure()));
  console.log('m3', JSON.stringify(await measure()));
  console.log(errs.length ? errs.join('\n') : 'no errors');
  await b.close();
})();
