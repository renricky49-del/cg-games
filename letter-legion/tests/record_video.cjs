// Records the CrazyGames preview videos frame-by-frame (deterministic 30 fps, real-time game speed, no cursor, silent).
// Usage: node tests/record_video.cjs landscape|portrait <framesDir>
// Then encode with ffmpeg (see README). First second = the static store cover, as CrazyGames asks.
const { chromium } = require('playwright');
const fs = require('fs');
const mode = process.argv[2] || 'landscape';
const OUT = process.argv[3] || '/tmp/frames_' + mode;
const VIEW = mode === 'portrait' ? { width: 720, height: 1080 } : { width: 1280, height: 720 };
const FPS = 30, SECONDS = 17.5;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: VIEW, deviceScaleFactor: 1.5 });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.route('**/sdk.crazygames.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForSelector('#play');
  await p.evaluate(() => {
    const P = __LL.P; P.tutorialDone = true; P.level = 6;
    P.loadout = { active: [{ id: 'frost', r: 2 }, { id: 'bomb', r: 2 }], passive: [{ id: 'quills', r: 2 }] };
    __LL.startMatch({ mode: 'ladder', rival: __LL.RIVALS[3], rivalIndex: 3, mapId: 'marsh', seed: 21, dailyBuff: 'gold' });
  });
  await p.waitForTimeout(400);
  // take over the clock: the page's own RAF loop stops advancing the match; we step it at exactly 1/30 s per frame
  await p.evaluate(async () => {
    const mod = await import('./js/ai.js'); const ctl = __LL.ctl;
    ctl.match.sides[0].autoPick = true; const brain = new mod.CpuBrain(ctl.match.sides[0], { think: 0.35, skill: 1, spell: 5, mistakes: 0 });
    const orig = ctl.update.bind(ctl); ctl.update = () => {};
    window.__step = dt => { brain.update(dt); orig(dt); };
    ctl.speed = 1;
    // fast-forward silently to just before the wave-5 boss with a lively board (KING / MAGE scripted in)
    ctl.match.sides[0].script = ['S', 'gold:K', 'S', 'gold:I', 'B', 'gold:N', 'L', 'gold:G', 'K', 'gold:M', 'gold:A', 'B', 'gold:G', 'gold:E', 'S', 'K'];
    for (let i = 0; i < 30 * 58; i++) window.__step(1 / 30);
    // queue a hero spelling (MONK) to land a few seconds into the clip for the cut-in
    const me = ctl.match.sides[0]; me.ink += 400; me.script = ['gold:M', 'gold:O', 'gold:N', 'gold:K', 'S', 'L', 'B'];
    me.hex = 0; ctl.match.sides[1].hex = 0; // hexes are fired on cue below
    __LL.view.cuts = []; __LL.view.banners = [];
  });
  const N = Math.round(FPS * SECONDS);
  for (let f = 0; f < N; f++) {
    // show both sides of a Hex: ours flies to the rival at 6.5 s, theirs lands on our road at 11 s
    if (f === Math.round(6.5 * FPS)) await p.evaluate(() => { const me = __LL.ctl.me; me.hex = me.hexNeed(); me.sendHex(); });
    if (f === Math.round(11 * FPS)) await p.evaluate(() => { const r = __LL.ctl.match.sides[1]; r.hex = r.hexNeed(); r.sendHex(); });
    await p.evaluate(() => window.__step(1 / 30));
    await p.screenshot({ path: `${OUT}/f${String(f).padStart(4, '0')}.jpg`, quality: 92 });
  }
  console.log(mode, 'frames', N, 'wave', await p.evaluate(() => __LL.ctl.match.wave), 'heroes', await p.evaluate(() => __LL.ctl.match.sides[0].stats.spelled.join(',')), 'errors', errors);
  await b.close();
})();
