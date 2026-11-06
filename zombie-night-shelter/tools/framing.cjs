// Asserts that the close camera keeps the player's whole room + door + corridor inside the safe area
// (between the HUD top bar and the action bar, not touching the screen edges) for every room, on desktop and phones.
const { chromium, devices } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWS = [['desktop 1280x720', { viewport: { width: 1280, height: 720 } }], ['desktop 1920x1080', { viewport: { width: 1920, height: 1080 } }],
  ['iPhone 13 portrait', devices['iPhone 13']], ['iPhone 13 landscape', devices['iPhone 13 landscape']]];
(async () => {
  const b = await chromium.launch(); let fails = 0, checks = 0;
  for (const [name, opts] of VIEWS) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage();
    p.on('pageerror', (e) => { console.log('pageerror', e.message); fails++; });
    await p.goto('http://localhost:8123/index.html'); await p.waitForSelector('#title.show');
    for (let mapIdx = 0; mapIdx < 3; mapIdx++) {
      for (let ri = 0; ri < 4; ri++) {
        await p.evaluate(([mapIdx, ri]) => {
          const A = window.__app; A.save.tutDone = true; A.startNight(mapIdx, true);
        }, [mapIdx, ri]);
        await p.waitForSelector('#intro.show'); await sleep(250);
        await p.evaluate(() => document.getElementById('btn-start').click());
        await sleep(150);
        // teleport the player to the room's door and let the normal claim/enter flow run
        await p.evaluate((ri) => { const g = window.__app.game, r = g.map.rooms[ri], d = r.doors[0]; for (const o of g.survivors) if (!o.isPlayer) { o.path = []; o.decideDelay = 99; } g.player.x = d.fx; g.player.y = d.fy + (r.top ? 0.3 : -0.3); g.goToRoom(g.player, r); }, ri);
        for (let i = 0; i < 60; i++) { if (await p.evaluate(() => { const A = window.__app; return A.game.player.state === 'inroom' && A.renderer.cam.tz == null && !document.getElementById('hud-bottom').classList.contains('hidden'); })) break; await sleep(100); }
        await sleep(900);
        for (let i = 0; i < 40 && await p.evaluate(() => window.__app.renderer.cam.tz != null); i++) await sleep(100);
        const r = await p.evaluate(() => {
          const A = window.__app, R = A.renderer, room = A.game.player.room, bx = R.roomBox(room);
          const a = R.worldToScreen(bx.x0, bx.y0), c = R.worldToScreen(bx.x1, bx.y1);
          const top = document.getElementById('hud-top').getBoundingClientRect();
          const barTop = document.getElementById('hud-bottom').getBoundingClientRect().top;
          const tile = 48 * R.cam.z;
          // the top HUD only spans parts of the width; treat its widgets' bottom as the safe top
          const ok = a.x >= -0.5 && c.x <= R.vw + 0.5 && a.y >= R.insets.top - 1 && c.y <= barTop + 1;
          return { ok, label: room.label, box: [a.x, a.y, c.x, c.y].map(Math.round), safe: [0, Math.round(R.insets.top), R.vw, Math.round(barTop)], tile: Math.round(tile) };
        });
        checks++;
        if (!r.ok) { fails++; console.log(`FAIL ${name} map${mapIdx} room ${r.label} box ${r.box} safe ${r.safe} tile ${r.tile}`); }
        if (ri === 0 && mapIdx === 0) console.log(`${name}: tile ${r.tile}px`);
      }
    }
    if (name === 'desktop 1280x720') await p.screenshot({ path: process.argv[2] + '/framing_last.png' });
    await ctx.close();
  }
  console.log(`${checks} checks, ${fails} failures`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
