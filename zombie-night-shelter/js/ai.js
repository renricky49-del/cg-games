// Scripted survivor AI. Each survivor has a personality (weights) and a reaction speed.
import { BUILDINGS, upgradeCost, bedIncome } from './data.js';

export function aiPickRoom(g, s) {
  let best = null, bs = -1e9;
  const targeted = new Set(g.survivors.filter((o) => o !== s && o.targetRoom).map((o) => o.targetRoom));
  for (const r of g.map.rooms) {
    if (r.owner) continue;
    const d = Math.min(...r.doors.map((dd) => Math.hypot(dd.fx - s.x, dd.fy - s.y)));
    let sc = r.size * 0.12 + r.support * 0.22 + g.rng() * 2.4 - d * 0.09;
    if (targeted.has(r)) sc -= 3;
    if (d / s.speed > g.phaseT - 1) sc -= 10; // can't make it
    if (sc > bs) { bs = sc; best = r; }
  }
  return best;
}

function nearDoorTiles(g, r) {
  const free = r.tiles.filter((t) => g.tileFree(r, t.tx, t.ty));
  const dd = (t) => Math.min(...r.doors.map((d) => Math.hypot(t.tx + 0.5 - d.fx, t.ty + 0.5 - d.fy)));
  return free.sort((a, b) => dd(a) - dd(b));
}

function chooseGoal(g, s) {
  const r = s.room, P = s.pers;
  const inc = Math.max(1, g.income(s));
  const night = g.phase === 'night';
  const boss = g.boss;
  const threat = boss && boss.alive ? (boss.dmg * 25) / g.doorMax(r) : 0.5; // >1 means boss breaks door in <25 hits
  const targeted = boss && boss.target && boss.target.room === r;
  const C = [];
  const val = (w, cost) => (w * (0.65 + g.rng() * 0.7)) / (1 + cost / (inc * 30));

  const cb = g.canBed(s);
  if (!cb.max && cb.cost != null) {
    if (cb.req) C.push({ kind: 'door', cost: g.canDoor(s).cost, v: val(P.bed * 0.9 + P.door, g.canDoor(s).cost || 1e9) });
    else C.push({ kind: 'bed', cost: cb.cost, v: val(P.bed * (night ? 1 : 1.8), cb.cost) });
  }
  const cd = g.canDoor(s);
  if (!cd.max) C.push({ kind: 'door', cost: cd.cost, v: val(P.door * (0.5 + threat * 1.4) * (targeted ? 1.6 : 1), cd.cost) });

  // turrets
  const turrets = r.buildings.filter((b) => BUILDINGS[b.type].kind === 'turret');
  const tiles = nearDoorTiles(g, r);
  const pw = g.power(r);
  let ttype = 'nail';
  if (g.unlocked('bow') && inc * 90 > BUILDINGS.bow.cost) ttype = 'bow';
  if (g.unlocked('tesla') && inc * 70 > BUILDINGS.tesla.cost) ttype = 'tesla';
  if (tiles.length && turrets.length < 6) {
    let cost = BUILDINGS[ttype].cost;
    if (ttype === 'tesla' && pw.cap - pw.used < 2) {
      if (g.unlocked('generator')) C.push({ kind: 'build', type: 'generator', cost: BUILDINGS.generator.cost, v: val(P.turret * 1.1, BUILDINGS.generator.cost), far: true });
      ttype = 'bow'; cost = BUILDINGS.bow.cost;
    }
    C.push({ kind: 'build', type: ttype, cost, v: val(P.turret * (night ? 1.5 : 0.9) * (turrets.length === 0 ? 2.5 : 1) * (targeted ? 1.4 : 1), cost) });
  }
  if (turrets.length) {
    const low = turrets.reduce((a, b) => (upgradeCost(a.type, a.lvl) < upgradeCost(b.type, b.lvl) ? a : b));
    if (low.lvl < BUILDINGS[low.type].maxLvl) {
      const cost = upgradeCost(low.type, low.lvl);
      C.push({ kind: 'upB', b: low, cost, v: val(P.turret * (night ? 1.3 : 0.8), cost) });
    }
  }
  // utilities
  const has = (t) => r.buildings.find((b) => b.type === t);
  const utilWant = [];
  if (g.unlocked('vending') && !has('vending')) utilWant.push('vending');
  if (g.unlocked('freezer') && !has('freezer')) utilWant.push('freezer');
  if (g.unlocked('bench') && !has('bench')) utilWant.push('bench');
  if (g.unlocked('spikes') && !has('spikes')) utilWant.push('spikes');
  for (const u of utilWant) {
    const D = BUILDINGS[u];
    if (D.power > 0 && pw.cap - pw.used < D.power) {
      if (g.unlocked('generator')) C.push({ kind: 'build', type: 'generator', cost: BUILDINGS.generator.cost, v: val(P.util, BUILDINGS.generator.cost), far: true });
      continue;
    }
    C.push({ kind: 'build', type: u, cost: D.cost, v: val(P.util, D.cost), far: true });
  }
  const gen = has('generator');
  if (gen && pw.cap - pw.used < 1 && gen.lvl < BUILDINGS.generator.maxLvl) {
    const cost = upgradeCost('generator', gen.lvl);
    C.push({ kind: 'upB', b: gen, cost, v: val(P.util * 0.8, cost) });
  }
  if (!C.length) return null;
  // rookies sometimes make a random choice
  if (P.id === 'rookie' && g.rng() < 0.35) return C[Math.floor(g.rng() * C.length)];
  return C.reduce((a, b) => (b.v > a.v ? b : a));
}

export function aiUpdate(g, s, dt) {
  if (s.state === 'corridor') {
    if (g.phase !== 'rush' || s.path.length) return;
    s.decideDelay -= dt;
    if (s.decideDelay > 0) return;
    if (s.panicT == null) {
      // sometimes a rookie freezes up in later nights (creates early minions)
      s.panicT = 0;
      if (!s.isPlayer && g.night.n >= 3 && s.pers.id === 'rookie' && g.rng() < 0.3) { s.decideDelay = 25 + g.rng() * 6; return; }
    }
    const r = aiPickRoom(g, s);
    if (r) g.goToRoom(s, r);
    else s.decideDelay = 0.5;
    return;
  }
  if (s.state !== 'inroom' || !s.room.alive) return;
  if (!s.lying) { g.lieDown(s); }
  s.aiT -= dt;
  if (s.aiT > 0) return;
  s.aiT = (0.45 + g.rng() * 0.5) * s.pers.react;
  const r = s.room;
  const frac = g.minDoorFrac(r);
  const hit = r.hitT < 2.5;
  if (hit && frac < s.pers.repairAt && g.canRepair(s).ok) { g.repairDoor(s); return; }
  if (hit && frac < 0.3 && g.canDoor(s).ok) { g.upgradeDoor(s); s.goal = null; return; }
  if (frac < 0.85 && !hit && g.canRepair(s).ok && s.scrap > g.canRepair(s).cost * 6) { g.repairDoor(s); return; }
  s.goalT = (s.goalT || 0) - (0.5 * s.pers.react);
  if (!s.goal || s.goalT <= 0) { s.goal = chooseGoal(g, s); s.goalT = 5; }
  const G = s.goal;
  if (!G || s.scrap < G.cost) return;
  let res = null;
  if (G.kind === 'bed') res = g.upgradeBed(s);
  else if (G.kind === 'door') res = g.upgradeDoor(s);
  else if (G.kind === 'upB') res = G.b.room === r && r.buildings.includes(G.b) ? g.upgradeBuilding(s, G.b) : null;
  else if (G.kind === 'build') {
    let tiles = nearDoorTiles(g, r);
    if (G.far) tiles = tiles.reverse();
    const t = tiles[0];
    if (t) res = g.build(s, G.type, t.tx, t.ty);
  }
  s.goal = null;
  return res;
}
