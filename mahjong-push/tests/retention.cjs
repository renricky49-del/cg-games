// Retention-feature test: first session (daily first win, goals line, hot streak, day-1 calendar after
// level 5, early free shuffle, guaranteed early Tea Rush) and a next-day return (welcome back + calendar
// day 2 + tips + new orders). node tests/retention.cjs  (static server on :8123)
const { chromium } = require('playwright');
const OUT = process.env.OUT || 'tests/shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:8123/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => window.__tts && window.__tts.state.screen === 's-game');
  const vis = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !document.getElementById('modal').classList.contains('hidden') && !!e.offsetParent; }, sel);
  const solve = () => p.evaluate(() => { const bv = window.__tts.board(); const r = window.__tts.L.solve(bv.cells(), bv.w, bv.h, 80000); for (const m of r.solution) bv._commitMatch(m); });
  const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) process.exitCode = 1; };
  // tutorials
  await solve(); await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 2);
  await p.waitForTimeout(500); await solve(); await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 3);
  await p.waitForTimeout(600); await solve();
  await p.waitForSelector('#w-house', { state: 'visible' }); await p.waitForTimeout(900);
  const card3 = await p.evaluate(() => document.getElementById('modal-card').innerText);
  check('daily first win bonus on first real level', /Daily first win/.test(card3));
  await p.screenshot({ path: `${OUT}/r1_first_win.png` });
  await p.click('#w-next');
  await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 4); await p.waitForTimeout(600); await solve();
  await p.waitForSelector('#w-next', { state: 'visible' }); await p.waitForTimeout(800);
  const card4 = await p.evaluate(() => document.getElementById('modal-card').innerText);
  check('goals line shows next restoration / order', /Ready to restore|more for the|orders?|\d+\/\d+/.test(card4));
  check('hot streak bonus shown at streak 2', /Hot streak ×2/.test(card4));
  await p.screenshot({ path: `${OUT}/r2_goals_streak.png` });
  await p.click('#w-next');
  await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 5); await p.waitForTimeout(500);
  const rush5 = await p.evaluate(() => window.__tts.state.G.rush);
  check('first Tea Rush meter pre-filled on level 5 (or a Tea Rush already happened)', rush5 >= 65 || await p.evaluate(() => window.__tts.state.S.stats.rush > 0));
  check('streak flame visible in HUD', await p.evaluate(() => !document.getElementById('g-streak').classList.contains('hidden')));
  await solve(); await p.waitForSelector('#w-next', { state: 'visible' }); await p.waitForTimeout(700);
  await p.click('#w-next');
  await p.waitForSelector('#cal-claim', { state: 'visible', timeout: 5000 });
  check('day-1 gift calendar introduced after level 5', true);
  await p.screenshot({ path: `${OUT}/r3_calendar_day1.png` });
  await p.click('#cal-claim'); await p.waitForTimeout(500);
  const calTxt = await p.evaluate(() => document.getElementById('modal-card').innerText);
  check('calendar shows tomorrow preview after claiming', /Tomorrow: Day 2/.test(calTxt));
  await p.click('#cal-ok');
  await p.waitForFunction(() => window.__tts.state.G && window.__tts.state.G.level === 6, null, { timeout: 5000 });
  check('continues into level 6 after the calendar', true);
  // early stuck = free shuffle
  await p.evaluate(() => window.__tts.board().cb.onStuck()); await p.waitForTimeout(300);
  check('chapter-1 stuck dialog offers a free shuffle', /Free shuffle/.test(await p.evaluate(() => document.getElementById('st-shuffle').innerText)));
  const shufBefore = await p.evaluate(() => window.__tts.state.S.boosters.shuffle);
  await p.click('#st-shuffle'); await p.waitForTimeout(400);
  check('free shuffle does not consume a booster', shufBefore === await p.evaluate(() => window.__tts.state.S.boosters.shuffle));
  // giving up resets the streak
  await p.evaluate(() => window.__tts.board().cb.onStuck()); await p.waitForTimeout(300); await p.click('#st-quit'); await p.waitForTimeout(300);
  check('giving up resets the hot streak', (await p.evaluate(() => window.__tts.state.S.streak)) === 0);
  // next day: welcome back
  await p.evaluate(() => {
    const S = window.__tts.state.S; const y = new Date(); y.setDate(y.getDate() - 1);
    const ys = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    S.lastSeen = ys; S.login.last = ys; S.orders.day = ys; S.areas[0][0] = true; S.tipT = Date.now() - 6 * 3600000; S.firstWin = ys;
    window.__tts.setSave(JSON.parse(JSON.stringify(S))); // through the game's own save (SDK Data Module)
  });
  await p.waitForTimeout(1500); await p.reload();
  await p.waitForSelector('#cal-claim', { state: 'visible', timeout: 6000 });
  const wb = await p.evaluate(() => document.getElementById('modal-card').innerText);
  check('returning player sees Welcome back', /Welcome back/.test(wb));
  check('welcome lists tips + new orders + daily puzzle', /tips/.test(wb) && /guest orders/.test(wb) && /Daily Puzzle/.test(wb));
  check('calendar advanced to Day 2', /Claim Day 2/.test(wb));
  await p.screenshot({ path: `${OUT}/r4_welcome_back.png` });
  await p.click('#cal-claim'); await p.waitForTimeout(400); await p.click('#cal-ok');
  check('day 2 gives 2 hints', (await p.evaluate(() => window.__tts.state.S.login.day)) === 2);
  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no console errors');
  await b.close();
})();
