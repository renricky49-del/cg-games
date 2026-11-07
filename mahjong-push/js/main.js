// Teahouse Tile Slide — screens, progression, modes, boosters, ads, tutorial.
import * as L from './logic.js';
import { LEVELS } from './levels-data.js';
import { AREAS, LEVELS_PER_CHAPTER } from './meta.js';
import { loadGlyphs, setSkin, SKINS, skinPreview } from './tiles.js';
import { Ambient } from './ambient.js';
import { BoardView } from './game.js';
import { Audio } from './audio.js';
import { CG } from './cg.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const icon = (n, cls = '') => `<svg class="i ${cls}"><use href="#i-${n}"/></svg>`;
const SAVE_KEY = 'tts_save_v1';
const PRICES = { hint: 30, shuffle: 45, undo: 20 };
const NUM_LEVELS = LEVELS.length;
const CHAPTERS = Math.ceil(NUM_LEVELS / LEVELS_PER_CHAPTER);

// ---------------- save ----------------
const DEFAULT_SAVE = () => ({
  v: 1, stars: {}, bank: 0, coins: 60, boosters: { hint: 3, shuffle: 2, undo: 3 },
  areas: AREAS.map(() => [false, false, false, false, false]),
  settings: { music: true, sfx: true, hc: false },
  daily: { last: '', streak: 0, best: 0 }, endlessBest: 0, played: 0, seenAreaDone: [],
  skins: ['jade'], skin: 'jade',
  stats: { gold: 0, rush: 0, mega: 0, maxChain: 0, maxCombo: 0, tied: 0 }, ach: {}, gift: '',
});
let S = DEFAULT_SAVE();
async function loadSave() {
  try {
    const raw = await CG.getItem(SAVE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      S = Object.assign(DEFAULT_SAVE(), d);
      S.boosters = Object.assign(DEFAULT_SAVE().boosters, d.boosters || {});
      S.settings = Object.assign(DEFAULT_SAVE().settings, d.settings || {});
      S.daily = Object.assign(DEFAULT_SAVE().daily, d.daily || {});
      S.stats = Object.assign(DEFAULT_SAVE().stats, d.stats || {});
      S.ach = d.ach || {};
      while (S.areas.length < AREAS.length) S.areas.push([false, false, false, false, false]);
    }
  } catch (e) { S = DEFAULT_SAVE(); }
}
let saveT = null;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => CG.setItem(SAVE_KEY, JSON.stringify(S)), 150);
}

// ---------------- progression helpers ----------------
const chapterOf = (n) => Math.floor((n - 1) / LEVELS_PER_CHAPTER);
const areaDone = (c) => S.areas[c] && S.areas[c].every(Boolean);
const cleared = (n) => (S.stars[n] || 0) > 0;
function chapterUnlocked(c) { return c === 0 || (cleared(c * LEVELS_PER_CHAPTER) && areaDone(c - 1)); }
function levelUnlocked(n) {
  if (n < 1 || n > NUM_LEVELS) return false;
  if (n === 1) return true;
  if (!cleared(n - 1)) return false;
  const c = chapterOf(n);
  return (n - 1) % LEVELS_PER_CHAPTER !== 0 || areaDone(c - 1);
}
function nextLevel() {
  for (let n = 1; n <= NUM_LEVELS; n++) if (!cleared(n)) return n;
  return NUM_LEVELS;
}
const areaUnlocked = (c) => c === 0 || cleared(c * LEVELS_PER_CHAPTER);
const totalStars = () => Object.values(S.stars).reduce((a, b) => a + b, 0);

// ---------------- ui helpers ----------------
let current = 'loading';
function show(id) {
  if (!$('#modal').classList.contains('hidden')) { modalClose = null; $('#modal').classList.add('hidden'); }
  $$('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
  current = id;
  document.body.classList.toggle('ingame', id === 's-game');
  document.body.classList.toggle('blurbg', id === 's-house');
  if (amb) amb.set(id === 's-title' || id === 's-map' ? 'petals' : id === 's-house' ? (AREAS[houseArea].ambient || 'motes') : 'none');
}
function setBg(name) { $('#bg').style.backgroundImage = `url(assets/img/bg/${name}.webp)`; }
let toastT;
function toast(msg, ms = 1800) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
let modalClose = null;
function modal(html, onClose) {
  $('#modal-card').innerHTML = html;
  $('#modal').classList.remove('hidden');
  modalClose = onClose || null;
  return $('#modal-card');
}
function closeModal() {
  $('#modal').classList.add('hidden');
  const f = modalClose; modalClose = null;
  f && f();
}
const modalOpen = () => !$('#modal').classList.contains('hidden');
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function refreshWallet() {
  $('#map-stars').textContent = S.bank; $('#map-coins').textContent = S.coins;
  $('#house-stars').textContent = S.bank; $('#g-coins').textContent = S.coins;
  for (const k of ['hint', 'shuffle', 'undo']) {
    const b = $('#b-' + k); const n = S.boosters[k];
    b.textContent = n > 0 ? n : '+'; b.classList.toggle('plus', n <= 0);
  }
}
const mascot = (pose, cls = '') => `<img class="mascot ${cls}" src="assets/img/mascot_${pose}.webp" alt="" draggable="false">`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const starRow = (n, big = false) => [0, 1, 2].map((i) => `<svg class="i ${i < n ? 'on' : ''}"${big ? ` style="animation-delay:${0.12 + i * 0.18}s"` : ''}><use href="#i-star"/></svg>`).join('');

// ---------------- board / session ----------------
let board, amb;
let G = null; // current session
const tut = { el: null, step: 0, kind: null };

function insets() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const top = $('#s-game .topbar').getBoundingClientRect().bottom + 6;
  const bt = $('#s-game .boosters').getBoundingClientRect();
  const side = bt.top > vh * 0.5; // boosters below the board (portrait) or at the side (landscape)
  let bottom = side ? vh - bt.top + 10 : 12;
  let lr = side ? Math.max(8, vw * 0.015) : vw - bt.left + 12;
  const msgb = side ? vh - bt.top + 12 : 14;
  document.documentElement.style.setProperty('--msgb', msgb + 'px');
  if (G && G.reserve) bottom += Math.min(90, vh * 0.13);
  return { top, bottom, left: lr, right: lr };
}

// 3-star par time: base + seconds per pair, more thinking time on harder boards (win = casual-bot win
// rate measured at build time). Rounded to 5 s so targets read cleanly.
function parFor(pairs, win = 0.6) { return Math.round((20 + pairs * (3.5 + 4 * (1 - win))) / 5) * 5; }

function startLevel(n) {
  const def = LEVELS[n - 1];
  const b = L.decode(def.s);
  const pairs = L.tileCount(b.cells) / 2;
  G = { mode: 'level', level: n, t: 0, used: 0, paused: false, adPaused: false, par: def.tut ? 9999 : parFor(pairs, def.win ?? 0.6), pairs, tut: def.tut || null, done: false, reserve: !!(def.tut || TIPS[n]) };
  hideTutorial();
  $('#g-label').textContent = `Level ${n}`;
  $('#g-target').innerHTML = def.tut ? 'Tutorial' : `${icon('star')}${icon('star')}${icon('star')} under ${fmt(G.par)}`;
  if (!def.tut && n >= 4) b.gold = pickGold(b.cells, n * 7919);
  beginBoard(b, chapterOf(n));
  showLevelTip(n);
  if (G.tut) startTutorial(G.tut);
}

function beginBoard(b, chapter = 0) {
  show('s-game');
  setBg('tablebg');
  board.hc = S.settings.hc;
  refreshWallet();
  $('#g-combo').classList.remove('show');
  if (G) { G.rush = 0; G.rushT = 0; }
  document.body.classList.remove('rush'); $('#g-rush').style.width = '0%';
  board.start(b, {
    onMatch: onMatch, onWin: onWin, onStuck: onStuck,
    onFailedPush: () => { if (G && G.tut === 'push') tutBubble('Almost! The dragged tile must line up with its twin, with nothing in between.'); },
    onComboEnd: () => $('#g-combo').classList.remove('show'),
    onTiedBlock: () => { if (!tiedToastShown) { tiedToastShown = true; toast('Tied tiles can\u2019t slide \u2014 match them to set them free!', 2600); } },
  });
  CG.gameplayStart();
}

function onMatch(combo, m, a, b) {
  if (!G) return;
  const el = $('#g-combo');
  if (combo >= 2) { el.textContent = `Combo ×${combo}`; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  const c = board._center(a);
  if (G.mode === 'endless') {
    const pts = 10 * combo;
    G.score += pts; G.timeLeft += 1;
    board.floatText(`+${pts}`, c.x, c.y);
    updateEndlessHud();
  } else if (combo >= 3) {
    board.floatText(`Combo ×${combo}`, c.x, c.y, '#ffe27a');
    if (combo % 3 === 0) { S.coins += 2; refreshWallet(); }
  }
  if (G.tut) { tutAfterMove(); return; }
  funOnMatch(combo, m, a, b, c);
}

// ---------------- fun layer: golden pair, mega slides, Tea Rush, achievements, daily gift ----------------
const RUSH_SECS = 6;
let tiedToastShown = false;
// golden pair: two tiles of one face get a gold rim and pay a bonus when matched (no effect on solvability)
function pickGold(cells, seed) {
  const rnd = L.mulberry32(seed);
  const byFace = {};
  cells.forEach((v, i) => { if (v >= 0 && v < L.TIED) (byFace[v] = byFace[v] || []).push(i); });
  const faces = Object.keys(byFace).filter((f) => byFace[f].length >= 2);
  if (!faces.length) return [];
  const list = L.shuffleArr(byFace[faces[Math.floor(rnd() * faces.length)]].slice(), rnd);
  return list.slice(0, 2);
}
function funOnMatch(combo, m, a, b, c) {
  const st = S.stats, endless = G.mode === 'endless', rushing = G.rushT > 0;
  let gain = 12 + 6 * Math.min(combo - 1, 5), coins = 0, pts = 0;
  st.maxCombo = Math.max(st.maxCombo, combo);
  st.tied += (a.face >= L.TIED ? 1 : 0) + (b.face >= L.TIED ? 1 : 0);
  if (m.type === 'push' && m.chain.length >= 2) {
    const n = m.chain.length;
    st.maxChain = Math.max(st.maxChain, n);
    if (n >= 3) {
      st.mega++; gain += 20; coins += n * 3; pts += n * 30;
      board.bigBurst(a); Audio.play('mega', n);
      board.floatText(n >= 5 ? `AVALANCHE! ×${n}` : `MEGA SLIDE ×${n}`, c.x, c.y - board.ch * 0.8, '#ffd23a');
    } else board.floatText('Chain slide!', c.x, c.y - board.ch * 0.8, '#bff5d8');
  }
  if (a.gold || b.gold) {
    st.gold++; gain += 15; coins += 20; pts += 150;
    board.bigBurst(a.gold ? a : b, 34); Audio.play('coin'); Audio.play('chime');
    board.floatText(endless ? 'Golden pair! +5s' : 'Golden pair! +20', c.x, c.y + board.ch * 0.6, '#ffe27a');
    if (endless) G.timeLeft += 5;
  }
  if (rushing) { coins += 2; pts += 10 * combo; }
  if (endless) { G.score += pts; updateEndlessHud(); } else if (coins) { S.coins += coins; refreshWallet(); bump($('#g-coins').parentElement); }
  if (!rushing) {
    G.rush = Math.min(100, (G.rush || 0) + gain);
    if (G.rush >= 100) startRush();
  }
  $('#g-rush').style.width = (rushing ? 100 : G.rush) + '%';
  checkAch();
}
function startRush() {
  G.rushT = RUSH_SECS; G.rush = 100;
  S.stats.rush++;
  board.rush = true; document.body.classList.add('rush');
  const el = document.createElement('div'); el.className = 'rush-banner'; el.textContent = 'TEA RUSH!';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1500);
  Audio.play('rush');
  toast(G.mode === 'endless' ? 'Clock frozen \u2014 double points!' : 'Clock frozen \u2014 bonus coins on every match!', 2000);
}
function endRush() {
  G.rushT = 0; G.rush = 0; board.rush = false; document.body.classList.remove('rush');
  $('#g-rush').style.width = '0%';
}

const ACH = [
  { id: 'first', name: 'First Cup', desc: 'Clear your first level', rw: 20, goal: 1, val: () => Object.keys(S.stars).length },
  { id: 'combo5', name: 'Tea Party', desc: 'Reach a ×5 combo', rw: 30, goal: 5, val: () => S.stats.maxCombo },
  { id: 'combo10', name: 'Tea Frenzy', desc: 'Reach a ×10 combo', rw: 80, goal: 10, val: () => S.stats.maxCombo },
  { id: 'mega', name: 'Mega Slide', desc: 'Slide 3+ tiles into a match', rw: 30, goal: 3, val: () => S.stats.maxChain },
  { id: 'avalanche', name: 'Avalanche', desc: 'Slide 5+ tiles into a match', rw: 100, goal: 5, val: () => S.stats.maxChain },
  { id: 'gold', name: 'Golden Touch', desc: 'Match 10 golden pairs', rw: 60, goal: 10, val: () => S.stats.gold },
  { id: 'rush', name: 'Tea Rush', desc: 'Fill the Tea Rush meter', rw: 30, goal: 1, val: () => S.stats.rush },
  { id: 'rush20', name: 'Rush Hour', desc: 'Trigger 20 Tea Rushes', rw: 120, goal: 20, val: () => S.stats.rush },
  { id: 'cords', name: 'Knots Undone', desc: 'Match 25 tied tiles', rw: 60, goal: 25, val: () => S.stats.tied },
  { id: 'perfect', name: 'Perfect Brew', desc: 'Get 3 stars on 25 levels', rw: 80, goal: 25, val: () => Object.values(S.stars).filter((v) => v === 3).length },
  { id: 'stars', name: 'Star Gazer', desc: 'Earn 150 stars', rw: 150, goal: 150, val: () => totalStars() },
  { id: 'area', name: 'Open Doors', desc: 'Restore your first area', rw: 50, goal: 1, val: () => S.areas.filter((x) => x.every(Boolean)).length },
  { id: 'allareas', name: 'Grand Teahouse', desc: 'Restore all 7 areas', rw: 300, goal: AREAS.length, val: () => S.areas.filter((x) => x.every(Boolean)).length },
  { id: 'daily', name: 'Regular Guest', desc: 'Reach a 3-day daily streak', rw: 60, goal: 3, val: () => S.daily.best },
  { id: 'endless', name: 'Endless Steeping', desc: 'Score 2,000 in Endless', rw: 80, goal: 2000, val: () => S.endlessBest },
  { id: 'master', name: 'Tea Master', desc: 'Clear every level', rw: 500, goal: NUM_LEVELS, val: () => Object.keys(S.stars).length },
];
const achQueue = []; let achShowing = false;
function checkAch() {
  let got = false;
  for (const a of ACH) {
    if (S.ach[a.id] || a.val() < a.goal) continue;
    S.ach[a.id] = 1; S.coins += a.rw; achQueue.push(a); got = true;
  }
  if (got) { save(); refreshWallet(); showAch(); }
}
function showAch() {
  if (achShowing || !achQueue.length) return;
  const a = achQueue.shift(); achShowing = true;
  const el = $('#ach-pop');
  el.innerHTML = `<div class="ai">${icon('trophy')}</div><div><small>Achievement</small><b>${a.name}</b> · +${a.rw} coins</div>`;
  el.classList.add('show'); Audio.play('star', 2);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { achShowing = false; showAch(); }, 500); }, 2600);
}
function openTrophies() {
  const done = ACH.filter((a) => S.ach[a.id]).length;
  const card = modal(`<h2>Trophies</h2><p>${done} / ${ACH.length} unlocked</p><div class="achs">${ACH.map((a) => {
    const v = Math.min(a.goal, a.val()), ok = !!S.ach[a.id];
    return `<div class="ach ${ok ? 'done' : ''}"><div class="ai">${icon(ok ? 'trophy' : 'lock')}</div><div style="flex:1;min-width:0"><b>${a.name}</b><small>${a.desc}</small>${ok ? '' : `<div class="pb"><i style="width:${(v / a.goal) * 100}%"></i></div>`}</div><span class="rw">${ok ? icon('check') : `+${a.rw}`}</span></div>`;
  }).join('')}</div><div class="btns"><button class="btn primary" id="tr-ok">Close</button></div>`);
  card.querySelector('#tr-ok').onclick = closeModal;
}
function giftReady() { return S.gift !== todayStr(); }
function refreshGift() {
  const b = $('#gift-btn'); if (!b) return;
  const ready = giftReady();
  b.classList.toggle('ready', ready); b.classList.toggle('gold', ready);
  $('#gift-lbl').textContent = ready ? 'Daily gift' : 'Gift tomorrow';
  $('#title-trophies').textContent = `${ACH.filter((a) => S.ach[a.id]).length}/${ACH.length}`;
}
function openGift() {
  if (!giftReady()) { toast('Your next gift is ready tomorrow!'); return; }
  const card = modal(`${mascot(0)}<h2>Lucky Teapot</h2><p>Tap the teapot to pour today's gift!</p>
    <div class="gift-pot" id="pot">${icon('gift')}</div><div id="prize"></div>
    <div class="btns"><button class="btn primary hidden" id="g-ok">Collect</button></div>`);
  let opened = false;
  card.querySelector('#pot').onclick = () => {
    if (opened) return; opened = true;
    card.querySelector('#pot').classList.add('shake'); Audio.play('shuffle');
    setTimeout(() => {
      const r = Math.random();
      let txt;
      if (r < 0.2) { S.coins += 40; txt = '+40 coins'; } else if (r < 0.45) { S.coins += 60; txt = '+60 coins'; } else if (r < 0.6) { S.coins += 120; txt = '+120 coins!'; }
      else if (r < 0.75) { S.boosters.hint += 2; txt = '+2 Hints'; } else if (r < 0.9) { S.boosters.shuffle += 2; txt = '+2 Shuffles'; } else { S.bank += 2; txt = '+2 Stars!'; }
      S.gift = todayStr(); save(); refreshWallet(); refreshGift();
      card.querySelector('#prize').innerHTML = `<div class="gift-prize">${txt}</div>`;
      card.querySelector('#g-ok').classList.remove('hidden');
      Audio.play('win'); CG.happytime();
    }, 1000);
  };
  card.querySelector('#g-ok').onclick = closeModal;
}

function onWin() {
  if (!G || G.done) return;
  if (G.mode === 'endless') return endlessBoardCleared();
  if (G.rushT > 0) endRush();
  G.done = true;
  CG.gameplayStop();
  Audio.play('win');
  if (G.mode === 'daily') return dailyWin();
  const n = G.level;
  let stars = 3;
  if (G.t > G.par) stars--;
  if (G.used > 0) stars--;
  stars = Math.max(1, stars);
  const prev = S.stars[n] || 0;
  const first = prev === 0;
  const gained = Math.max(0, stars - prev);
  S.stars[n] = Math.max(prev, stars);
  S.bank += gained;
  const coins = 10 + stars * 5 + (first ? 10 : 0);
  S.coins += coins; S.played++;
  save(); refreshWallet(); checkAch();
  if (stars === 3) CG.happytime();
  hideTutorial();
  if (LEVELS[n - 1].tut && n < NUM_LEVELS) {
    // tutorials chain straight on: quick celebration over the board, no result screen to click through
    const box = board.frame ? { x: window.innerWidth / 2, y: window.innerHeight * 0.42 } : { x: 400, y: 300 };
    board.floatText(n === 1 ? 'Nice! Now try sliding' : 'Great! Let\u2019s play', box.x, box.y, '#fff6c8');
    [0, 1, 2].forEach((i) => setTimeout(() => Audio.play('star', i), 100 + i * 150));
    setTimeout(() => { if (G && G.level === n && current === 's-game') startLevel(n + 1); }, 850);
    return;
  }
  const isChapterEnd = n % LEVELS_PER_CHAPTER === 0;
  // early meta hook: offer the teahouse as soon as a restoration in the current area is affordable
  const area = Math.min(chapterOf(n), AREAS.length - 1);
  const canRestore = areaUnlocked(area) && AREAS[area].tasks.some((t, k) => !S.areas[area][k] && S.bank >= t.cost);
  const firstPrompt = canRestore && !S.housePrompted;
  if (firstPrompt) { S.housePrompted = true; save(); }
  const nextLocked = n < NUM_LEVELS && !levelUnlocked(n + 1);
  const card = modal(`${mascot(stars === 3 ? 1 : 0)}
    <h2>${['', 'Cleared!', 'Well brewed!', 'Perfect cup!'][stars]}</h2>
    <div class="stars-big">${starRow(stars, true)}</div>
    <p>Time ${fmt(G.t)} · ${G.used ? `${G.used} booster${G.used > 1 ? 's' : ''} used` : 'no boosters'}</p>
    <div class="rewards">
      <div class="pill coin"><b>+${coins}</b></div>
      ${gained ? `<div class="pill star"><b>+${gained}</b></div>` : ''}
    </div>
    ${stars < 3 ? `<p class="sub">${G.t > G.par ? `Finish under ${fmt(G.par)}` : ''}${G.t > G.par && G.used ? ' and ' : ''}${G.used ? 'clear it without Hint/Shuffle' : ''} for 3 stars.</p>` : ''}
    ${CG.rewardedAvailable() ? `<div class="btns">
      <button class="btn gold" id="w-double">${icon('film')} Double coins</button>
    </div>` : ''}
    ${firstPrompt ? `<p class="hook">${icon('star')} You can restore your first teahouse piece now!</p>
    <div class="btns"><button class="btn primary big pulse" id="w-house">${icon('house')} Restore the teahouse</button></div>` : ''}
    <div class="btns">
      <button class="btn" id="w-map">${icon('map')} Map</button>
      ${firstPrompt
        ? (!nextLocked && n < NUM_LEVELS ? `<button class="btn" id="w-next">Next ${icon('play')}</button>` : '')
        : isChapterEnd || nextLocked
          ? `<button class="btn primary" id="w-house">${icon('house')} Teahouse</button>`
          : `${canRestore ? `<button class="btn" id="w-house">${icon('house')} Teahouse <span class="dot"></span></button>` : ''}${n < NUM_LEVELS ? `<button class="btn primary big" id="w-next">Next ${icon('play')}</button>` : ''}`}
    </div>`);
  setTimeout(() => [0, 1, 2].forEach((i) => i < stars && setTimeout(() => Audio.play('star', i), 150 + i * 180)), 0);
  const dbl = card.querySelector('#w-double');
  if (dbl) dbl.onclick = async (e) => {
    e.currentTarget.disabled = true;
    const ok = await CG.rewarded();
    if (ok) { S.coins += coins; save(); refreshWallet(); Audio.play('coin'); toast(`+${coins} coins!`); e.target.closest('.btn').innerHTML = `${icon('check')} Doubled`; }
    else { toast('Ad not available right now'); e.target.closest('.btn').disabled = false; }
  };
  // midgame ads only at the level-to-level break (Next), never on navigation buttons (Map / Teahouse)
  card.querySelector('#w-map').onclick = () => { closeModal(); openMap(chapterOf(Math.min(n + 1, NUM_LEVELS))); };
  const nx = card.querySelector('#w-next'); if (nx) nx.onclick = async () => { closeModal(); if (n >= 3) await CG.midgame(); startLevel(n + 1); };
  const wh = card.querySelector('#w-house'); if (wh) wh.onclick = () => { closeModal(); openHouse(Math.min(chapterOf(n), AREAS.length - 1)); };
}

function onStuck() {
  if (!G || G.done) return;
  if (G.mode === 'endless') {
    G.timeLeft = Math.max(1, G.timeLeft - 5);
    toast('No moves — free shuffle (−5s)');
    board.shuffle(Math.random);
    return;
  }
  G.paused = true; board.paused = true; board.cancelInput(); CG.gameplayStop();
  Audio.play('lose');
  const card = modal(`${mascot(2)}
    <h2>No moves left!</h2>
    <p>No pair can be matched and no slide lines one up.</p>
    <div class="col">
      <button class="btn primary" id="st-shuffle">${icon('shuffle')} Shuffle ${S.boosters.shuffle > 0 ? `(${S.boosters.shuffle} left)` : `· ${PRICES.shuffle} coins`}</button>
      ${board.canUndo() ? `<button class="btn" id="st-undo">${icon('undo')} Undo last move</button>` : ''}
      ${CG.rewardedAvailable() ? `<button class="btn gold" id="st-ad">${icon('film')} Watch ad: free shuffle</button>` : ''}
      <button class="btn red" id="st-quit">Give up</button>
    </div>`);
  const resume = () => { closeModal(); G.paused = false; board.paused = false; CG.gameplayStart(); };
  card.querySelector('#st-shuffle').onclick = () => {
    if (S.boosters.shuffle > 0) S.boosters.shuffle--;
    else if (S.coins >= PRICES.shuffle) S.coins -= PRICES.shuffle;
    else return toast('Not enough coins');
    G.used++; save(); refreshWallet(); resume(); board.shuffle(Math.random);
  };
  const u = card.querySelector('#st-undo'); if (u) u.onclick = () => { useUndo(true); resume(); };
  const stAd = card.querySelector('#st-ad');
  if (stAd) stAd.onclick = async () => {
    const ok = await CG.rewarded();
    if (ok) { G.used++; resume(); board.shuffle(Math.random); } else toast('Ad not available right now');
  };
  card.querySelector('#st-quit').onclick = () => { closeModal(); levelFailed(); };
}

function levelFailed() {
  G.done = true; CG.gameplayStop();
  const n = G.level, mode = G.mode;
  const card = modal(`${mascot(2)}
    <h2>Out of moves</h2>
    <p>The tea went cold this time. Plan your slides a little further ahead!</p>
    <div class="btns">
      <button class="btn" id="f-map">${icon('map')} ${mode === 'daily' ? 'Home' : 'Map'}</button>
      <button class="btn primary big" id="f-retry">${icon('restart')} Retry</button>
    </div>`);
  card.querySelector('#f-retry').onclick = async () => { closeModal(); await CG.midgame(); mode === 'daily' ? startDaily() : startLevel(n); };
  card.querySelector('#f-map').onclick = () => { closeModal(); mode === 'daily' ? openTitle() : openMap(chapterOf(n)); };
}

// ---------------- boosters ----------------
function booster(kind) {
  if (!G || G.done || G.paused || modalOpen() || board.busy()) return;
  if (kind === 'undo') {
    if (G.mode === 'endless') { toast('Undo is off in Endless — keep moving!'); return; }
    return useUndo(false);
  }
  if (S.boosters[kind] <= 0) return buyBooster(kind);
  if (kind === 'hint') {
    const m = board.findHint();
    if (!m) { toast('No moves left — try Shuffle'); return; }
    if (board.lastHintDead) {
      // don't charge for a hint that can't help: the position can no longer be cleared
      toast(board.canUndo() ? 'This layout can\u2019t be cleared any more — Undo or Shuffle!' : 'This layout can\u2019t be cleared any more — try Shuffle!', 2600);
      Audio.play('deny');
      return;
    }
    S.boosters.hint--; G.used++;
    board.showHint(m);
  } else if (kind === 'shuffle') {
    S.boosters.shuffle--; G.used++;
    board.shuffle(Math.random);
  }
  save(); refreshWallet();
}
function useUndo(free) {
  if (!board.canUndo()) { toast('Nothing to undo'); return; }
  if (!free) {
    if (S.boosters.undo <= 0) return buyBooster('undo');
    S.boosters.undo--;
  }
  board.undo(); save(); refreshWallet();
}
function buyBooster(kind) {
  const names = { hint: 'Hint', shuffle: 'Shuffle', undo: 'Undo' };
  const desc = { hint: 'Shows a good move — including slides.', shuffle: 'Rearranges the tiles into a solvable layout.', undo: 'Takes back your last move.' };
  const wasPaused = G && G.paused;
  if (G) { G.paused = true; board.paused = true; }
  const card = modal(`
    <h2>Out of ${names[kind]}s</h2>
    <p>${desc[kind]}</p>
    <div class="col">
      <button class="btn primary" id="bb-coins">Buy 3 for ${PRICES[kind] * 2} coins</button>
      ${CG.rewardedAvailable() ? `<button class="btn gold" id="bb-ad">${icon('film')} Watch ad: +2 ${names[kind]}s</button>` : ''}
      <button class="btn" id="bb-close">Not now</button>
    </div>
    <p class="sub">You have ${S.coins} coins.</p>`, () => { if (G) { G.paused = wasPaused; board.paused = wasPaused; } });
  card.querySelector('#bb-coins').onclick = () => {
    if (S.coins < PRICES[kind] * 2) return toast('Not enough coins — clear levels to earn more');
    S.coins -= PRICES[kind] * 2; S.boosters[kind] += 3; save(); refreshWallet(); Audio.play('coin'); closeModal();
  };
  const bbAd = card.querySelector('#bb-ad');
  if (bbAd) bbAd.onclick = async () => {
    const ok = await CG.rewarded();
    if (ok) { S.boosters[kind] += 2; save(); refreshWallet(); Audio.play('coin'); closeModal(); toast(`+2 ${names[kind]}s`); }
    else toast('Ad not available right now');
  };
  card.querySelector('#bb-close').onclick = closeModal;
}

// ---------------- pause / settings ----------------
function pauseGame(fromFocus = false) {
  if (!G || G.done || modalOpen()) return;
  G.paused = true; board.paused = true; board.cancelInput();
  if (!fromFocus) CG.gameplayStop(); // CrazyGames: don't send gameplayStop for focus/visibility changes
  const card = modal(`
    <h2>Paused</h2>
    ${settingsHtml()}
    <div class="col">
      <button class="btn primary big" id="p-resume">${icon('play')} Resume</button>
      <div class="btns" style="margin-top:0">
        <button class="btn" id="p-restart">${icon('restart')} Restart</button>
        <button class="btn" id="p-help">How to play</button>
        <button class="btn" id="p-quit">${icon('back')} Quit</button>
      </div>
    </div>`, () => { if (G && !G.done) { G.paused = false; board.paused = false; CG.gameplayStart(); } });
  bindSettings(card);
  card.querySelector('#p-resume').onclick = closeModal;
  card.querySelector('#p-restart').onclick = () => { modalClose = null; closeModal(); restartSession(); };
  card.querySelector('#p-help').onclick = () => { modalClose = null; howTo(() => { G.paused = false; board.paused = false; CG.gameplayStart(); }); };
  card.querySelector('#p-quit').onclick = () => { modalClose = null; closeModal(); quitSession(); };
}
function restartSession() {
  if (!G) return;
  const m = G.mode;
  if (m === 'level') startLevel(G.level); else if (m === 'daily') startDaily(); else startEndless();
}
function quitSession() {
  const m = G && G.mode, n = G && G.level;
  G = null; board.stop(); CG.gameplayStop(); hideTutorial();
  if (m === 'level') openMap(chapterOf(n)); else openTitle();
}
function settingsHtml() {
  const row = (k, ic, label, sub) => `<div class="toggle"><div class="tl">${icon(ic)}<div>${label}${sub ? `<small>${sub}</small>` : ''}</div></div><button class="switch ${S.settings[k] ? 'on' : ''}" data-set="${k}" aria-label="${label}"></button></div>`;
  return `<div style="margin:.4em 0 .6em">${row('music', 'music', 'Music')}${row('sfx', 'sfx', 'Sound effects')}${row('hc', 'eye', 'High-contrast tiles', 'Coloured suits + big corner numbers')}</div>`;
}
function bindSettings(card) {
  card.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => {
    const k = b.dataset.set; S.settings[k] = !S.settings[k]; b.classList.toggle('on', S.settings[k]);
    applySettings(); save(); Audio.play('click');
  });
}
function applySettings() {
  Audio.setMusic(S.settings.music); Audio.setSfx(S.settings.sfx); setSkin(S.skin);
  if (board.hc !== S.settings.hc) { board.hc = S.settings.hc; }
}
function openSettings() {
  const card = modal(`<h2>Settings</h2>${settingsHtml()}
    <div class="col"><button class="btn gold" id="s-skins">Tile backs</button><button class="btn" id="s-help">How to play</button><button class="btn red" id="s-reset">Reset progress</button><button class="btn primary" id="s-close">Done</button></div>`);
  bindSettings(card);
  card.querySelector('#s-close').onclick = closeModal;
  card.querySelector('#s-help').onclick = () => howTo();
  card.querySelector('#s-skins').onclick = () => openSkins(openSettings);
  card.querySelector('#s-reset').onclick = () => {
    const c2 = modal(`<h2>Reset progress?</h2><p>All stars, coins and teahouse restorations will be lost.</p><div class="btns"><button class="btn" id="r-no">Cancel</button><button class="btn red" id="r-yes">Reset</button></div>`);
    c2.querySelector('#r-no').onclick = closeModal;
    c2.querySelector('#r-yes').onclick = () => { const st = S.settings; S = DEFAULT_SAVE(); S.settings = st; applySettings(); save(); closeModal(); openTitle(); toast('Progress reset'); };
  };
}
function openSkins(back) {
  const card = modal(`<h2>Tile backs</h2><p>Give your tiles a new look. Coins: <b id="sk-coins">${S.coins}</b></p><div class="skins"></div>
    <div class="btns"><button class="btn primary" id="sk-done">Done</button></div>`);
  const box = card.querySelector('.skins');
  const draw = () => {
    box.innerHTML = '';
    for (const [k, v] of Object.entries(SKINS)) {
      const own = S.skins.includes(k), on = S.skin === k;
      const d = document.createElement('div'); d.className = 'skin' + (on ? ' on' : '');
      d.appendChild(skinPreview(k));
      d.insertAdjacentHTML('beforeend', `<b>${v.name}</b>`);
      const b = document.createElement('button');
      b.className = 'btn ' + (on ? '' : own ? 'primary' : 'gold');
      b.innerHTML = on ? `${icon('check')} In use` : own ? 'Use' : `${v.price} coins`;
      b.disabled = on;
      b.onclick = () => {
        if (!own) {
          if (S.coins < v.price) { Audio.play('deny'); return toast('Not enough coins — clear levels and dailies to earn more'); }
          S.coins -= v.price; S.skins.push(k); Audio.play('coin');
        } else Audio.play('click');
        S.skin = k; setSkin(k); save(); refreshWallet(); card.querySelector('#sk-coins').textContent = S.coins; draw();
      };
      d.appendChild(b); box.appendChild(d);
    }
  };
  draw();
  card.querySelector('#sk-done').onclick = () => { closeModal(); back && back(); };
}
function howTo(after) {
  const card = modal(`<h2>How to play</h2>
    <div class="howto">
      <div><b class="n">1</b><span><b>Match pairs.</b> Click a tile, then its identical twin. They must be in the same row or column with only empty space between them.</span></div>
      <div><b class="n">2</b><span><b>Slide tiles.</b> Drag a tile up, down, left or right. Every tile in front of it moves too, into the empty space.</span></div>
      <div><b class="n">3</b><span>A slide only counts if the dragged tile ends up lined up with its twin — then both clear. Otherwise the tiles slide back.</span></div>
      <div><b class="n">4</b><span>Mossy stones never move. Clear every tile to win. Fast clears and no boosters earn 3 stars.</span></div>
      <div><b class="n">★</b><span>Spend stars to restore the teahouse and unlock new chapters.</span></div>
    </div>
    <p class="sub">Keys: H hint · Z undo · S shuffle · P pause</p>
    <div class="btns"><button class="btn primary" id="h-ok">Got it</button></div>`, after);
  card.querySelector('#h-ok').onclick = closeModal;
}

// ---------------- tutorial ----------------
function startTutorial(kind) {
  tut.kind = kind; tut.step = 0;
  $('#tutorial').classList.remove('hidden');
  setTimeout(tutPoint, 250);
}
function hideTutorial() { $('#tutorial').classList.add('hidden'); tut.kind = null; cancelAnimationFrame(tut.raf); }
function tutBubble(txt) { $('#tut-bubble').innerHTML = `${mascot(0, 'tut')}<div>${txt}</div>`; }
function tutPoint() {
  if (!tut.kind || !G) return;
  cancelAnimationFrame(tut.raf);
  const cells = board.cells();
  const hand = $('#hand');
  const c = (i) => { const x = i % board.w, y = (i / board.w) | 0; return { x: board.sx(x, y) + board.cw * 0.55, y: board.sy(x, y) + board.ch * 0.55 }; };
  if (tut.kind === 'match') {
    const m = L.directMatches(cells, board.w, board.h)[0];
    if (!m) return;
    tutBubble(tut.step === 0
      ? 'Tap a tile, then tap its <b>identical twin</b>.<br>They must share a row or column with nothing in between.'
      : 'Nice! Keep matching until the board is clear.');
    hand.style.display = '';
    const p1 = c(m.a), p2 = c(m.b);
    const t0 = performance.now();
    const anim = (now) => {
      const sel = board.sel != null;
      const t = ((now - t0) / 1000) % 1.4;
      const p = sel ? p2 : p1;
      hand.style.left = p.x + 'px'; hand.style.top = p.y + 'px';
      hand.style.transform = `translate(-30%, -8%) scale(${t < 0.2 ? 0.85 : 1})`;
      tut.raf = requestAnimationFrame(anim);
    };
    tut.raf = requestAnimationFrame(anim);
  } else {
    const m = L.pushMoves(cells, board.w, board.h)[0];
    if (!m) { hand.style.display = 'none'; return; }
    tutBubble(tut.step === 0
      ? '<b>Drag</b> this tile to slide it.<br>When it lines up with its twin, both clear!'
      : 'One more slide! Tiles in front of the dragged one get pushed along too.');
    hand.style.display = '';
    const p1 = c(m.from), p2 = c(m.to);
    const t0 = performance.now();
    const anim = (now) => {
      const t = ((now - t0) / 1000) % 1.8;
      const k = t < 0.3 ? 0 : t < 1.2 ? (t - 0.3) / 0.9 : 1;
      const e = k * k * (3 - 2 * k);
      hand.style.left = p1.x + (p2.x - p1.x) * e + 'px'; hand.style.top = p1.y + (p2.y - p1.y) * e + 'px';
      hand.style.opacity = t > 1.5 ? String(1 - (t - 1.5) / 0.3) : '1';
      tut.raf = requestAnimationFrame(anim);
    };
    tut.raf = requestAnimationFrame(anim);
  }
}
function tutAfterMove() {
  tut.step++;
  if (board.remaining() === 0 || (tut.kind === 'match' && tut.step >= 2)) {
    $('#hand').style.display = 'none'; cancelAnimationFrame(tut.raf);
    if (board.remaining() > 0) tutBubble('Great! Clear the last pair yourself.');
    return;
  }
  setTimeout(tutPoint, 250);
}

const TIPS = {
  3: 'Tip: dragging a tile pushes every tile in front of it along.',
  4: 'Golden pair! Match the shimmering gold tiles for bonus coins. Fast matches fill the Tea Rush meter.',
  6: 'Stuck? Hint, Undo and Shuffle are below the board.',
  13: 'New: mossy stones never move and block lines.',
  25: 'New tiles: flowers! Corner letters help tell them apart.',
  27: 'New: red cords! Tied tiles can be matched but never slide \u2014 and they block any chain they are in.',
  37: 'New tiles: characters. The small number in the corner shows the value.',
  61: 'Expert chapters: more stones and more tile types. Plan two slides ahead!',
};
function showLevelTip(n) {
  const el = $('#g-tip');
  const t = TIPS[n];
  if (!t) { el.classList.add('hidden'); return; }
  el.textContent = t; el.classList.remove('hidden');
  clearTimeout(el._t);
}

// ---------------- daily ----------------
function todayStr(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function genBoard(P, seed, maxTries = 60) {
  const all = [...Array(38).keys()];
  for (let k = 0; k < maxTries; k++) {
    const rnd = L.mulberry32(seed + k * 7919);
    const pool = L.shuffleArr(all.slice(), rnd).slice(0, P.types);
    const b = L.generateBoard({ ...P, typePool: pool }, seed + k * 104729);
    if (!L.hasMove(b.cells, b.w, b.h)) continue;
    if (L.solve(b.cells, b.w, b.h, 20000, 40).solution) return b;
  }
  // fallback: progressively easier boards until the solver proves one (always terminates quickly)
  for (let k = 0; k < 200; k++) {
    const b = L.generateBoard({ ...P, pairs: Math.max(4, P.pairs - 1 - (k >> 2)), types: Math.max(3, P.types - 2), stones: 0 }, seed + 999 + k);
    if (L.hasMove(b.cells, b.w, b.h) && L.solve(b.cells, b.w, b.h, 20000).solution) return b;
  }
  return L.decode('a.a./b..b/cc..');
}
function openDaily() {
  const done = S.daily.last === todayStr();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const streak = S.daily.last === todayStr() || S.daily.last === todayStr(y) ? S.daily.streak : 0;
  const card = modal(`<h2>Daily Puzzle</h2>
    <p>A fresh hand-picked board every day. Keep your streak going!</p>
    <div class="big-num">${streak} day${streak === 1 ? '' : 's'}</div><p class="sub">current streak · best ${S.daily.best}</p>
    ${done ? `<p>${icon('check')} Today's puzzle is complete. Come back tomorrow!</p>` : '<p>Reward: <b>50 coins + 2 stars</b></p>'}
    <div class="btns"><button class="btn" id="d-close">Close</button><button class="btn primary big" id="d-play">${icon('play')} ${done ? 'Replay' : 'Play'}</button></div>`);
  card.querySelector('#d-close').onclick = closeModal;
  card.querySelector('#d-play').onclick = () => { closeModal(); startDaily(); };
}
function startDaily() {
  const day = todayStr();
  const b = genBoard({ w: 8, h: 7, pairs: 18, types: 10, stones: 3, tied: 2 }, L.hashString('daily:' + day));
  b.gold = pickGold(b.cells, L.hashString('gold:' + day));
  G = { mode: 'daily', t: 0, used: 0, paused: false, par: parFor(18, 0.5), pairs: 18, done: false, day };
  $('#g-label').textContent = 'Daily';
  $('#g-target').textContent = day;
  $('#g-tip').classList.add('hidden');
  beginBoard(b, 2);
}
function dailyWin() {
  const first = S.daily.last !== G.day;
  let msg = 'Replay complete — rewards are once per day.';
  if (first) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    S.daily.streak = S.daily.last === todayStr(y) ? S.daily.streak + 1 : 1;
    S.daily.best = Math.max(S.daily.best, S.daily.streak);
    S.daily.last = G.day;
    S.coins += 50; S.bank += 2;
    msg = `Streak: <b>${S.daily.streak} day${S.daily.streak > 1 ? 's' : ''}</b>`;
    CG.happytime();
  }
  save(); refreshWallet(); checkAch();
  const card = modal(`${mascot(1)}<h2>Daily cleared!</h2><p>Time ${fmt(G.t)}</p>
    ${first ? `<div class="rewards"><div class="pill coin"><b>+50</b></div><div class="pill star"><b>+2</b></div></div>` : ''}
    <p>${msg}</p><div class="btns"><button class="btn primary big" id="dw-ok">Continue</button></div>`);
  card.querySelector('#dw-ok').onclick = () => { closeModal(); G = null; board.stop(); openTitle(); };
}

// ---------------- endless ----------------
const ENDLESS_SIZES = [[5, 6, 9, 5, 0, 0], [6, 6, 11, 6, 1, 0], [7, 6, 13, 7, 1, 1], [7, 7, 15, 8, 2, 1], [8, 7, 18, 9, 2, 2], [8, 8, 21, 10, 3, 2]];
function endlessBoard() {
  const P = ENDLESS_SIZES[Math.min(G.boards, ENDLESS_SIZES.length - 1)];
  const b = genBoard({ w: P[0], h: P[1], pairs: P[2], types: P[3], stones: P[4], tied: P[5] }, (Math.random() * 1e9) | 0, 30);
  b.gold = pickGold(b.cells, (Math.random() * 1e9) | 0);
  return b;
}
function startEndless() {
  G = { mode: 'endless', t: 0, used: 0, paused: false, done: false, score: 0, timeLeft: 75, boards: 0, reserve: false };
  $('#g-label').textContent = 'Endless';
  $('#g-tip').classList.add('hidden');
  toast('Clear boards before time runs out — fast matches build combos!', 3500);
  beginBoard(endlessBoard(), 2);
  updateEndlessHud();
}
function updateEndlessHud() {
  $('#g-time').textContent = fmt(Math.max(0, G.timeLeft));
  $('#g-target').textContent = `Score ${G.score} · Board ${G.boards + 1}`;
  $('#g-time').style.color = G.timeLeft < 10 ? '#c9402e' : '';
}
function endlessBoardCleared() {
  G.boards++;
  const bonus = 100 + G.boards * 20;
  G.score += bonus; G.timeLeft += 15;
  toast(`Board clear! +${bonus} · +15s`);
  Audio.play('win');
  updateEndlessHud();
  setTimeout(() => { if (G && G.mode === 'endless' && !G.done) { const rt = G.rushT; board.start(endlessBoard(), board.cb); board.rush = rt > 0; } }, 700);
}
function endlessOver() {
  G.done = true; CG.gameplayStop(); board.over = true;
  Audio.play('lose');
  const best = G.score > S.endlessBest;
  S.endlessBest = Math.max(S.endlessBest, G.score);
  const coins = Math.floor(G.score / 25);
  S.coins += coins; save(); refreshWallet(); checkAch();
  if (G.rushT > 0) endRush();
  const card = modal(`<h2>Time's up!</h2><div class="big-num">${G.score}</div>
    <p>${best ? '<b>New best score!</b>' : `Best: ${S.endlessBest}`} · ${G.boards} board${G.boards === 1 ? '' : 's'} cleared</p>
    <div class="rewards"><div class="pill coin"><b>+${coins}</b></div></div>
    <div class="btns"><button class="btn" id="e-home">${icon('back')} Home</button><button class="btn primary big" id="e-again">${icon('restart')} Again</button></div>`);
  card.querySelector('#e-again').onclick = async () => { closeModal(); await CG.midgame(); startEndless(); };
  card.querySelector('#e-home').onclick = () => { closeModal(); G = null; board.stop(); openTitle(); };
}

// ---------------- title ----------------
function openTitle() {
  G = null; board.stop(); hideTutorial(); CG.gameplayStop();
  show('s-title'); setBg('keyart');
  const n = nextLevel();
  $('#title-lvl').textContent = S.played || cleared(1) ? `· Level ${n}` : '';
  refreshGift();
  $('#title-streak').textContent = S.daily.streak && S.daily.last >= todayStr(new Date(Date.now() - 864e5)) ? `· ${S.daily.streak} day${S.daily.streak > 1 ? 's' : ''}` : '';
}

// ---------------- map ----------------
let mapCh = 0;
function openMap(c = chapterOf(nextLevel())) {
  G = null; board.stop(); hideTutorial(); CG.gameplayStop();
  mapCh = Math.max(0, Math.min(CHAPTERS - 1, c));
  show('s-map'); setBg('mapbg'); refreshWallet();
  renderMap();
}
function nodePos(i) {
  // snake path: 3 rows x 4
  const row = Math.floor(i / 4), k = i % 4;
  const col = row % 2 === 0 ? k : 3 - k;
  return { x: 14 + col * 24 + (row === 1 ? 2 : 0), y: 18 + row * 31 };
}
function renderMap() {
  const c = mapCh, A = AREAS[c];
  $('#ch-name').textContent = A.chapter;
  const got = [...Array(LEVELS_PER_CHAPTER).keys()].reduce((s, i) => s + (S.stars[c * LEVELS_PER_CHAPTER + i + 1] || 0), 0);
  $('#ch-sub').innerHTML = `${icon('star')} ${got} / ${LEVELS_PER_CHAPTER * 3} · total ${totalStars()}`;
  $('#ch-prev').disabled = c === 0; $('#ch-next').disabled = c >= CHAPTERS - 1;
  const nodes = $('#map-nodes'); nodes.innerHTML = '';
  const svg = $('#map-svg');
  const pts = [...Array(LEVELS_PER_CHAPTER).keys()].map(nodePos);
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (a.y === b.y) d += ` L ${b.x} ${b.y}`;
    else { const dir = a.x > 50 ? 1 : -1; d += ` C ${a.x + dir * 12} ${a.y} ${b.x + dir * 12} ${b.y} ${b.x} ${b.y}`; }
  }
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.innerHTML = `<path d="${d}" fill="none" stroke="rgba(80,45,15,.45)" stroke-width="5.2" stroke-linecap="round" vector-effect="non-scaling-stroke" style="stroke-width:calc(var(--u)*3.2)"/>
    <path d="${d}" fill="none" stroke="#f3dfb2" stroke-width="4" stroke-linecap="round" style="stroke-width:calc(var(--u)*2.4)" vector-effect="non-scaling-stroke"/>
    <path d="${d}" fill="none" stroke="#c9a46a" stroke-width="1" stroke-dasharray="1 2.2" style="stroke-width:calc(var(--u)*.5);stroke-dasharray:calc(var(--u)*.8) calc(var(--u)*1.8)" vector-effect="non-scaling-stroke"/>`;
  const nx = nextLevel();
  for (let i = 0; i < LEVELS_PER_CHAPTER; i++) {
    const n = c * LEVELS_PER_CHAPTER + i + 1;
    if (n > NUM_LEVELS) break;
    const p = pts[i];
    const b = document.createElement('button');
    const un = levelUnlocked(n);
    b.className = 'node' + (un ? '' : ' locked') + (n === nx && un ? ' current' : '');
    b.style.left = p.x + '%'; b.style.top = p.y + '%';
    b.innerHTML = un ? `${n}${cleared(n) ? `<span class="st">${starRow(S.stars[n])}</span>` : ''}` : icon('lock');
    b.title = un ? `Level ${n}` : 'Locked';
    if (un) b.onclick = () => { Audio.play('click'); startLevel(n); };
    nodes.appendChild(b);
  }
  const lock = $('#map-lock');
  if (c > 0 && !chapterUnlocked(c)) {
    lock.classList.remove('hidden');
    $('#lock-txt').innerHTML = cleared(c * LEVELS_PER_CHAPTER)
      ? `<b>Restore the ${AREAS[c - 1].name}</b> in the teahouse to open this chapter.`
      : `Finish <b>${AREAS[c - 1].chapter}</b> and restore the ${AREAS[c - 1].name} to open this chapter.`;
  } else lock.classList.add('hidden');
}

// ---------------- teahouse ----------------
let houseArea = 0, houseBack = 'title';
function openHouse(a) {
  const from = current;
  houseBack = from === 's-map' ? 'map' : 'title';
  G = null; board.stop(); hideTutorial(); CG.gameplayStop();
  if (a == null) { a = 0; for (let c = 0; c < AREAS.length; c++) if (areaUnlocked(c) && !areaDone(c)) { a = c; break; } else if (areaUnlocked(c)) a = c; }
  houseArea = a;
  show('s-house'); refreshWallet();
  renderHouse();
}
function renderHouse(anim = -1) {
  const c = houseArea, A = AREAS[c];
  setBg(A.bg);
  if (amb) amb.set(A.ambient || 'motes');
  $('#area-name').textContent = A.name;
  const done = S.areas[c].filter(Boolean).length;
  $('#area-prog').style.width = (done / 5 * 100) + '%';
  $('#area-prev').disabled = c === 0;
  $('#area-next').disabled = c >= AREAS.length - 1;
  const sc = $('#scene');
  const unlocked = areaUnlocked(c);
  const prog = done / 5;
  const prevProg = anim >= 0 ? (done - 1) / 5 : prog;
  sc.innerHTML = `<div class="base" style="background-image:url(assets/img/bg/${A.before || A.bg}.webp)"></div>` +
    `<div class="base after" style="background-image:url(assets/img/bg/${A.bg}.webp);opacity:${prevProg}"></div>`;
  if (anim >= 0) requestAnimationFrame(() => requestAnimationFrame(() => { const a = sc.querySelector('.after'); if (a) a.style.opacity = prog; }));
  A.tasks.forEach((t, k) => {
    const im = document.createElement('img');
    im.src = `assets/img/items/${t.img}.webp`; im.alt = t.name; im.draggable = false;
    im.className = 'item' + (S.areas[c][k] ? (k === anim ? ' drop' : '') + (t.anim ? ' ' + t.anim : '') + (t.glow ? ' glow' : '') : ' ghost');
    im.style.left = t.x * 100 + '%'; im.style.top = t.y * 100 + '%'; im.style.width = t.w * 100 + '%'; im.style.zIndex = t.z;
    if (!S.areas[c][k]) { im.style.opacity = '0.28'; im.style.filter = 'brightness(0) blur(1px)'; }
    sc.appendChild(im);
  });
  if (!unlocked) sc.insertAdjacentHTML('beforeend', `<div class="done-badge">${icon('lock')} Finish ${AREAS[c - 1].chapter.split('·')[1].trim()} to unlock</div>`);
  else if (done === 5 && anim < 0) sc.insertAdjacentHTML('beforeend', `<div class="done-badge" style="top:12%;font-size:1.05em;padding:.5em 1.4em">${icon('check')} ${A.name} restored</div>`);
  const list = $('#tasks'); list.innerHTML = '';
  A.tasks.forEach((t, k) => {
    const d = document.createElement('div');
    const isDone = S.areas[c][k];
    d.className = 'task' + (isDone ? ' done' : '') + (unlocked ? '' : ' locked');
    d.innerHTML = `<img src="assets/img/items/${t.img}.webp" alt=""><div class="tn">${t.name}<small>${t.desc}</small></div>` +
      (isDone ? `<span class="btn">${icon('check')}</span>` : `<button class="btn ${S.bank >= t.cost && unlocked ? 'primary pulse' : ''}" ${unlocked ? '' : 'disabled'}>${t.cost} ${icon('star')}</button>`);
    const btn = d.querySelector('button');
    if (btn) btn.onclick = () => restoreTask(c, k);
    list.appendChild(d);
  });
  const affordable = unlocked && A.tasks.some((t, k) => !S.areas[c][k] && S.bank >= t.cost);
  $('#s-house [data-act=play]').classList.toggle('pulse', !affordable && levelUnlocked(nextLevel()));
}
function restoreTask(c, k) {
  const t = AREAS[c].tasks[k];
  if (S.bank < t.cost) {
    Audio.play('deny');
    toast(`You need ${t.cost - S.bank} more star${t.cost - S.bank > 1 ? 's' : ''} — earn them by clearing levels`);
    return;
  }
  S.bank -= t.cost; S.areas[c][k] = true; save(); setTimeout(checkAch, 1500);
  Audio.play('build'); bump($('#house-stars').parentElement);
  refreshWallet();
  renderHouse(k);
  sparkleScene(t);
  if (areaDone(c)) {
    S.coins += 100; S.boosters.hint++; S.boosters.shuffle++; save(); refreshWallet();
    CG.happytime();
    setTimeout(() => {
      Audio.play('win'); Audio.play('chime');
      const nextC = c + 1;
      const card = modal(`${mascot(1)}<h2>${AREAS[c].name} restored!</h2>
        <p>The teahouse grows more beautiful. You earned <b>100 coins</b>, <b>+1 Hint</b> and <b>+1 Shuffle</b>.</p>
        ${nextC < AREAS.length ? `<p><b>${AREAS[nextC].chapter}</b> is now open!</p>` : '<p><b>The whole teahouse is restored!</b> Thank you for playing — keep enjoying the Daily Puzzle and Endless mode.</p>'}
        <div class="btns">${nextC < AREAS.length ? `<button class="btn primary big" id="ad-go">${icon('play')} Play chapter ${nextC + 1}</button>` : '<button class="btn primary" id="ad-ok">Wonderful</button>'}</div>`);
      const go = card.querySelector('#ad-go'); if (go) go.onclick = () => { closeModal(); openMap(nextC); };
      const ok = card.querySelector('#ad-ok'); if (ok) ok.onclick = closeModal;
    }, 1300);
  }
}
function sparkleScene(t) {
  const sc = $('#scene');
  for (let i = 0; i < 16; i++) {
    const s = document.createElement('div');
    const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 60;
    s.style.cssText = `position:absolute;left:${t.x * 100}%;top:${(t.y - 0.1) * 100}%;width:10px;height:10px;border-radius:50%;background:radial-gradient(#fff,#ffd23a 60%,transparent 70%);z-index:20;pointer-events:none;transition:transform .9s cubic-bezier(.2,.8,.3,1),opacity .9s;transition-delay:.35s`;
    sc.appendChild(s);
    requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = `translate(${Math.cos(a) * r * 2}px,${Math.sin(a) * r - 40}px) scale(${0.5 + Math.random()})`; s.style.opacity = '0'; }));
    setTimeout(() => s.remove(), 1500);
  }
}

// ---------------- main loop (timers) ----------------
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (G && !G.paused && !G.done && !G.adPaused && current === 's-game' && document.visibilityState === 'visible') {
    const rushing = G.rushT > 0;
    if (rushing) {
      G.rushT -= dt;
      $('#g-rush').style.width = Math.max(0, G.rushT / RUSH_SECS * 100) + '%';
      if (G.rushT <= 0) endRush();
    } else if (G.rush > 0) {
      G.rush = Math.max(0, G.rush - 5 * dt);
      $('#g-rush').style.width = G.rush + '%';
    }
    if (!rushing) G.t += dt; // Tea Rush freezes the clock
    if (G.mode === 'endless') {
      if (!rushing) G.timeLeft -= dt;
      if (Math.floor(G.timeLeft * 10) % 2 === 0) updateEndlessHud();
      if (G.timeLeft <= 0) { G.timeLeft = 0; updateEndlessHud(); endlessOver(); }
    } else {
      $('#g-time').textContent = fmt(G.t);
      $('#g-time').style.color = G.t > G.par ? '#a0522d' : '';
    }
  }
  requestAnimationFrame(tick);
}

// ---------------- events ----------------
function bindUi() {
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    Audio.unlock();
    const a = b.dataset.act;
    if (a !== 'hint' && a !== 'undo' && a !== 'shuffle') Audio.play('click');
    if (a === 'play') {
      const n = nextLevel();
      if (!cleared(1) || (current === 's-house' && levelUnlocked(n) && !cleared(n))) startLevel(n); else openMap(chapterOf(n));
    }
    else if (a === 'home') openTitle();
    else if (a === 'back') houseBack === 'map' ? openMap(houseArea) : openTitle();
    else if (a === 'teahouse') {
      let c = null;
      if (current === 's-map') { c = Math.min(mapCh, AREAS.length - 1); while (c > 0 && !areaUnlocked(c)) c--; }
      openHouse(c);
    }
    else if (a === 'settings') openSettings();
    else if (a === 'trophies') openTrophies();
    else if (a === 'gift') openGift();
    else if (a === 'daily') openDaily();
    else if (a === 'endless') startEndless();
    else if (a === 'pause') pauseGame();
    else if (a === 'hint' || a === 'shuffle' || a === 'undo') booster(a);
  });
  $('#ch-prev').onclick = () => { if (mapCh > 0) { mapCh--; renderMap(); Audio.play('click'); } };
  $('#ch-next').onclick = () => { if (mapCh < CHAPTERS - 1) { mapCh++; renderMap(); Audio.play('click'); } };
  $('#area-prev').onclick = () => { if (houseArea > 0) { houseArea--; renderHouse(); Audio.play('click'); } };
  $('#area-next').onclick = () => { if (houseArea < AREAS.length - 1) { houseArea++; renderHouse(); Audio.play('click'); } };
  $('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal' && $('#modal-card').querySelector('#p-resume')) closeModal(); });
  window.addEventListener('keydown', (e) => {
    if (current !== 's-game') return;
    if (e.key === 'p' || e.key === 'P') { if (modalOpen() && $('#modal-card').querySelector('#p-resume')) closeModal(); else pauseGame(); return; }
    if (modalOpen()) return;
    const k = e.key.toLowerCase();
    if (k === 'h') booster('hint'); else if (k === 'z') booster('undo'); else if (k === 's') booster('shuffle');
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && G && !G.done && current === 's-game') pauseGame(true); });
  // iOS only resumes an AudioContext inside click/touchend handlers
  for (const ev of ['pointerdown', 'touchend', 'click']) window.addEventListener(ev, () => Audio.unlock(), { passive: true });
  window.addEventListener('resize', () => { if (tut.kind) setTimeout(tutPoint, 50); });
}

// ---------------- boot ----------------
function preload(srcs, onProgress) {
  let done = 0;
  return Promise.all(srcs.map((s) => new Promise((res) => {
    const im = new Image(); im.onload = im.onerror = () => { done++; onProgress(done / srcs.length); res(); }; im.src = s;
  })));
}
async function boot() {
  const fill = $('#load-fill');
  await CG.init({
    pause: () => { Audio.adPause(true); if (G) G.adPaused = true; if (board) { board.paused = true; board.cancelInput(); } },
    resume: () => { Audio.adPause(false); if (G) { G.adPaused = false; if (!G.paused) board.paused = false; } },
    muteChange: (m) => Audio.setSdkMute(m),
  });
  CG.loadingStart();
  Audio.setSdkMute(CG.sdkMuted());
  await loadSave();
  const imgs = ['keyart', 'tablebg', 'mapbg'].map((n) => `assets/img/bg/${n}.webp`);
  await Promise.all([
    preload(imgs.concat(['assets/img/glyphs.png']), (p) => { fill.style.width = (p * 80) + '%'; }),
    loadGlyphs('assets/img/glyphs.png'),
  ]);
  fill.style.width = '100%';
  board = new BoardView($('#board'), $('#fx'));
  amb = new Ambient($('#amb'));
  board.insets = insets;
  applySettings();
  bindUi();
  refreshWallet();
  requestAnimationFrame(tick);
  CG.loadingStop();
  Audio.loadMusic(['assets/audio/music2.mp3', 'assets/audio/music.mp3']);
  Audio.loadSamples({ pour: 'assets/audio/sfx/pour.mp3', chime: 'assets/audio/sfx/chime.mp3' });
  // lazy-load the teahouse art in the background
  setTimeout(() => preload(AREAS.flatMap((a) => [`assets/img/bg/${a.bg}.webp`, ...a.tasks.map((t) => `assets/img/items/${t.img}.webp`)]), () => {}), 1500);
  if (!cleared(1) && !S.played) startLevel(1); else openTitle();
  $('#loading').classList.remove('show');
}

// test hooks (used by Playwright tests)
window.__tts = {
  get state() { return { screen: current, G, S, board: board && { w: board.w, h: board.h, cells: board.cells(), T: board.T, remaining: board.remaining() } }; },
  board: () => board, startLevel, startDaily, startEndless, openMap, openHouse, openTitle, L,
  setSave(obj) { S = Object.assign(DEFAULT_SAVE(), obj); save(); },
};

boot();
