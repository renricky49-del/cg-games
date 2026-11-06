// Boot, main loop, match lifecycle & rewards
import { CG } from './cg.js';
import { Audio } from './audio.js';
import { loadAll } from './assets.js';
import { MatchView } from './render.js';
import { MatchController } from './game.js';
import { P, loadProfile, saveProfile, unlockedHeroIds, addXp, rollWeapon, equippedWeapons, refreshShop, dailyInfo } from './save.js';
import { initUI, show, hideUI, toast, pauseMenu, spellbookModal, resultsScreen } from './ui.js';
import { RIVALS, TUTOR_RIVAL, HEROES, MAP_BY_ID } from './data.js';
import { RNG } from './rng.js';
import { FONT } from './glyphs.js';

const canvas = document.getElementById('game');
const view = new MatchView(canvas);
let ctl = null;
let pauseModal = null;
let adActive = false;
window.__LL = { get ctl() { return ctl; }, get P() { return P; }, show, startMatch: o => startMatch(o), RIVALS, view }; // test hook

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
  spellbook: () => { if (!ctl) return; ctl.paused = true; CG.gameplayStop(); spellbookModal(() => { ctl.paused = false; CG.gameplayStart(); }); },
  toast: t => toast(t, 1400),
  hint: setHint,
  cursor: c => { canvas.style.cursor = c; },
  setFast: on => { P.settings.fast = on; saveProfile(); },
};

function openPause() {
  if (!ctl || ctl.ended || pauseModal) return;
  ctl.paused = true; CG.gameplayStop();
  pauseModal = pauseMenu(() => { pauseModal = null; ctl.paused = false; CG.gameplayStart(); }, () => { pauseModal = null; ctl.paused = false; ctl.match.finish(1, 'You forfeited the match'); });
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
  Audio.playMusic();
}
function startTutorial() { startMatch({ mode: 'tutorial', mapId: 'ember', seed: 12345 }); }

function computeRewards(res) {
  const o = res.opts; const tutorial = o.tutorial;
  const ri = Math.max(0, o.rivalIndex ?? 0);
  let coins, xp;
  if (tutorial) { coins = 100; xp = 60; }
  else if (res.won) { coins = 60 + 22 * ri + res.wave * 3; xp = 45 + 10 * ri + res.wave * 4; }
  else { coins = 15 + res.wave * 2; xp = 15 + res.wave * 3; }
  if (o.mode === 'daily' && res.won && P.daily.wins < 3) coins = Math.round(coins * 1.5);
  coins = Math.round(coins * (res.coinsMult || 1));
  const rng = new RNG((Date.now() & 0x7fffffff) ^ res.score);
  let weapon = null;
  if (!tutorial && (res.won || rng.next() < 0.25)) {
    weapon = rollWeapon(rng, res.won ? ri * 0.18 : 0);
    if (!res.won && (weapon.rarity !== 'white' && weapon.rarity !== 'green')) weapon.rarity = 'green';
    if (P.weapons.length >= 40) { // auto-sell the weakest sellable weapon to make room
      const idx = P.weapons.findIndex(w => (w.rarity === 'white') && !Object.values(P.equipped).includes(w.uid));
      if (idx >= 0) { P.coins += 15; P.weapons.splice(idx, 1); } else weapon = null;
    }
    if (weapon) P.weapons.push(weapon);
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
  refreshShop(false);
  saveProfile(true);
  return { coins, xp, weapon, ladderUp, newBest, levelUps, unlocks };
}

function endMatch(res) {
  const rewards = computeRewards(res);
  if (res.won) CG.happytime();
  if (rewards.levelUps.length) Audio.play('levelup'); else if (rewards.weapon) Audio.play('drop');
  setHint(null);
  resultsScreen(res, rewards, async () => {
    const wasTutorial = res.opts.tutorial;
    ctl = null; canvas.style.display = 'none';
    // natural break → midgame ad (rate-limited inside the adapter; never right after session start)
    if (!wasTutorial) await CG.midgame();
    show('hub');
    if (wasTutorial) toast('Tutorial complete! Challenge the rival ladder ⚔', 2600);
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
  if (ctl && !pauseModal && document.querySelector('#modals').children.length === 0) { ctl.key(e.key); if (e.key === ' ') e.preventDefault(); }
  else if (e.key === 'Escape' && pauseModal) { /* resume via button */ }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (ctl && !ctl.ended) openPause(); Audio.suspend(); } else Audio.resume(); });
window.addEventListener('pointerdown', () => Audio.unlock(), { capture: true });

// ---------------- ads ----------------
CG.onAdStart(() => { adActive = true; Audio.setAdMuted(true); if (ctl) ctl.paused = true; CG.gameplayStop(); });
CG.onAdEnd(() => { adActive = false; Audio.setAdMuted(false); if (ctl && !ctl.ended && !pauseModal) { ctl.paused = false; CG.gameplayStart(); } });

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
  Audio.loadMusic('assets/audio/music.mp3');
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
