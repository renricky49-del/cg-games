// Boot, main loop, match lifecycle & rewards
import { CG } from './cg.js';
import { Audio } from './audio.js';
import { loadAll } from './assets.js';
import { MatchView } from './render.js';
import { MatchController } from './game.js';
import { P, loadProfile, saveProfile, unlockedHeroIds, addXp, rollWeapon, equippedWeapons, refreshShop, dailyInfo, questProgress } from './save.js';
import { initUI, show, hideUI, toast, pauseMenu, spellbookModal, resultsScreen, draftModal } from './ui.js';
import { RIVALS, TUTOR_RIVAL, HEROES, MAP_BY_ID, RARITIES } from './data.js';
import { RNG } from './rng.js';
import { FONT } from './glyphs.js';

const canvas = document.getElementById('game');
const view = new MatchView(canvas);
let ctl = null;
let pauseModal = null;
let adActive = false;
// automated-test hook: only exposed when running locally (never on the live site)
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) || /[?&]test=1/.test(location.search)) window.__LL = { get ctl() { return ctl; }, get P() { return P; }, show, startMatch: o => startMatch(o), RIVALS, view };

function resize() {
  const W = window.innerWidth, H = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  view.resize(W, H, dpr);
  document.documentElement.style.setProperty('--vh', H / 100 + 'px');
}
window.addEventListener('resize', resize);

function setHint(html) {
  const el = document.getElementById('hint');
  if (!html) { el.classList.remove('on'); return; }
  el.innerHTML = html; el.classList.add('on');
}

const hooks = {
  onEnd: res => endMatch(res),
  pause: () => openPause(),
  draft: c => draftModal(c),
  sync: () => syncGameplay(),
  spellbook: () => { const c = ctl; if (!c || c.ended) return; c.hold('book'); syncGameplay(); spellbookModal(() => { c.release('book'); syncGameplay(); }); },
  toast: t => toast(t, 1400),
  notice: html => toast(html, 4500),
  hint: setHint,
  cursor: c => { canvas.style.cursor = c; },
  setFast: on => { P.settings.fast = on; saveProfile(); },
  tipOnce: id => { if (P.tips[id]) return false; P.tips[id] = 1; saveProfile(); return true; },
};

// tell the SDK whether the player is actively playing right now
function syncGameplay() { if (ctl && !ctl.ended && !ctl.paused) CG.gameplayStart(); else CG.gameplayStop(); }
function openPause() {
  const c = ctl;
  if (!c || c.ended || pauseModal || adActive) return; // an ad already pauses the match
  c.hold('menu'); syncGameplay();
  pauseModal = pauseMenu(() => { pauseModal = null; c.release('menu'); syncGameplay(); },
    () => { pauseModal = null; c.release('menu'); if (c.ended) return; c.match.forfeit = true; c.match.finish(1, c.tutorial ? 'Tutorial skipped' : 'You forfeited the match'); },
    c.tutorial ? 'Skip tutorial' : 'Forfeit match', c.me.boons);
}

function startMatch(o) {
  const tutorial = o.mode === 'tutorial';
  const rival = tutorial ? TUTOR_RIVAL : o.rival;
  const weapons = {}; for (const [hid, w] of Object.entries(equippedWeapons())) weapons[hid] = w;
  const opts = {
    ...o, tutorial, rival,
    unlockedHeroes: tutorial ? ['KING', 'MAGE', 'MONK'] : unlockedHeroIds(),
    passives: tutorial ? [] : P.loadout.passive, actives: tutorial ? [] : P.loadout.active,
    weapons: tutorial ? {} : weapons, fast: !tutorial && P.settings.fast,
    dailyBuff: tutorial ? null : o.dailyBuff,
  };
  hideUI(); setHint(null);
  canvas.style.display = 'block';
  ctl = new MatchController(view, opts, hooks);
  CG.gameplayStart();
  Audio.setTrack('battle');
}
function startTutorial() { startMatch({ mode: 'tutorial', mapId: 'ember', seed: 12345 }); }

function computeRewards(res) {
  const o = res.opts; const tutorial = o.tutorial;
  const ri = Math.max(0, o.rivalIndex ?? 0);
  let coins, xp;
  const firstTutorial = tutorial && !P.tutorialDone;
  if (res.forfeit) { coins = 0; xp = 0; } // forfeits never pay (no reward farming)
  else if (tutorial) { coins = firstTutorial && res.won ? 100 : 0; xp = firstTutorial && res.won ? 60 : 0; }
  else if (res.won) { coins = 60 + 22 * ri + res.wave * 3; xp = 45 + 10 * ri + res.wave * 4; }
  else if (res.wave >= 3) { coins = 10 + res.wave * 2; xp = 12 + res.wave * 3; } // a real attempt still earns a little
  else { coins = 0; xp = 5; }
  if (o.mode === 'daily' && res.won && P.daily.wins < 3) coins = Math.round(coins * 1.5);
  coins = Math.round(coins * (res.coinsMult || 1));
  const rng = new RNG((Date.now() & 0x7fffffff) ^ res.score);
  let weapon = null;
  if (!tutorial && !res.forfeit && (res.won || (res.wave >= 5 && rng.next() < 0.25))) {
    weapon = rollWeapon(rng, res.won ? ri * 0.18 : 0, null, res.won ? 4 : 1); // losses drop Common/Uncommon only
    if (P.weapons.length >= 40) { // make room: auto-sell the weakest unequipped sellable weapon
      const order = ['white', 'green', 'blue'];
      let idx = -1;
      for (const r of order) { idx = P.weapons.findIndex(w => w.rarity === r && !Object.values(P.equipped).includes(w.uid)); if (idx >= 0) break; }
      if (idx >= 0) { const sold = P.weapons.splice(idx, 1)[0]; P.coins += RARITIES.find(r => r.id === sold.rarity).sell; }
      // if nothing could be sold, keep the drop anyway (inventory may exceed 40 slightly)
    }
    P.weapons.push(weapon);
  }
  // ladder progress
  let ladderUp = null;
  if (o.mode === 'ladder' && res.won && ri === P.ladder) {
    P.ladder++; coins += 100; if (P.ladder < RIVALS.length) ladderUp = RIVALS[P.ladder].name; else ladderUp = 'Ladder complete! You are the Grand Speller!';
  }
  // bests
  let newBest = false;
  if (!tutorial) {
    if ((P.bests[res.mapId] || 0) < res.score) { P.bests[res.mapId] = res.score; newBest = true; }
    if (o.mode === 'daily') { P.daily.played++; if (res.won) P.daily.wins++; if (res.score > P.daily.best) P.daily.best = res.score; }
  }
  const before = unlockedHeroIds();
  P.coins += coins;
  const levelUps = addXp(xp);
  const unlocks = unlockedHeroIds().filter(h => !before.includes(h));
  P.stats.matches++; if (res.won) P.stats.wins++; P.stats.heroes += res.stats.heroes; P.stats.kills += res.stats.kills;
  if (tutorial) P.tutorialDone = true;
  const questsDone = (!tutorial && !res.forfeit) ? questProgress({ won: res.won, mode: o.mode, stats: res.stats, lives: res.lives }) : [];
  // Rally: consecutive real losses to a ladder rival make the next attempt easier (shown on the pre-battle screen)
  if (o.mode === 'ladder' && o.rival && !res.forfeit) { if (res.won) delete P.lossStreak[o.rival.id]; else P.lossStreak[o.rival.id] = (P.lossStreak[o.rival.id] || 0) + 1; }
  if (!res.forfeit) refreshShop(false);
  saveProfile(true);
  return { coins, xp, weapon, ladderUp, newBest, levelUps, unlocks, questsDone, next: nextStep(res), quests: P.quests.list.map(q => ({ ...q })) };
}
// one tap from the results screen straight into the next battle (keeps the session going)
function nextStep(res) {
  const o = res.opts; if (o.tutorial) return null;
  if (o.mode === 'ladder') {
    if (res.won && P.ladder < RIVALS.length && P.ladder > o.rivalIndex) return { label: 'Next rival ▶', screen: 'prematch', arg: { mode: 'ladder', rivalIndex: P.ladder } };
    return { label: res.won ? 'Rematch ▶' : 'Try again ▶', screen: 'prematch', arg: { mode: 'ladder', rivalIndex: o.rivalIndex } };
  }
  if (o.mode === 'daily') return { label: 'Play again ▶', screen: 'prematch', arg: { mode: 'daily' } };
  return { label: 'Play again ▶', screen: 'prematch', arg: { mode: o.mode, rivalIndex: o.rivalIndex, mapId: o.mapId } };
}

function endMatch(res) {
  // close anything still open over the battle (pause menu, spellbook)
  if (pauseModal) { pauseModal.close(); pauseModal = null; }
  document.querySelectorAll('#modals .modal-bg').forEach(m => m.remove());
  document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); // battle tips don't follow you onto the results
  if (ctl) ctl.dispose();
  const rewards = computeRewards(res);
  // happytime is for special moments only: beating a new ladder rival
  if (rewards.ladderUp) CG.happytime();
  if (rewards.levelUps.length) Audio.play('levelup'); else if (rewards.weapon) Audio.play('drop');
  setHint(null);
  resultsScreen(res, rewards, async (usedRewarded, goNext) => {
    const wasTutorial = res.opts.tutorial;
    ctl = null; canvas.style.display = 'none'; Audio.setTrack('menu');
    // natural break → midgame ad (rate-limited inside the adapter; never right after session start)
    // ...but never a midgame ad in the same break as a rewarded ad (CrazyGames ad rules)
    if (!wasTutorial && !usedRewarded) await CG.midgame();
    if (wasTutorial && P.ladder === 0) { show('prematch', { mode: 'ladder', rivalIndex: 0 }); toast('Tutorial complete! Your first duel awaits ⚔', 2600); }
    else if (goNext && rewards.next) show(rewards.next.screen, rewards.next.arg);
    else show('hub');
  });
}

// ---------------- input ----------------
function pos(e) { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
canvas.addEventListener('pointerdown', e => { if (!ctl) return; canvas.setPointerCapture?.(e.pointerId); const [x, y] = pos(e); ctl.pointerMove(x, y); ctl.pointerDown(x, y); e.preventDefault(); });
canvas.addEventListener('pointermove', e => { if (!ctl) return; const [x, y] = pos(e); ctl.pointerMove(x, y); });
canvas.addEventListener('pointerup', e => { if (!ctl) return; const [x, y] = pos(e); ctl.pointerUp(x, y); });
canvas.addEventListener('pointercancel', () => { if (ctl) { view.drag = null; view.pointer.down = false; } });
canvas.addEventListener('pointerleave', () => { if (ctl) { view.tip = null; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (adActive) { e.preventDefault(); return; }
  if (ctl && !pauseModal && document.querySelector('#modals').children.length === 0) { ctl.key(e.key); if (e.key === ' ') e.preventDefault(); }
  else if (e.key === 'Escape' && pauseModal) { /* resume via button */ }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (ctl && !ctl.ended) openPause(); Audio.suspend(); } else Audio.resume(); });
// iOS only unlocks WebAudio on touchend/click gestures
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, () => Audio.unlock(), { capture: true });

// ---------------- ads ----------------
CG.onAdStart(() => { adActive = true; Audio.setAdMuted(true); if (ctl) ctl.hold('ad'); CG.gameplayStop(); });
CG.onAdEnd(() => { adActive = false; Audio.setAdMuted(false); if (ctl) ctl.release('ad'); syncGameplay(); });

// ---------------- loop ----------------
let last = performance.now();
let frames = 0, fpsT = 0; window.__fps = 60;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  frames++; fpsT += dt; if (fpsT >= 1) { window.__fps = frames / fpsT; frames = 0; fpsT = 0; }
  if (ctl) { try { ctl.update(dt); } catch (err) { console.error(err); } }
  requestAnimationFrame(frame);
}

// ---------------- boot ----------------
async function boot() {
  const bar = document.querySelector('#loading .bar i');
  await CG.init();
  CG.loadingStart();
  try { await Promise.race([Promise.all([document.fonts.load(`40px ${FONT}`), document.fonts.load('20px "Fredoka"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* fallback font */ }
  await loadAll(p => { if (bar) bar.style.width = Math.round(p * 100) + '%'; });
  loadProfile();
  Audio.setMusic(P.settings.music); Audio.setSfx(P.settings.sfx);
  Audio.setSdkMuted(CG.muteAudioSetting());
  CG.onSettingsChange(s => { if (s && 'muteAudio' in s) Audio.setSdkMuted(!!s.muteAudio); });
  Audio.loadMusic({ menu: 'assets/audio/menu.mp3', battle: 'assets/audio/music.mp3' });
  Audio.loadSamples(['sfx_gold', 'sfx_box', 'sfx_merge', 'sfx_roar', 'sfx_meteor', 'sfx_cry', 'win', 'lose', ...HEROES.map(h => 'v_' + h.id)]);
  resize();
  initUI({ startMatch, startTutorial, onScreen: () => { CG.gameplayStop(); }, rewarded: () => CG.rewarded() });
  document.getElementById('loading').remove();
  CG.loadingStop();
  CG.markSessionStart();
  canvas.style.display = 'none';
  show('title');
  requestAnimationFrame(frame);
}
boot();
