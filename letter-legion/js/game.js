// Match controller: wires the sim, the CPU brain, the renderer and player input together.
import { Match } from './sim.js';
import { CpuBrain } from './ai.js';
import { UNITS, HERO_BY_ID, HEROES, MAP_BY_ID, ITEM_BY_ID, RARITIES, LEVEL_NAMES, GOLD_TILE, BOON_BY_ID } from './data.js';
import { Audio } from './audio.js';
import { CG } from './cg.js';

const STEP = 1 / 60;

export class MatchController {
  constructor(view, opts, hooks) {
    this.view = view; this.opts = opts; this.hooks = hooks; this.audio = Audio;
    this.rival = opts.rival; this.tutorial = !!opts.tutorial;
    this.speed = opts.fast ? 2 : 1; this.pauseReasons = new Set(); this.acc = 0; this.ended = false; this.timers = [];
    const unlocked = opts.unlockedHeroes;
    // CPU knows heroes appropriate to its tier
    const rivalHeroes = HEROES.filter((h, i) => i < 3 + Math.floor((opts.rivalIndex ?? 0) * 0.7)).map(h => h.id);
    this.match = new Match({
      mapId: opts.mapId, seed: opts.seed, tutorial: this.tutorial,
      player: { unlockedHeroes: unlocked, passives: opts.passives, actives: opts.actives, weapons: opts.weapons, dailyBuff: opts.dailyBuff, script: this.tutorial ? ['S', 'S', 'gold:K', 'gold:I', 'gold:N', 'gold:G', 'B', 'K', 'S', 'L'] : null },
      rival: { unlockedHeroes: rivalHeroes, cpuBonus: this.rival.power, dailyBuff: opts.dailyBuff, cpuSkill: this.rival.skill, cpuSpell: this.rival.spell },
    });
    if (this.tutorial) { this.match.mapDef = { ...this.match.mapDef, waves: 4 }; this.match.tutorialHold = true; }
    else if (opts.headStart) { const me = this.match.sides[0]; me.ink += 60; me.shovels += 1; }
    this.brain = new CpuBrain(this.match.sides[1], this.tutorial ? { think: 3.0, skill: 0.2, spell: 0, mistakes: 0.4 } : this.rival);
    view.setMatch(this.match, this);
    this.highlightCells = null;
    this.tut = this.tutorial ? { step: 0 } : null;
    if (this.tutorial) this.tutStep(0);
  }
  get me() { return this.match.sides[0]; }
  // several independent things can pause a match (pause menu, spellbook, ads, tab switch); it runs only when none do
  get paused() { return this.pauseReasons.size > 0; }
  hold(reason) { this.pauseReasons.add(reason); }
  release(reason) { this.pauseReasons.delete(reason); }
  later(fn, ms) { this.timers.push(setTimeout(() => { if (!this.ended) fn(); }, ms)); }
  dispose() { this.ended = true; this.timers.forEach(clearTimeout); this.timers.length = 0; this.view.drag = null; }

  // ---------------- tutorial ----------------
  tutorialWants(what) { return this.tut && this.tut.want === what; }
  tutStep(n) {
    const t = this.tut; t.step = n; t.want = null; this.highlightCells = null;
    const me = this.me;
    const say = (txt) => this.hooks.hint(txt);
    const roadSide = me.cells.filter(c => !c.locked && c.row === 1).map(c => c.id);
    switch (n) {
      case 0: say('Protect <b>Prince Pip</b>! Click <b>SUMMON</b> to recruit a letter soldier.'); t.want = 'summon'; me.ink = Math.max(me.ink, me.summonCost()); break;
      case 1: say('Drag the <b>S</b> onto a <b>glowing cell</b> by the road.'); this.highlightCells = roadSide; t.want = 'place'; break;
      case 2: say('It fights on its own. <b>SUMMON</b> again!'); t.want = 'summon'; me.ink = Math.max(me.ink, me.summonCost()); break;
      case 3: { const sc = me.cells.find(c => c.unit && c.unit.letter === 'S'); say('Drop the new <b>S</b> <b>onto your first S</b> to <b>MERGE</b> them (same letter + same level).'); this.highlightCells = sc ? [sc.id] : null; t.want = 'merge'; break; }
      case 4: say('Stronger and a free cell! Now <b>summon</b> a few times for <b>golden letters</b>.'); t.want = 'gold'; me.ink = Math.max(me.ink, 200); break;
      case 5: { const row = me.cells.filter(c => !c.locked && c.row === 2).map(c => c.id); say('Spell a hero: put <b>K · I · N · G</b> side by side in <b>one row, left → right</b>.'); this.highlightCells = row; t.want = 'spell'; break; }
      case 6: say('<b>KING</b> joined your legion! Now hold the road — outlast the rival.'); this.match.tutorialHold = false; t.want = null; this.later(() => { if (this.tut && this.tut.step === 6) this.tutStep(7); }, 4500); break;
      case 7: say('Tip: board clear? Click the <b>wave bar</b> to call the next wave early for bonus ink.'); this.later(() => { if (this.tut && this.tut.step === 7) { this.hooks.hint(null); this.tut.step = 8; } }, 7000); break;
    }
  }
  tutEvent(ev) {
    const t = this.tut; if (!t) return;
    if (t.step === 0 && ev.t === 'summon') this.tutStep(1);
    else if (t.step === 1 && ev.t === 'place') this.tutStep(2);
    else if (t.step === 2 && ev.t === 'summon') this.tutStep(3);
    else if ((t.step === 2 || t.step === 3) && ev.t === 'merge') this.tutStep(4); // merged early (e.g. with keys 1-3): fine
    else if (t.step === 4 && ev.t === 'summon') { t.gold = (t.gold || 0) + 1; if (t.gold >= 3 && this.me.freeTraySlot() < 0 || t.gold >= 4) this.tutStep(5); else this.me.ink = Math.max(this.me.ink, this.me.summonCost()); }
    else if (t.step === 5 && ev.t === 'spell') this.tutStep(6);
    else if (t.step === 5 && ev.t === 'summon') { /* keep going */ }
  }

  // keeps the scripted tutorial from dead-ending whatever the player does
  tutGuard() {
    const t = this.tut, me = this.me;
    if (this.match.tutorialHold && me.ink < me.summonCost()) me.ink = me.summonCost(); // no wave income while held
    if (t.step === 1 && !me.tray.some(Boolean) && !me.cells.some(c => c.unit)) this.tutStep(0); // recruit was sold: summon again
    if (t.step === 3) {
      const isS1 = u => u && u.kind === 'basic' && u.letter === 'S' && u.level === 1;
      const n = me.cells.filter(c => isS1(c.unit)).length + me.tray.filter(isS1).length;
      if (n < 2) this.tutStep(4); // an S was sold: skip the merge lesson rather than dead-end
      else this.highlightCells = me.cells.filter(c => isS1(c.unit)).map(c => c.id);
    }
    if (t.step === 5) {
      // re-issue any K/I/N/G the player sold, so KING can always be spelled
      const held = me.heldGold().slice(); const missing = [];
      for (const ch of 'KING') { const i = held.indexOf(ch); if (i >= 0) held.splice(i, 1); else missing.push(ch); }
      const queued = me.script.filter(x => x.startsWith('gold:')).map(x => x.slice(5));
      for (const ch of missing) { const qi = queued.indexOf(ch); if (qi >= 0) queued.splice(qi, 1); else me.script.unshift('gold:' + ch); }
    }
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
      if (this.tut) this.tutGuard();
      // first-time explanations for the duel mechanics the tutorial doesn't cover
      if (!this.tutorial && !this.ended) {
        if (!this.tipHex && this.me.canHex()) { this.tipHex = true; this.oneTimeHint('hex', 'Your <b>Hex</b> is charged! Click the purple orb (or press <b>H</b>) to send a <b>Hexed Brute</b> down the rival\'s road.'); }
        if (!this.tipWild && this.me.heldGold().includes('*')) { this.tipWild = true; this.oneTimeHint('wild', 'A <b>★ wild letter</b>! It counts as <b>any</b> letter — drop it into the gap of a hero name.'); }
      }
      // blessing draft: the match is frozen until the player picks one of three cards
      if (this.match.state === 'running' && this.match.draft && this.me.offers && !this.me.autoPick && !this.draftOpen) { this.draftOpen = true; this.hold('draft'); this.hooks.sync?.(); this.hooks.draft(this); }
    }
    {
      if (this.match.state === 'over' && !this.ended) {
        this.ended = true; this.timers.forEach(clearTimeout); this.timers.length = 0;
        setTimeout(() => this.hooks.onEnd(this.result()), 1200);
        if (this.match.winner === 0) { Audio.play('win'); this.view.banner('VICTORY!', '#ffe066', 2.5, 0); } else { Audio.play('lose'); this.view.banner('DEFEAT', '#ff6b7a', 2.5, 0); }
        CG.gameplayStop();
      }
    }
    // keep a hover tooltip current (charges, costs) without waiting for the mouse to move
    const v = this.view; this.tipT = (this.tipT || 0) + realDt;
    if (this.tipT > 0.25 && v.tip && !v.drag && !this.paused) { this.tipT = 0; this.pointerMove(v.pointer.x, v.pointer.y); }
    this.view.draw(this.paused ? 0 : realDt * this.speed);
  }
  oneTimeHint(id, html) {
    if (!this.hooks.tipOnce || !this.hooks.tipOnce(id)) return;
    this.hintId = id; this.hooks.hint(html);
    this.later(() => { if (this.hintId === id) { this.hintId = null; this.hooks.hint(null); } }, 7000);
  }
  pickBoon(i) {
    if (!this.match.pickBoon(0, i)) return false;
    this.draftOpen = false; this.release('draft'); this.hooks.sync?.();
    return true;
  }
  rerollBoons() { const ok = this.match.rerollBoons(0); Audio.play(ok ? 'summon' : 'error'); return ok; }
  result() {
    const m = this.match, me = m.sides[0];
    return { won: m.winner === 0, forfeit: !!m.forfeit, reason: m.endReason, wave: m.wave, lives: me.lives, stats: me.stats, score: m.score(0), mapId: m.mapId, coinsMult: me.mods.coins, opts: this.opts };
  }

  // ---------------- actions ----------------
  doSummon(free = false) {
    const me = this.me;
    if (me.freeTraySlot() < 0) { this.toast('Recruit tray is full — deploy or sell first'); Audio.play('error'); return; }
    if (!free && me.ink < me.summonCost() && !me.freeLeft) { this.toast('Not enough ink'); Audio.play('error'); return; }
    me.summon(free);
  }
  button(id) {
    const me = this.me;
    if (id === 'pause') return this.hooks.pause();
    if (id === 'speed') { this.speed = this.speed > 1 ? 1 : 2; this.hooks.setFast(this.speed > 1); Audio.play('click'); return; }
    if (id === 'book') return this.hooks.spellbook();
    if (id === 'summon') return this.doSummon();
    if (id === 'callWave') { this.match.callWave(0); return; }
    if (id === 'hex') {
      if (!me.sendHex()) {
        Audio.play('error');
        const foe = this.match.sides[1];
        this.toast(!me.hexReady() ? `Hex charging: ${Math.floor(me.hex)}/${me.hexNeed()} — defeat enemies to fill it` : this.match.draft ? 'Choose a blessing first' : foe.dead ? 'The rival\'s ward has already fallen' : 'Not right now');
      }
      return;
    }
    if (id.startsWith('train')) { const L = ['S', 'L', 'B', 'K'][+id.slice(5)]; if (!me.doTrain(L)) { Audio.play('error'); this.toast(me.trainCost(L) === Infinity ? 'Fully trained' : 'Not enough ink to train'); } else this.view.banner(`${UNITS[L].name}s trained! (+${me.train[L]})`, UNITS[L].color, 1.2, 0); return; }
    if (id.startsWith('item')) { const i = +id.slice(4); if (!me.useItem(i)) Audio.play('error'); return; }
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
      else if (v.stripHits) {
        const h = v.stripHits.find(s => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h);
        if (h && h.boon) v.tip = { x, y, lines: [`Blessing: ${h.boon.name}`, h.boon.desc], col: h.boon.col };
        else if (h) v.tip = { x, y, lines: [`${h.hero.word} — ${h.hero.skill}`, h.hero.skillDesc, 'Place golden letters in a row, left→right'], col: h.hero.color };
      }
    }
    const interactive = (v.hover && (v.hover.id !== 'callWave' || this.match.canCallWave(0))) || (v.hoverTray >= 0 && this.me.tray[v.hoverTray]) || (v.hoverCell && (v.hoverCell.unit || (v.hoverCell.locked && this.me.shovels) || v.selected));
    this.hooks.cursor(v.drag && v.drag.moved ? 'grabbing' : interactive ? 'pointer' : 'default');
  }
  pointerUp(x, y) {
    const v = this.view; v.pointer.down = false;
    if (this.ended || this.paused) { v.drag = null; this.downBtn = null; return; }
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
    if (this.ended || this.paused) return;
    if (k === ' ' || k === 'Enter') this.doSummon();
    else if (k === 'Escape' || k === 'p' || k === 'P') this.hooks.pause();
    else if (k === 'q' || k === 'Q') this.button('item0');
    else if (k === 'w' || k === 'W') this.button('item1');
    else if (k === 'f' || k === 'F') this.button('speed');
    else if (k === 'n' || k === 'N') this.button('callWave');
    else if ((k === 'h' || k === 'H') && !this.tutorial) this.button('hex');
    else if (['1', '2', '3'].includes(k)) { const i = +k - 1; if (this.me.tray[i]) this.autoPlace({ tray: i }); }
  }
  unitTip(u) {
    const me = this.me;
    if (u.kind === 'basic') { const d = UNITS[u.letter]; return { lines: [`${d.name} (${u.letter}) · Lv ${u.level} ${LEVEL_NAMES[u.level - 1]}`, `${d.role} · dmg ${Math.round(me.unitDamage(u))} · ${me.unitRate(u).toFixed(1)}/s`, d.desc, u.level < 7 ? 'Merge with same letter & level to upgrade' : 'Max level!'], col: d.color }; }
    if (u.kind === 'gold' && u.letter === '*') return { lines: ['★ Wild letter', 'Counts as ANY letter when spelling a hero', 'Put it in the gap of a hero name (row, left → right)', `Weak attack: ${Math.round(me.unitDamage(u))} dmg`], col: '#e0a8ff' };
    if (u.kind === 'gold') { const words = me.unlockedHeroes().filter(h => h.word.includes(u.letter)).map(h => h.word); return { lines: [`Golden letter "${u.letter}"`, words.length ? 'Spells: ' + words.join(', ') : 'Not used by your heroes yet', 'Drop on an identical gold letter to transmute', `Weak attack: ${Math.round(me.unitDamage(u))} dmg`], col: '#ffd24a' }; }
    const h = HERO_BY_ID[u.heroId]; const w = me.mods.weapons[u.heroId];
    return { lines: [`${h.word} · ${h.title} ★${u.level}`, `${h.skill}: ${h.skillDesc}`, `dmg ${Math.round(me.unitDamage(u))} · skill every ${(u.skillMax || h.cd).toFixed(1)}s`, w ? `Weapon: +${Math.round(w.dmg * 100)}% dmg${w.upgrade ? ' · skill upgraded' : ''}` : 'Spell it again to level up (max ★3)'], col: h.color };
  }
  buttonTip(b, x, y) {
    const me = this.me;
    const T = {
      summon: ['Summon (Space)', 'Random letter, golden hero letter or shovel', 'Each summon costs more than the last'],
      callWave: this.match.canCallWave(0) ? ['Call the next wave now (N)', 'Your board is clear — skip the wait', this.match.curWave ? `+${this.match.callWaveBonus()} bonus ink` : 'Start the first wave right away'] : ['Next wave timer', 'Clear your board to call the next wave early for bonus ink'],
      pause: ['Pause (Esc)'], speed: ['Game speed (F)'], book: ['Spellbook — all heroes & skills'],
      hex: me.canHex() ? ['HEX READY! (H)', 'Curse the rival: a tough Hexed Brute marches down THEIR road', 'Defeating Brutes sent at you charges your own Hex'] : ['Hex (H)', `Charge ${Math.floor(me.hex)}/${me.hexNeed()} — defeat enemies to fill it (bosses & Brutes count extra)`, 'When full, send a Hexed Brute down the rival\'s road'],
    };
    if (b.id.startsWith('train')) { const L = ['S', 'L', 'B', 'K'][+b.id.slice(5)]; return { x, y, lines: [`Train ${UNITS[L].name}s`, `+18% damage for every ${L} on your board`, `Rank ${me.train[L]}/5`], col: UNITS[L].color }; }
    if (b.id.startsWith('item')) { const it = me.mods.actives[+b.id.slice(4)]; if (!it) return { x, y, lines: ['Empty item slot', 'Buy active items in the Shop'] }; const d = ITEM_BY_ID[it.id]; return { x, y, lines: [`${d.name} (${RARITIES[it.r].name}) — ${b.id === 'item0' ? 'Q' : 'W'}`, d.desc(d.vals[it.r]), it.used ? 'Already used this match' : 'Once per match'], col: RARITIES[it.r].color }; }
    return T[b.id] ? { x, y, lines: T[b.id] } : null;
  }
}
