// Records the CrazyGames preview videos (mandatory at submission):
//   store/preview_landscape_1920x1080.mp4 and store/preview_portrait_1080x1620.mp4
// Rules followed (docs.crazygames.com/requirements/game-covers): 15-20 s, no sound, opens on the static
// cover, real-time gameplay (no fast-forward), no mouse cursor, no black bars / logo intros / promo text.
// Frames come from Chrome's screencast (with timestamps) and are assembled to 30 fps H.264 by ffmpeg.
// Needs the static server on :8123.  node tools/preview.cjs
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const URL = 'http://localhost:8123/index.html';
const TMP = path.join(require('os').tmpdir(), 'tts-preview');

const COVER = (bg, w, h, scale, top) => `<html><head><link rel="stylesheet" href="http://localhost:8123/css/style.css"><style>
  body{margin:0;width:${w}px;height:${h}px;background:url(http://localhost:8123/${bg}) center/cover;position:relative;overflow:hidden}
  .glow{position:absolute;left:0;right:0;top:0;height:55%;background:radial-gradient(ellipse 60% 60% at 50% 35%,rgba(40,15,0,.38),rgba(40,15,0,0) 70%)}
  .logo span{white-space:nowrap}.logo{position:absolute;width:max-content;left:50%;top:${top};transform:translateX(-50%) scale(${scale});transform-origin:50% 0}
  .logo .l1{font-size:110px;-webkit-text-stroke:6px #7a3b12}.logo .l2{font-size:190px;-webkit-text-stroke:8px #6b2a0c}
</style></head><body><div class="glow"></div><div class="logo"><span class="l1">Teahouse</span><span class="l2">Tile Slide</span></div></body></html>`;

async function record(browser, { name, w, h, coverBg, coverScale, coverTop, level }) {
  const dir = path.join(TMP, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  // 1) static cover still (opening frame)
  const cp = await browser.newPage({ viewport: { width: w, height: h } });
  await cp.goto(URL); await cp.setContent(COVER(coverBg, w, h, coverScale, coverTop)); await cp.waitForTimeout(700);
  await cp.screenshot({ path: path.join(dir, 'cover.jpg'), type: 'jpeg', quality: 95 }); await cp.close();

  // 2) gameplay capture
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__tts && ['s-title', 's-game'].includes(window.__tts.state.screen));
  await p.evaluate(() => { const S = window.__tts.state.S; S.settings.music = false; S.settings.sfx = false; });
  const cdp = await p.context().newCDPSession(p);
  const frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) { /* */ }
  });
  await p.evaluate((n) => window.__tts.startLevel(n), level);
  await p.waitForTimeout(300);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
  await p.waitForTimeout(900);
  const sol = await p.evaluate(() => {
    const b = window.__tts.board(); const r = window.__tts.L.solve(b.cells(), b.w, b.h, 80000);
    return r.solution.map((m) => ({ type: m.type, a: m.a, b: m.b, from: m.from, to: m.to }));
  });
  const c = (i) => p.evaluate((i) => { const b = window.__tts.board(); return { x: b.sx(i % b.w, (i / b.w) | 0) + b.cw / 2, y: b.sy(i % b.w, (i / b.w) | 0) + b.ch / 2 }; }, i);
  for (const m of sol.slice(0, 9)) {
    if (m.type === 'match') {
      const a = await c(m.a), b = await c(m.b);
      await p.mouse.click(a.x, a.y); await p.waitForTimeout(260); await p.mouse.click(b.x, b.y); await p.waitForTimeout(420);
    } else {
      const a = await c(m.from), b = await c(m.to);
      await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.waitForTimeout(120);
      for (let s = 1; s <= 14; s++) { await p.mouse.move(a.x + (b.x - a.x) * s / 14, a.y + (b.y - a.y) * s / 14); await p.waitForTimeout(28); }
      await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(480);
    }
  }
  await p.waitForTimeout(500);
  // teahouse: restore the last piece of the courtyard (before -> after, Momo cheers)
  await p.evaluate(() => {
    const S = window.__tts.state.S; S.bank = 12; for (let i = 1; i <= 12; i++) S.stars[i] = 3;
    S.areas[0] = [true, true, true, true, false]; window.__tts.openHouse(0);
  });
  await p.waitForTimeout(1300);
  await p.click('#tasks .task:nth-child(5) button');
  await p.waitForTimeout(3400);
  await cdp.send('Page.stopScreencast');
  await p.close();

  // 3) assemble: cover 1.5 s + frames with their real durations, 30 fps CFR, no audio
  const list = [`file '${path.join(dir, 'cover.jpg')}'`, 'duration 1.5'];
  for (let i = 0; i < frames.length; i++) {
    const d = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].t - frames[i].t) : 0.5;
    list.push(`file '${frames[i].file}'`, `duration ${d.toFixed(4)}`);
  }
  list.push(`file '${frames[frames.length - 1].file}'`);
  fs.writeFileSync(path.join(dir, 'list.txt'), list.join('\n'));
  const out = `store/${name}.mp4`;
  execSync(`ffmpeg -v error -y -f concat -safe 0 -i ${path.join(dir, 'list.txt')} -vf "scale=${w}:${h}:flags=lanczos,fps=30,format=yuv420p" -t 20 -an -c:v libx264 -preset slow -crf 20 -movflags +faststart ${out}`);
  const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${out}`).toString().trim();
  console.log(`${out}: ${frames.length} frames captured, ${(+dur).toFixed(1)} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
}

(async () => {
  const browser = await chromium.launch();
  await record(browser, { name: 'preview_landscape_1920x1080', w: 1920, h: 1080, coverBg: 'store/raw/keyart.png', coverScale: 1.0, coverTop: '9%', level: 33 });
  await record(browser, { name: 'preview_portrait_1080x1620', w: 1080, h: 1620, coverBg: 'store/raw/cover_portrait.png', coverScale: 0.95, coverTop: '7%', level: 33 });
  await browser.close();
})();
