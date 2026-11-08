// Layout check at CrazyGames iframe sizes + phones: every button of every screen must be fully on screen,
// HUD pieces must not overlap each other. usage: node tools/layoutfit.cjs   (needs the static server on :8123)
const { chromium } = require('playwright');
const SIZES = [[800, 450], [907, 510], [1077, 606], [1216, 684], [1366, 768], [1920, 1080], [390, 844], [844, 390]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  let fails = 0, checks = 0;
  for (const [W, H] of SIZES) {
    const p = await b.newPage({ viewport: { width: W, height: H } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto('http://localhost:8123/index.html');
    await p.waitForSelector('#title.show');
    // every visible button / key element inside the viewport
    const inside = async (label, sel) => {
      const bad = await p.evaluate(([sel, W, H]) => [...document.querySelectorAll(sel)].filter((el) => {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return false;
        return r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1;
      }).map((el) => el.id || el.className || el.textContent.trim().slice(0, 20)), [sel, W, H]);
      checks++; if (bad.length) { fails++; console.log(`FAIL ${W}x${H} ${label}: off-screen ${bad.join(', ')}`); }
    };
    const noOverlap = async (label, a, c) => {
      const o = await p.evaluate(([a, c]) => { const A = document.querySelector(a), C = document.querySelector(c); if (!A || !C || A.closest('.hidden') || C.closest('.hidden')) return false;
        const r = A.getBoundingClientRect(), q = C.getBoundingClientRect(); if (!r.width || !q.width) return false;
        return r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1; }, [a, c]);
      checks++; if (o) { fails++; console.log(`FAIL ${W}x${H} ${label}: ${a} overlaps ${c}`); }
    };
    await inside('title', '#title button');
    for (const [btn, scr] of [['#btn-nights', 'nights'], ['#btn-perks', 'perks'], ['#btn-skins', 'skins'], ['#btn-how', 'how'], ['#btn-settings', 'settings']]) {
      await p.evaluate((b) => document.querySelector(b).click(), btn); await sleep(150);
      await inside(scr, `#${scr} .panel-head button, #${scr} .panel-head h2` + (scr === 'settings' ? ', #settings button, #settings label' : ''));
      await p.evaluate(() => window.__app.showTitle()); await sleep(100);
    }
    // daily popup
    await p.evaluate(() => { const A = window.__app; A.save.nightsPlayed = 2; A.save.lastDaily = '2000-01-01'; A.showTitle(); }); await sleep(150);
    await inside('daily', '#daily button, #daily .day');
    await p.evaluate(() => { window.__app.dailyPending = null; window.__app.save.lastDaily = new Date().toISOString().slice(0, 10); window.__app.save.tutDone = true; window.__app.showTitle(); });
    // intro of a 5-boss night
    await p.evaluate(() => window.__app.startNight(12, true)); await sleep(250);
    await inside('intro', '#intro button, #intro .intro-name');
    await p.evaluate(() => window.__app.beginPlay());
    await p.evaluate(() => { const g = window.__app.game; g.autoPlayer = true; window.__app.speed = 6; });
    for (let i = 0; i < 400 && !(await p.evaluate(() => window.__app.game.phase === 'night')); i++) await sleep(100);
    await p.evaluate(() => { window.__app.speed = 1; }); await sleep(700);
    await inside('hud', '#top-btns button, #hud-bottom button:not(.hidden), #phase-box, .boss-box, #scrap-pill');
    await noOverlap('hud', '#phase-box', '#boss-boxes');
    await noOverlap('hud', '#scrap-pill', '#phase-box');
    await noOverlap('hud', '#power-pill', '#phase-box');
    await noOverlap('hud', '#top-btns', '#boss-boxes');
    // pause
    await p.evaluate(() => window.__app.pause()); await sleep(150);
    await inside('pause', '#pause button, #pause label');
    await p.evaluate(() => window.__app.resume());
    // continue + results
    await p.evaluate(() => { const A = window.__app, g = A.game; for (const d of g.player.room.doors) d.hp = 0; A.speed = 4; });
    for (let i = 0; i < 100 && !(await p.evaluate(() => !!document.querySelector('#continue.show, #results.show'))); i++) await sleep(100);
    if (await p.$('#continue.show')) { await inside('continue', '#continue button'); await p.evaluate(() => window.__app.showResults()); }
    await sleep(300);
    await inside('results', '#results button:not(.hidden), #res-stars');
    if (errs.length) { fails++; console.log(`FAIL ${W}x${H} page errors: ${errs.join(' | ')}`); }
    await p.close();
  }
  console.log(`${checks} checks, ${fails} failures`);
  await b.close();
  process.exit(fails ? 1 : 0);
})();
