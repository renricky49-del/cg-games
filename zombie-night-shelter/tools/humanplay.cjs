// A "first-time player" bot inside the simulated CrazyGames frame: real mouse clicks, real time (1x), no cheats.
// Follows the tutorial, then plays greedily. Screenshots every 3 s. usage: node humanplay.cjs <gameDir> <outDir> [W] [H] [nights]
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const [gameDir, OUT, W, H, NIGHTS] = [process.argv[2], process.argv[3], +(process.argv[4] || 907), +(process.argv[5] || 510), +(process.argv[6] || 2)];
const MIME = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', jpg: 'image/jpeg', mp3: 'audio/mpeg', woff2: 'font/woff2' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  const errs = [];
  await ctx.route('http://cg-parent.test/**', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><body style="margin:0;background:#111;overflow:hidden">
<iframe id="g" src="http://cg-game.test/index.html" width="${W}" height="${H}" style="border:0;display:block" allow="autoplay; fullscreen"></iframe>
<script>const F=document.getElementById('g');const send=(m)=>F.contentWindow.postMessage(m,'*');window.msgs=[];
addEventListener('message',(e)=>{const d=e.data;if(!d||!d.type)return;window.msgs.push([Math.round(performance.now()),d.type]);
 if(d.type==='checkCrazyGamesGF')send({type:'crazyGamesGFConfirmation'});
 if(d.type==='init-js-sdk'){send({type:'initialized',data:{gameLink:'https://www.crazygames.com/preview/t',gameId:'t',launchFlow:'basic',systemInfo:{applicationType:'web',countryCode:'US',browser:{name:'Chrome',version:'1'},os:{name:'Linux',version:'1'},device:{type:'desktop'}},userAccountAvailable:true,dataModule:{isEnabled:true},rafvertizingUrl:'',clientInfo:{},configCatValues:{}}});send({type:'initialUserSet',messageTarget:'sdk',data:{user:null}});}
 if(d.type==='hasAdblock')setTimeout(()=>send({type:'adblockDetectionExecuted',messageTarget:'sdk',hasAdblock:false}),800);});</script></body>` }));
  await ctx.route('http://cg-game.test/**', (r) => { let p = decodeURIComponent(new URL(r.request().url()).pathname); if (p === '/') p = '/index.html'; const f = path.join(gameDir, p);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { errs.push('404 ' + p); return r.fulfill({ status: 404, body: '' }); } r.fulfill({ contentType: MIME[f.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/SDK|ads/i.test(m.text())) errs.push('console ' + m.text().slice(0, 150)); });
  await page.goto('http://cg-parent.test/');
  let f = null; for (let i = 0; i < 100 && !f; i++) { f = page.frames().find((q) => q.url().includes('cg-game.test')); await sleep(50); }
  const t0 = Date.now(); let shots = 0; const notes = [];
  const note = (s) => { notes.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s}`); };
  let shooting = true;
  (async () => { while (shooting) { await page.screenshot({ path: `${OUT}/${String(++shots).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 80 }).catch(() => {}); await sleep(3000); } })();
  const ev = (fn, arg) => f.evaluate(fn, arg);
  const clickWorld = async (x, y) => { const p = await ev(([x, y]) => window.__app.renderer.worldToScreen(x, y), [x, y]); await page.mouse.move(p.x, p.y, { steps: 6 }); await sleep(120); await page.mouse.click(p.x, p.y); };
  const clickEl = async (sel) => { const bb = await (await f.$(sel)).boundingBox(); if (!bb) return false; await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 6 }); await sleep(120); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); return true; };
  await f.waitForSelector('#title.show'); note('title visible'); await sleep(1200);
  await clickEl('#btn-play'); note('clicked PLAY');
  for (let night = 1; night <= NIGHTS; night++) {
    if (night > 1) { await f.waitForSelector('#intro.show'); await sleep(1500); await clickEl('#btn-start'); note(`night ${night}: start`); }
    await sleep(1500);
    // 1. pick the room the tutorial arrow / nearest free room points at
    const room = await ev(() => { const g = window.__app.game, s = g.player; let best = null, bd = 1e9; for (const r of g.map.rooms) if (!r.owner && !g.survivors.some((o) => o !== s && o.targetRoom === r)) { const d = Math.hypot(r.doors[0].fx - s.x, r.doors[0].fy - s.y); if (d < bd) { bd = d; best = r; } } best = best || g.map.rooms.find((r) => !r.owner); return { x: best.x + best.w / 2, y: best.y + best.h / 2 }; });
    await clickWorld(room.x, room.y); note('clicked a room');
    for (let i = 0; i < 200 && !(await ev(() => window.__app.game.player.state === 'inroom')); i++) await sleep(100);
    note('in room'); await sleep(900);
    // 2. lie down (tutorial asks to click the bed)
    if (!(await ev(() => window.__app.game.player.lying))) { const bed = await ev(() => { const r = window.__app.game.player.room; return { x: r.bed.x, y: r.bed.y }; }); await clickWorld(bed.x, bed.y); note('clicked bed'); }
    // 3. main loop: greedy human — bed when affordable, turret by the door, door upgrade, repair when hurt, flashbang when hit
    let lastAct = 0, built = 0;
    while (true) {
      const st = await ev(() => { const A = window.__app, g = A.game, s = g.player, r = s.room; if (!r) return { over: A.isOver(), screen: A.screen };
        const d = r.doors[0], frac = g.minDoorFrac(r);
        const free = r.tiles.filter((q) => g.tileFree(r, q.tx, q.ty)).sort((a, c) => Math.hypot(a.tx - d.tx, a.ty - d.ty) - Math.hypot(c.tx - d.tx, c.ty - d.ty))[0];
        const up = r.buildings.filter((q) => g.canUpgradeB(s, q).ok)[0];
        const bossNear = g.enemies.find((e) => e.kind === 'boss' && e.alive && e.state === 'attack' && e.target && e.target.room === r);
        return { over: A.isOver(), screen: A.screen, phase: g.phase, scrap: s.scrap, bed: g.canBed(s), door: g.canDoor(s), rep: g.canRepair(s), frac, nail: g.canBuild(s, 'nail', free ? free.tx : 0, free ? free.ty : 0), bow: g.canBuild(s, 'bow', free ? free.tx : 0, free ? free.ty : 0),
          free: free ? { x: free.tx + 0.5, y: free.ty + 0.5 } : null, turrets: r.buildings.length, up: up ? { x: up.tx + 0.5, y: up.ty + 0.5 } : null, flash: g.canAbility('flash').ok, boss: bossNear ? { x: bossNear.x, y: bossNear.y } : null, bedLvl: r.bedLvl, doorLvl: r.doorLvl }; });
      if (st.screen === 'results' || st.screen === 'continue') break;
      if (st.over) { await sleep(500); continue; }
      const now = Date.now();
      if (now - lastAct > 1500) { // a human does roughly one thing every 1.5 s
        if (st.frac < 0.55 && st.rep.ok) { await clickEl('#act-repair'); note('repair'); lastAct = now; }
        else if (st.boss && st.flash) { const p = await ev(([x, y]) => window.__app.renderer.worldToScreen(x, y), [st.boss.x, st.boss.y]); await page.mouse.move(p.x, p.y, { steps: 5 }); await page.keyboard.press('q'); note('flashbang'); lastAct = now; }
        else if (st.bed.ok && (st.turrets >= 1 || st.bedLvl < 2)) { await clickEl('#act-bed'); note('bed up -> ' + (st.bedLvl + 1)); lastAct = now; }
        else if (st.free && st.turrets < 6 && st.nail.ok && (st.turrets < 2 || st.scrap > 120)) { await clickWorld(st.free.x, st.free.y); await sleep(500); const item = st.bow.ok && st.turrets >= 2 ? '.bm-item[data-type="bow"]' : '.bm-item[data-type="nail"]'; if (await f.$(item)) { await clickEl(item); built++; note('built ' + item.slice(20, 24)); } lastAct = now; }
        else if (st.door.ok && (st.bed.req || st.frac < 0.8 || st.scrap > st.door.cost * 2)) { await clickEl('#act-door'); note('door up -> ' + (st.doorLvl + 1)); lastAct = now; }
        else if (st.up && st.scrap > 150) { await clickWorld(st.up.x, st.up.y); await sleep(500); if (await f.$('#info-panel [data-a="up"]:not(.off)')) { await clickEl('#info-panel [data-a="up"]'); note('turret upgraded'); } await page.keyboard.press('Escape'); lastAct = now; }
      }
      await sleep(250);
    }
    await sleep(2500);
    const res = await ev(() => { const r = window.__app.game.results(); return { won: r.won, stars: r.stars, real: Math.round(window.__app.game.t), screen: window.__app.screen }; });
    note(`night ${night} over: ${JSON.stringify(res)}`);
    await sleep(2500);
    if (night < NIGHTS) { if (res.screen === 'continue') { await clickEl('#btn-giveup'); await sleep(1500); }
      const next = await f.$('#btn-next:not(.hidden)'); await clickEl(next ? '#btn-next' : '#btn-retry'); }
  }
  shooting = false; await sleep(400);
  console.log(notes.join('\n')); console.log('errors:', errs.length ? errs : 'none', 'shots', shots);
  await b.close();
})();
