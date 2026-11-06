// Fuzz test: random mouse/keyboard/resize chaos on many levels + daily + endless.
// Checks after every burst: no JS errors, no overlapping tiles, tiles inside the board, every face
// count even, no NaN positions, game never wedged (if not won/stuck there is always a legal move or a modal).
// node tests/fuzz.cjs   (static server on :8123)
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:8123/index.html';
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('throttled')) errors.push(m.text()); });
  await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.__tts && ['s-title', 's-game'].includes(window.__tts.state.screen));
  await p.evaluate(() => { const S = window.__tts.state.S; S.coins = 99999; S.boosters = { hint: 99, shuffle: 99, undo: 99 }; });
  let rng = 12345; const R = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
  const invariant = () => p.evaluate(() => {
    const b = window.__tts.board(); const out = [];
    const live = b.tiles.filter((t) => t.rm < 0);
    const seen = new Set(); const cnt = {};
    for (const t of live) {
      const k = t.x + ',' + t.y;
      if (seen.has(k)) out.push('overlap at ' + k); seen.add(k);
      if (t.x < 0 || t.y < 0 || t.x >= b.w || t.y >= b.h) out.push('out of bounds ' + k);
      if (b.stones.some((s) => s.x === t.x && s.y === t.y)) out.push('tile on stone ' + k);
      if (![t.vx, t.vy, t.ox, t.oy].every(Number.isFinite)) out.push('NaN position');
      cnt[t.face] = (cnt[t.face] || 0) + 1;
    }
    for (const f in cnt) if (cnt[f] % 2) out.push('odd face count ' + f);
    return out;
  });
  const issues = new Set();
  const modes = [];
  for (let i = 0; i < 30; i++) modes.push({ level: 1 + Math.floor(R() * 84) });
  modes.push({ daily: 1 }, { endless: 1 }, { level: 84 }, { level: 1 }, { level: 2 });
  let actions = 0, wins = 0, stucks = 0;
  for (const m of modes) {
    await p.evaluate((m) => { if (m.daily) window.__tts.startDaily(); else if (m.endless) window.__tts.startEndless(); else window.__tts.startLevel(m.level); }, m);
    await p.waitForTimeout(400);
    for (let burst = 0; burst < 30; burst++) {
      for (let a = 0; a < 12; a++) {
        actions++;
        const r = R();
        const box = await p.evaluate(() => { const b = window.__tts.board(); return { x: b.ox, y: b.oy, w: b.bw, h: b.bh }; });
        const x = box.x + R() * box.w, y = box.y + R() * box.h;
        if (r < 0.3) { // a real legal move through the mouse (random, often a bad one, so boards also get stuck)
          const mv = await p.evaluate(() => {
            const b = window.__tts.board(); const L = window.__tts.L; const ms = L.allMoves(b.cells(), b.w, b.h);
            if (!ms.length) return null; const m = ms[Math.floor(Math.random() * ms.length)];
            const c = (i) => ({ x: b.sx(i % b.w, (i / b.w) | 0) + b.cw / 2, y: b.sy(i % b.w, (i / b.w) | 0) + b.ch / 2 });
            return m.type === 'match' ? { k: 'm', a: c(m.a), b: c(m.b) } : { k: 'p', a: c(m.from), b: c(m.to) };
          });
          if (mv && mv.k === 'm') { await p.mouse.click(mv.a.x, mv.a.y); await p.mouse.click(mv.b.x, mv.b.y); }
          else if (mv) { await p.mouse.move(mv.a.x, mv.a.y); await p.mouse.down(); await p.mouse.move(mv.b.x, mv.b.y, { steps: 6 }); await p.mouse.up(); }
          await p.waitForTimeout(160);
        } else if (r < 0.4) await p.mouse.click(x, y);
        else if (r < 0.7) { // drag in a random direction, sometimes reversing mid-way
          await p.mouse.move(x, y); await p.mouse.down();
          const dx = (R() - 0.5) * 300, dy = (R() - 0.5) * 300;
          await p.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 });
          if (R() < 0.2) await p.mouse.move(x - dx / 3, y - dy / 3, { steps: 2 });
          if (R() < 0.1) await p.keyboard.press(['z', 'h', 's', 'p'][Math.floor(R() * 4)]); // booster mid-drag
          await p.mouse.move(x + dx, y + dy, { steps: 3 }); await p.mouse.up();
        } else if (r < 0.8) await p.keyboard.press(['z', 'h', 's', 'z'][Math.floor(R() * 4)]);
        else if (r < 0.84) { await p.keyboard.press('p'); await p.waitForTimeout(50); await p.keyboard.press('p'); }
        else if (r < 0.87) await p.setViewportSize(R() < 0.5 ? { width: 1280, height: 720 } : { width: 700 + Math.floor(R() * 600), height: 500 + Math.floor(R() * 400) });
        else await p.mouse.click(R() * 1280, R() * 720); // anywhere (HUD, empty space)
        // dismiss modals the fuzzer opened (stuck / buy / pause) and count outcomes
        const st = await p.evaluate(() => { const open = !document.getElementById('modal').classList.contains('hidden'); const has = (id) => open && !!document.getElementById(id); return { modal: open, win: has('w-map') || has('dw-ok') || has('e-again'), stuck: has('st-shuffle'), screen: window.__tts.state.screen }; });
        if (st.win) { wins++; break; }
        if (st.stuck) { stucks++; await p.click('#st-shuffle'); await p.waitForTimeout(300); }
        else if (st.modal) { await p.evaluate(() => { const c = document.getElementById('modal-card'); const b = c.querySelector('#p-resume, #bb-close, #h-ok, #s-close'); if (b) b.click(); }); }
        if (st.screen !== 's-game') break;
      }
      await p.waitForTimeout(450);
      for (const i of await invariant()) issues.add(i);
      const done = await p.evaluate(() => { const open = !document.getElementById('modal').classList.contains('hidden'); return (open && (!!document.getElementById('w-map') || !!document.getElementById('dw-ok') || !!document.getElementById('e-again'))) || window.__tts.state.screen !== 's-game'; });
      if (done) break;
      // wedge check: playing, no modal, tiles left => a legal move must exist (shuffle guarantees it)
      const wedged = await p.evaluate(() => {
        const b = window.__tts.board(); const L = window.__tts.L;
        if (b.over || b.remaining() === 0 || !document.getElementById('modal').classList.contains('hidden')) return false;
        return !L.hasMove(b.cells(), b.w, b.h);
      });
      if (wedged) { await p.waitForTimeout(900); if (!(await p.evaluate(() => !document.getElementById('modal').classList.contains('hidden')))) issues.add('wedged: no moves and no stuck dialog'); }
    }
    await p.setViewportSize({ width: 1280, height: 720 });
  }
  console.log(`fuzz: ${actions} actions over ${modes.length} sessions, ${wins} wins, ${stucks} stuck dialogs`);
  console.log(issues.size ? 'INVARIANT ISSUES:\n' + [...issues].join('\n') : 'all invariants hold');
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
  await browser.close();
})();
