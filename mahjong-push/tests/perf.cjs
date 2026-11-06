// Performance / leak check: node tests/perf.cjs
// 1) Endless mode auto-played for 25 s while sampling frame times.
// 2) 80 level starts/clears in a row, comparing JS heap before/after (after GC).
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8123/index.html';
(async () => {
  const browser = await chromium.launch({ args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('throttled')) errors.push(m.text()); });
  await p.goto(URL); await p.waitForSelector('#s-title.show');
  await p.evaluate(() => window.__tts.startEndless());
  await p.waitForTimeout(800);
  const res = await p.evaluate(() => new Promise((resolve) => {
    const frames = []; let last = performance.now(); const t0 = last;
    const auto = setInterval(() => {
      const b = window.__tts.board(); const L = window.__tts.L;
      if (b.over || b.paused) return;
      const c = b.cells(); const ms = L.allMoves(c, b.w, b.h);
      if (ms.length) b._commitMatch(ms[0]);
      window.__tts.state.G.timeLeft = 60; // keep the run going
    }, 220);
    function f(now) {
      frames.push(now - last); last = now;
      if (now - t0 < 25000) requestAnimationFrame(f);
      else {
        clearInterval(auto);
        frames.sort((a, b) => a - b);
        const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
        resolve({ n: frames.length, fps: 1000 / avg, p95: frames[Math.floor(frames.length * 0.95)], max: frames[frames.length - 1], boards: window.__tts.state.G.boards });
      }
    }
    requestAnimationFrame(f);
  }));
  console.log(`endless 25s: ${res.n} frames, avg ${res.fps.toFixed(1)} fps, p95 frame ${res.p95.toFixed(1)} ms, max ${res.max.toFixed(1)} ms, boards cleared ${res.boards}`);

  const heap = () => p.evaluate(() => { if (window.gc) window.gc(); return performance.memory ? performance.memory.usedJSHeapSize : 0; });
  await p.evaluate(() => window.__tts.openTitle());
  await p.waitForTimeout(500);
  const h0 = await heap();
  for (let i = 0; i < 80; i++) {
    await p.evaluate((n) => {
      window.__tts.startLevel(n);
      const b = window.__tts.board(); const L = window.__tts.L;
      const r = L.solve(b.cells(), b.w, b.h, 50000);
      if (r.solution) for (const m of r.solution) b._commitMatch(m);
    }, 3 + (i % 57));
    await p.waitForTimeout(60);
  }
  await p.evaluate(() => window.__tts.openTitle());
  await p.waitForTimeout(1500);
  const h1 = await heap();
  console.log(`heap before ${(h0 / 1e6).toFixed(1)} MB, after 80 levels ${(h1 / 1e6).toFixed(1)} MB (delta ${((h1 - h0) / 1e6).toFixed(1)} MB)`);
  console.log(errors.length ? 'ERRORS: ' + errors.join('\n') : 'no console errors');
  await browser.close();
})();
