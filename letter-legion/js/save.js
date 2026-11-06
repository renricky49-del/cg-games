// Persistent player profile (CrazyGames data module with localStorage fallback)
import { CG } from './cg.js';
import { HEROES, RIVALS, MAPS, ITEMS, ITEM_PRICES, SHOP_RARITY_WEIGHTS, RARITIES, WEAPON_BASES, WEAPON_ADJ, DAILY_BUFFS, xpForLevel } from './data.js';
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
  };
}
export let P = defaultProfile();

export function loadProfile() {
  try {
    const raw = CG.getItem(KEY);
    if (raw) { const d = JSON.parse(raw); P = Object.assign(defaultProfile(), d); P.settings = Object.assign(defaultProfile().settings, d.settings || {}); P.daily = Object.assign(defaultProfile().daily, d.daily || {}); }
  } catch (e) { console.warn('save load failed', e); P = defaultProfile(); }
  rolloverDaily();
  if (!P.shop) refreshShop(false);
  return P;
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
}

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
export function rollWeapon(rng, tierBoost = 0, heroPool = null) {
  const pool = heroPool || unlockedHeroIds();
  const hero = pool[rng.int(pool.length)];
  const w = RARITIES.map((r, i) => r.weight * (i >= 2 ? 1 + tierBoost : 1) * (i >= 3 ? 1 + tierBoost : 1));
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
