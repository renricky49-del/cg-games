// End-to-end test: node tests/play.cjs  (expects a static server on :8123 serving mahjong-push/)
// Plays the two tutorial levels and level 3 with real mouse input, forces a loss, screenshots key screens.
const { chromium } = require('playwright');
const OUT = process.env.OUT || 'tests/shots';
const URL = process.env.URL || 'http://localhost:8123/index.html';
require('fs').mkdirSync(OUT, { recursive: true });

async function cellCenter(p, i) {
  return p.evaluate((i) => {
    const b = window.__tts.board();
    const x = i % b.w, y = (i / b.w) | 0;
    return { x: b.sx(x, y) + b.cw / 2, y: b.sy(x, y) + b.ch / 2 };
  }, i);
}
async function doMove(p, m) {
  if (m.type === 'match') {
    const a = await cellCenter(p, m.a), b = await cellCenter(p, m.b);
    await p.mouse.click(a.x, a.y); await p.waitForTimeout(120);
    await p.mouse.click(b.x, b.y); await p.waitForTimeout(450);
  } else {
    const a = await cellCenter(p, m.from), b = await cellCenter(p, m.to);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    const steps = 8;
    for (let s = 1; s <= steps; s++) { await p.mouse.move(a.x + (b.x - a.x) * s / steps, a.y + (b.y - a.y) * s / steps); await p.waitForTimeout(16); }
    await p.mouse.up(); await p.waitForTimeout(550);
  }
}
async function solveAndPlay(p) {
  const sol = await p.evaluate(() => {
    const b = window.__tts.state.board;
    const r = window.__tts.L.solve(b.cells, b.w, b.h, 200000);
    return r.solution && r.solution.map((m) => ({ type: m.type, a: m.a, b: m.b, from: m.from, to: m.to }));
  });
  if (!sol) throw new Error('no solution found');
  for (const m of sol) await doMove(p, m);
  return sol.length;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  // brand-new players land straight in the tutorial (no title click)
  await p.waitForFunction(() => window.__tts && window.__tts.state.screen === 's-game' && window.__tts.state.G.level === 1);
  console.log('new player lands directly in level 1');

  // Level 1 — tutorial (direct matches)
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/02_tutorial_match.png` });
  const n1 = await solveAndPlay(p);
  console.log('level 1 won in', n1, 'moves');

  // Level 2 — tutorial (push): starts automatically
  await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 2, null, { timeout: 5000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/04_tutorial_push.png` });
  const n2 = await solveAndPlay(p);
  console.log('level 2 won in', n2, 'moves');

  // Level 3 — first generated level (starts automatically), solver-driven mouse play
  await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 3, null, { timeout: 5000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/05_level3.png` });
  const n3 = await solveAndPlay(p);
  await p.waitForSelector('#w-house.pulse', { state: 'visible', timeout: 5000 });
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/03_level_complete.png` });
  console.log('level 3 won in', n3, 'moves; teahouse prompt shown');
  const st = await p.evaluate(() => ({ stars: window.__tts.state.S.stars, bank: window.__tts.state.S.bank, coins: window.__tts.state.S.coins }));
  console.log('progress', JSON.stringify(st));
  await p.click('#w-house');
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/05b_first_restore_prompt.png` });
  await p.click('#tasks .btn.primary.pulse'); await p.waitForTimeout(1200);
  await p.click('#s-house [data-act=play]');
  await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 4, null, { timeout: 5000 });
  console.log('first restore done, Play went straight to level 4');
  await p.evaluate(() => window.__tts.openTitle()); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/01_title.png` });
  await p.evaluate(() => window.__tts.openMap(0));
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/06_map.png` });

  // A failed push (no match) must slide back
  await p.evaluate(() => window.__tts.startLevel(30));
  await p.waitForTimeout(900);
  const failRes = await p.evaluate(() => {
    const b = window.__tts.board(); const L = window.__tts.L; const c = b.cells();
    for (let i = 0; i < c.length; i++) { if (c[i] < 0) continue; for (let d = 0; d < 4; d++) { const info = L.pushInfo(c, b.w, b.h, i, d); if (info.maxK > 0 && !L.tryPush(c, b.w, b.h, i, d, 1, info)) return { i, to: i + [-b.w, b.w, -1, 1][d] }; } }
    return null;
  });
  const before = await p.evaluate(() => window.__tts.state.board.cells.join(','));
  await doMove(p, { type: 'push', from: failRes.i, to: failRes.to });
  const after = await p.evaluate(() => window.__tts.state.board.cells.join(','));
  console.log('non-matching push reverted:', before === after);

  // Hint, undo, shuffle
  await p.click('[data-act=hint]'); await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/07_hint.png` });
  await p.keyboard.press('p'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/08_pause.png` });
  await p.click('#p-resume');

  // Loss: play random moves on a hard level until stuck, then give up
  let lost = false;
  for (let attempt = 0; attempt < 6 && !lost; attempt++) {
    await p.evaluate(() => window.__tts.startLevel(58));
    await p.waitForTimeout(700);
    for (let k = 0; k < 40; k++) {
      if (await p.$('#st-quit')) { lost = true; break; }
      const m = await p.evaluate(() => {
        const b = window.__tts.state.board; const L = window.__tts.L;
        const ms = L.allMoves(b.cells, b.w, b.h);
        // greedy "bad" play: prefer pushes, they burn options fastest
        const pm = ms.filter((x) => x.type === 'push');
        const pick = (pm.length ? pm : ms)[Math.floor(Math.random() * (pm.length ? pm : ms).length)];
        return pick ? { type: pick.type, a: pick.a, b: pick.b, from: pick.from, to: pick.to } : null;
      });
      if (!m) { await p.waitForTimeout(900); continue; }
      await doMove(p, m);
    }
    if (!lost && await p.$('#st-quit')) lost = true;
  }
  if (lost) {
    await p.screenshot({ path: `${OUT}/09_stuck.png` });
    await p.click('#st-quit'); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/10_failed.png` });
    console.log('loss reached and fail screen shown');
  } else console.log('WARNING: could not reach a loss');

  // Teahouse with stars to spend
  await p.evaluate(() => { const S = window.__tts.state.S; S.bank = 20; window.__tts.openHouse(0); });
  await p.waitForTimeout(800);
  await p.click('#tasks .task button'); await p.waitForTimeout(300);
  await p.click('#tasks .task button'); await p.waitForTimeout(1300);
  await p.screenshot({ path: `${OUT}/11_teahouse.png` });

  // Daily + Endless
  await p.evaluate(() => window.__tts.startDaily()); await p.waitForTimeout(1000);
  await p.screenshot({ path: `${OUT}/12_daily.png` });
  await p.evaluate(() => window.__tts.startEndless()); await p.waitForTimeout(1000);
  await p.screenshot({ path: `${OUT}/13_endless.png` });

  // Save persisted across reload
  await p.evaluate(() => window.__tts.openTitle());
  await p.waitForTimeout(400);
  await p.reload(); await p.waitForSelector('#s-title.show');
  const saved = await p.evaluate(() => window.__tts.state.S.stars);
  console.log('save persisted after reload:', JSON.stringify(saved));

  // Mobile portrait
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await m.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(URL); await mp.waitForFunction(() => window.__tts && window.__tts.state.screen === 's-game'); await mp.evaluate(() => window.__tts.openTitle()); await mp.waitForTimeout(600);
  await mp.screenshot({ path: `${OUT}/m1_title.png` });
  await mp.evaluate(() => window.__tts.startLevel(45)); await mp.waitForTimeout(1000);
  await mp.screenshot({ path: `${OUT}/m2_game.png` });
  console.log('mobile board transposed:', await mp.evaluate(() => window.__tts.state.board.T));
  await mp.evaluate(() => window.__tts.openMap(0)); await mp.waitForTimeout(600);
  await mp.screenshot({ path: `${OUT}/m3_map.png` });
  await mp.evaluate(() => { window.__tts.state.S.areas[1] = [true, true, false, true, false]; window.__tts.state.S.stars[12] = 3; window.__tts.openHouse(1); }); await mp.waitForTimeout(900);
  await mp.screenshot({ path: `${OUT}/m4_house.png` });
  // mobile landscape
  const ml = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const lp = await ml.newPage();
  await lp.goto(URL); await lp.waitForFunction(() => window.__tts && window.__tts.state.screen === 's-game');
  await lp.evaluate(() => window.__tts.startLevel(60)); await lp.waitForTimeout(1000);
  await lp.screenshot({ path: `${OUT}/m5_landscape_game.png` });

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})().catch((e) => { console.error('TEST FAILED', e); process.exit(1); });
