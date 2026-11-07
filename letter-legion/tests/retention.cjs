// Retention features through the real UI: starter quests, 7-day login streak (claim, next day, missed day),
// one-tap "Next rival" / "Try again" from results, and the Rally bonus after a loss.
// Usage: node tests/retention.cjs [outdir]
const { chromium } = require('playwright');
const OUT = process.argv[2] || '/tmp/claude-0/shots';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.route('**/sdk.crazygames.com/**', r => r.abort());
  await p.goto('http://127.0.0.1:8123/index.html'); await p.waitForSelector('.title-screen');
  ok(await p.evaluate(() => __LL.P.quests.list.map(q => q.id).join()) === 'win1,spell3,boons2', 'a brand-new player gets the three starter quests');
  await p.evaluate(() => { __LL.P.tutorialDone = true; __LL.show('hub'); }); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + '/r1_hub_streak.png' });
  const c0 = await p.evaluate(() => __LL.P.coins);
  await p.click('#claimStreak'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => __LL.P.coins) === c0 + 60 && await p.locator('.streak-strip.done').count() === 1, 'Day 1 login reward pays 60 coins and the strip shows tomorrow\'s reward');
  ok(await p.locator('#claimStreak').count() === 0, 'cannot claim twice on the same day');
  // pretend the claims happened on the previous days → Day 3 (Rare weapon) today
  const day3 = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); __LL.P.streak = { day: 2, last: k, claimed: k }; __LL.show('hub'); return k; });
  await p.waitForTimeout(200);
  const w0 = await p.evaluate(() => __LL.P.weapons.length);
  await p.click('#claimStreak'); await p.waitForTimeout(300);
  ok(await p.evaluate(w0 => __LL.P.weapons.length === w0 + 1 && __LL.P.weapons.slice(-1)[0].rarity === 'blue' && __LL.P.streak.day === 3, w0), 'consecutive day: Day 3 gives a Rare weapon');
  await p.evaluate(() => { __LL.P.streak = { day: 5, last: '2000-01-01', claimed: '2000-01-01' }; __LL.show('hub'); }); await p.waitForTimeout(200);
  ok((await p.locator('.streak-strip').innerText()).includes('Day 1') && (await p.locator('.streak-strip').innerText()).includes('restarted'), 'a missed day restarts the streak at Day 1');
  // first ladder win → results offer "Next: <rival>" → prematch of the next rival
  await p.click('#fight'); await p.waitForTimeout(300); await p.click('#go'); await p.waitForTimeout(500);
  await p.evaluate(() => __LL.ctl.match.finish(0, "The rival's ward fell")); await p.waitForSelector('.results'); await p.waitForTimeout(400);
  const nextLabel = await p.locator('#next').innerText();
  ok(/Next rival/.test(nextLabel) && (await p.locator('.results').innerText()).includes('Wren'), 'results after a ladder win offer the next rival: ' + nextLabel);
  ok(await p.locator('.res-quests .rq').count() === 3, 'results show daily quest progress');
  await p.screenshot({ path: OUT + '/r2_results_next.png' });
  await p.click('#next'); await p.waitForSelector('.prematch', { timeout: 6000 }); await p.waitForTimeout(300);
  ok((await p.locator('.vs').innerText()).includes('Wren'), 'one tap goes straight to the next rival\'s pre-battle screen');
  // lose to Wren → "Try again" → Rally: free head start and a weaker rival
  await p.click('#go'); await p.waitForTimeout(500);
  const basePower = await p.evaluate(() => __LL.ctl.rival.power);
  await p.evaluate(() => __LL.ctl.match.finish(1, 'Your ward fell')); await p.waitForSelector('.results'); await p.waitForTimeout(400);
  ok(/Try again/.test(await p.locator('#next').innerText()), 'results after a loss offer "Try again"');
  await p.click('#next'); await p.waitForSelector('.prematch', { timeout: 6000 }); await p.waitForTimeout(300);
  ok(await p.locator('.rally').count() === 1 && (await p.locator('#hs').innerText()).includes('Rally'), 'pre-battle screen shows the Rally bonus with a free head start');
  await p.screenshot({ path: OUT + '/r3_rally.png' });
  const coins = await p.evaluate(() => __LL.P.coins);
  await p.click('#go'); await p.waitForTimeout(500);
  const st = await p.evaluate(() => ({ power: __LL.ctl.rival.power, ink: Math.round(__LL.ctl.me.ink), shovels: __LL.ctl.me.shovels, coins: __LL.P.coins }));
  ok(st.power < basePower && st.ink >= 160 && st.shovels >= 1 && st.coins === coins, `Rally applies: rival power ${basePower.toFixed(2)} → ${st.power.toFixed(2)}, start ink ${st.ink}, no coins spent`);
  await p.evaluate(() => __LL.ctl.match.finish(0, "The rival's ward fell")); await p.waitForSelector('.results'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !__LL.P.lossStreak.wren), 'a win clears the Rally counter');
  await p.click('#cont'); await p.waitForSelector('.hub', { timeout: 6000 });
  ok(errors.length === 0, 'no page errors ' + JSON.stringify(errors));
  await b.close(); console.log(fails ? `${fails} FAILED` : 'RETENTION FEATURES OK'); process.exit(fails ? 1 : 0);
})();
