// Letter Legion — match simulation (pure logic, no DOM). Runs in browser and in Node for balance tests.
import {
  UNITS, BASIC_LETTERS, MAX_LEVEL, LEVEL_DMG, LEVEL_RATE, GOLD_TILE, HEROES, HERO_BY_ID, HERO_LEVEL_MULT, HERO_MAX_LEVEL,
  ENEMIES, BOSSES, WAVE_POOLS, BOSS_EVERY, waveHp, MAP_BY_ID, SUMMON_BASE, SUMMON_STEP, START_INK, PASSIVE_INK, TRAIN_COSTS, TRAIN_BONUS,
  ITEM_BY_ID, RARITIES, WEAPON_BASES, HEX, BOONS, DRAFT_WAVES,
} from './data.js';
import { RNG } from './rng.js';

export const TRAY_SIZE = 3;
export let BOON_HP = +(globalThis.process?.env?.BOON_HP ?? 0.12);
const COMBO_WINDOW = 3.5; // seconds between merges to keep a combo going
const WAVE_DUR = 21, BOSS_WAVE_DUR = 28, FIRST_WAVE_DELAY = 2.5;
// opening waves are short so the action starts fast: 12s, 14s, 16s, 18s, then 21s
export const waveDur = (w, isBoss) => isBoss ? BOSS_WAVE_DUR : (w <= 4 ? 10 + 2 * w : WAVE_DUR);

// ---------- map parsing ----------
const parsedCache = {};
export function parseMap(mapId) {
  if (parsedCache[mapId]) return parsedCache[mapId];
  const m = MAP_BY_ID[mapId];
  const rows = m.rows.length, cols = Math.max(...m.rows.map(r => r.length));
  const at = (x, y) => (y >= 0 && y < rows && x >= 0 && x < cols) ? (m.rows[y][x] || '.') : '.';
  let start = null; const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = at(x, y);
    if (c === 'E') start = { x, y };
    if (c === 'o' || c === 'x') cells.push({ id: cells.length, x, y, locked: c === 'x' });
  }
  // walk the road
  const path = [start]; const seen = new Set([start.x + ',' + start.y]);
  let cur = start, guard = 0;
  while (at(cur.x, cur.y) !== 'W' && guard++ < 500) {
    let nxt = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy, c = at(nx, ny);
      if ((c === '#' || c === 'W') && !seen.has(nx + ',' + ny)) { nxt = { x: nx, y: ny }; break; }
    }
    if (!nxt) throw new Error('broken road in map ' + mapId + ' at ' + cur.x + ',' + cur.y);
    seen.add(nxt.x + ',' + nxt.y); path.push(nxt); cur = nxt;
  }
  const pts = path.map(p => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  // extend entry half a tile outward so enemies walk in from the edge
  const d0x = pts[0].x - pts[1].x, d0y = pts[0].y - pts[1].y;
  pts.unshift({ x: pts[0].x + d0x * 0.5, y: pts[0].y + d0y * 0.5 });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  // horizontal runs of cells (for spelling)
  const byPos = new Map(cells.map(c => [c.x + ',' + c.y, c]));
  for (const c of cells) { c.right = byPos.get((c.x + 1) + ',' + c.y)?.id ?? -1; c.left = byPos.get((c.x - 1) + ',' + c.y)?.id ?? -1; }
  const roadTiles = new Set(path.map(p => p.x + ',' + p.y));
  const res = { id: mapId, def: m, cols, rows, pts, cum, len: cum[cum.length - 1], cells, ward: pts[pts.length - 1], roadTiles, at };
  parsedCache[mapId] = res;
  return res;
}
export function posAt(map, d) {
  const { pts, cum } = map;
  if (d <= 0) return { x: pts[0].x, y: pts[0].y, dir: 0 };
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  if (d >= cum[cum.length - 1]) { const p = pts[pts.length - 1]; return { x: p.x, y: p.y, dir: 0 }; }
  const a = pts[lo], b = pts[lo + 1], t = (d - cum[lo]) / (cum[lo + 1] - cum[lo] || 1);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dir: Math.sign(b.x - a.x) };
}

// ---------- wave generation (shared by both sides) ----------
export function makeWave(w, rng, mapDef, overtime = 0) {
  const isBoss = w % BOSS_EVERY === 0;
  const hp = waveHp(w) * mapDef.hpMult * (overtime ? Math.pow(1.45, overtime) : 1);
  const pool = WAVE_POOLS.find(p => w <= p.upTo).pool;
  const list = [];
  const count = isBoss ? 4 + Math.floor(w / 3) : 7 + Math.floor(w * 1.1) + (w <= 4 ? 2 : 0);
  const spread = isBoss ? 8 : Math.min(11, waveDur(w, false) * (w <= 4 ? 0.8 : 0.6));
  const iv = spread / count;
  let t = 0;
  // themed group: sometimes a whole wave of one type
  const theme = (!isBoss && w > 3 && rng.next() < 0.3) ? rng.pick(pool) : null;
  for (let i = 0; i < count; i++) {
    const type = theme && rng.next() < 0.7 ? theme : rng.pick(pool);
    list.push({ at: t, type, hp: hp * ENEMIES[type].hp });
    t += iv * rng.range(0.7, 1.3);
  }
  if (isBoss) {
    const bi = (Math.floor(w / BOSS_EVERY) - 1) % BOSSES.length;
    const b = BOSSES[bi];
    const cycle = Math.floor((Math.floor(w / BOSS_EVERY) - 1) / BOSSES.length);
    list.push({ at: 2.5, type: 'boss', boss: bi, hp: hp * b.hp * (1 + 0.35 * cycle) });
  }
  list.sort((a, b) => a.at - b.at);
  return { w, isBoss, list, dur: waveDur(w, isBoss) };
}

// ---------- modifiers from loadout / daily buff / weapons ----------
export function buildMods(cfg = {}) {
  const mods = { dmg: 1, letterDmg: { S: 1, L: 1, B: 1, K: 1 }, letterRate: { S: 1, L: 1, B: 1, K: 1 }, ink: 1, gold: 0.22, lives: 0,
    heroCd: 1, startInk: START_INK, weapons: {}, actives: [], coins: 1, unlockedHeroes: cfg.unlockedHeroes || HEROES.map(h => h.id),
    // blessing-driven knobs (see Side.applyBoon)
    summonCost: 1, lucky: 0.04, wild: 0.05, shovel: 0.05, mergeInk: 0, enemySpeed: 1, crit: 0, critMult: 2.5, bossDmg: 0,
    hexRate: 1, hexHp: 1, splash: 1, letterRange: { S: 0, L: 0, B: 0, K: 0 } };
  for (const it of (cfg.passives || [])) {
    const def = ITEM_BY_ID[it.id]; if (!def) continue; const v = def.vals[it.r];
    if (it.id === 'ring') mods.ink += v / 100;
    if (it.id === 'quills') mods.dmg += v / 100;
    if (it.id === 'goldink') mods.gold += v / 100;
    if (it.id === 'pillow') mods.lives += v;
    if (it.id === 'hourglass') mods.heroCd *= 1 - v / 100;
    if (it.id === 'purse') mods.coins += v / 100;
  }
  mods.actives = (cfg.actives || []).map(it => ({ ...it, used: false }));
  const b = cfg.dailyBuff;
  if (b === 'sword') mods.letterDmg.S += 0.3;
  if (b === 'lance') mods.letterDmg.L += 0.3;
  if (b === 'bow') mods.letterDmg.B += 0.3;
  if (b === 'knight') mods.letterRate.K += 0.25;
  if (b === 'gold') mods.gold *= 1.5;
  if (b === 'ink') mods.startInk += 60;
  if (b === 'hero') mods.heroCd *= 0.8;
  for (const [hid, wpn] of Object.entries(cfg.weapons || {})) {
    if (!wpn) continue; const r = RARITIES.findIndex(x => x.id === wpn.rarity);
    if (r >= 0) mods.weapons[hid] = { dmg: RARITIES[r].dmg, cd: RARITIES[r].cd, upgrade: RARITIES[r].upgrade };
  }
  if (cfg.cpuBonus) mods.dmg *= cfg.cpuBonus;
  return mods;
}

let UID = 1;

// ---------- one side of the duel ----------
export class Side {
  constructor(match, idx, cfg) {
    this.match = match; this.idx = idx; this.cfg = cfg;
    this.map = parseMap(match.mapId);
    this.cells = this.map.cells.map(c => ({ id: c.id, x: c.x + 0.5, y: c.y + 0.5, col: c.x, row: c.y, left: c.left, right: c.right, locked: c.locked, unit: null }));
    this.mods = buildMods(cfg);
    this.maxLives = this.map.def.lives + this.mods.lives;
    this.lives = this.maxLives;
    this.ink = this.mods.startInk;
    this.summons = 0;
    this.tray = new Array(TRAY_SIZE).fill(null);
    this.enemies = [];
    this.train = { S: 0, L: 0, B: 0, K: 0 };
    this.shovels = 0;
    this.rng = new RNG(match.seed * 31 + 7 + idx * 1013);
    this.events = [];
    this.stats = { kills: 0, dmg: 0, leaks: 0, heroes: 0, merges: 0, maxLevel: 1, summons: 0, spelled: [], dmgBy: {},
      calls: 0, hexes: 0, brutes: 0, boons: 0, maxCombo: 0, wildSpells: 0, crits: 0, lucky: 0, boonList: [] };
    this.boons = this.stats.boonList; this.offers = null; this.rerolls = 1;
    this.autoPick = idx === 1; // the CPU picks its blessings instantly; the player picks in the draft screen
    this.hex = 0; this.hexSent = 0;
    this.combo = 0; this.lastMergeT = -99;
    this.wildLeft = 0;
    this.dmgKey = 'other';
    this.script = cfg.script ? cfg.script.slice() : null;
    this.cloverLeft = 0;
    this.hornT = 0;
    this.freezeT = 0;
    this.shield = 0;
    this.dirty = true;
    this.lastPlacedCell = -1;
    this.dead = false;
    this.adShovelUsed = false; this.adSummonUsed = false;
    this.pendingSpawns = [];
  }
  emit(e) { if (this.events.length < 400) this.events.push(e); }
  summonCost() { return Math.round((SUMMON_BASE + SUMMON_STEP * this.summons) * this.mods.summonCost); }
  // no actions while the match is over or a blessing draft is open
  busy() { return this.dead || this.match.state !== 'running' || !!this.match.draft; }
  freeTraySlot() { return this.tray.findIndex(t => t === null); }
  freeCells() { return this.cells.filter(c => !c.locked && !c.unit); }
  lockedCells() { return this.cells.filter(c => c.locked); }
  heroesOnBoard() { return this.cells.filter(c => c.unit && c.unit.kind === 'hero').map(c => c.unit); }
  unlockedHeroes() { return HEROES.filter(h => this.mods.unlockedHeroes.includes(h.id)); }

  // golden letters currently held (board + tray)
  heldGold() {
    const out = [];
    for (const c of this.cells) if (c.unit && c.unit.kind === 'gold') out.push(c.unit.letter);
    for (const t of this.tray) if (t && t.kind === 'gold') out.push(t.letter);
    return out;
  }
  heroProgress(h) {
    // a ★ wild letter stands in for any one missing letter
    const held = this.heldGold().slice(); let n = 0;
    for (const ch of h.word) { let i = held.indexOf(ch); if (i < 0) i = held.indexOf('*'); if (i >= 0) { held.splice(i, 1); n++; } }
    return n / h.word.length;
  }
  // pity threshold: a golden letter at least every 4 summons until your first hero, then every 6
  pityAt() { return this.stats.heroes === 0 ? 3 : 5; }
  // golden letters only make sense while some unlocked hero can still be spelled or levelled up
  goldUseful() {
    const onBoard = this.heroesOnBoard();
    return this.unlockedHeroes().some(h => (onBoard.find(u => u.heroId === h.id)?.level || 0) < HERO_MAX_LEVEL);
  }
  rollGoldLetter() {
    const onBoard = this.heroesOnBoard();
    const heroes = this.unlockedHeroes().filter(h => (onBoard.find(u => u.heroId === h.id)?.level || 0) < HERO_MAX_LEVEL);
    if (!heroes.length) return 'K';
    // bias toward the missing letters of the word you're closest to completing
    let best = [], bp = -1;
    for (const h of heroes) { const p = this.heroProgress(h); if (p >= 1) continue; if (p > bp + 1e-6) { bp = p; best = [h]; } else if (Math.abs(p - bp) < 1e-6) best.push(h); }
    if (best.length && bp > 0 && this.rng.next() < (this.stats.heroes === 0 ? 0.85 : 0.65)) {
      const h = best[this.rng.int(best.length)];
      const held = this.heldGold().slice(); const missing = [];
      for (const ch of h.word) { const i = held.indexOf(ch); if (i >= 0) held.splice(i, 1); else missing.push(ch); }
      missing.length -= Math.min(missing.length, held.filter(x => x === '*').length); // wilds already cover some
      if (missing.length) return missing[this.rng.int(missing.length)];
    }
    // otherwise: a random letter from a random (unfinished) hero word — shorter words slightly favoured
    const h = heroes[this.rng.weighted(heroes.map(x => x.word.length === 4 ? 1.4 : 1))];
    return h.word[this.rng.int(h.word.length)];
  }
  // a golden letter from a summon: sometimes a ★ wild letter
  goldItem() {
    if (this.wildLeft > 0) { this.wildLeft--; return this.makeGold('*'); }
    return this.makeGold(this.rng.next() < this.mods.wild ? '*' : this.rollGoldLetter());
  }
  makeBasic(letter, level = 1) { return { uid: UID++, kind: 'basic', letter, level, cd: this.rng.range(0, 0.6), atkT: 0, frozen: 0, born: this.match.time }; }
  makeGold(letter) { return { uid: UID++, kind: 'gold', letter, level: 1, cd: this.rng.range(0, 0.6), atkT: 0, frozen: 0, born: this.match.time }; }

  canSummon() { return !this.busy() && this.ink >= this.summonCost() && this.freeTraySlot() >= 0; }
  summon(free = false) {
    if (this.busy()) return null;
    const slot = this.freeTraySlot();
    if (slot < 0) return null;
    const cost = this.summonCost();
    if (!free) { if (this.ink < cost) return null; this.ink -= cost; this.summons++; }
    this.stats.summons++;
    let item;
    const sc = this.script && this.script.length ? this.script.shift() : null;
    if (sc) {
      if (sc === 'shovel') item = { kind: 'shovel' };
      else if (sc.startsWith('gold:')) item = this.makeGold(sc.slice(5));
      else item = this.makeBasic(sc);
    } else if ((this.cloverLeft > 0 || this.wildLeft > 0) && this.goldUseful()) {
      if (this.cloverLeft > 0 && !this.wildLeft) this.cloverLeft--;
      item = this.goldItem();
    } else {
      const r = this.rng.next();
      const canGold = this.goldUseful();
      const shovelChance = this.lockedCells().length > this.shovels ? this.mods.shovel : 0;
      if (canGold && (this.sinceGold || 0) >= this.pityAt()) item = this.goldItem(); // pity: guaranteed golden letter
      else if (r < shovelChance) item = { kind: 'shovel' };
      else if (canGold && r < shovelChance + this.mods.gold) item = this.goldItem();
      else {
        item = this.makeBasic(BASIC_LETTERS[this.rng.int(4)]);
        if (this.rng.next() < this.mods.lucky) { item.level = 2; item.lucky = true; this.stats.lucky++; this.stats.maxLevel = Math.max(this.stats.maxLevel, 2); }
      }
    }
    this.sinceGold = item.kind === 'gold' ? 0 : (this.sinceGold || 0) + 1;
    if (item.kind === 'shovel') { this.shovels++; this.emit({ t: 'summon', item, slot: -1 }); return item; }
    this.tray[slot] = item;
    this.emit({ t: 'summon', item, slot });
    return item;
  }

  // src: {tray:i} or {cell:id}
  getSrc(src) { return src.tray !== undefined ? this.tray[src.tray] : this.cells[src.cell]?.unit; }
  clearSrc(src) { if (src.tray !== undefined) this.tray[src.tray] = null; else this.cells[src.cell].unit = null; }
  canMerge(a, b) {
    if (!a || !b || a === b) return false;
    if (a.kind === 'basic' && b.kind === 'basic') return a.letter === b.letter && a.level === b.level && a.level < MAX_LEVEL;
    if (a.kind === 'gold' && b.kind === 'gold') return a.letter === b.letter && a.letter !== '*'; // transmute (never wilds)
    return false;
  }
  // returns a result string or null
  place(src, dstId) {
    if (this.busy()) return null;
    const u = this.getSrc(src); const dst = this.cells[dstId];
    if (!u || !dst || dst.locked) return null;
    if (src.cell === dstId) return null;
    if (!dst.unit) {
      this.clearSrc(src); dst.unit = u; this.dirty = true; this.lastPlacedCell = dstId;
      this.emit({ t: 'place', cell: dstId, unit: u });
      if (u.kind === 'gold') this.checkSpell(dstId);
      return 'move';
    }
    const t = dst.unit;
    if (this.canMerge(u, t)) {
      this.clearSrc(src);
      if (u.kind === 'basic') {
        t.level++; t.cd = 0.2; t.mergeT = this.match.time;
        this.stats.merges++; this.stats.maxLevel = Math.max(this.stats.maxLevel, t.level);
        // quick successive merges chain into a combo that pays bonus ink
        const now = this.match.time;
        this.combo = now - this.lastMergeT <= COMBO_WINDOW ? this.combo + 1 : 1; this.lastMergeT = now;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
        const ink = this.mods.mergeInk * t.level + (this.combo >= 2 ? Math.round((3 + this.match.wave) * (this.combo - 1)) : 0);
        this.ink += ink;
        this.emit({ t: 'merge', cell: dstId, unit: t, combo: this.combo, ink });
      } else {
        // transmute two identical gold tiles into a letter you need
        let nl = t.letter, tries = 0;
        while (nl === t.letter && tries++ < 12) nl = this.rollGoldLetter();
        t.letter = nl; t.mergeT = this.match.time;
        this.emit({ t: 'transmute', cell: dstId, unit: t });
        this.checkSpell(dstId);
      }
      this.dirty = true;
      return 'merge';
    }
    if (src.cell !== undefined) { // swap
      const sc = this.cells[src.cell]; sc.unit = t; dst.unit = u; this.dirty = true; this.lastPlacedCell = dstId;
      this.emit({ t: 'swap', a: src.cell, b: dstId });
      if (u.kind === 'gold') this.checkSpell(dstId);
      if (t.kind === 'gold') this.checkSpell(src.cell);
      return 'swap';
    }
    if (src.tray !== undefined) { // tray onto occupied: swap occupant into tray slot (heroes never go back to the tray)
      if (t.kind === 'hero') return null;
      this.tray[src.tray] = t; dst.unit = u; this.dirty = true; this.lastPlacedCell = dstId;
      this.emit({ t: 'place', cell: dstId, unit: u });
      if (u.kind === 'gold') this.checkSpell(dstId);
      return 'swap';
    }
    return null;
  }
  sellValue(u) {
    if (!u) return 0;
    if (u.kind === 'basic') return Math.round(6 * Math.pow(2, u.level - 1) + this.summons * 0.8);
    if (u.kind === 'gold') return 8 + Math.round(this.summons * 0.6);
    return 0;
  }
  sell(src) {
    if (this.busy()) return 0;
    const u = this.getSrc(src); if (!u || u.kind === 'hero') return 0;
    const v = this.sellValue(u); this.ink += v; this.clearSrc(src); this.dirty = true;
    this.emit({ t: 'sell', src, value: v, cell: src.cell });
    return v;
  }
  dig(cellId) {
    const c = this.cells[cellId];
    if (!c || !c.locked || this.shovels <= 0 || this.busy()) return false;
    this.shovels--; c.locked = false; this.dirty = true;
    this.emit({ t: 'dig', cell: cellId });
    return true;
  }
  trainCost(letter) { const r = this.train[letter]; return r < TRAIN_COSTS.length ? TRAIN_COSTS[r] : Infinity; }
  doTrain(letter) {
    const cost = this.trainCost(letter); if (this.ink < cost || this.busy()) return false;
    this.ink -= cost; this.train[letter]++; this.emit({ t: 'train', letter, rank: this.train[letter] }); return true;
  }
  useItem(i) {
    const it = this.mods.actives[i]; if (!it || it.used || this.busy()) return false;
    const def = ITEM_BY_ID[it.id]; const v = def.vals[it.r];
    it.used = true; this.dmgKey = 'item';
    if (it.id === 'flask') this.ink += v;
    if (it.id === 'frost') { this.freezeT = Math.max(this.freezeT, v); }
    if (it.id === 'bomb') { const d = waveHp(Math.max(1, this.match.wave)) * 0.35 * v; for (const e of this.enemies) this.damage(e, d, true, null); }
    if (it.id === 'clover') this.cloverLeft += v;
    if (it.id === 'shovel') this.shovels += v;
    if (it.id === 'horn') this.hornT = v;
    this.emit({ t: 'item', id: it.id, v });
    return true;
  }

  // ---------- blessings ----------
  boonOk(b) {
    if (b.id === 'wild' && !this.goldUseful()) return false;
    if (b.id === 'dig' && !this.lockedCells().length) return false;
    if (b.id === 'tempo' && !this.unlockedHeroes().length) return false;
    return true;
  }
  rollOffers(avoid = []) {
    let pool = BOONS.filter(b => this.boonOk(b) && !avoid.includes(b.id));
    if (pool.length < 3) pool = BOONS.filter(b => this.boonOk(b));
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(this.rng.int(pool.length), 1)[0].id);
    return out;
  }
  // CPU / auto-pick heuristic: weigh each offer against the current board
  boonScore(id) {
    const cnt = { S: 0, L: 0, B: 0, K: 0 }; let tot = 0;
    for (const c of this.cells) if (c.unit && c.unit.kind === 'basic') { const v = Math.pow(2, c.unit.level - 1); cnt[c.unit.letter] += v; tot += v; }
    const share = L => tot ? cnt[L] / tot : 0.25;
    const w = this.match.wave;
    switch (id) {
      case 'serif': return 1.0;
      case 'cheap': return w < 12 ? 0.95 : 0.7;
      case 'gilded': return this.goldUseful() ? 0.75 : 0;
      case 'lucky': return 0.8;
      case 'blade': return 0.3 + 2.2 * share('S');
      case 'lance': return 0.3 + 2.0 * share('L');
      case 'eagle': return 0.3 + 2.0 * share('B');
      case 'charge': return 0.3 + 2.0 * share('K');
      case 'rebate': return 0.65;
      case 'tempo': return this.heroesOnBoard().length ? 0.9 : 0.45;
      case 'guard': return this.lives <= this.maxLives / 2 ? 1.4 : 0.55;
      case 'chill': return 0.8;
      case 'bounty': return w < 10 ? 0.95 : 0.6;
      case 'crit': return 0.85;
      case 'slayer': return 0.7;
      case 'wild': return this.goldUseful() ? 0.8 : 0;
      case 'hexer': return 0.6;
      case 'dig': return this.lockedCells().length ? 0.7 : 0;
    }
    return 0.5;
  }
  chooseBoon() {
    if (!this.offers) return 0;
    const skill = this.cfg.cpuSkill ?? 1;
    if (this.rng.next() > skill) return this.rng.int(this.offers.length);
    let best = 0; this.offers.forEach((id, i) => { if (this.boonScore(id) > this.boonScore(this.offers[best])) best = i; });
    return best;
  }
  applyBoon(id) {
    const m = this.mods;
    switch (id) {
      case 'serif': m.dmg *= 1.2; break;
      case 'cheap': m.summonCost *= 0.8; break;
      case 'gilded': m.gold += 0.08; break;
      case 'lucky': m.lucky += 0.2; break;
      case 'blade': m.letterDmg.S += 0.4; m.splash *= 1.3; break;
      case 'lance': m.letterDmg.L += 0.25; m.letterRange.L += 0.8; break;
      case 'eagle': m.letterDmg.B += 0.3; m.letterRange.B += 1; break;
      case 'charge': m.letterRate.K += 0.4; break;
      case 'rebate': m.mergeInk += 8; break;
      case 'tempo': m.heroCd *= 0.7; break;
      case 'guard': this.maxLives += 2; this.lives += 2; break;
      case 'chill': m.enemySpeed *= 0.88; break;
      case 'bounty': m.ink += 0.4; break;
      case 'crit': m.crit = Math.min(0.6, m.crit + 0.15); break;
      case 'slayer': m.bossDmg += 0.75; break;
      case 'wild': this.wildLeft += 2; break;
      case 'hexer': m.hexRate *= 1.5; m.hexHp *= 1.3; break;
      case 'dig': this.shovels += 2; m.shovel += 0.05; break;
      default: return false;
    }
    this.boons.push(id); this.stats.boons++; this.dirty = true;
    this.emit({ t: 'boon', id });
    return true;
  }

  // ---------- hex (curse the rival with a Hexed Brute) ----------
  hexNeed() { return HEX.need + HEX.step * this.hexSent; }
  hexReady() { return !this.match.tutorial && this.hex >= this.hexNeed(); }
  chargeHex(n) { if (!this.match.tutorial) this.hex = Math.min(this.hexNeed(), this.hex + n * this.mods.hexRate); }
  canHex() { const foe = this.match.sides[1 - this.idx]; return this.hexReady() && !this.busy() && !foe.dead; }
  sendHex() {
    if (!this.canHex()) return false;
    const foe = this.match.sides[1 - this.idx]; const m = this.match;
    this.hex = 0; this.hexSent++; this.stats.hexes++;
    const hp = waveHp(Math.max(1, m.wave)) * m.mapDef.hpMult * ENEMIES.brute.hp * this.mods.hexHp * (m.overtime ? Math.pow(1.45, m.overtime) : 1);
    foe.pendingSpawns.push({ type: 'brute', hp, dist: 0 });
    this.emit({ t: 'hexSent' }); foe.emit({ t: 'hexed' });
    return true;
  }

  // ---------- spelling ----------
  checkSpell(cellId) {
    const c0 = this.cells[cellId]; if (!c0) return false;
    // collect the whole run of cells in this row
    let s = c0; while (s.left >= 0) s = this.cells[s.left];
    const run = []; let c = s; while (c) { run.push(c); c = c.right >= 0 ? this.cells[c.right] : null; }
    const heroes = this.unlockedHeroes().slice().sort((a, b) => b.word.length - a.word.length);
    for (const h of heroes) {
      const L = h.word.length;
      for (let i = 0; i + L <= run.length; i++) {
        let ok = true;
        for (let k = 0; k < L; k++) {
          const u = run[i + k].unit;
          if (!u || u.locked || run[i + k].locked || u.kind !== 'gold' || (u.letter !== h.word[k] && u.letter !== '*')) { ok = false; break; }
        }
        if (!ok) continue;
        const existing = this.cells.find(cc => cc.unit && cc.unit.kind === 'hero' && cc.unit.heroId === h.id);
        if (existing && existing.unit.level >= HERO_MAX_LEVEL) continue;
        const seg = run.slice(i, i + L);
        const wild = seg.some(sc => sc.unit.letter === '*');
        if (wild) this.stats.wildSpells++;
        for (const sc of seg) sc.unit = null;
        let target;
        if (existing) { existing.unit.level++; existing.unit.mergeT = this.match.time; target = existing; }
        else {
          target = seg.find(sc => sc.id === cellId) || seg[0];
          target.unit = { uid: UID++, kind: 'hero', heroId: h.id, letter: h.word, level: 1, cd: 0.5, skillCd: 3, atkT: 0, frozen: 0, born: this.match.time, mergeT: this.match.time };
        }
        this.stats.heroes++; this.stats.spelled.push(h.id);
        this.dirty = true;
        this.emit({ t: 'spell', hero: h.id, cells: seg.map(x => x.id), target: target.id, level: target.unit.level, wild });
        return true;
      }
    }
    return false;
  }

  // ---------- combat ----------
  unitDamage(u) {
    if (u.kind === 'basic') {
      const d = UNITS[u.letter];
      return d.dmg * Math.pow(LEVEL_DMG, u.level - 1) * (1 + TRAIN_BONUS * this.train[u.letter]) * this.mods.dmg * this.mods.letterDmg[u.letter];
    }
    if (u.kind === 'gold') return GOLD_TILE.dmg * this.mods.dmg * (1 + 0.12 * (this.match.wave - 1));
    const h = HERO_BY_ID[u.heroId]; const w = this.mods.weapons[u.heroId];
    return h.dmg * HERO_LEVEL_MULT[u.level - 1] * (1 + (w ? w.dmg : 0)) * this.mods.dmg * this.heroWaveScale();
  }
  heroWaveScale() { return Math.pow(1.11, Math.max(0, this.match.wave - 1)); }
  unitRate(u) {
    let r;
    if (u.kind === 'basic') r = UNITS[u.letter].rate * (1 + LEVEL_RATE * (u.level - 1)) * this.mods.letterRate[u.letter];
    else if (u.kind === 'gold') r = GOLD_TILE.rate;
    else r = HERO_BY_ID[u.heroId].rate;
    if (u.aura) r *= 1 + u.aura;
    if (this.hornT > 0) r *= 1.6;
    return r;
  }
  unitRange(u) { return u.kind === 'basic' ? UNITS[u.letter].range + this.mods.letterRange[u.letter] : u.kind === 'gold' ? GOLD_TILE.range : HERO_BY_ID[u.heroId].range; }
  recomputeAuras() {
    const kings = this.cells.filter(c => c.unit && c.unit.kind === 'hero' && c.unit.heroId === 'KING');
    for (const c of this.cells) if (c.unit) c.unit.aura = 0;
    for (const k of kings) {
      const amt = (this.mods.weapons.KING?.upgrade ? 0.6 : 0.35) * (1 + 0.25 * (k.unit.level - 1));
      for (const c of this.cells) if (c.unit && c !== k && Math.hypot(c.x - k.x, c.y - k.y) <= 1.9) c.unit.aura = Math.max(c.unit.aura, amt);
    }
    this.dirty = false;
  }
  spawn(spec) {
    let e;
    if (spec.type === 'boss') {
      const b = BOSSES[spec.boss];
      e = { id: UID++, type: 'boss', boss: spec.boss, name: b.name, hp: spec.hp, maxHp: spec.hp, speed: b.speed, armor: b.armor || 0, ink: b.ink, size: b.size, sprite: b.sprite, abilityT: b.abilityCd * 0.6 };
      this.emit({ t: 'boss', boss: spec.boss });
    } else {
      const d = ENEMIES[spec.type];
      e = { id: UID++, type: spec.type, hp: spec.hp, maxHp: spec.hp, speed: d.speed, armor: d.armor || 0, ink: d.ink, size: d.size, sprite: d.sprite, elite: !!d.elite };
    }
    e.dist = spec.dist || 0; e.slowT = 0; e.slowF = 1; e.stunT = 0; e.dotT = 0; e.dot = 0; e.hitT = 0; e.wave = this.match.wave;
    e.inkMul = 1 + 0.25 * (this.match.wave - 1);
    const p = posAt(this.map, e.dist); e.x = p.x; e.y = p.y; e.dir = p.dir;
    this.enemies.push(e);
    return e;
  }
  damage(e, amt, pierce, src) {
    if (e.hp <= 0) return 0;
    if (this.mods.bossDmg && (e.type === 'boss' || e.elite)) amt *= 1 + this.mods.bossDmg;
    if (!pierce && e.armor) amt *= 1 - e.armor;
    if (e.type === 'imp' && !pierce && this.rng.next() < 0.2) { this.emit({ t: 'dodge', x: e.x, y: e.y }); return 0; }
    const real = Math.min(amt, e.hp); e.hp -= amt; e.hitT = 0.12; this.stats.dmg += amt; this.stats.dmgBy[this.dmgKey] = (this.stats.dmgBy[this.dmgKey] || 0) + real;
    if (amt > 0 && this.match.fx) this.emit({ t: 'dmg', x: e.x, y: e.y, v: amt, big: src === 'skill' });
    if (e.hp <= 0) this.kill(e);
    return amt;
  }
  kill(e) {
    this.stats.kills++;
    const ink = Math.round(e.ink * e.inkMul * this.mods.ink);
    this.ink += ink;
    this.emit({ t: 'kill', x: e.x, y: e.y, type: e.type, boss: e.boss, ink, elite: e.elite });
    if (e.elite) this.stats.brutes++;
    this.chargeHex(e.type === 'boss' ? HEX.boss : e.elite ? HEX.elite : HEX.kill);
    if (e.type === 'slime') {
      for (let i = 0; i < 2; i++) this.pendingSpawns.push({ type: 'baby', hp: e.maxHp * 0.28, dist: Math.max(0, e.dist - 0.25 * i) });
    }
  }
  leadingEnemyInRange(x, y, range) {
    let best = null, bd = -1; const r2 = range * range;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r2 && e.dist > bd) { bd = e.dist; best = e; }
    }
    return best;
  }
  attack(c, u) {
    this.dmgKey = u.kind === 'basic' ? u.letter : u.kind === 'gold' ? 'gold' : u.heroId;
    const range = this.unitRange(u);
    const tgt = this.leadingEnemyInRange(c.x, c.y, range);
    if (!tgt) return false;
    let dmg = this.unitDamage(u);
    if (this.mods.crit > 0 && this.rng.next() < this.mods.crit) {
      dmg *= this.mods.critMult; this.stats.crits++;
      if (this.match.fx) this.emit({ t: 'crit', x: tgt.x, y: tgt.y });
    }
    u.atkT = 1; u.aimX = tgt.x; u.aimY = tgt.y;
    let kind = u.kind === 'basic' ? UNITS[u.letter].kind : u.kind === 'gold' ? 'single' : HERO_BY_ID[u.heroId].kind;
    if (kind === 'splash') {
      const rad = u.kind === 'basic' ? UNITS[u.letter].splash * this.mods.splash : HERO_BY_ID[u.heroId].splash;
      const tx = tgt.x, ty = tgt.y;
      for (const e of this.enemies) if (e.hp > 0 && Math.hypot(e.x - tx, e.y - ty) <= rad) this.damage(e, e === tgt ? dmg : dmg * 0.6, false, u);
      this.emit({ t: 'slash', cell: c.id, x: tx, y: ty, letter: u.letter, hero: u.heroId });
    } else if (kind === 'pierce') {
      // line from cell through target, length = range
      const dx = tgt.x - c.x, dy = tgt.y - c.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const w = UNITS[u.letter].width;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const ex = e.x - c.x, ey = e.y - c.y; const along = ex * ux + ey * uy;
        if (along < 0 || along > range + 0.3) continue;
        const perp = Math.abs(ex * uy - ey * ux);
        if (perp <= w) this.damage(e, dmg, true, u);
      }
      this.emit({ t: 'thrust', cell: c.id, x: c.x + ux * range, y: c.y + uy * range });
    } else {
      this.damage(tgt, dmg, false, u);
      this.emit({ t: 'shot', cell: c.id, x: tgt.x, y: tgt.y, letter: u.kind === 'basic' ? u.letter : u.kind === 'gold' ? 'gold' : u.heroId });
    }
    return true;
  }
  castSkill(c, u) {
    this.dmgKey = u.heroId + '*';
    const h = HERO_BY_ID[u.heroId]; const w = this.mods.weapons[u.heroId]; const up = w && w.upgrade;
    const base = this.unitDamage(u);
    const alive = this.enemies.filter(e => e.hp > 0);
    const ev = { t: 'skill', hero: h.id, cell: c.id, x: c.x, y: c.y, targets: [] };
    switch (h.id) {
      case 'KING': {
        const g = Math.round((18 + 5 * this.match.wave) * (1 + 0.5 * (u.level - 1)));
        this.ink += g; ev.ink = g; break;
      }
      case 'MAGE': {
        const casts = up ? 2 : 1;
        for (let k = 0; k < casts; k++) {
          let best = null, bc = 0;
          for (const e of alive) { if (e.hp <= 0) continue; let n = 0; for (const o of alive) if (o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 1.3) n++; if (n > bc) { bc = n; best = e; } }
          if (!best) break;
          const bx = best.x, by = best.y;
          for (const e of alive) if (e.hp > 0 && Math.hypot(e.x - bx, e.y - by) < 1.3) this.damage(e, base * 3, false, 'skill');
          ev.targets.push({ x: bx, y: by });
        }
        break;
      }
      case 'MONK': {
        for (const e of alive) if (Math.hypot(e.x - c.x, e.y - c.y) <= 3.2) { e.slowT = 3; e.slowF = 0.5; this.damage(e, base * (up ? 5 : 1.5), false, 'skill'); ev.targets.push({ x: e.x, y: e.y }); }
        break;
      }
      case 'HAWK': {
        const n = up ? 2 : 1;
        for (let k = 0; k < n; k++) for (const e of alive) if (e.hp > 0) { this.damage(e, base * 1.1, false, 'skill'); if (k === 0) ev.targets.push({ x: e.x, y: e.y }); }
        break;
      }
      case 'NINJA': {
        const n = up ? 10 : 6;
        for (let k = 0; k < n; k++) {
          const live = alive.filter(e => e.hp > 0); if (!live.length) break;
          const e = live[this.rng.int(live.length)];
          this.damage(e, base * 1.6, false, 'skill'); ev.targets.push({ x: e.x, y: e.y });
        }
        break;
      }
      case 'DRUID': {
        const lead = this.leadingEnemyInRange(c.x, c.y, 99); if (!lead) break;
        const rad = up ? 2.6 : 1.6;
        for (const e of alive) if (Math.hypot(e.x - lead.x, e.y - lead.y) <= rad) { e.stunT = Math.max(e.stunT, 2); e.dotT = 3; e.dot = base * 1.2; }
        ev.targets.push({ x: lead.x, y: lead.y, r: rad });
        break;
      }
      case 'TITAN': {
        const st = up ? 3 : 1.5;
        for (const e of alive) if (Math.hypot(e.x - c.x, e.y - c.y) <= 3.0) { e.stunT = Math.max(e.stunT, e.type === 'boss' ? st * 0.5 : st); this.damage(e, base * 0.8, false, 'skill'); }
        ev.r = 3.0;
        break;
      }
      case 'SAINT': {
        if (this.lives < this.maxLives) { this.lives++; ev.heal = true; }
        else { let best = null; for (const e of alive) if (!best || e.hp > best.hp) best = e; if (best) { this.damage(best, base * 8, false, 'skill'); ev.targets.push({ x: best.x, y: best.y }); } }
        break;
      }
    }
    this.emit(ev);
  }
  bossAbility(e) {
    const b = BOSSES[e.boss];
    const occupied = this.cells.filter(c => c.unit && c.unit.frozen <= 0);
    const pick = (n, dur) => {
      for (let i = 0; i < n && occupied.length; i++) {
        const c = occupied.splice(this.rng.int(occupied.length), 1)[0];
        c.unit.frozen = dur; this.emit({ t: 'disable', cell: c.id, kind: b.ability, fx: e.x, fy: e.y });
      }
    };
    if (b.ability === 'tongue') pick(1, 3);
    if (b.ability === 'quake') pick(2, 2);
    if (b.ability === 'scorch') pick(3, 2);
    if (b.ability === 'raise') { for (let i = 0; i < 2; i++) this.pendingSpawns.push({ type: 'wisp', hp: waveHp(this.match.wave) * 0.6, dist: Math.max(0, e.dist - 0.3 - i * 0.3) }); this.emit({ t: 'raise', x: e.x, y: e.y }); }
  }
  update(dt) {
    if (this.dead) return;
    if (this.dirty) this.recomputeAuras();
    if (this.hornT > 0) this.hornT -= dt;
    if (this.match.curWave) this.ink += PASSIVE_INK * dt;
    // units
    for (const c of this.cells) {
      const u = c.unit; if (!u) continue;
      if (u.atkT > 0) u.atkT = Math.max(0, u.atkT - dt * 4);
      if (u.frozen > 0) { u.frozen -= dt; continue; }
      u.cd -= dt * this.unitRate(u);
      if (u.cd <= 0) { if (this.attack(c, u)) u.cd = 1; else u.cd = 0; }
      if (u.kind === 'hero') {
        const h = HERO_BY_ID[u.heroId]; const w = this.mods.weapons[u.heroId];
        let cdMul = this.mods.heroCd * (1 - (w ? w.cd : 0));
        if (u.heroId === 'SAINT' && w && w.upgrade) cdMul *= 0.5;
        u.skillCd -= dt;
        u.skillMax = h.cd * cdMul;
        if (u.skillCd <= 0) {
          const hasEnemy = this.enemies.some(e => e.hp > 0);
          if (hasEnemy || h.id === 'KING' || (h.id === 'SAINT' && this.lives < this.maxLives)) { this.castSkill(c, u); u.skillCd = h.cd * cdMul; }
          else u.skillCd = 0;
        }
      }
    }
    // enemies
    const frozen = this.freezeT > 0; if (frozen) this.freezeT -= dt;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e.hitT > 0) e.hitT -= dt;
      if (e.dotT > 0) { e.dotT -= dt; this.dmgKey = 'DRUID*'; this.damage(e, e.dot * dt, true, null); if (e.hp <= 0) continue; }
      if (e.type === 'wisp') e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ENEMIES.wisp.regen * dt);
      if (e.type === 'boss') { if (e.castT > 0) e.castT -= dt; e.abilityT -= dt; if (e.abilityT <= 0) { e.abilityT = BOSSES[e.boss].abilityCd; e.castT = 0.8; this.bossAbility(e); } }
      let sp = e.speed * this.mods.enemySpeed;
      if (e.slowT > 0) { e.slowT -= dt; sp *= e.slowF; }
      if (e.stunT > 0) { e.stunT -= dt; sp = 0; }
      if (frozen) sp = 0;
      e.dist += sp * dt;
      const p = posAt(this.map, e.dist); e.x = p.x; e.y = p.y; if (p.dir) e.dir = p.dir;
      if (e.dist >= this.map.len) {
        e.hp = 0; e.leaked = true;
        const cost = e.type === 'boss' ? 2 : 1;
        if (this.shield > 0) { this.shield--; }
        else { this.lives -= cost; this.stats.leaks += cost; }
        this.emit({ t: 'leak', boss: e.type === 'boss', cost, elite: e.elite });
        this.match.onLeak(this);
      }
    }
    if (this.pendingSpawns.length) { for (const s of this.pendingSpawns) this.spawn(s); this.pendingSpawns.length = 0; }
    if (this.enemies.length > 40 || this.match.tick % 30 === 0) this.enemies = this.enemies.filter(e => e.hp > 0);
    if (this.lives <= 0) { this.lives = 0; this.dead = true; }
  }
}

// ---------- the duel ----------
export class Match {
  constructor({ mapId, seed = 1, player = {}, rival = {}, tutorial = false, fx = true }) {
    this.mapId = mapId; this.seed = seed; this.tutorial = tutorial; this.fx = fx;
    this.mapDef = MAP_BY_ID[mapId];
    this.rng = new RNG(seed);
    this.time = 0; this.tick = 0;
    this.wave = 0; this.waveT = -FIRST_WAVE_DELAY; this.curWave = null; this.spawnIdx = 0;
    this.overtime = 0;
    this.state = 'running'; this.winner = -1; this.endReason = '';
    this.sides = [new Side(this, 0, player), new Side(this, 1, rival)];
    this.tutorialHold = false; // tutorial can pause wave progression
    this.plan = {}; // pre-rolled waves so the next one can be previewed
    this.otLeaks = [false, false];
    this.events = [];
    this.draft = null; // blessing draft in progress (the match waits until every side has picked)
  }
  get finalWave() { return this.mapDef.waves; }
  getPlan(w) {
    if (!this.plan[w]) { const r = new RNG(this.seed * 7919 + w * 104729); this.plan[w] = makeWave(w, r, this.mapDef, 0); }
    return this.plan[w];
  }
  previewWave() { const w = this.wave + 1; if (w > this.finalWave) return null; return this.getPlan(w); }
  // a side whose board is clear may call the next wave early for bonus ink (skips dead time)
  callWaveBonus() { return Math.round(this.timeToNextWave() * (2 + 0.6 * Math.max(1, this.wave))); }
  canCallWave(idx) {
    if (this.state !== 'running' || this.tutorialHold || this.overtime || this.draft) return false;
    if (this.curWave && (this.spawnIdx < this.curWave.list.length || this.wave >= this.finalWave)) return false;
    if (this.timeToNextWave() < 2) return false;
    return !this.sides[idx].enemies.some(e => e.hp > 0);
  }
  callWave(idx) {
    if (!this.canCallWave(idx)) return 0;
    const bonus = this.curWave ? this.callWaveBonus() : 0;
    const s = this.sides[idx]; s.ink += bonus; s.stats.calls++;
    s.emit({ t: 'call', ink: bonus });
    if (!this.curWave) this.waveT = 0; else this.startWave();
    return bonus;
  }
  timeToNextWave() { return this.curWave ? Math.max(0, this.curWave.dur - this.waveT) : Math.max(0, -this.waveT); }
  onLeak(side) {
    // sudden death: first leak loses — decided at the end of the tick so neither side is favoured by update order
    if (this.overtime > 0 && this.state === 'running') this.otLeaks[side.idx] = true;
  }
  finish(winner, reason) {
    if (this.state !== 'running') return;
    this.state = 'over'; this.winner = winner; this.endReason = reason;
    this.events.push({ t: 'end', winner, reason });
  }
  startWave() {
    this.wave++;
    const isOver = this.wave > this.finalWave;
    if (isOver) this.overtime++;
    this.curWave = this.overtime ? makeWave(this.wave, this.rng, this.mapDef, this.overtime) : this.getPlan(this.wave);
    this.spawnIdx = 0; this.waveT = 0;
    const bonus = 20 + 8 * this.wave;
    for (const s of this.sides) { s.ink += bonus; s.emit({ t: 'wave', w: this.wave, boss: this.curWave.isBoss, ink: bonus, overtime: this.overtime }); }
    if (!this.tutorial && !this.overtime && DRAFT_WAVES.includes(this.wave)) this.openDraft();
  }
  // ---------- blessing draft: every living side picks 1 of 3 before the wave's enemies arrive ----------
  openDraft() {
    this.draft = { w: this.wave, picks: {} }; this.drafts = (this.drafts || 0) + 1;
    for (const s of this.sides) { s.offers = s.dead ? null : s.rollOffers(); if (s.offers) s.emit({ t: 'draft', offers: s.offers }); }
    for (const s of this.sides) if (s.offers && s.autoPick) this.pickBoon(s.idx, s.chooseBoon()); // the CPU decides at once
    if (this.sides.every(s => !s.offers)) this.draft = null;
  }
  pickBoon(idx, choice) {
    const s = this.sides[idx];
    if (!this.draft || !s.offers || !s.offers[choice]) return false;
    const id = s.offers[choice]; s.offers = null;
    s.applyBoon(id); this.draft.picks[idx] = id;
    if (this.sides.every(x => !x.offers)) this.draft = null;
    return id;
  }
  rerollBoons(idx) {
    const s = this.sides[idx];
    if (!this.draft || !s.offers || s.rerolls <= 0) return false;
    s.rerolls--; s.offers = s.rollOffers(s.offers);
    return true;
  }
  update(dt) {
    if (this.state !== 'running') return;
    if (this.draft) {
      for (const s of this.sides) if (s.offers && s.autoPick) this.pickBoon(s.idx, s.chooseBoon());
      if (this.draft) return; // waiting for the player's pick
    }
    this.time += dt; this.tick++;
    if (!this.tutorialHold) {
      this.waveT += dt;
      if (!this.curWave) { if (this.waveT >= 0) this.startWave(); }
      else {
        while (this.spawnIdx < this.curWave.list.length && this.curWave.list[this.spawnIdx].at <= this.waveT) {
          const spec = this.curWave.list[this.spawnIdx++];
          // both sides grow stronger with every blessing, so later waves get a matching HP bump
          const sp = this.drafts ? { ...spec, hp: spec.hp * (1 + BOON_HP * this.drafts) } : spec;
          for (const s of this.sides) if (!s.dead) s.spawn(sp);
        }
        const allSpawned = this.spawnIdx >= this.curWave.list.length;
        if (this.wave >= this.finalWave && allSpawned) {
          // after the final wave: wait for the boards to clear, then judge
          const clear = this.sides.every(s => s.dead || !s.enemies.some(e => e.hp > 0));
          if (clear) {
            const [a, b] = this.sides;
            if (a.lives !== b.lives) this.finish(a.lives > b.lives ? 0 : 1, 'Survived the final wave with more lives');
            else this.startWave(); // overtime
          } else if (this.waveT >= this.curWave.dur + 200) {
            // enemies stuck too long (shouldn't happen) — compare lives / damage
            const [a, b] = this.sides; this.finish(a.lives > b.lives || (a.lives === b.lives && a.stats.dmg >= b.stats.dmg) ? 0 : 1, 'Time');
          }
        } else if (this.waveT >= this.curWave.dur) this.startWave();
      }
    }
    this.otLeaks = [false, false];
    for (const s of this.sides) s.update(dt);
    const [a, b] = this.sides;
    if (this.otLeaks[0] || this.otLeaks[1]) {
      if (this.otLeaks[0] && this.otLeaks[1]) this.finish(a.stats.dmg >= b.stats.dmg ? 0 : 1, 'Sudden death tie — more damage wins');
      else this.finish(this.otLeaks[0] ? 1 : 0, 'Sudden death!');
      return;
    }
    if (a.dead && b.dead) this.finish(a.stats.dmg >= b.stats.dmg ? 0 : 1, 'Both wards fell — more damage wins');
    else if (a.dead) this.finish(1, 'Your ward fell');
    else if (b.dead) this.finish(0, "The rival's ward fell");
  }
  score(sideIdx = 0) {
    const s = this.sides[sideIdx];
    return Math.round(Math.min(this.wave, this.finalWave + this.overtime) * 100 + s.lives * 60 + s.stats.kills * 2 + (this.winner === sideIdx ? 1000 : 0));
  }
}
