// Records the CrazyGames preview videos frame by frame (deterministic, real 1x speed, no audio, no cursor).
// usage: node tools/trailer.cjs landscape|portrait <outDir>   (needs `python3 -m http.server 8123` in the game folder)
// Then tools/trailer.sh stitches the frames + the static cover into store/video/*.mp4.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const mode = process.argv[2] || 'landscape';
const out = path.resolve(process.argv[3] || 'trailer_frames/' + mode);
const FPS = 30;
const VP = mode === 'portrait' ? { width: 720, height: 1080 } : { width: 1280, height: 720 }; // x1.5 -> 1080x1620 / 1920x1080

(async () => {
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VP, deviceScaleFactor: 1.5 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  // manual requestAnimationFrame: the game only advances when we step it
  await page.addInitScript(() => {
    const real = window.requestAnimationFrame.bind(window);
    window.__manual = false; window.__q = []; window.__t = 0;
    window.requestAnimationFrame = (cb) => { if (window.__manual) { window.__q.push(cb); return 1; } return real(cb); };
    window.__step = (n, ms) => { for (let i = 0; i < n; i++) { window.__t += ms; const q = window.__q; window.__q = []; for (const cb of q) cb(window.__t); } };
  });
  await page.goto('http://localhost:8123/index.html');
  await page.evaluate(() => {
    const stars = {}; for (let i = 1; i <= 12; i++) stars[i] = 3;
    localStorage.setItem('lds_save_v1', JSON.stringify({ v: 1, stars, medals: 0, perks: { start: 3, door: 3, dmg: 3, bed: 3, fix: 2 }, skin: 's3',
      music: false, sfx: false, shake: true, tutDone: true, bestEndless: 0, nightsPlayed: 0, lastNight: 13, skinsOwned: ['s0', 's1', 's2', 's3'] }));
  });
  await page.reload();
  await page.waitForSelector('#title.show');
  await page.addStyleTag({ content: '.ad, #btn-headstart, #tutorial, #tut-arrow, #toasts { display: none !important; } * { cursor: none !important; }' });
  await page.evaluate(() => window.__app.startNight(12, true)); // Night 13 "Mixed Company": five different bosses
  await page.waitForSelector('#intro.show');
  await page.evaluate(() => { window.__app.beginPlay(); window.__app.game.autoPlayer = true; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__t = performance.now(); window.__manual = true; });
  await page.waitForTimeout(200);

  let seg = 0, frame = 0;
  const step = (n = 1, ms = 1000 / FPS) => page.evaluate(([n, ms]) => window.__step(n, ms), [n, ms]);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  async function capture(sec, onFrame) {
    seg++; frame = 0;
    const dir = path.join(out, 'seg' + seg); fs.mkdirSync(dir);
    const n = Math.round(sec * FPS);
    for (let i = 0; i < n; i++) {
      if (onFrame) await onFrame(i);
      await step();
      await page.screenshot({ path: path.join(dir, String(++frame).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 });
    }
  }
  async function skipUntil(fn, maxSec = 120) {
    for (let t = 0; t < maxSec * 10; t++) { if (await ev(fn)) return true; await step(1, 100); }
    throw new Error('skipUntil timeout: ' + fn);
  }

  // A: the room rush, camera following the hero
  await capture(3.6);
  await skipUntil(() => window.__app.game.player.state === 'inroom');
  // everyone gets a fat wallet so the floor is full of turrets by nightfall
  await ev(() => { for (const s of window.__app.game.survivors) s.scrap += 2600; });
  await skipUntil(() => window.__app.game.phase === 'night');
  // B: bosses wake up in the lair (normal camera panned over to them, no letterboxing)
  await ev(() => { const a = window.__app, R = a.renderer, g = a.game;
    const p = R.worldToScreen(g.player.x, 8.5), l = R.worldToScreen(g.map.lair.sx + 5, 8.5); R.pan(p.x - l.x, 0); a.userPanned = true; });
  await capture(4.2);
  // C: back to my room while a boss pounds the door; throw a Molotov, then a Flashbang
  await ev(() => { const a = window.__app; a.renderer.focusRoom(a.game.player.room); });
  await skipUntil(() => { const g = window.__app.game, r = g.player.room, d = r.doors[0];
    return g.enemies.some((e) => e.kind === 'boss' && e.alive && e.state === 'attack' && Math.hypot(e.x - d.fx, e.y - d.fy) < 2.6); }, 60);
  const throwAt = (k) => ev((k) => { const g = window.__app.game, d = g.player.room.doors[0];
    const b = g.enemies.filter((e) => e.kind === 'boss' && e.alive).sort((a, c) => Math.hypot(a.x - d.fx, a.y - d.fy) - Math.hypot(c.x - d.fx, c.y - d.fy))[0];
    if (b) g.useAbility(k, b.x, b.y); }, k);
  await capture(5.4, async (i) => { if (i === 20) await throwAt('molotov'); if (i === 85) await throwAt('flash'); });
  // D: that boss goes down
  await ev(() => { const g = window.__app.game, d = g.player.room.doors[0];
    const b = g.enemies.filter((e) => e.kind === 'boss' && e.alive).sort((a, c) => Math.hypot(a.x - d.fx, a.y - d.fy) - Math.hypot(c.x - d.fx, c.y - d.fy))[0];
    if (b) b.hp = Math.min(b.hp, b.maxHp * 0.03); });
  await capture(3.2);
  console.log(mode, 'segments', seg, 'errors', errs);
  await browser.close();
})();
