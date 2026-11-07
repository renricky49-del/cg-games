// Persistent player profile (CrazyGames data module with localStorage fallback)
import { CG } from './cg.js';
import { HEROES, RIVALS, MAPS, ITEMS, ITEM_BY_ID, ITEM_PRICES, SHOP_RARITY_WEIGHTS, RARITIES, WEAPON_BASES, WEAPON_ADJ, DAILY_BUFFS, xpForLevel, QUESTS, QUEST_BY_ID, QUEST_ALL_BONUS, STARTER_QUESTS, STREAK_REWARDS } from './data.js';
import { RNG, hashStr, todayKey } from './rng.js';

const KEY = 'letterlegion_save_v1';

export function defaultProfile() {
  return {
    v: 1, coins: 150, xp: 0, level: 1, ladder: 0, beaten: {}, tutorialDone: false,
    weapons: [], equipped: {}, nextUid: 1,
    shop: null, loadout: { active: [], passive: [] },
    settings: { music: true, sfx: true, fast: false },
    bests: {}, daily: { date: '', best: 0, wins: 0, played: 0, history: [] },
    stats: { matches: 0, wins: 0, heroes: 0, kills: 0 },
    seenHeroes: {},
    quests: { date: '', list: [], bonus: false },
    tips: {},
    streak: { day: 0, last: '', claimed: '' },
    lossStreak: {}, // ladder rival id → consecutive losses (for the Rally bonus)
  };
}
export let P = defaultProfile();

export function loadProfile() {
  try {
    const raw = CG.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw); const def = defaultProfile();
      P = Object.assign(def, d);
      for (const k of ['settings', 'daily', 'stats', 'loadout', 'quests', 'streak']) P[k] = Object.assign(defaultProfile()[k], d[k] && typeof d[k] === 'object' ? d[k] : {});
      sanitize();
    }
  } catch (e) { console.warn('save load failed', e); P = defaultProfile(); }
  rolloverDaily();
  if (!P.shop) refreshShop(false);
  return P;
}
// drop anything an older/corrupted save references that no longer exists
function sanitize() {
  const okItem = it => it && ITEM_BY_ID[it.id] && Number.isInteger(it.r) && it.r >= 0 && it.r < RARITIES.length;
  P.loadout.active = (Array.isArray(P.loadout.active) ? P.loadout.active : []).filter(it => okItem(it) && ITEM_BY_ID[it.id].type === 'active').slice(0, 2);
  P.loadout.passive = (Array.isArray(P.loadout.passive) ? P.loadout.passive : []).filter(it => okItem(it) && ITEM_BY_ID[it.id].type === 'passive').slice(0, 3);
  if (!P.shop || !Array.isArray(P.shop.offers) || !P.shop.offers.every(okItem)) P.shop = null;
  P.weapons = (Array.isArray(P.weapons) ? P.weapons : []).filter(w => w && WEAPON_BASES[w.hero] && RARITIES.some(r => r.id === w.rarity));
  for (const [h, uid] of Object.entries(P.equipped || {})) if (!P.weapons.some(w => w.uid === uid && w.hero === h)) delete P.equipped[h];
  P.nextUid = Math.max(P.nextUid || 1, ...P.weapons.map(w => w.uid + 1));
  for (const k of ['coins', 'xp', 'level', 'ladder']) if (!Number.isFinite(P[k]) || P[k] < 0) P[k] = defaultProfile()[k];
  P.level = Math.max(1, Math.floor(P.level)); P.ladder = Math.min(Math.floor(P.ladder), RIVALS.length);
  if (!Array.isArray(P.daily.history)) P.daily.history = [];
  if (!P.tips || typeof P.tips !== 'object' || Array.isArray(P.tips)) P.tips = {};
  const st = P.streak; st.day = Number.isInteger(st.day) ? Math.max(0, Math.min(7, st.day)) : 0;
  for (const k of ['last', 'claimed']) if (typeof st[k] !== 'string') st[k] = '';
  if (!P.lossStreak || typeof P.lossStreak !== 'object' || Array.isArray(P.lossStreak)) P.lossStreak = {};
  for (const [k, v] of Object.entries(P.lossStreak)) if (!RIVALS.some(r => r.id === k) || !Number.isFinite(v) || v < 0) delete P.lossStreak[k];
  P.quests.list = (Array.isArray(P.quests.list) ? P.quests.list : []).filter(q => q && QUEST_BY_ID[q.id])
    .map(q => ({ id: q.id, prog: Number.isFinite(q.prog) ? Math.max(0, Math.min(q.prog, QUEST_BY_ID[q.id].goal)) : 0, claimed: !!q.claimed }));
  if (P.quests.list.length !== 3) P.quests.date = ''; // regenerate
}
let saveTimer = null;
export function saveProfile(now = false) {
  const doSave = () => { try { CG.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } };
  if (now) { clearTimeout(saveTimer); doSave(); return; }
  clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 300);
}
export function resetProfile() { P = defaultProfile(); refreshShop(false); saveProfile(true); }

// ---------- progression ----------
export function unlockedHeroIds(lvl = P.level) { return HEROES.filter(h => h.unlock <= lvl).map(h => h.id); }
export function addXp(n) {
  P.xp += n; const ups = [];
  while (P.xp >= xpForLevel(P.level)) { P.xp -= xpForLevel(P.level); P.level++; ups.push(P.level); }
  return ups;
}
export function mapUnlocked(mapId) {
  // a map unlocks when you reach the first rival that plays on it
  const idx = RIVALS.findIndex(r => r.map === mapId);
  return idx <= P.ladder;
}

// ---------- daily ----------
export function dailyInfo(date = new Date()) {
  const key = todayKey(date);
  const seed = hashStr('letter-legion-' + key);
  const rng = new RNG(seed);
  const map = MAPS[rng.int(MAPS.length)];
  const buff = DAILY_BUFFS[rng.int(DAILY_BUFFS.length)];
  const rival = RIVALS[Math.min(RIVALS.length - 1, 1 + rng.int(4))];
  return { key, seed, map, buff, rival };
}
export function rolloverDaily() {
  const k = todayKey();
  if (P.daily.date !== k) {
    if (P.daily.date && P.daily.played) {
      P.daily.history.unshift({ date: P.daily.date, score: P.daily.best, wins: P.daily.wins });
      P.daily.history = P.daily.history.slice(0, 14);
    }
    P.daily.date = k; P.daily.best = 0; P.daily.wins = 0; P.daily.played = 0;
  }
  if (P.quests.date !== k) {
    // three different quests a day (the same three for everyone on that date)
    const rng = new RNG(hashStr('letter-legion-quests-' + k)); const pool = QUESTS.filter(q => !q.starter); let list = [];
    if (!P.quests.date && !P.stats.matches) list = STARTER_QUESTS.map(id => ({ id, prog: 0, claimed: false })); // brand-new player
    while (list.length < 3) list.push({ id: pool.splice(rng.int(pool.length), 1)[0].id, prog: 0, claimed: false });
    P.quests = { date: k, list, bonus: false };
  }
}
// ---------- daily quests ----------
// add one match's progress; returns the ids of quests that just became complete
export function questProgress(res) {
  rolloverDaily();
  const done = [];
  for (const q of P.quests.list) {
    const def = QUEST_BY_ID[q.id]; if (!def || q.prog >= def.goal) continue;
    q.prog = Math.min(def.goal, q.prog + Math.max(0, def.m(res) || 0));
    if (q.prog >= def.goal) done.push(q.id);
  }
  return done;
}
export function claimQuest(i) {
  const q = P.quests.list[i]; const def = q && QUEST_BY_ID[q.id];
  if (!def || q.claimed || q.prog < def.goal) return null;
  q.claimed = true; P.coins += def.coins; const ups = addXp(def.xp);
  let bonus = 0;
  if (!P.quests.bonus && P.quests.list.every(x => x.claimed)) { P.quests.bonus = true; bonus = QUEST_ALL_BONUS; P.coins += bonus; }
  saveProfile(true);
  return { coins: def.coins, xp: def.xp, bonus, levelUps: ups };
}
// time until the daily quests, Daily Duel and login reward reset (local midnight)
export function untilReset() { const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const m = Math.max(0, Math.round((t - n) / 60000)); return `${Math.floor(m / 60)}h ${m % 60}m`; }

// ---------- login streak ----------
function prevKey(k) { const [y, m, d] = k.split('-').map(Number); return todayKey(new Date(y, m - 1, d - 1)); }
export function streakInfo() {
  const k = todayKey(); const s = P.streak; const claimed = s.claimed === k;
  const day = claimed ? s.day : (s.last && s.last === prevKey(k) ? s.day % 7 + 1 : 1);
  return { day, claimed, reward: STREAK_REWARDS[day - 1], next: STREAK_REWARDS[day % 7], restarted: !claimed && day === 1 && s.day > 0 };
}
export function makeWeapon(rarity, rng = new RNG((Date.now() & 0x7fffffff) ^ (P.nextUid * 131))) {
  const pool = unlockedHeroIds(); const hero = pool[rng.int(pool.length)];
  return { uid: P.nextUid++, hero, rarity, name: `${WEAPON_ADJ[rarity][rng.int(3)]} ${WEAPON_BASES[hero].name}` };
}
export function claimStreak() {
  const info = streakInfo(); if (info.claimed) return null;
  const r = info.reward; let weapon = null, levelUps = [];
  if (r.coins) P.coins += r.coins;
  if (r.xp) levelUps = addXp(r.xp);
  if (r.weapon) { weapon = makeWeapon(r.weapon); P.weapons.push(weapon); }
  const k = todayKey(); P.streak = { day: info.day, last: k, claimed: k };
  saveProfile(true);
  return { ...r, weapon, levelUps, day: info.day };
}
export function questsClaimable() { return P.quests.list.filter(q => !q.claimed && q.prog >= (QUEST_BY_ID[q.id]?.goal ?? Infinity)).length; }

// ---------- shop ----------
export function rollItem(rng) {
  const def = ITEMS[rng.int(ITEMS.length)];
  const r = rng.weighted(SHOP_RARITY_WEIGHTS.map((w, i) => i <= Math.min(4, 1 + Math.floor(P.level / 2)) ? w : 0));
  return { id: def.id, r };
}
export function refreshShop(paid) {
  const rng = new RNG((Date.now() & 0xffffffff) ^ (P.nextUid * 7919));
  const offers = []; const seen = new Set();
  while (offers.length < 4) { const it = rollItem(rng); const k = it.id; if (seen.has(k)) continue; seen.add(k); offers.push({ ...it, price: ITEM_PRICES[it.r], sold: false }); }
  P.shop = { offers };
  if (paid !== undefined) saveProfile();
}
export const REROLL_COST = 40;

// ---------- weapons ----------
export function rollWeapon(rng, tierBoost = 0, heroPool = null, maxRarity = 4) {
  const pool = heroPool || unlockedHeroIds();
  const hero = pool[rng.int(pool.length)];
  const w = RARITIES.map((r, i) => i > maxRarity ? 0 : r.weight * (i >= 2 ? 1 + tierBoost : 1) * (i >= 3 ? 1 + tierBoost : 1));
  const ri = rng.weighted(w);
  const rar = RARITIES[ri];
  const adj = WEAPON_ADJ[rar.id][rng.int(3)];
  return { uid: P.nextUid++, hero, rarity: rar.id, name: `${adj} ${WEAPON_BASES[hero].name}` };
}
export function equippedWeapons() {
  const out = {};
  for (const [hid, uid] of Object.entries(P.equipped)) { const w = P.weapons.find(x => x.uid === uid); if (w) out[hid] = w; }
  return out;
}
