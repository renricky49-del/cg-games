// Match controller: wires the sim, the CPU brain, the renderer and player input together.
import { Match } from './sim.js';
import { CpuBrain } from './ai.js';
import { UNITS, HERO_BY_ID, HEROES, MAP_BY_ID, ITEM_BY_ID, RARITIES, LEVEL_NAMES, GOLD_TILE } from './data.js';
import { Audio } from './audio.js';
import { CG } from './cg.js';

const STEP = 1 / 60;

export class MatchController {
  constructor(view, opts, hooks) {
    this.view = view; this.opts = opts; this.hooks = hooks; this.audio = Audio;
    this.rival = opts.rival; this.tutorial = !!opts.tutorial;
    this.speed = opts.fast ? 2 : 1; this.paused = false; this.acc = 0; this.ended = false;
    const unlocked = opts.unlockedHeroes;
    // CPU knows heroes appropriate to its tier
    const rivalHeroes = HEROES.filter((h, i) => i < 3 + Math.floor((opts.rivalIndex ?? 0) * 0.7)).map(h => h.id);
    this.match = new Match({
      mapId: opts.mapId, seed: opts.seed,
      player: { unlockedHeroes: unlocked, passives: opts.passives, actives: opts.actives, weapons: opts.weapons, dailyBuff: opts.dailyBuff, script: this.tutorial ? ['S', 'S', 'gold:K', 'gold:I', 'gold:N', 'gold:G', 'B', 'K', 'S', 'L'] : null },
      rival: { unlockedHeroes: rivalHeroes, cpuBonus: this.rival.power, dailyBuff: opts.dailyBuff },
    });
    if (this.tutorial) { this.match.mapDef = { ...this.match.mapDef, waves: 6 }; this.match.tutorialHold = true; }
    this.brain = new CpuBrain(this.match.sides[1], this.tutorial ? { think: 3.0, skill: 0.2, spell: 0, mistakes: 0.4 } : this.rival);
    view.setMatch(this.match, this);
    this.highlightCells = null;
    this.tut = this.tutorial ? { step: 0 } : null;
    if (this.tutorial) this.tutStep(0);
  }
  get me() { return this.match.sides[0]; }

  // ---------------- tutorial ----------------
  tutorialWants(what) { return this.tut && this.tut.want === what; }
  tutStep(n) {
    const t = this.tut; t.step = n; t.want = null; this.highlightCells = null;
    const me = this.me;
    const say = (txt) => this.hooks.hint(txt);
    const roadSide = me.cells.filter(c => !c.locked && c.row === 1).map(c => c.id);
    switch (n) {
      case 0: say('Welcome, commander! Enemies march down the road toward <b>Prince Pip</b>. Click <b>SUMMON</b> to recruit a letter soldier.'); t.want = 'summon'; me.ink = Math.max(me.ink, me.summonCost()); break;
      case 1: say('A <b>Swordsman S</b>! Drag it from your recruit tray onto a <b>glowing cell</b> next to the road.'); this.highlightCells = roadSide; t.want = 'place'; break;
      case 2: say('Great! Letters attack on their own. Click <b>SUMMON</b> again.'); t.want = 'summon'; me.ink = Math.max(me.ink, me.summonCost()); break;
      case 3: { const sc = me.cells.find(c => c.unit && c.unit.letter === 'S'); say('Another <b>S</b>! Drag it <b>onto your first S</b> to <b>MERGE</b> them into a stronger Level 2 soldier.'); this.highlightCells = sc ? [sc.id] : null; t.want = 'merge'; break; }
      case 4: say('Merged letters hit much harder — and free up cells! Now for heroes: <b>summon 4 more times</b> to get golden letters.'); t.want = 'gold'; me.ink = Math.max(me.ink, 200); break;
      case 5: { const row = me.cells.filter(c => !c.locked && c.row === 2).map(c => c.id); say('Golden letters spell <b>HEROES</b>! Place <b>K · I · N · G</b> in <b>one row, left to right</b>, in neighbouring cells.'); this.highlightCells = row; t.want = 'spell'; break; }
      case 6: say('<b>KING</b> has joined your legion! Heroes cast special skills (watch the ring). Now defend Prince Pip — beat the rival by outlasting them!'); this.match.tutorialHold = false; t.want = null; setTimeout(() => { if (this.tut && this.tut.step === 6) this.tutStep(7); }, 7000); break;
      case 7: say('Tips: keep <b>summoning</b> and <b>merging</b>. Drag letters to the <b>✖ bin</b> to sell. <b>Train</b> buttons upgrade a whole letter type.'); setTimeout(() => { if (this.tut && this.tut.step === 7) { this.hooks.hint(null); this.tut.step = 8; } }, 9000); break;
    }
  }
  tutEvent(ev) {
    const t = this.tut; if (!t) return;
    if (t.step === 0 && ev.t === 'summon') this.tutStep(1);
    else if (t.step === 1 && ev.t === 'place') this.tutStep(2);
    else if (t.step === 2 && ev.t === 'summon') this.tutStep(3);
    else if (t.step === 3 && ev.t === 'merge') this.tutStep(4);
    else if (t.step === 4 && ev.t === 'summon') { t.gold = (t.gold || 0) + 1; if (t.gold >= 3 && this.me.freeTraySlot() < 0 || t.gold >= 4) this.tutStep(5); else this.me.ink = Math.max(this.me.ink, this.me.summonCost()); }
    else if (t.step === 5 && ev.t === 'spell') this.tutStep(6);
    else if (t.step === 5 && ev.t === 'summon') { /* keep going */ }
  }

  // ---------------- loop ----------------
  update(realDt) {
    if (this.ended) { this.view.draw(realDt); return; }
    if (!this.paused) {
      this.acc += Math.min(0.1, realDt) * this.speed;
      let n = 0;
      while (this.acc >= STEP && n < 12) {
        this.brain.update(STEP); this.match.update(STEP); this.acc -= STEP; n++;
        for (let i = 0; i < 2; i++) { const s = this.match.sides[i]; if (s.events.length) { if (i === 0 && this.tut) for (const ev of s.events) this.tutEvent(ev); this.view.consume(i, s.events); s.events.length = 0; } }
      }
      // tutorial: gold summon step needs ink & space
      if (this.tut && this.tut.step === 4) { const me = this.me; if (me.ink < me.summonCost()) me.ink = me.summonCost(); }
      if (this.match.state === 'over' && !this.ended) {
        this.ended = true;
        setTimeout(() => this.hooks.onEnd(this.result()), 1200);
        if (this.match.winner === 0) { Audio.play('win'); this.view.banner('VICTORY!', '#ffe066', 2.5, 0); } else { Audio.play('lose'); this.view.banner('DEFEAT', '#ff6b7a', 2.5, 0); }
        CG.gameplayStop();
      }
    }
    this.view.draw(this.paused ? 0 : realDt * this.speed);
  }
  result() {
    const m = this.match, me = m.sides[0];
    return { won: m.winner === 0, reason: m.endReason, wave: m.wave, lives: me.lives, stats: me.stats, score: m.score(0), mapId: m.mapId, coinsMult: me.mods.coins, opts: this.opts };
  }

  // ---------------- actions ----------------
  doSummon(free = false) {
    const me = this.me;
    if (me.freeTraySlot() < 0) { this.toast('Recruit tray is full — deploy or sell first'); Audio.play('error'); return; }
    if (!free && me.ink < me.summonCost()) { this.toast('Not enough ink'); Audio.play('error'); return; }
    me.summon(free);
  }
  button(id) {
    const me = this.me;
    if (id === 'pause') return this.hooks.pause();
    if (id === 'speed') { this.speed = this.speed > 1 ? 1 : 2; this.hooks.setFast(this.speed > 1); Audio.play('click'); return; }
    if (id === 'book') return this.hooks.spellbook();
    if (id === 'summon') return this.doSummon();
    if (id.startsWith('train')) { const L = ['S', 'L', 'B', 'K'][+id.slice(5)]; if (!me.doTrain(L)) { Audio.play('error'); this.toast(me.trainCost(L) === Infinity ? 'Fully trained' : 'Not enough ink to train'); } else this.view.banner(`${UNITS[L].name}s trained! (+${me.train[L]})`, UNITS[L].color, 1.2, 0); return; }
    if (id.startsWith('item')) { const i = +id.slice(4); if (!me.useItem(i)) Audio.play('error'); return; }
    if (id === 'adSummon') {
      if (me.adSummonUsed || me.freeTraySlot() < 0) return;
      this.paused = true;
      CG.rewarded().then(ok => { this.paused = false; if (ok) { me.adSummonUsed = true; me.summon(true); } else this.toast('Ad unavailable right now'); });
      return;
    }
    if (id === 'adShovel') {
      if (me.adShovelUsed) return;
      this.paused = true;
      CG.rewarded().then(ok => { this.paused = false; if (ok) { me.adShovelUsed = true; me.shovels++; this.view.banner('Shovel ready! Click a locked cell', '#ffd88a', 1.6); Audio.play('shovel'); } else this.toast('Ad unavailable right now'); });
    }
  }
  toast(t) { this.hooks.toast(t); }

  // ---------------- input ----------------
  pointerDown(x, y) {
    const v = this.view; v.pointer = { x, y, down: true }; Audio.unlock();
    if (this.ended || this.paused) return;
    const b = v.buttonAt(x, y); if (b) { this.downBtn = b; return; }
    const ti = v.trayAt(x, y);
    if (ti >= 0 && this.me.tray[ti]) { v.drag = { src: { tray: ti }, sx: x, sy: y, moved: false }; return; }
    const c = v.cellAt(x, y);
    if (c) {
      if (c.locked) { if (this.me.shovels > 0) { this.me.dig(c.id); } else { this.toast('Locked — find a Shovel by summoning to dig it'); Audio.play('error'); } return; }
      if (c.unit) { v.drag = { src: { cell: c.id }, sx: x, sy: y, moved: false }; return; }
      if (v.selected) { this.dropOn(v.selected, c); v.selected = null; return; }
    }
    if (v.selected) v.selected = null;
  }
  pointerMove(x, y) {
    const v = this.view; v.pointer.x = x; v.pointer.y = y;
    if (v.drag && !v.drag.moved && Math.hypot(x - v.drag.sx, y - v.drag.sy) > 6) { v.drag.moved = true; v.selected = null; }
    v.hover = v.buttonAt(x, y);
    v.hoverTray = v.trayAt(x, y);
    v.hoverCell = v.cellAt(x, y);
    // tooltip
    v.tip = null;
    if (!v.drag || !v.drag.moved) {
      const me = this.me;
      let u = null;
      if (v.hoverTray >= 0) u = me.tray[v.hoverTray];
      else if (v.hoverCell && v.hoverCell.unit) u = v.hoverCell.unit;
      if (u) v.tip = { x, y, ...this.unitTip(u) };
      else if (v.hoverCell && v.hoverCell.locked) v.tip = { x, y, lines: ['Locked cell', me.shovels ? 'Click to dig with a shovel' : 'Summon a Shovel to unlock'], col: '#ffd88a' };
      else if (v.hover) v.tip = this.buttonTip(v.hover, x, y);
      else if (v.stripHits) { const h = v.stripHits.find(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h); if (h) v.tip = { x, y, lines: [`${h.hero.word} — ${h.hero.skill}`, h.hero.skillDesc, 'Place golden letters in a row, left→right'], col: h.hero.color }; }
    }
    const interactive = v.hover || (v.hoverTray >= 0 && this.me.tray[v.hoverTray]) || (v.hoverCell && (v.hoverCell.unit || (v.hoverCell.locked && this.me.shovels) || v.selected));
    this.hooks.cursor(v.drag && v.drag.moved ? 'grabbing' : interactive ? 'pointer' : 'default');
  }
  pointerUp(x, y) {
    const v = this.view; v.pointer.down = false;
    if (this.downBtn) { const b = v.buttonAt(x, y); if (b === this.downBtn) { Audio.play('click'); this.button(b.id); } this.downBtn = null; return; }
    const d = v.drag; v.drag = null;
    if (!d) return;
    if (!d.moved) {
      // click-select (alternative to dragging): click a recruit, then click a cell
      if (v.selected && v.selected.tray === d.src.tray && d.src.tray !== undefined) { this.autoPlace(d.src); v.selected = null; return; }
      if (v.selected && d.src.cell !== undefined) { const c = this.me.cells[d.src.cell]; this.dropOn(v.selected, c); v.selected = null; return; }
      v.selected = d.src; Audio.play('hover'); return;
    }
    if (v.inTrash(x, y)) { const val = this.me.sell(d.src); if (!val) { this.toast('Heroes cannot be sold'); Audio.play('error'); } return; }
    const c = v.cellAt(x, y);
    if (c) this.dropOn(d.src, c);
    this.pointerMove(x, y);
  }
  dropOn(src, c) {
    const me = this.me;
    if (c.locked) { this.toast('That cell is locked'); Audio.play('error'); return; }
    const u = me.getSrc(src); if (!u) return;
    if (src.tray !== undefined && c.unit && !me.canMerge(u, c.unit) && me.freeTraySlot() < 0 && false) return;
    const r = me.place(src, c.id);
    if (!r) { Audio.play('error'); if (c.unit && c.unit.kind === 'basic' && u.kind === 'basic') this.toast('Merge needs the same letter AND the same level'); }
  }
  autoPlace(src) {
    const me = this.me; const u = me.getSrc(src); if (!u) return;
    const merge = me.cells.find(c => c.unit && me.canMerge(u, c.unit) && u.kind === 'basic');
    const free = me.freeCells()[0];
    const dst = merge || free;
    if (dst) me.place(src, dst.id); else { this.toast('No free cell'); Audio.play('error'); }
  }
  key(k) {
    if (this.ended) return;
    if (k === ' ' || k === 'Enter') { if (!this.paused) this.doSummon(); }
    else if (k === 'Escape' || k === 'p' || k === 'P') this.hooks.pause();
    else if (k === 'q' || k === 'Q') this.button('item0');
    else if (k === 'w' || k === 'W') this.button('item1');
    else if (k === 'f' || k === 'F') this.button('speed');
    else if (['1', '2', '3'].includes(k)) { const i = +k - 1; if (this.me.tray[i]) this.autoPlace({ tray: i }); }
  }
  unitTip(u) {
    const me = this.me;
    if (u.kind === 'basic') { const d = UNITS[u.letter]; return { lines: [`${d.name} (${u.letter}) · Lv ${u.level} ${LEVEL_NAMES[u.level - 1]}`, `${d.role} · dmg ${Math.round(me.unitDamage(u))} · ${me.unitRate(u).toFixed(1)}/s`, d.desc, u.level < 7 ? 'Merge with same letter & level to upgrade' : 'Max level!'], col: d.color }; }
    if (u.kind === 'gold') { const words = me.unlockedHeroes().filter(h => h.word.includes(u.letter)).map(h => h.word); return { lines: [`Golden letter "${u.letter}"`, words.length ? 'Spells: ' + words.join(', ') : 'Not used by your heroes yet', 'Drop on an identical gold letter to transmute', `Weak attack: ${Math.round(me.unitDamage(u))} dmg`], col: '#ffd24a' }; }
    const h = HERO_BY_ID[u.heroId]; const w = me.mods.weapons[u.heroId];
    return { lines: [`${h.word} · ${h.title} ★${u.level}`, `${h.skill}: ${h.skillDesc}`, `dmg ${Math.round(me.unitDamage(u))} · skill every ${(u.skillMax || h.cd).toFixed(1)}s`, w ? `Weapon: +${Math.round(w.dmg * 100)}% dmg${w.upgrade ? ' · skill upgraded' : ''}` : 'Spell it again to level up (max ★3)'], col: h.color };
  }
  buttonTip(b, x, y) {
    const me = this.me;
    const T = {
      summon: ['Summon (Space)', 'Random letter, golden hero letter or shovel', 'Each summon costs more than the last'],
      pause: ['Pause (Esc)'], speed: ['Game speed (F)'], book: ['Spellbook — all heroes & skills'],
      adSummon: ['Watch an ad: free summon', 'Once per match'], adShovel: ['Watch an ad: free shovel', 'Once per match'],
    };
    if (b.id.startsWith('train')) { const L = ['S', 'L', 'B', 'K'][+b.id.slice(5)]; return { x, y, lines: [`Train ${UNITS[L].name}s`, `+18% damage for every ${L} on your board`, `Rank ${me.train[L]}/5`], col: UNITS[L].color }; }
    if (b.id.startsWith('item')) { const it = me.mods.actives[+b.id.slice(4)]; if (!it) return { x, y, lines: ['Empty item slot', 'Buy active items in the Shop'] }; const d = ITEM_BY_ID[it.id]; return { x, y, lines: [`${d.name} (${RARITIES[it.r].name}) — ${b.id === 'item0' ? 'Q' : 'W'}`, d.desc(d.vals[it.r]), it.used ? 'Already used this match' : 'Once per match'], col: RARITIES[it.r].color }; }
    return T[b.id] ? { x, y, lines: T[b.id] } : null;
  }
}
