// Browser monkey test: random mouse/touch/keyboard input across menus and matches; fails on any page error.
// Usage: node tests/monkey.cjs [rounds]
const { chromium } = require('playwright');
const ROUNDS = +process.argv[2] || 3;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('CONSOLE ' + m.text()); });
  await p.route('**/sdk.crazygames.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:8123/index.html');
  await p.waitForSelector('#play');
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const W = 1280, H = 720;
  await p.evaluate(() => { __LL.P.tutorialDone = true; __LL.P.coins = 5000; __LL.P.loadout = { active: [{ id: 'frost', r: 4 }, { id: 'clover', r: 4 }], passive: [{ id: 'pillow', r: 4 }, { id: 'goldink', r: 4 }, { id: 'quills', r: 2 }] }; });
  for (let round = 0; round < ROUNDS; round++) {
    // random menu wandering
    for (const s of ['shop', 'armory', 'spellbook', 'daily', 'quick', 'ladder', 'settings', 'hub']) {
      await p.evaluate(s => __LL.show(s), s);
      for (let k = 0; k < 4; k++) {
        const btns = await p.$$('#ui button:not([disabled]):not(#reset):not(#tut), #ui .clickable');
        if (!btns.length) break;
        const el = btns[Math.floor(rnd() * btns.length)];
        try { await el.click({ timeout: 800 }); } catch (e) { /* element moved */ }
        await p.waitForTimeout(60);
        // close any modal that popped up
        const close = await p.$('#modals .modal button.ghost, #modals #close, #modals #cancel, #modals #no, #modals #cl');
        if (close) { try { await close.click({ timeout: 500 }); } catch (e) { /* */ } }
      }
      if (await p.$('canvas#game:visible')) break; // a button started a battle
    }
    // ensure a match is running
    if (!(await p.evaluate(() => !!__LL.ctl))) await p.evaluate(r => __LL.startMatch({ mode: 'quick', rival: __LL.RIVALS[r % 9], rivalIndex: r % 9, mapId: ['ember', 'marsh', 'bay', 'iron'][r % 4], seed: 99 + r, dailyBuff: 'gold' }), round);
    await p.waitForTimeout(300);
    await p.evaluate(() => { __LL.ctl.speed = 4; });
    // monkey input during the match
    const t0 = Date.now();
    while (Date.now() - t0 < 45000 && !(await p.$('.results'))) {
      const r = rnd();
      if (r < 0.45) { // drag
        const x0 = rnd() * W, y0 = rnd() * H, x1 = rnd() * W, y1 = rnd() * H;
        await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2); await p.mouse.move(x1, y1); await p.mouse.up();
      } else if (r < 0.8) { // targeted click on summon / tray / cells
        const tgt = await p.evaluate(k => {
          const v = __LL.view, ctl = __LL.ctl; if (!ctl) return null;
          if (k < 0.4) return v.btnCenter('summon');
          if (k < 0.6) return v.trayCenter(Math.floor(k * 10) % 3);
          const cells = ctl.match.sides[0].cells; const c = cells[Math.floor(k * 997) % cells.length]; const rc = v.cellRect(0, c); return [rc.x + rc.w / 2, rc.y + rc.h / 2];
        }, rnd());
        if (tgt) await p.mouse.click(tgt[0], tgt[1]);
      } else if (r < 0.9) {
        await p.keyboard.press([' ', '1', '2', '3', 'q', 'w', 'f', 'Escape', 'h', 'r'][Math.floor(rnd() * 10)]);
        // resume if paused
        const resume = await p.$('#modals #resume'); if (resume) { await resume.click(); }
      } else {
        const id = ['callWave', 'book', 'item0', 'item1', 'train0', 'train1', 'train2', 'train3', 'speed', 'hex'][Math.floor(rnd() * 10)];
        const c = await p.evaluate(id => __LL.ctl && __LL.view.btnCenter(id), id);
        if (c) await p.mouse.click(c[0], c[1]);
        await p.waitForTimeout(1200); // fake ads take 1 s
        const cl = await p.$('#modals #cl'); if (cl) await cl.click();
        await p.evaluate(() => { if (__LL.ctl) __LL.ctl.speed = 4; });
      }
      // invariants
      const st = await p.evaluate(() => { const c = __LL.ctl; if (!c) return null; const m = c.match; const s = m.sides[0]; return { ink: s.ink, lives: s.lives, paused: c.paused, modals: document.querySelector('#modals').children.length, heroTray: s.tray.some(t => t && t.kind === 'hero'), drag: !!__LL.view.drag && !__LL.view.pointer.down }; });
      if (st) {
        if (!Number.isFinite(st.ink) || st.ink < 0) errors.push('bad ink ' + st.ink);
        if (st.heroTray) errors.push('hero in tray');
        if (st.paused && st.modals === 0 && !(await p.$('.fake-ad'))) errors.push('paused with no modal/ad (stuck)');
        if (st.drag) errors.push('drag state left over after mouseup');
      }
    }
    if (!(await p.$('.results'))) await p.evaluate(() => __LL.ctl.match.finish(1, 'monkey stop'));
    await p.waitForSelector('.results', { timeout: 10000 });
    await p.click('#cont');
    await p.waitForTimeout(1500);
    const fake = await p.$('.fake-ad'); if (fake) await p.waitForTimeout(1200);
    const onHub = await p.evaluate(() => !__LL.ctl && document.querySelector('#ui').className);
    console.log('round', round, 'back to', onHub, 'errors so far', errors.length);
  }
  console.log(errors.length ? errors.slice(0, 20).join('\n') : 'NO ERRORS');
  await b.close();
  process.exit(errors.length ? 1 : 0);
})();
