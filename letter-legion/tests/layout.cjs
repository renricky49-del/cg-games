// Layout check: for several viewports and every map, board rects must not intersect each other, the HUD, or the spell strip.
const { chromium, devices } = require('playwright');
const OUT = process.argv[2] || '/tmp/claude-0/shots/layout';
const VIEWS = [['1280x720', { viewport: { width: 1280, height: 720 } }], ['1920x1080', { viewport: { width: 1920, height: 1080 } }], ['1366x768', { viewport: { width: 1366, height: 768 } }],
  ['phone_portrait', devices['iPhone 13']], ['phone_landscape', devices['iPhone 13 landscape']],
  ['tiny_568x270', { viewport: { width: 568, height: 270 } }], ['tiny_640x360', { viewport: { width: 640, height: 360 } }], ['portrait_360x640', { viewport: { width: 360, height: 640 } }]];
const MAPS = ['ember', 'marsh', 'bay', 'iron'];
const inter = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(); let fails = 0;
  for (const [name, opt] of VIEWS) {
    const ctx = await b.newContext(opt); const p = await ctx.newPage();
    await p.route('**/sdk.crazygames.com/**', r => r.abort());
    await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForSelector('#play');
    for (const mapId of MAPS) {
      await p.evaluate(m => { __LL.P.tutorialDone = true; __LL.startMatch({ mode: 'quick', rival: __LL.RIVALS[3], rivalIndex: 3, mapId: m, seed: 9, dailyBuff: 'ink' }); }, mapId);
      await p.waitForTimeout(250);
      const r = await p.evaluate(() => ({ ...__LL.view.layoutRects(), W: innerWidth, H: innerHeight, ts: __LL.view.geo.map(g => g.ts) }));
      const keys = ['player', 'rival', 'hud', 'strip', 'top', 'info'];
      const bad = [];
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (inter(r[keys[i]], r[keys[j]])) bad.push(keys[i] + '×' + keys[j]);
      // HUD controls must not overlap each other (taps would hit the wrong control)
      const hb = await p.evaluate(() => { const v = __LL.view; return [...v.buttons.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h })), ...v.trayRects.map((r, i) => ({ id: 'tray' + i, ...r })), { id: 'trash', ...v.trash }]; });
      for (let i = 0; i < hb.length; i++) for (let j = i + 1; j < hb.length; j++) if (inter(hb[i], hb[j])) bad.push(hb[i].id + '×' + hb[j].id);
      for (const k of ['player', 'rival']) { const q = r[k]; if (q.x < 0 || q.y < 0 || q.x + q.w > r.W || q.y + q.h > r.H) bad.push(k + ' offscreen'); }
      const used = (r.player.w * r.player.h + r.rival.w * r.rival.h) / ((r.W - (r.hud.w < r.W ? r.hud.w : 0)) * r.H);
      console.log(name.padEnd(16), mapId.padEnd(6), 'ts', r.ts.join('/'), 'fill', (used * 100).toFixed(0) + '%', bad.length ? 'OVERLAP ' + bad.join(',') : 'ok');
      if (bad.length) fails++;
      if (mapId === 'marsh' || mapId === 'ember') await p.screenshot({ path: `${OUT}/${name}_${mapId}.png` });
      await p.evaluate(() => { __LL.ctl.ended = true; });
    }
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `FAIL ${fails}` : 'ALL LAYOUTS OK');
})();
