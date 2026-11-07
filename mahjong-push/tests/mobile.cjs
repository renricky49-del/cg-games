// Mobile / tablet layout sweep: every screen and dialog on 9 viewports (portrait + landscape).
// Automatic checks per screen: visible buttons fully on screen (or inside a scrollable dialog), no
// clipped button text, board inside the free area (not under HUD/boosters), minimum tile size, no
// horizontal page overflow, no JS errors. Also runs once with canvas roundRect removed (old Safari).
// OUT=<dir> node tests/mobile.cjs   (static server on :8123)
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT || 'tests/mobile-shots';
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = [
  ['phone-se', 375, 667], ['phone-se-land', 667, 375], ['phone-14', 390, 844], ['phone-14-land', 844, 390],
  ['android-small', 360, 640], ['android-small-land', 640, 360], ['pixel-7', 412, 915],
  ['ipad', 768, 1024], ['ipad-land', 1024, 768],
];
const LEGACY = process.env.LEGACY === '1'; // simulate Safari < 16 (no canvas roundRect)

async function audit(p, name) {
  return p.evaluate((name) => {
    const vw = innerWidth, vh = innerHeight, out = [];
    const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && e.offsetParent !== null; };
    const modalOpen = !document.getElementById('modal').classList.contains('hidden');
    const root = modalOpen ? document.getElementById('modal') : document.querySelector('.screen.show');
    if (!root) return [`${name}: no visible screen`];
    for (const e of root.querySelectorAll('button, .btn, .node, .task')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      const card = e.closest('.card, #tasks, .achs, .orders, .skins');
      const scrollable = card && card.scrollHeight > card.clientHeight + 2;
      const off = r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1;
      if (off && !scrollable) out.push(`${name}: off-screen "${(e.textContent || e.title || e.className).trim().slice(0, 30)}" [${r.left | 0},${r.top | 0},${r.right | 0},${r.bottom | 0}]`);
      if (e.matches('.btn') && !e.classList.contains('icon')) { // label text wider than its button (badges excluded)
        for (const n of e.childNodes) {
          if (n.nodeType === 1 && (n.classList.contains('badge') || getComputedStyle(n).position === 'absolute')) continue;
          const rg = document.createRange(); rg.selectNodeContents(n); const tr = rg.getBoundingClientRect();
          if (tr.width && (tr.left < r.left - 2 || tr.right > r.right + 2)) { out.push(`${name}: text overflows button "${e.textContent.trim().slice(0, 30)}"`); break; }
        }
      }
    }
    if (document.documentElement.scrollWidth > vw + 1) out.push(`${name}: horizontal page overflow`);
    // board checks while playing
    if (!modalOpen && document.querySelector('#s-game.show') && window.__tts) {
      const b = window.__tts.board();
      const top = document.querySelector('#s-game .topbar').getBoundingClientRect().bottom;
      const bt = document.querySelector('#s-game .boosters').getBoundingClientRect();
      const bx = { l: b.ox, t: b.oy, r: b.ox + b.bw, btm: b.oy + b.bh };
      if (bx.t < top - 1) out.push(`${name}: board under top bar (${bx.t | 0} < ${top | 0})`);
      const overlapX = Math.min(bx.r, bt.right) - Math.max(bx.l, bt.left), overlapY = Math.min(bx.btm, bt.bottom) - Math.max(bx.t, bt.top);
      if (overlapX > 2 && overlapY > 2) out.push(`${name}: board overlaps boosters`);
      if (bx.l < -1 || bx.r > vw + 1 || bx.btm > vh + 1) out.push(`${name}: board outside viewport`);
      if (b.cw < 26) out.push(`${name}: tiles very small (${b.cw.toFixed(1)} px wide)`);
    }
    return out;
  }, name);
}

(async () => {
  const browser = await chromium.launch();
  const issues = [], errors = [];
  for (const [dev, w, h] of DEVICES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 1000, hasTouch: true, deviceScaleFactor: 2 });
    if (LEGACY) await ctx.addInitScript(() => { delete CanvasRenderingContext2D.prototype.roundRect; });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${dev}: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('throttled')) errors.push(`${dev}: ${m.text()}`); });
    await p.goto('http://localhost:8123/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload();
    await p.waitForFunction(() => window.__tts && window.__tts.state.screen === 's-game');
    const shot = async (n) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/${dev}__${n}.png` }); issues.push(...await audit(p, `${dev}/${n}`)); };
    const close = () => p.evaluate(() => { document.getElementById('modal').classList.add('hidden'); });
    await p.waitForTimeout(700); await shot('01-tutorial');
    // progress save for the rest
    await p.evaluate(() => {
      const S = window.__tts.state.S; for (let i = 1; i <= 30; i++) S.stars[i] = 3; S.played = 30; S.bank = 12; S.coins = 900;
      S.areas[0] = [true, true, true, true, true]; S.areas[1] = [true, true, false, false, false]; S.tipT = Date.now() - 4 * 3600000;
    });
    await p.evaluate(() => window.__tts.openTitle()); await shot('02-title');
    await p.evaluate(() => window.__tts.openMap(1)); await shot('03-map');
    await p.evaluate(() => window.__tts.startLevel(30)); await p.waitForTimeout(600);
    await p.evaluate(() => { const G = window.__tts.state.G; G.rush = 70; document.getElementById('g-rush').style.width = '70%'; });
    await shot('04-game-l30');
    await p.evaluate(() => { const b = window.__tts.board(); const r = window.__tts.L.solve(b.cells(), b.w, b.h, 80000); for (const m of r.solution) b._commitMatch(m); });
    await p.waitForTimeout(1300); await shot('05-win');
    await close();
    await p.evaluate(() => { window.__tts.startLevel(30); }); await p.waitForTimeout(500);
    await p.evaluate(() => window.__tts.board().cb.onStuck()); await shot('06-stuck');
    await close();
    await p.evaluate(() => { const G = window.__tts.state.G; G.paused = false; window.__tts.board().paused = false; });
    await p.keyboard.press('p'); await shot('07-pause');
    await close();
    await p.evaluate(() => window.__tts.openHouse(1)); await p.waitForTimeout(700); await shot('08-teahouse');
    await p.click('#s-house [data-act=orders]', { timeout: 3000 }); await shot('09-orders'); await close();
    await p.click('#s-house [data-act=perks]', { timeout: 3000 }); await shot('10-perks'); await close();
    await p.evaluate(() => window.__tts.openTitle()); await p.waitForTimeout(300);
    await p.click('[data-act=trophies]'); await shot('11-trophies'); await close();
    await p.click('[data-act=gift]'); await shot('12-gift'); await close();
    await p.click('[data-act=settings]'); await shot('13-settings');
    await p.click('#s-skins'); await shot('14-skins'); await close();
    await p.evaluate(() => window.__tts.startEndless()); await p.waitForTimeout(900); await shot('15-endless');
    await p.evaluate(() => window.__tts.startLevel(84)); await p.waitForTimeout(900); await shot('16-game-l84');
    await ctx.close();
  }
  await browser.close();
  console.log(`checked ${DEVICES.length} viewports × 16 screens${LEGACY ? ' (legacy Safari canvas)' : ''}`);
  console.log(issues.length ? `LAYOUT ISSUES (${issues.length}):\n` + issues.join('\n') : 'no layout issues');
  console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
})();
