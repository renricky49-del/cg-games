// Opening-pace benchmark for a brand-new player who reacts instantly:
// clicks/time from page load to first playable board, the tutorial hand delay, the dead time between
// clearing a level and the next board being playable (levels 1->2->3->4), and when the teahouse is first shown.
// node tests/pace.cjs   (static server on :8123)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.evaluate(() => localStorage.clear());
  const t0 = Date.now(); await p.reload();
  let clicks = 0;
  const visible = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && !e.closest('.hidden') && getComputedStyle(e).visibility !== 'hidden' && !!e.offsetParent; }, sel);
  // reach the first board
  for (;;) {
    const scr = await p.evaluate(() => window.__tts && window.__tts.state.screen);
    if (scr === 's-game') break;
    if (scr === 's-title' && await visible('[data-act=play]')) { await p.click('#s-title [data-act=play]'); clicks++; }
    await p.waitForTimeout(30);
  }
  const playable = () => p.evaluate(() => { const bv = window.__tts.board(); return bv.active && !bv.paused && !bv.over && bv.tiles.length > 0 && bv.tiles.every((t) => t.intro >= 1); });
  while (!(await playable())) await p.waitForTimeout(20);
  console.log(`first playable board: ${((Date.now() - t0) / 1000).toFixed(2)} s after load, ${clicks} click(s)`);
  const tHand = Date.now();
  while (!(await p.evaluate(() => { const h = document.getElementById('hand'); return !document.getElementById('tutorial').classList.contains('hidden') && h.style.display !== 'none' && !!h.style.left; }))) await p.waitForTimeout(20);
  console.log(`tutorial hand shows after ${((Date.now() - tHand) / 1000).toFixed(2)} s`);
  let houseAt = null;
  for (let lvl = 1; lvl <= 4; lvl++) {
    const L0 = await p.evaluate(() => window.__tts.state.G.level);
    // play the level instantly through the board API
    await p.evaluate(() => { const bv = window.__tts.board(); const r = window.__tts.L.solve(bv.cells(), bv.w, bv.h); for (const m of r.solution) bv._commitMatch(m); });
    const tClear = Date.now(); let gap = 0;
    // advance as fast as the UI allows
    for (;;) {
      const st = await p.evaluate(() => ({ scr: window.__tts.state.screen, lvl: window.__tts.state.G && window.__tts.state.G.level }));
      if (st.scr === 's-house') { // restore one affordable piece, then Play -> straight back to the next level
        const btn = await p.$('#tasks .btn.primary.pulse');
        if (btn) { await btn.click(); gap++; await p.waitForTimeout(300); if (await visible('#ad-go')) { await p.click('#ad-go'); gap++; } }
        await p.click('#s-house [data-act=play]'); gap++;
        await p.waitForTimeout(50); continue;
      }
      if (st.scr === 's-game' && st.lvl !== L0 && await playable()) break;
      if (await visible('#w-house.pulse')) { houseAt = houseAt || `after level ${L0} (prompted)`; await p.click('#w-house'); gap++; }
      else if (await visible('#w-next')) { await p.click('#w-next'); gap++; }
      await p.waitForTimeout(20);
    }
    console.log(`level ${L0} cleared -> level ${L0 + 1} playable: ${((Date.now() - tClear) / 1000).toFixed(2)} s, ${gap} click(s)`);
  }
  console.log('teahouse first shown:', houseAt || 'not within the first 4 levels');
  console.log(errs.length ? 'ERRORS ' + errs.join('; ') : 'no errors');
  await b.close();
})();
