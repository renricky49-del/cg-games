// CPU rival brain — plays one Side using exactly the same actions a human has.
import { UNITS, MAX_LEVEL } from './data.js';

export class CpuBrain {
  constructor(side, profile) {
    this.side = side; this.p = profile;
    this.t = Math.random() * 0.5 + 1.0;
    this.plan = null;
    const map = side.map;
    // distance from each cell to the nearest road tile
    this.roadDist = side.cells.map(c => {
      let best = 99;
      for (const k of map.roadTiles) { const [x, y] = k.split(',').map(Number); best = Math.min(best, Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y)); }
      return best;
    });
  }
  update(dt) {
    const s = this.side;
    if (s.dead || s.match.state !== 'running') return;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = this.p.think * (0.75 + s.rng.next() * 0.5);
    if (s.rng.next() < this.p.mistakes) return; // hesitates this turn
    // do up to a few actions per think
    for (let i = 0; i < 3; i++) if (!this.act()) break;
  }
  rowRun(cell) {
    const s = this.side; let c = cell; while (c.left >= 0 && !s.cells[c.left].locked) c = s.cells[c.left];
    const run = []; while (c && !c.locked) { run.push(c); c = c.right >= 0 ? s.cells[c.right] : null; }
    return run;
  }
  choosePlan() {
    const s = this.side; if (!this.p.spell) return null;
    const heroes = s.unlockedHeroes().filter(h => h.word.length <= this.p.spell);
    const onBoard = s.heroesOnBoard();
    let best = null;
    const seenRuns = new Set();
    for (const c of s.cells) {
      if (c.locked) continue;
      const run = this.rowRun(c); const key = run[0].id; if (seenRuns.has(key)) continue; seenRuns.add(key);
      for (const h of heroes) {
        const lvl = onBoard.find(u => u.heroId === h.id)?.level || 0; if (lvl >= 3) continue;
        for (let i = 0; i + h.word.length <= run.length; i++) {
          const seg = run.slice(i, i + h.word.length);
          if (seg.some(sc => sc.unit && sc.unit.kind === 'hero')) continue;
          let score = s.heroProgress(h) * 10 + seg.filter((sc, k) => sc.unit && sc.unit.kind === 'gold' && sc.unit.letter === h.word[k]).length * 4;
          score -= seg.filter(sc => sc.unit && sc.unit.kind === 'hero').length * 100;
          score -= seg.filter(sc => sc.unit && sc.unit.kind === 'basic').reduce((a, sc) => a + sc.unit.level, 0) * 0.6;
          score -= h.word.length * 0.5;
          if (!best || score > best.score) best = { hero: h, cells: seg.map(x => x.id), score };
        }
      }
    }
    return best;
  }
  planNeeds(letter) {
    if (!this.plan) return -1;
    const s = this.side; const w = this.plan.hero.word;
    for (let k = 0; k < w.length; k++) {
      const c = s.cells[this.plan.cells[k]];
      if (w[k] === letter && !(c.unit && c.unit.kind === 'gold' && c.unit.letter === letter) && !(c.unit && c.unit.kind === 'hero')) return c.id;
    }
    return -1;
  }
  planValid() {
    if (!this.plan) return false;
    const s = this.side;
    return this.plan.cells.every(id => !s.cells[id].locked && !(s.cells[id].unit && s.cells[id].unit.kind === 'hero'));
  }
  bestFreeCell(u) {
    const s = this.side; const reserved = new Set(this.plan ? this.plan.cells : []);
    let free = s.freeCells().filter(c => !reserved.has(c.id));
    if (!free.length) free = s.freeCells();
    if (!free.length) return -1;
    const melee = u.kind === 'basic' && UNITS[u.letter].range < 2.5;
    // smart CPUs put short-range letters near the road
    if (this.p.skill > 0.35) free.sort((a, b) => melee ? this.roadDist[a.id] - this.roadDist[b.id] : this.roadDist[b.id] - this.roadDist[a.id]);
    else free.sort(() => s.rng.next() - 0.5);
    return free[0].id;
  }
  mergeTarget(u) {
    const s = this.side;
    const reserved = new Set(this.plan ? this.plan.cells : []);
    let cands = s.cells.filter(c => c.unit && s.canMerge(u, c.unit) && u.kind === 'basic');
    if (!cands.length) return -1;
    cands.sort((a, b) => (reserved.has(a.id) ? 1 : 0) - (reserved.has(b.id) ? 1 : 0) || this.roadDist[a.id] - this.roadDist[b.id]);
    return cands[0].id;
  }
  act() {
    const s = this.side;
    // 1) dig
    if (s.shovels > 0) {
      const locked = s.lockedCells();
      const adj = locked.filter(c => (c.left >= 0 && !s.cells[c.left].locked) || (c.right >= 0 && !s.cells[c.right].locked));
      const pick = (adj.length ? adj : locked)[0];
      if (pick) { s.dig(pick.id); return true; }
    }
    if (!this.planValid()) this.plan = this.choosePlan();
    // 2) deploy tray items
    for (let i = 0; i < s.tray.length; i++) {
      const u = s.tray[i]; if (!u) continue;
      if (u.kind === 'gold') {
        if (!this.p.spell) { s.sell({ tray: i }); return true; }
        let dst = this.planNeeds(u.letter);
        if (dst < 0) { this.plan = this.choosePlan(); dst = this.planNeeds(u.letter); }
        if (dst >= 0) {
          const occ = s.cells[dst].unit;
          if (occ && occ.kind === 'gold' && occ.letter === u.letter) { /* already */ }
          if (s.place({ tray: i }, dst)) return true;
        }
        // keep it somewhere if a matching gold tile exists (transmute) or sell
        const twin = s.cells.find(c => c.unit && c.unit.kind === 'gold' && c.unit.letter === u.letter && !(this.plan && this.plan.cells.includes(c.id)));
        if (twin && this.p.skill > 0.5) { s.place({ tray: i }, twin.id); return true; }
        const fc = this.bestFreeCell(u);
        if (fc >= 0 && s.freeCells().length > (this.p.skill > 0.6 ? 4 : 2)) { s.place({ tray: i }, fc); return true; }
        s.sell({ tray: i }); return true;
      } else {
        const free = s.freeCells().filter(c => !(this.plan && this.plan.cells.includes(c.id)));
        const mt = this.mergeTarget(u);
        if (mt >= 0 && (free.length === 0 || u.level <= 1 && this.p.skill > 0.45 && s.rng.next() < 0.5)) { s.place({ tray: i }, mt); return true; }
        const fc = this.bestFreeCell(u);
        if (fc >= 0) { s.place({ tray: i }, fc); return true; }
        if (mt >= 0) { s.place({ tray: i }, mt); return true; }
        // no room: merge something on the board, else sell
        if (this.mergeBoard()) return true;
        s.sell({ tray: i }); return true;
      }
    }
    // 3) relocate basic units out of plan cells when the plan needs room
    if (this.plan && this.p.skill > 0.5) {
      for (const id of this.plan.cells) {
        const c = s.cells[id];
        if (c.unit && c.unit.kind === 'basic') {
          const fc = this.bestFreeCell(c.unit);
          if (fc >= 0 && !this.plan.cells.includes(fc)) { s.place({ cell: id }, fc); return true; }
        }
      }
    }
    // 4) summon
    const free = s.freeCells().length;
    if (s.canSummon() && (free > 0 || this.hasBoardMerge())) {
      s.summon(); return true;
    }
    if (free === 0 && this.mergeBoard()) return true;
    // stuck with a full board and nothing to merge: clear out the weakest junk to make room
    if (free === 0 && s.ink >= s.summonCost() && this.p.skill > 0.2) {
      const inPlan = id => this.plan && this.plan.cells.includes(id);
      const junk = s.cells.filter(c => c.unit && c.unit.kind !== 'hero' && !(inPlan(c.id) && c.unit.kind === 'gold'))
        .sort((a, b) => this.unitValue(a.unit) - this.unitValue(b.unit));
      if (junk.length) { s.sell({ cell: junk[0].id }); return true; }
    }
    // 5) train
    if (this.p.skill > 0.45 && this.wantTrain()) {
      const L = this.favoriteLetter();
      if (s.ink >= s.trainCost(L)) { s.doTrain(L); return true; }
    }
    return false;
  }
  unitValue(u) {
    if (u.kind === 'gold') return this.planNeeds(u.letter) >= 0 ? 50 : 0.5;
    return Math.pow(2, u.level);
  }
  favoriteLetter() {
    const s = this.side; const tot = { S: 0, L: 0, B: 0, K: 0 };
    for (const c of s.cells) if (c.unit && c.unit.kind === 'basic') tot[c.unit.letter] += Math.pow(2, c.unit.level);
    return Object.keys(tot).sort((a, b) => tot[b] - tot[a])[0];
  }
  wantTrain() {
    const s = this.side; const L = this.favoriteLetter(); const c = s.trainCost(L);
    if (c === Infinity || s.summons < 8) return false;
    const stuck = s.freeCells().length === 0 && !this.hasBoardMerge();
    return stuck || s.ink >= c + s.summonCost() * 2;
  }
  hasBoardMerge() {
    const s = this.side; const occ = s.cells.filter(c => c.unit && c.unit.kind === 'basic');
    for (let i = 0; i < occ.length; i++) for (let j = i + 1; j < occ.length; j++) if (s.canMerge(occ[i].unit, occ[j].unit)) return true;
    return false;
  }
  mergeBoard() {
    const s = this.side; const occ = s.cells.filter(c => c.unit && c.unit.kind === 'basic' && c.unit.level < MAX_LEVEL);
    occ.sort((a, b) => a.unit.level - b.unit.level);
    for (let i = 0; i < occ.length; i++) for (let j = i + 1; j < occ.length; j++) {
      if (s.canMerge(occ[i].unit, occ[j].unit)) {
        // keep the one nearer the road for melee
        const [a, b] = this.roadDist[occ[i].id] > this.roadDist[occ[j].id] ? [occ[i], occ[j]] : [occ[j], occ[i]];
        s.place({ cell: a.id }, b.id); return true;
      }
    }
    return false;
  }
}
