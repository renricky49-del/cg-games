// Pure game simulation (no DOM). Runs in the browser and headless in Node for balance tests.
import {
  RUSH_TIME, GRACE_TIME, PACE, MAX_BED, MAX_DOOR, bedIncome, bedCost, bedDoorReq,
  doorMaxHp, doorCost, repairCost, REPAIR_FRAC, REPAIR_CD,
  BUILDINGS, upgradeCost, totalSpent, turretStats, BOSSES, bossBase, BOSS_LVL_HP, BOSS_LVL_DMG, bossXpNeed,
  PERSONALITIES, AI_NAMES,
} from './data.js';
import { buildMap } from './map.js';
import { aiUpdate, aiPickRoom } from './ai.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
let NEXT_ID = 1;

export class Game {
  constructor(opts) {
    this.night = opts.night;               // NIGHTS entry or ENDLESS
    this.endless = !!opts.night.endless;
    this.perks = opts.perks || {};
    this.tutorial = !!opts.tutorial;
    this.autoPlayer = !!opts.autoPlayer;    // headless tests: player driven by AI
    this.rng = mulberry32(opts.seed || (Math.random() * 1e9) | 0);
    this.map = buildMap(opts.night.map || 0, this.rng);
    this.events = [];
    this.t = 0;                 // total elapsed
    this.phase = 'rush';        // rush | grace | night | won | lost
    this.phaseT = opts.rushTime || RUSH_TIME;
    this.nightLeft = opts.night.len;
    this.nightLen = opts.night.len;
    this.diff = opts.night.diff;
    this.enemies = [];
    this.projectiles = [];
    this.buildings = [];
    this.survivors = [];
    this.stats = { earned: 0, built: 0, repairs: 0, bossKilled: false, timeSurvived: 0, realTime: 0, wave: 1, minionsKilled: 0 };
    this.continueUsed = false;
    this.adRepairUsed = false;
    this.adScrapUses = 0;
    this.lostReason = '';
    this.bossWaves = 0;

    for (const r of this.map.rooms) {
      r.owner = null; r.alive = true; r.doorLvl = 1; r.bedLvl = 1; r.repairCd = 0;
      r.buildings = []; r.hitT = 99; r.attackers = 0; r.flash = 0;
      this._setDoorHpFull(r);
    }
    // survivors
    const names = AI_NAMES.filter((n) => n !== opts.playerName).sort(() => this.rng() - 0.5);
    const skins = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11'].filter((s) => s !== (opts.skin || 's0')).sort(() => this.rng() - 0.5);
    const cx = this.map.W / 2;
    const count = opts.aiCount != null ? opts.aiCount : 5;
    const pers = PERSONALITIES.slice().sort(() => this.rng() - 0.5);
    for (let i = 0; i <= count; i++) {
      const isPlayer = i === 0;
      const s = {
        id: NEXT_ID++, isPlayer, name: isPlayer ? 'You' : names[i % names.length],
        skin: isPlayer ? (opts.skin || 's0') : skins[(i - 1) % skins.length],
        x: cx + (i - count / 2) * 1.1 + (this.rng() - 0.5) * 0.4, y: 8.5 + (this.rng() - 0.5) * 0.8,
        dir: Math.PI / 2, speed: isPlayer ? 4.6 : 3.4 + this.rng() * 0.9,
        state: 'corridor', path: [], room: null, lying: false, scrap: 0, earnAcc: 0, earned: 0,
        pers: isPlayer ? PERSONALITIES[3] : pers[(i - 1) % pers.length],
        aiT: 0, goal: null, targetRoom: null, decideDelay: 0, walkT: 0, vx: 0, vy: 0, deadT: 0,
      };
      if (isPlayer) s.scrap = 25 * (this.perks.start || 0);
      if (!isPlayer) s.decideDelay = 0.4 + this.rng() * 2.5 * s.pers.react;
      this.survivors.push(s);
    }
    this.player = this.survivors[0];
    // boss
    const B = BOSSES[this.night.boss];
    this.boss = this._makeBoss(this.night.boss, this.diff);
    this.enemies.push(this.boss);
    this.bossDef = B;
  }

  emit(type, data) { this.events.push(Object.assign({ type }, data)); }

  // -------------------------------------------------------------- helpers
  doorMax(room) {
    const perk = room.owner && room.owner.isPlayer ? 1 + 0.1 * (this.perks.door || 0) : 1;
    return Math.round(doorMaxHp(room.doorLvl) * perk);
  }
  _setDoorHpFull(room) { const m = this.doorMax(room); for (const d of room.doors) d.hp = m; }
  income(s) {
    if (!s.room || s.state !== 'inroom') return 0;
    const r = s.room;
    let inc = s.lying ? bedIncome(r.bedLvl) : 0;
    if (s.isPlayer) inc *= 1 + 0.1 * (this.perks.bed || 0);
    for (const b of r.buildings) {
      if (b.type === 'vending' && b.disabledT <= 0) inc += BUILDINGS.vending.income * Math.pow(BUILDINGS.vending.incomeMul, b.lvl - 1);
    }
    return inc;
  }
  power(room) {
    let cap = 0, used = 0;
    for (const b of room.buildings) {
      const d = BUILDINGS[b.type];
      if (b.type === 'generator') cap += d.powerUp * b.lvl;
      else used += d.power;
    }
    return { cap, used };
  }
  repairCdMax(s) { return REPAIR_CD * (s && s.isPlayer ? 1 - 0.12 * (this.perks.fix || 0) : 1); }
  unlocked(type) {
    if (this.endless) return true;
    return BUILDINGS[type].unlock <= this.night.n;
  }
  minDoorFrac(room) {
    const m = this.doorMax(room);
    return Math.min(...room.doors.map((d) => d.hp)) / m;
  }

  // -------------------------------------------------------------- player/AI actions
  canBed(s) {
    const r = s.room; if (!r || !r.alive) return { ok: false, reason: 'No room' };
    if (r.bedLvl >= MAX_BED) return { ok: false, reason: 'Max level', max: true };
    const cost = bedCost(r.bedLvl), req = bedDoorReq(r.bedLvl + 1);
    if (r.doorLvl < req) return { ok: false, reason: `Needs Door Lv ${req}`, cost, req };
    if (s.scrap < cost) return { ok: false, reason: 'Not enough scrap', cost, poor: true };
    return { ok: true, cost };
  }
  upgradeBed(s = this.player) {
    const c = this.canBed(s); if (!c.ok) return c;
    s.scrap -= c.cost; s.room.bedLvl++;
    this.emit('upgrade', { what: 'bed', room: s.room, s, x: s.room.bed.x, y: s.room.bed.y, lvl: s.room.bedLvl });
    return c;
  }
  canDoor(s) {
    const r = s.room; if (!r || !r.alive) return { ok: false, reason: 'No room' };
    if (r.doorLvl >= MAX_DOOR) return { ok: false, reason: 'Max level', max: true };
    const cost = doorCost(r.doorLvl);
    if (s.scrap < cost) return { ok: false, reason: 'Not enough scrap', cost, poor: true };
    return { ok: true, cost };
  }
  upgradeDoor(s = this.player) {
    const c = this.canDoor(s); if (!c.ok) return c;
    s.scrap -= c.cost; s.room.doorLvl++; this._setDoorHpFull(s.room);
    for (const d of s.room.doors) this.emit('upgrade', { what: 'door', room: s.room, s, x: d.tx + 0.5, y: d.ty + 0.5, lvl: s.room.doorLvl });
    return c;
  }
  canRepair(s) {
    const r = s.room; if (!r || !r.alive) return { ok: false, reason: 'No room' };
    const cost = repairCost(r.doorLvl);
    if (r.repairCd > 0) return { ok: false, reason: 'Cooling down', cost, cd: r.repairCd };
    if (this.minDoorFrac(r) >= 0.999) return { ok: false, reason: 'Door is full', cost, full: true };
    if (s.scrap < cost) return { ok: false, reason: 'Not enough scrap', cost, poor: true };
    return { ok: true, cost };
  }
  repairDoor(s = this.player) {
    const c = this.canRepair(s); if (!c.ok) return c;
    const r = s.room, m = this.doorMax(r);
    s.scrap -= c.cost; r.repairCd = this.repairCdMax(s);
    for (const d of r.doors) {
      d.hp = Math.min(m, d.hp + m * REPAIR_FRAC);
      this.emit('repair', { room: r, s, x: d.tx + 0.5, y: d.ty + 0.5 });
    }
    if (s.isPlayer) this.stats.repairs++;
    return c;
  }
  fullRepair(s = this.player) { // rewarded ad
    const r = s.room; if (!r || !r.alive) return;
    this._setDoorHpFull(r);
    for (const d of r.doors) this.emit('repair', { room: r, s, x: d.tx + 0.5, y: d.ty + 0.5, big: true });
  }
  tileFree(room, tx, ty) {
    if (!room.tiles.find((t) => t.tx === tx && t.ty === ty)) return false;
    return !room.buildings.find((b) => b.tx === tx && b.ty === ty);
  }
  canBuild(s, type, tx, ty) {
    const r = s.room; if (!r || !r.alive || s.state !== 'inroom') return { ok: false, reason: 'No room' };
    const d = BUILDINGS[type];
    if (!this.unlocked(type)) return { ok: false, reason: `Unlocks on Night ${d.unlock}`, locked: true, cost: d.cost };
    if (tx != null && !this.tileFree(r, tx, ty)) return { ok: false, reason: 'Tile occupied', cost: d.cost };
    if (d.power > 0) {
      const p = this.power(r);
      if (p.used + d.power > p.cap) return { ok: false, reason: `Needs ${d.power} power`, cost: d.cost, power: true };
    }
    if (s.scrap < d.cost) return { ok: false, reason: 'Not enough scrap', cost: d.cost, poor: true };
    return { ok: true, cost: d.cost };
  }
  build(s, type, tx, ty) {
    const c = this.canBuild(s, type, tx, ty); if (!c.ok) return c;
    s.scrap -= c.cost;
    const b = { id: NEXT_ID++, type, lvl: 1, tx, ty, x: tx + 0.5, y: ty + 0.5, room: s.room, cd: 0.3, angle: s.room.top ? Math.PI / 2 : -Math.PI / 2, disabledT: 0, flash: 0, pop: 1 };
    s.room.buildings.push(b); this.buildings.push(b);
    if (s.isPlayer) this.stats.built++;
    this.emit('build', { b, s, x: b.x, y: b.y });
    return c;
  }
  canUpgradeB(s, b) {
    const d = BUILDINGS[b.type];
    if (b.lvl >= d.maxLvl) return { ok: false, reason: 'Max level', max: true };
    const cost = upgradeCost(b.type, b.lvl);
    if (s.scrap < cost) return { ok: false, reason: 'Not enough scrap', cost, poor: true };
    return { ok: true, cost };
  }
  upgradeBuilding(s, b) {
    const c = this.canUpgradeB(s, b); if (!c.ok) return c;
    s.scrap -= c.cost; b.lvl++; b.pop = 1;
    this.emit('upgrade', { what: 'building', b, s, x: b.x, y: b.y, lvl: b.lvl });
    return c;
  }
  canSell(s, b) {
    if (b.type === 'generator') {
      const p = this.power(b.room);
      if (p.used > p.cap - BUILDINGS.generator.powerUp * b.lvl) return { ok: false, reason: 'Power in use' };
    }
    return { ok: true, refund: Math.floor(totalSpent(b.type, b.lvl) * 0.5) };
  }
  sellBuilding(s, b) {
    const c = this.canSell(s, b); if (!c.ok) return c;
    s.scrap += c.refund;
    this._removeBuilding(b);
    this.emit('sell', { x: b.x, y: b.y, s, refund: c.refund });
    return c;
  }
  _removeBuilding(b) {
    b.room.buildings = b.room.buildings.filter((o) => o !== b);
    this.buildings = this.buildings.filter((o) => o !== b);
  }
  lieDown(s = this.player) {
    if (s.state === 'inroom' && !s.lying && !s.path.length) {
      s.lying = true; s.x = s.room.bed.x; s.y = s.room.bed.y;
      this.emit('lie', { s });
    } else if (s.state === 'inroom' && s.path.length) {
      s.wantLie = true;
    }
  }
  adScrapAmount() { return Math.max(150, Math.round(this.income(this.player) * 40)); }
  grantScrap(s, n) { s.scrap += n; s.earned += n; if (s.isPlayer) this.stats.earned += n; this.emit('float', { x: s.x, y: s.y - 0.6, text: '+' + fmt(n), color: '#ffd84a', big: true }); }

  // movement during rush
  goToRoom(s, room) {
    if (s.state !== 'corridor' || this.phase === 'lost' || this.phase === 'won') return false;
    if (room.owner) return false;
    let best = room.doors[0], bd = 1e9;
    for (const d of room.doors) { const dd = dist(s.x, s.y, d.fx, d.fy); if (dd < bd) { bd = dd; best = d; } }
    s.targetRoom = room; s.targetDoor = best;
    s.path = [{ x: best.fx, y: best.fy, claim: true }, { x: best.ix, y: best.iy }, { x: room.bed.x, y: room.bed.y, bed: true }];
    return true;
  }
  moveTo(s, x, y) {
    if (s.state !== 'corridor') return;
    const c = this.map.corridor;
    x = Math.max(1.4, Math.min(c.x1 - 0.4, x)); y = Math.max(c.y0 + 0.4, Math.min(c.y1 - 0.4, y));
    s.path = [{ x, y }]; s.targetRoom = null;
  }

  // -------------------------------------------------------------- update
  step(dt) {
    if (this.phase === 'won' || this.phase === 'lost') return;
    this.t += dt;
    if (this.phase === 'rush') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this._endRush();
    } else if (this.phase === 'grace') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this._wakeBoss();
    } else if (this.phase === 'night') {
      this.stats.timeSurvived += dt;
      if (!this.endless) {
        this.nightLeft -= dt;
        if (this.nightLeft <= 0) { this._win(false); return; }
      }
    }
    for (const s of this.survivors) this._updSurvivor(s, dt);
    for (const r of this.map.rooms) {
      if (r.repairCd > 0) r.repairCd -= dt;
      r.hitT += dt; if (r.flash > 0) r.flash -= dt;
      for (const d of r.doors) { if (d.shake > 0) d.shake -= dt; }
      if (r.alive && r.owner && r.owner.state === 'inroom') {
        for (const b of r.buildings) {
          if (b.type === 'bench' && b.disabledT <= 0) {
            const m = this.doorMax(r), d = BUILDINGS.bench;
            for (const door of r.doors) door.hp = Math.min(m, door.hp + m * (d.heal + d.healUp * (b.lvl - 1)) * dt);
          }
        }
      }
    }
    this._updBuildings(dt);
    this._updEnemies(dt);
    this._updProjectiles(dt);
  }

  _updSurvivor(s, dt) {
    if (s.state === 'dead') { s.deadT += dt; return; }
    // AI brain
    if ((!s.isPlayer || this.autoPlayer)) aiUpdate(this, s, dt);
    // follow path
    if (s.path.length) {
      const p = s.path[0];
      const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
      const step = s.speed * dt;
      s.walkT += dt;
      if (d > 0.01) s.dir = Math.atan2(dy, dx);
      if (d <= step) {
        s.x = p.x; s.y = p.y; s.path.shift();
        if (p.claim) {
          const room = s.targetRoom;
          if (room.owner || s.state !== 'corridor' || this.phase !== 'rush') {
            s.path = []; s.targetRoom = null; // taken: think again
            if (!s.isPlayer) s.decideDelay = 0.2;
            else this.emit('toast', { text: 'Room taken! Pick another.' });
          } else {
            room.owner = s; s.room = room; s.state = 'entering';
            this._setDoorHpFull(room);
            this.emit('claim', { room, s });
          }
        }
        if (p.bed) {
          s.state = 'inroom';
          s.dir = room_dir(s.room);
          if (!s.isPlayer || !this.tutorial || s.wantLie || this.autoPlayer) { s.lying = true; this.emit('lie', { s }); }
        }
      } else {
        s.x += (dx / d) * step; s.y += (dy / d) * step;
      }
    } else if (s.state === 'corridor' && (s.vx || s.vy)) {
      // keyboard movement in corridor
      const c = this.map.corridor;
      s.x = Math.max(1.4, Math.min(c.x1 - 0.4, s.x + s.vx * s.speed * dt));
      s.y = Math.max(c.y0 + 0.35, Math.min(c.y1 - 0.35, s.y + s.vy * s.speed * dt));
      s.dir = Math.atan2(s.vy, s.vx); s.walkT += dt;
      // walking into a free door enters the room
      for (const r of this.map.rooms) {
        if (r.owner) continue;
        for (const d of r.doors) {
          if (Math.abs(s.x - d.fx) < 0.6 && Math.abs(s.y - d.fy) < 0.5 && ((r.top && s.vy < 0) || (!r.top && s.vy > 0))) {
            this.goToRoom(s, r); s.path[0] = { x: d.fx, y: d.fy, claim: true };
            s.targetRoom = r; return;
          }
        }
      }
    }
    if (s.state === 'inroom') {
      const inc = this.income(s);
      if (inc > 0 && s.room.alive) {
        const g = inc * dt;
        s.scrap += g; s.earned += g; s.earnAcc += g;
        if (s.isPlayer) this.stats.earned += g;
        s.payT = (s.payT || 0) + dt;
        if (s.payT >= 1) {
          s.payT -= 1;
          if (s.earnAcc >= 1) this.emit('coins', { s, x: s.room.bed.x, y: s.room.bed.y - 0.6, n: Math.floor(s.earnAcc) });
          s.earnAcc -= Math.floor(s.earnAcc);
        }
      }
    }
  }

  _endRush() {
    for (const s of this.survivors) {
      if (s.state === 'corridor' || (s.state !== 'inroom' && s.state !== 'entering' && s.state !== 'dead')) {
        this._eliminate(s, 'corridor');
      }
    }
    if (this.phase === 'lost') return;
    // unclaimed rooms: doors swing shut and stay empty
    this.phase = 'grace'; this.phaseT = GRACE_TIME;
    this.emit('phase', { phase: 'grace' });
  }

  _eliminate(s, why) {
    if (s.state === 'dead') return;
    s.state = 'dead'; s.lying = false; s.deadT = 0; s.path = [];
    this.emit('death', { s, why, x: s.x, y: s.y });
    if (s.isPlayer) {
      this.phase = 'lost';
      this.lostReason = why === 'corridor' ? 'You were caught in the hallway!' : 'Your door was broken!';
      this.emit('lose', { why });
      return;
    }
    s.minionPending = true;
    if (this.phase === 'night') this._spawnMinionFrom(s);
  }

  _makeBoss(kind, diff) {
    const B = BOSSES[kind], base = bossBase(diff);
    const hp = base.hp * B.hp;
    return {
      id: NEXT_ID++, kind: 'boss', variant: kind, sprite: B.sprite, name: B.name,
      x: this.map.lair.sx, y: this.map.lair.sy, hp, maxHp: hp, dmg: base.dmg * B.dmg, baseSpeed: B.speed,
      state: 'sleep', target: null, atkCd: 1, lvl: 1, xp: 0, r: 0.8, dir: 0, slow: 0, hitFlash: 0,
      recentDmg: 0, switchT: 4, abilityT: 8, howlT: 18, retreats: 0, chargeMul: 1, charging: false, walkT: 0,
      armor: !!B.armor, def: B, alive: true, pause: 0,
    };
  }

  _wakeBoss() {
    this.phase = 'night';
    this.emit('phase', { phase: 'night' });
    this.boss.state = 'seek';
    this.emit('bossWake', { boss: this.boss });
    for (const s of this.survivors) if (s.minionPending) this._spawnMinionFrom(s);
  }

  _spawnMinionFrom(s) {
    s.minionPending = false;
    const ref = this.boss.alive ? this.boss : { maxHp: bossBase(this.diff).hp, dmg: bossBase(this.diff).dmg };
    const m = this._makeMinion(s.x, s.y, ref, 0.2, 0.22, 'minion' + (parseInt(s.skin.slice(1), 10) % 4));
    m.rise = 1.2;
    this.emit('minionSpawn', { m, x: m.x, y: m.y });
  }
  _makeMinion(x, y, ref, hpF, dmgF, sprite) {
    const hp = ref.maxHp * hpF;
    const m = {
      id: NEXT_ID++, kind: 'minion', sprite, x, y, hp, maxHp: hp, dmg: ref.dmg * dmgF, baseSpeed: 1.25 + this.rng() * 0.3,
      state: 'seek', target: null, atkCd: 1, r: 0.4, dir: 0, slow: 0, hitFlash: 0, walkT: this.rng() * 5, alive: true, rise: 0,
      off: (this.rng() - 0.5) * 0.7, pause: 0,
    };
    this.enemies.push(m);
    return m;
  }

  _doorTargets() {
    const out = [];
    for (const r of this.map.rooms) {
      if (!r.alive || !r.owner || r.owner.state !== 'inroom') continue;
      for (const d of r.doors) out.push({ room: r, door: d });
    }
    return out;
  }

  // defensive firepower that can reach a door front
  doorDefense(door) {
    let dps = 0;
    for (const b of this.buildings) {
      const D = BUILDINGS[b.type];
      if (D.kind !== 'turret' || !b.room.alive) continue;
      const st = turretStats(b.type, b.lvl, b.room.owner && b.room.owner.isPlayer ? this.perks : null);
      if (dist(b.x, b.y, door.fx, door.fy) <= st.range) dps += st.dmg * st.rate;
    }
    return dps;
  }

  _pickBossTarget(e, exclude) {
    const opts = this._doorTargets().filter((o) => !exclude || o.room !== exclude);
    if (!opts.length) return null;
    let best = null, bs = 1e9;
    for (const o of opts) {
      const m = this.doorMax(o.room);
      const frac = o.door.hp / m;
      const def = this.doorDefense(o.door) / Math.max(1, e.maxHp / 25); // how fast turrets here kill me
      const ttb = o.door.hp / Math.max(1, e.dmg); // hits to break
      let s = ttb * 0.06 + frac * 0.8 + def * 0.9 + dist(e.x, e.y, o.door.fx, o.door.fy) * 0.02 + this.rng() * 0.6;
      if (this.tutorial && o.room.owner.isPlayer && this.stats.timeSurvived < 70) s += 5;
      if (this.night.n === 2 && o.room.owner.isPlayer && this.stats.timeSurvived < 30) s += 2;
      if (s < bs) { bs = s; best = o; }
    }
    return best;
  }

  _updEnemies(dt) {
    const alive = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      alive.push(e);
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.rise > 0) { e.rise -= dt; continue; }
      if (e.state === 'sleep') continue;
      if (e.pause > 0) { e.pause -= dt; continue; }
      // slow from chill traps
      let slow = 0;
      for (const b of this.buildings) {
        if (b.type !== 'freezer' || b.disabledT > 0 || !b.room.alive) continue;
        const D = BUILDINGS.freezer;
        if (dist(b.x, b.y, e.x, e.y) <= D.range + D.rangeUp * (b.lvl - 1)) slow = Math.max(slow, Math.min(D.slowMax, D.slow + D.slowUp * (b.lvl - 1)));
      }
      e.slow = slow;
      const spd = e.baseSpeed * (1 - slow) * (e.charging ? 3.6 : 1);
      if (e.kind === 'boss') this._bossBrain(e, dt, spd);
      else this._minionBrain(e, dt, spd);
    }
    this.enemies = alive;
  }

  _walkTo(e, x, y, spd, dt) {
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy);
    if (d < 0.05) return true;
    const st = Math.min(d, spd * dt);
    e.x += (dx / d) * st; e.y += (dy / d) * st; e.dir = Math.atan2(dy, dx); e.walkT += dt * spd;
    return d - st < 0.05;
  }

  _attackPos(e, t) {
    const off = e.kind === 'boss' ? (e.def.acid && !e.def.charge ? 0.45 : 0.25) + e.r * 0.5 : 0.35;
    const sign = t.room.top ? 1 : -1;
    return { x: t.door.fx + (e.off || 0), y: t.door.fy + sign * off };
  }

  _bossBrain(e, dt, spd) {
    e.recentDmg *= Math.pow(0.85, dt);
    e.xp += dt * 0.08;
    this._checkLevel(e);
    if (e.state === 'retreat') {
      if (this._walkTo(e, this.map.lair.sx, this.map.lair.sy, spd * 1.15, dt)) { e.state = 'heal'; this.emit('bossHeal', { e }); }
      return;
    }
    if (e.state === 'heal') {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.07 * dt);
      if (e.hp >= e.maxHp * 0.85) { e.state = 'seek'; e.target = null; this.emit('bossReturn', { e }); }
      return;
    }
    // retreat when badly hurt
    if (e.hp < e.maxHp * 0.28 && e.retreats < (this.night.n >= 6 || this.endless ? 2 : 1)) {
      e.retreats++; e.state = 'retreat'; e.charging = false; e.target = null;
      this.emit('bossRetreat', { e });
      return;
    }
    // abilities
    if (e.def.howl) {
      e.howlT -= dt;
      if (e.howlT <= 0) {
        e.howlT = 24;
        for (let i = 0; i < 2; i++) {
          const m = this._makeMinion(this.map.lair.sx + (this.rng() - 0.5), this.map.lair.sy + (this.rng() - 0.5) * 2, e, 0.1, 0.18, 'minion' + Math.floor(this.rng() * 4));
          m.rise = 0.8;
        }
        this.emit('howl', { e, x: e.x, y: e.y });
      }
    }
    if (e.state === 'seek' || !e.target || !e.target.room.alive || !e.target.room.owner || e.target.room.owner.state === 'dead') {
      if (!e.target || !e.target.room.alive || e.state !== 'walk') {
        e.target = this._pickBossTarget(e);
        if (!e.target) { e.state = 'idle'; this._walkTo(e, this.map.W / 2, 8.5, spd, dt); return; }
        e.state = 'walk';
      }
    }
    const t = e.target, ap = this._attackPos(e, t);
    if (e.state === 'walk') {
      if (this._walkTo(e, ap.x, ap.y, spd, dt)) { e.state = 'attack'; e.atkCd = e.charging ? 0.1 : 0.6; e.switchT = 5; }
      return;
    }
    if (e.state === 'attack') {
      e.dir = t.room.top ? -Math.PI / 2 : Math.PI / 2;
      e.atkCd -= dt * (1 - e.slow * 0.5);
      if (e.atkCd <= 0) {
        e.atkCd = 1.15;
        let dmg = e.dmg;
        if (e.charging) { dmg *= 3; e.charging = false; this.emit('chargeHit', { e, x: t.door.fx, y: t.door.fy }); }
        this._hitDoor(e, t, dmg);
        if (!t.room.alive) return;
      }
      // spitter acid: jam a gadget in the room
      if (e.def.acid) {
        e.abilityT -= dt;
        if (e.abilityT <= 0) {
          e.abilityT = 11;
          const list = t.room.buildings.filter((b) => b.disabledT <= 0);
          if (list.length) {
            const b = list[Math.floor(this.rng() * list.length)];
            b.disabledT = 5;
            this.emit('acid', { e, b, x: e.x, y: e.y, tx: b.x, ty: b.y });
          }
        }
      }
      // charger: dash to another door
      if (e.def.charge) {
        e.chargeT = (e.chargeT == null ? 9 : e.chargeT) - dt;
        if (e.chargeT <= 0) {
          e.chargeT = 15;
          const nt = this._pickBossTarget(e, t.room);
          if (nt) { e.target = nt; e.state = 'walk'; e.charging = true; this.emit('charge', { e, x: e.x, y: e.y }); return; }
        }
      }
      // switch away from heavily defended doors
      e.switchT -= dt;
      if (e.switchT <= 0) {
        e.switchT = 3;
        const frac = t.door.hp / this.doorMax(t.room);
        if (e.recentDmg > e.maxHp * 0.16 && frac > 0.35 && this.rng() < 0.55) {
          const nt = this._pickBossTarget(e, t.room);
          if (nt) { e.target = nt; e.state = 'walk'; this.emit('bossSwitch', { e }); }
        }
      }
    }
  }

  _minionBrain(e, dt, spd) {
    if (!e.target || !e.target.room.alive || !e.target.room.owner || e.target.room.owner.state === 'dead') {
      const opts = this._doorTargets();
      if (!opts.length) { e.state = 'idle'; return; }
      let best = null, bd = 1e9;
      for (const o of opts) { const d = dist(e.x, e.y, o.door.fx, o.door.fy) + this.rng() * 6; if (d < bd) { bd = d; best = o; } }
      e.target = best; e.state = 'walk';
    }
    const t = e.target, ap = this._attackPos(e, t);
    if (e.state === 'walk') {
      if (this._walkTo(e, ap.x, ap.y, spd, dt)) { e.state = 'attack'; e.atkCd = 0.8; }
      return;
    }
    e.dir = t.room.top ? -Math.PI / 2 : Math.PI / 2;
    e.atkCd -= dt * (1 - e.slow * 0.5);
    if (e.atkCd <= 0) { e.atkCd = 1.0; this._hitDoor(e, t, e.dmg); }
  }

  _hitDoor(e, t, dmg) {
    const r = t.room;
    t.door.hp -= dmg; t.door.shake = 0.25; r.hitT = 0; r.flash = 0.15;
    e.lunge = 0.3;
    this.emit('doorHit', { room: r, door: t.door, dmg, e, x: t.door.tx + 0.5, y: t.door.ty + 0.5, player: r.owner && r.owner.isPlayer });
    if (e.kind === 'boss') { e.xp += 1; this._checkLevel(e); }
    // spikes reflect
    for (const b of r.buildings) {
      if (b.type === 'spikes' && b.disabledT <= 0) {
        const D = BUILDINGS.spikes;
        this._damage(e, dmg * (D.reflect + D.reflectUp * (b.lvl - 1)), r, 'spike');
      }
    }
    if (t.door.hp <= 0) { t.door.hp = 0; this._breakRoom(r, e); }
  }

  _breakRoom(r, e) {
    const s = r.owner;
    if (s && s.isPlayer) {
      r.brokenBy = e;
      this.emit('doorBreak', { room: r, x: r.doors[0].tx + 0.5, y: r.doors[0].ty + 0.5, player: true });
      this._eliminate(s, 'door');
      return;
    }
    r.alive = false;
    this.emit('doorBreak', { room: r, x: r.doors[0].tx + 0.5, y: r.doors[0].ty + 0.5 });
    const nb = r.buildings.length;
    for (const b of r.buildings.slice()) { this._removeBuilding(b); this.emit('destroyed', { x: b.x, y: b.y }); }
    r.rubble = true;
    if (s) {
      // the survivor falls; rises as a minion a moment later
      s.x = r.doors[0].fx; s.y = r.doors[0].fy;
      this._eliminate(s, 'door');
    }
    const boss = this.boss;
    if (boss.alive) { boss.xp += 8 + nb; this._checkLevel(boss); }
    if (e.kind === 'boss') { e.pause = 1.2; e.state = 'seek'; e.target = null; }
  }

  _checkLevel(e) {
    while (e.xp >= bossXpNeed(e.lvl)) {
      e.xp -= bossXpNeed(e.lvl); e.lvl++;
      const oldMax = e.maxHp;
      e.maxHp *= BOSS_LVL_HP; e.dmg *= BOSS_LVL_DMG;
      e.hp = Math.min(e.maxHp, e.hp * (e.maxHp / oldMax) + e.maxHp * 0.15);
      e.r = Math.min(1.25, 0.8 + 0.035 * (e.lvl - 1));
      this.emit('bossLevel', { e, lvl: e.lvl, x: e.x, y: e.y });
    }
  }

  continueAfterLoss() {
    // rewarded "continue": the player's door is rebuilt and the boss is knocked back
    const s = this.player, r = s.room;
    if (!r || this.phase !== 'lost' || this.continueUsed) return false;
    this.continueUsed = true;
    s.state = 'inroom'; s.lying = true; s.x = r.bed.x; s.y = r.bed.y;
    const m = this.doorMax(r);
    for (const d of r.doors) d.hp = m * 0.75;
    for (const e of this.enemies) {
      if (e.target && e.target.room === r) {
        if (e.kind === 'boss') { e.state = 'retreat'; e.target = null; e.retreats = Math.max(0, e.retreats - 1); }
        else { e.alive = false; this.emit('kill', { e, x: e.x, y: e.y }); }
      }
    }
    this.phase = 'night'; this.lostReason = '';
    this.emit('continue', {});
    return true;
  }

  _updBuildings(dt) {
    for (const b of this.buildings) {
      if (b.pop > 0) b.pop = Math.max(0, b.pop - dt * 3);
      if (b.flash > 0) b.flash -= dt;
      if (b.disabledT > 0) { b.disabledT -= dt; continue; }
      const D = BUILDINGS[b.type];
      if (D.kind !== 'turret' || !b.room.alive || this.phase !== 'night') continue;
      const owner = b.room.owner;
      const st = turretStats(b.type, b.lvl, owner && owner.isPlayer ? this.perks : null);
      // signal tower boost
      let boost = 0;
      for (const o of b.room.buildings) {
        if (o.type === 'radio' && o.disabledT <= 0) {
          const R = BUILDINGS.radio;
          if (dist(o.x, o.y, b.x, b.y) <= R.range + R.rangeUp * (o.lvl - 1)) boost = Math.max(boost, R.boost + R.boostUp * (o.lvl - 1));
        }
      }
      b.cd -= dt * (1 + boost);
      // targeting: prefer enemies hitting my room, then the boss, then nearest
      let tgt = null, ts = 1e9;
      for (const e of this.enemies) {
        if (!e.alive || e.rise > 0) continue;
        const d = dist(b.x, b.y, e.x, e.y);
        if (d > st.range + e.r * 0.5) continue;
        let s = d;
        if (e.target && e.target.room === b.room) s -= 10;
        if (e.kind === 'boss') s -= 3;
        if (s < ts) { ts = s; tgt = e; }
      }
      if (!tgt) continue;
      const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
      b.angle = lerpAngle(b.angle, want, Math.min(1, dt * 14));
      if (b.cd > 0) continue;
      b.cd = 1 / st.rate; b.flash = 0.08;
      if (D.proj === 'zap') {
        const pts = [{ x: b.x, y: b.y }];
        const hit = new Set();
        let cur = tgt, dmg = st.dmg;
        for (let i = 0; i < D.chain && cur; i++) {
          hit.add(cur); pts.push({ x: cur.x, y: cur.y });
          this._damage(cur, dmg, b.room, 'zap');
          dmg *= 0.7;
          let nx = null, nd = 3.2;
          for (const e of this.enemies) { if (!e.alive || hit.has(e)) continue; const d2 = dist(cur.x, cur.y, e.x, e.y); if (d2 < nd) { nd = d2; nx = e; } }
          cur = nx;
        }
        this.emit('zap', { pts, b, x: b.x, y: b.y });
      } else if (D.proj === 'flame') {
        // burns every enemy inside the range at once
        for (const e of this.enemies) {
          if (!e.alive || e.rise > 0) continue;
          if (dist(b.x, b.y, e.x, e.y) <= st.range + e.r * 0.5) this._damage(e, st.dmg, b.room, 'flame', false, true);
        }
        this.emit('flame', { b, x: b.x, y: b.y, tx: tgt.x, ty: tgt.y, angle: want, player: owner && owner.isPlayer });
      } else if (D.proj === 'shell') {
        // lobbed shell: flies to where the target is now, splashes on landing
        const d0 = dist(b.x, b.y, tgt.x, tgt.y);
        this.projectiles.push({ x: b.x, y: b.y, sx: b.x, sy: b.y, tx: tgt.x, ty: tgt.y, d0, sp: 7, target: tgt, dmg: st.dmg, type: 'shell', room: b.room, splash: D.splash, life: 3 });
        this.emit('shoot', { b, type: 'shell', x: b.x, y: b.y, angle: want, player: owner && owner.isPlayer });
      } else {
        const sp = D.proj === 'bolt' ? 15 : 13;
        this.projectiles.push({ x: b.x + Math.cos(want) * 0.35, y: b.y + Math.sin(want) * 0.35, sp, target: tgt, dmg: st.dmg, type: D.proj, room: b.room, pierce: !!D.pierce, life: 2 });
        this.emit('shoot', { b, type: D.proj, x: b.x, y: b.y, angle: want, player: owner && owner.isPlayer });
      }
    }
  }

  _updProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.life -= dt;
      if (p.type === 'shell') {
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d <= p.sp * dt || p.life <= 0) {
          for (const e of this.enemies) if (e.alive && e.rise <= 0 && dist(p.tx, p.ty, e.x, e.y) <= p.splash + e.r * 0.5) this._damage(e, p.dmg, p.room, 'shell');
          this.emit('boom', { x: p.tx, y: p.ty, r: p.splash, player: p.room && p.room.owner && p.room.owner.isPlayer });
          continue;
        }
        p.x += (dx / d) * p.sp * dt; p.y += (dy / d) * p.sp * dt;
        p.prog = 1 - d / Math.max(0.01, p.d0);
        keep.push(p);
        continue;
      }
      const t = p.target;
      if (!t.alive || p.life <= 0) continue;
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      p.angle = Math.atan2(dy, dx);
      if (d <= p.sp * dt + t.r * 0.6) {
        this._damage(t, p.dmg, p.room, p.type, p.pierce);
        continue;
      }
      p.x += (dx / d) * p.sp * dt; p.y += (dy / d) * p.sp * dt;
      keep.push(p);
    }
    this.projectiles = keep;
  }

  _damage(e, dmg, room, src, pierce, quiet) {
    if (!e.alive) return;
    if (e.armor && !pierce && src !== 'spike') dmg *= 0.5;
    e.hp -= dmg; if (!quiet || e.hitFlash <= 0) e.hitFlash = 0.08;
    if (e.kind === 'boss') e.recentDmg += dmg;
    this.emit('hit', { e, dmg, x: e.x, y: e.y, src, player: room && room.owner && room.owner.isPlayer });
    if (e.hp <= 0) {
      e.alive = false; e.hp = 0;
      this.emit('kill', { e, x: e.x, y: e.y });
      if (e.kind === 'boss') {
        this.stats.bossKilled = true;
        if (this.endless) this._nextWave();
        else this._win(true);
      } else {
        this.stats.minionsKilled++;
        // bounty to the room that landed the kill
        if (room && room.owner && room.owner.state === 'inroom') {
          const n = Math.round(bedIncome(room.bedLvl) * 6);
          room.owner.scrap += n; room.owner.earned += n;
          if (room.owner.isPlayer) { this.stats.earned += n; this.emit('float', { x: e.x, y: e.y - 0.5, text: '+' + fmt(n), color: '#ffd84a' }); }
        }
      }
    }
  }

  _nextWave() {
    this.bossWaves++;
    this.stats.wave = this.bossWaves + 1;
    this.emit('waveCleared', { wave: this.bossWaves });
    const kinds = Object.keys(BOSSES);
    const kind = kinds[Math.min(kinds.length - 1, Math.floor(this.bossWaves / 1.5)) % kinds.length];
    this.diff *= 1.55;
    const b = this._makeBoss(kind, this.diff);
    b.state = 'sleep'; b.pause = 0;
    this.boss = b; this.bossDef = BOSSES[kind];
    this.enemies.push(b);
    // short breather, then it wakes
    this.waveT = 12;
    const wake = () => { b.state = 'seek'; this.emit('bossWake', { boss: b }); };
    this._pendingWake = { t: 12, fn: wake };
  }

  _win(killed) {
    this.phase = 'won';
    this.stats.bossKilled = killed;
    this.emit('win', { killed });
  }

  tick(dt) { // wrapper: applies the game pace (not during the rush) and the endless wake timer
    if (this.phase === 'night') this.stats.realTime += dt;
    if (this.phase !== 'rush') dt *= PACE;
    if (this._pendingWake) {
      this._pendingWake.t -= dt;
      if (this._pendingWake.t <= 0) { const f = this._pendingWake.fn; this._pendingWake = null; f(); }
    }
    this.step(dt);
  }

  aliveSurvivors() { return this.survivors.filter((s) => s.state !== 'dead').length; }

  results() {
    const won = this.phase === 'won';
    const alive = this.aliveSurvivors();
    let stars = 0;
    if (won) {
      stars = 1;
      if (alive >= 4 || this.stats.bossKilled) stars = 2;
      if (this.stats.bossKilled) stars = 3;
    }
    return {
      won, stars, alive, killed: this.stats.bossKilled, earned: Math.floor(this.stats.earned),
      time: this.stats.timeSurvived, bossLvl: this.boss.lvl, built: this.stats.built,
      wave: this.stats.wave, realTime: this.stats.realTime, minions: this.stats.minionsKilled, reason: this.lostReason,
    };
  }
}

function room_dir(room) { return room.top ? Math.PI / 2 : -Math.PI / 2; }
function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace(/\.0+$/, '') + 'M';
  return (n / 1e9).toFixed(2) + 'B';
}
export { aiPickRoom };
