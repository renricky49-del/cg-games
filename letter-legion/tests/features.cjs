// New-mechanics browser test: blessing draft modal, Hex send/receive, wild ★ spelling, merge combo, daily quests.
// Usage: node tests/features.cjs [url] [outdir]
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://127.0.0.1:8123/index.html';
const OUT = process.argv[3] || '/tmp/claude-0/shots';
const ok = (c, m) => { if (!c) { console.log('FAIL:', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  await page.route('**/sdk.crazygames.com/**', r => r.abort());
  await page.goto(URL);
  await page.waitForSelector('.title-screen', { timeout: 15000 });
  await page.evaluate(() => { __LL.P.tutorialDone = true; __LL.P.ladder = 3; __LL.show('hub'); });
  await page.waitForTimeout(300);
  ok(await page.locator('.card.quests .quest').count() === 3, 'hub shows 3 daily quests');
  await page.click('#fight'); await page.waitForTimeout(300); await page.click('#go'); await page.waitForTimeout(800);
  // CPU brain plays side 0 but does NOT auto-pick, so the draft screen must appear
  await page.evaluate(async () => {
    const { ctl } = __LL; const mod = await import('./js/ai.js');
    window.__pb = new mod.CpuBrain(ctl.match.sides[0], { think: 0.6, skill: 0.9, spell: 5, mistakes: 0 });
    const orig = ctl.update.bind(ctl);
    ctl.update = dt => { if (!ctl.paused) window.__pb.update(dt * ctl.speed); orig(dt); };
    ctl.speed = 2;
  });
  await page.waitForSelector('.modal.draft .boon-card', { timeout: 60000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/f1_draft.png' });
  const st1 = await page.evaluate(() => ({ wave: __LL.ctl.match.wave, paused: __LL.ctl.paused, draft: !!__LL.ctl.match.draft, cards: document.querySelectorAll('.boon-card').length, rivalBoons: __LL.ctl.match.sides[1].boons.length, t: __LL.ctl.match.time }));
  ok(st1.wave === 3 && st1.paused && st1.draft && st1.cards === 3, `draft opens before wave 3 and pauses (${JSON.stringify(st1)})`);
  ok(st1.rivalBoons === 1, 'CPU rival already picked its blessing');
  await page.waitForTimeout(700);
  ok(await page.evaluate(t => __LL.ctl.match.time === t, st1.t), 'battle time frozen during the draft');
  const before = await page.evaluate(() => __LL.ctl.me.offers.join());
  await page.click('#reroll'); await page.waitForTimeout(200);
  const after = await page.evaluate(() => __LL.ctl.me.offers.join());
  ok(before !== after && await page.locator('#reroll').isDisabled(), `reroll gives new offers (${before} → ${after}) and is used up`);
  await page.keyboard.press('2'); await page.waitForTimeout(600);
  const st2 = await page.evaluate(() => ({ boons: __LL.ctl.me.boons.slice(), draft: !!__LL.ctl.match.draft, paused: __LL.ctl.paused, modals: document.querySelectorAll('#modals .modal-bg').length }));
  ok(st2.boons.length === 1 && !st2.draft && !st2.paused && st2.modals === 0, `key 2 picks a blessing and the battle resumes (${JSON.stringify(st2)})`);
  // Hex: charge it, send with the HUD button, check a Brute walks on the rival's road
  await page.evaluate(() => { window.__pb.update = () => {}; const me = __LL.ctl.me; me.hex = me.hexNeed(); }); // brain off: it would send the hex itself
  await page.waitForTimeout(300);
  const [hx, hy] = await page.evaluate(() => __LL.view.btnCenter('hex'));
  await page.mouse.move(hx, hy); await page.waitForTimeout(150);
  ok(await page.evaluate(() => __LL.view.tip && __LL.view.tip.lines[0].startsWith('HEX READY')), 'hex button tooltip says ready');
  await page.mouse.click(hx, hy); await page.waitForTimeout(700);
  const st3 = await page.evaluate(() => ({ sent: __LL.ctl.me.stats.hexes, brutes: __LL.ctl.match.sides[1].enemies.filter(e => e.elite && e.hp > 0).length, hex: __LL.ctl.me.hex }));
  ok(st3.sent === 1 && st3.brutes === 1 && st3.hex < 5, `hex sends a Brute to the rival (${JSON.stringify(st3)})`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/f2_hex.png' });
  // receive a hex from the CPU
  await page.evaluate(() => { const r = __LL.ctl.match.sides[1]; r.hex = r.hexNeed(); r.sendHex(); });
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => __LL.ctl.me.enemies.some(e => e.elite && e.hp > 0)), 'CPU hex puts a Brute on your road');
  await page.screenshot({ path: OUT + '/f3_hexed.png' });
  // wild letter: spell MAGE with M A ★ E in one row
  const spelled = await page.evaluate(() => {
    const me = __LL.ctl.me; const before = me.stats.heroes;
    const row = me.cells.filter(c => !c.locked).reduce((a, c) => { (a[c.row] = a[c.row] || []).push(c); return a; }, {});
    const run = Object.values(row).find(r => r.length >= 4).sort((a, b) => a.col - b.col);
    for (const c of run) if (c.unit && c.unit.kind === 'hero') c.unit = null;
    ['M', 'A', '*', 'E'].forEach((L, k) => { run[k].unit = me.makeGold(L); });
    me.checkSpell(run[2].id);
    return { heroes: me.stats.heroes - before, wild: me.stats.wildSpells, last: me.stats.spelled.slice(-1)[0] };
  });
  ok(spelled.heroes === 1 && spelled.wild === 1 && spelled.last === 'MAGE', `★ wild completes MAGE (${JSON.stringify(spelled)})`);
  // merge combo
  const combo = await page.evaluate(() => {
    const me = __LL.ctl.me; const free = me.freeCells();
    if (free.length < 2) { me.cells.forEach(c => { if (c.unit && c.unit.kind === 'basic') c.unit = null; }); }
    const f = me.freeCells(); const a = f[0], b = f[1];
    a.unit = me.makeBasic('K', 1); me.tray[0] = me.makeBasic('K', 1); me.place({ tray: 0 }, a.id);
    b.unit = me.makeBasic('B', 1); me.tray[0] = me.makeBasic('B', 1); const ink0 = me.ink; me.place({ tray: 0 }, b.id);
    return { combo: me.combo, max: me.stats.maxCombo, bonus: Math.round(me.ink - ink0) };
  });
  ok(combo.combo >= 2 && combo.bonus > 0, `two quick merges make a combo with bonus ink (${JSON.stringify(combo)})`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + '/f4_combo.png' });
  // finish the match quickly and check quest progress lands in the profile
  await page.evaluate(() => { __LL.ctl.match.sides[1].lives = 0; });
  await page.waitForSelector('.results', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/f5_results.png' });
  ok(await page.locator('.res-boons .boon-chip').count() >= 1, 'results list the blessings you chose');
  const q = await page.evaluate(() => __LL.P.quests.list.map(x => x.id + ':' + x.prog).join(' '));
  console.log('quests after match:', q);
  await page.click('#cont'); await page.waitForSelector('.hub', { timeout: 15000 }); await page.waitForTimeout(300);
  // force-complete a quest and claim it
  const coins0 = await page.evaluate(() => { __LL.P.quests.list[0].prog = 999; __LL.show('hub'); return __LL.P.coins; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/f6_quests.png' });
  await page.click('[data-claim="0"]'); await page.waitForTimeout(300);
  const st4 = await page.evaluate(() => ({ coins: __LL.P.coins, claimed: __LL.P.quests.list[0].claimed }));
  ok(st4.claimed && st4.coins > coins0, `claiming a quest pays coins (${coins0} → ${st4.coins})`);
  ok(errors.length === 0, 'no console errors ' + JSON.stringify(errors.slice(0, 3)));
  await browser.close();
})();
