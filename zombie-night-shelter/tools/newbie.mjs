// How do the first nights feel for real people? Two scripted "humans" play in the headless sim:
//   naive  = follows the tutorial, then one slow action every 3.5 s, repairs late, never uses abilities or helps
//   decent = one action every 1.5 s, repairs at 55 %, flashbangs bosses at the door
//   idle   = lies in bed and never does anything (must NOT be a winning strategy)
// usage: node tools/newbie.mjs [runs] [fromNight] [toNight] [kinds=naive,decent]
import { Game } from '../js/sim.js';
import { NIGHTS, PACE, BUILDINGS } from '../js/data.js';
const runs = +(process.argv[2] || 30), from = +(process.argv[3] || 1), to = +(process.argv[4] || 3);
function play(night, seed, kind) {
  const g = new Game({ night, seed, tutorial: night.n === 1, rushTime: night.n === 1 ? 40 : undefined });
  const s = g.player, react = kind === 'naive' ? 3.5 : 1.5;
  let t = 0, next = 2, firstHit = null, minFrac = 1, wake = null, repairs = 0;
  const DT = 1 / 30;
  while (g.phase !== 'won' && g.phase !== 'lost' && t < 900) {
    g.tick(DT); t += DT;
    for (const ev of g.events) {
      if (ev.type === 'bossWake') wake = t;
      if (ev.type === 'doorHit' && ev.player && firstHit == null) firstHit = t;
    }
    g.events.length = 0;
    const r = s.room;
    if (r && r.alive) minFrac = Math.min(minFrac, g.minDoorFrac(r));
    if (t < next) continue;
    next = t + react;
    if (s.state === 'corridor' && !s.targetRoom) { const free = g.map.rooms.filter((q) => !q.owner && !g.survivors.some((o) => o !== s && o.targetRoom === q)); const pick = (free.length ? free : g.map.rooms.filter((q) => !q.owner)).sort((a, b) => Math.hypot(a.doors[0].fx - s.x, a.doors[0].fy - s.y) - Math.hypot(b.doors[0].fx - s.x, b.doors[0].fy - s.y))[0]; if (pick) g.goToRoom(s, pick); continue; }
    if (s.state !== 'inroom' || !r) continue;
    if (!s.lying) { g.lieDown(s); continue; }
    const frac = g.minDoorFrac(r), turrets = r.buildings.filter((b) => BUILDINGS[b.type].kind === 'turret');
    const d = r.doors[0];
    const freeTile = () => r.tiles.filter((q) => g.tileFree(r, q.tx, q.ty)).sort((a, b) => Math.hypot(a.tx - d.tx, a.ty - d.ty) - Math.hypot(b.tx - d.tx, b.ty - d.ty))[0];
    const build = (type) => { const ft = freeTile(); return ft && g.build(s, type, ft.tx, ft.ty).ok; };
    if (kind === 'idle') continue; // lies in bed and never touches anything
    if (kind === 'naive') {
      if (r.bedLvl < 2) { g.upgradeBed(s); continue; }
      if (!turrets.length) { build('nail'); continue; }
      if (frac < 0.4 && g.canRepair(s).ok) { g.repairDoor(s); repairs++; continue; }
      if (frac < 0.6 && g.canDoor(s).ok) { g.upgradeDoor(s); continue; }
      if (g.canBed(s).ok) { g.upgradeBed(s); continue; }
      if (turrets.length < 3 && build('nail')) continue;
      if (g.canDoor(s).ok && s.scrap > g.canDoor(s).cost * 2) { g.upgradeDoor(s); continue; }
    } else {
      const boss = g.enemies.find((e) => e.kind === 'boss' && e.alive && e.state === 'attack' && e.target && e.target.room === r);
      if (frac < 0.55 && g.canRepair(s).ok) { g.repairDoor(s); repairs++; continue; }
      if (boss && g.canAbility('flash').ok) { g.useAbility('flash', boss.x, boss.y); continue; }
      if (g.canBed(s).ok && (turrets.length >= 1 || r.bedLvl < 2)) { g.upgradeBed(s); continue; }
      if (turrets.length < 6 && s.scrap >= 30 && (turrets.length < 2 || s.scrap > 120)) { if (build(turrets.length >= 2 && g.canBuild(s, 'bow', 0, 0).cost <= s.scrap ? 'bow' : 'nail')) continue; }
      const cd = g.canDoor(s); if (cd.ok && (g.canBed(s).req || frac < 0.8 || s.scrap > cd.cost * 2)) { g.upgradeDoor(s); continue; }
      const up = r.buildings.find((b) => g.canUpgradeB(s, b).ok); if (up && s.scrap > 150) { g.upgradeBuilding(s, up); continue; }
    }
  }
  const res = g.results();
  return { won: res.won, stars: res.stars, killed: res.killed, real: t, wake, firstHit, minFrac, repairs, lostAt: res.won ? null : t };
}
for (const night of NIGHTS.filter((n) => n.n >= from && n.n <= to)) {
  for (const kind of (process.argv[5] ? process.argv[5].split(',') : ['naive', 'decent'])) {
    const R = []; for (let i = 0; i < runs; i++) R.push(play(night, 9000 + i * 17 + night.n, kind));
    const avg = (f) => (R.reduce((a, r) => a + (f(r) || 0), 0) / R.length);
    const hit = R.filter((r) => r.firstHit != null);
    console.log(`N${night.n} ${kind.padEnd(6)} win ${(100 * avg((r) => +r.won)).toFixed(0).padStart(3)}%  kill-all ${(100 * avg((r) => +r.killed)).toFixed(0).padStart(3)}%  stars ${avg((r) => r.stars).toFixed(2)}  night ${avg((r) => r.real).toFixed(0)}s real  bosses wake @${avg((r) => r.wake).toFixed(0)}s  door first hit @${hit.length ? (hit.reduce((a, r) => a + r.firstHit, 0) / hit.length).toFixed(0) : '-'}s (${hit.length}/${R.length})  min door ${(100 * avg((r) => r.minFrac)).toFixed(0)}%  repairs ${avg((r) => r.repairs).toFixed(1)}  ${R.filter((r) => !r.won).length ? 'lost at ' + R.filter((r) => !r.won).map((r) => r.lostAt.toFixed(0)).join(',') : ''}`);
  }
}
