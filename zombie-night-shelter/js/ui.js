// In-game HUD: resource pills, phase timer, boss card, action bar, build menu, info panels, tooltips, tutorial.
import { Audio } from './audio.js';
import { fmt } from './sim.js';
import {
  BUILDINGS, BUILD_ORDER, bedIncome, bedCost, bedDoorReq, doorMaxHp, upgradeCost, turretStats, spriteFor,
  REPAIR_FRAC, MAX_BED, GRACE_TIME, PACE,
} from './data.js';
import { roomAt } from './map.js';

const $ = (id) => document.getElementById(id);
const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

export class HUD {
  constructor(app) {
    this.app = app;
    this.bm = $('build-menu'); this.info = $('info-panel'); this.tip = $('tooltip');
    this.bannerT = 0; this.cache = {};
    this.bindButtons();
  }

  get g() { return this.app.game; }
  get R() { return this.app.renderer; }

  reset(g, tutorial) {
    this.closeMenus();
    this.tut = tutorial ? { step: 0, t: 0 } : null;
    $('tutorial').classList.add('hidden'); $('tut-arrow').classList.add('hidden');
    this.cache = {};
    this.lastScrap = 0;
    g.bosses.forEach((b, i) => { $('boss-img' + i).src = `assets/img/${b.sprite}.png`; });
    $('hud-bottom').classList.add('hidden');
    this.layout();
  }

  layout() {
    requestAnimationFrame(() => {
      const top = $('hud-top').getBoundingClientRect();
      const bot = $('hud-bottom');
      const bh = bot.classList.contains('hidden') ? 8 : window.innerHeight - bot.getBoundingClientRect().top + 4;
      const prev = this.R.insets;
      this.R.insets = { top: top.bottom + 2, bottom: Math.max(bh, 8) };
      if (this.g) {
        const f = this.R.fitScale(); this.R.cam.fit = f; this.R.clampCam();
        // the action bar appearing changes the visible area: re-frame the player's room
        const pr = this.g.player.room;
        if (pr && prev.bottom !== this.R.insets.bottom && !this.app.userPanned && this.R.cam.z > f * 1.1) this.R.focusRoom(pr);
      }
    });
  }

  bindButtons() {
    const act = (id, fn) => $(id).addEventListener('click', () => { Audio.unlock(); fn(); });
    act('act-bed', () => this.doAction('bed'));
    act('act-repair', () => this.doAction('repair'));
    act('act-door', () => this.doAction('door'));
    act('act-adscrap', () => { if (this.g.adScrapUses >= 2) return; this.app.rewarded('scrap'); });
    act('act-adrepair', () => { if (this.g.adRepairUsed) return; this.app.rewarded('repair'); });
    document.querySelector('.tut-skip').addEventListener('click', () => {
      this.tut = null; $('tutorial').classList.add('hidden'); $('tut-arrow').classList.add('hidden');
      this.app.save.tutDone = true; this.app.persist();
      if (this.g) { this.g.tutorial = false; this.g.lieDown(this.g.player); }
    });
    for (const id of ['act-bed', 'act-repair', 'act-door', 'act-adscrap', 'act-adrepair']) {
      $(id).addEventListener('mouseenter', () => { this.hoverBtn = id; Audio.play('hover'); });
      $(id).addEventListener('mouseleave', () => { if (this.hoverBtn === id) this.hoverBtn = null; this.hideTip(); });
    }
  }

  doAction(kind) {
    const g = this.g; if (!g || this.app.isOver()) return;
    const s = g.player;
    let r;
    if (kind === 'bed') r = g.upgradeBed(s);
    if (kind === 'repair') r = g.repairDoor(s);
    if (kind === 'door') r = g.upgradeDoor(s);
    if (r && !r.ok) {
      Audio.play('error');
      this.toast(r.reason + (r.poor ? ` (${fmt(r.cost)})` : ''), 'bad');
      const el = $('act-' + kind); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
  }

  hotkey(k) {
    const g = this.g; if (!g) return;
    if (k === 'b') this.doAction('bed');
    else if (k === 'r') this.doAction('repair');
    else if (k === 'u') this.doAction('door');
    else if (k === 'z') this.app.toggleZoom();
    else if (k === ' ' && g.player.state === 'inroom' && !g.player.lying) g.lieDown(g.player);
    else if (/^[0-9]$/.test(k)) {
      const type = BUILD_ORDER.find((t) => BUILDINGS[t].hotkey === k); if (!type) return;
      let t = this.bmTile;
      if (!t && this.R.hover) t = this.R.hover;
      if (!t || !g.player.room) return;
      this.tryBuild(type, t.tx, t.ty);
    }
  }

  tryBuild(type, tx, ty) {
    const g = this.g, r = g.build(g.player, type, tx, ty);
    if (!r.ok) { Audio.play('error'); this.toast(r.reason + (r.poor ? ` (${fmt(r.cost)})` : ''), 'bad'); return false; }
    this.closeMenus();
    return true;
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    const g = this.g; if (!g) return;
    const s = g.player, room = s.room;
    // resources
    const scrap = Math.floor(s.scrap);
    this.setText('scrap', fmt(scrap));
    if (scrap > this.lastScrap + 0.5 && scrap - this.lastScrap > g.income(s) * 2 + 5) { const p = $('scrap-pill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); }
    this.lastScrap = scrap;
    this.setText('income', '+' + fmt(g.income(s)) + '/s');
    if (room) { const p = g.power(room); this.setText('power', `${p.cap - p.used}/${p.cap}`); }
    $('power-pill').classList.toggle('hidden', !room || !g.unlocked('generator'));
    // phase
    let title = '', timer = 0, urgent = false, dawn = 0;
    if (g.phase === 'rush') { title = s.state === 'corridor' ? 'Find a room!' : 'Others are still running…'; timer = g.phaseT; urgent = g.phaseT < 8 && s.state === 'corridor'; }
    else if (g.phase === 'grace') { title = 'Bosses wake in'; timer = g.phaseT / PACE; urgent = g.phaseT / PACE < 5; }
    else if (g.endless) { title = `Wave ${g.stats.wave}`; timer = g.stats.realTime; }
    else { title = 'Dawn in'; timer = g.nightLeft / PACE; dawn = 1 - g.nightLeft / g.nightLen; }
    if (g.phase === 'won') { title = 'Dawn!'; timer = 0; dawn = 1; }
    this.setText('phase-title', title);
    this.setText('phase-timer', mmss(timer));
    $('phase-box').classList.toggle('urgent', urgent);
    if (urgent && (g.phase === 'rush' || g.phase === 'grace')) Audio.play('tick');
    $('dawn-fill').style.width = (dawn * 100).toFixed(1) + '%';
    $('dawn-moon').style.left = (dawn * 100).toFixed(1) + '%';
    // bosses (two per night)
    g.bosses.forEach((b, i) => {
      this.setText('boss-name' + i, b.name);
      this.setText('boss-lvl' + i, String(b.lvl));
      $('boss-hp' + i).style.width = (100 * Math.max(0, b.hp) / b.maxHp).toFixed(1) + '%';
      const bst = { sleep: 'Sleeping…', seek: 'Hunting', walk: b.charging ? 'CHARGING!' : 'On the move', attack: b.target && b.target.room.owner ? `Smashing ${b.target.room.owner.isPlayer ? 'YOUR' : b.target.room.owner.name + "'s"} door` : 'Attacking', retreat: 'Fleeing to heal!', heal: 'Healing', idle: 'Prowling' };
      this.setText('boss-state' + i, b.alive ? (bst[b.state] || '') : 'Defeated');
      $('boss-box' + i).classList.toggle('down', !b.alive);
      if ($('boss-img' + i).getAttribute('src').indexOf(b.sprite) < 0) $('boss-img' + i).src = `assets/img/${b.sprite}.png`;
    });
    // action bar
    const inRoom = s.state === 'inroom' && room && room.alive;
    const bottom = $('hud-bottom');
    if (inRoom === bottom.classList.contains('hidden')) { bottom.classList.toggle('hidden', !inRoom); this.layout(); }
    if (inRoom) this.updateActions(g, s, room);
    // panels follow their anchor
    if (!this.info.classList.contains('hidden') && this.infoObj) this.renderInfo();
    if (!this.bm.classList.contains('hidden')) this.refreshBuildMenu();
    if (this.hoverBtn) this.btnTip(this.hoverBtn);
    // banner
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.remove('show'); }
    this.updateTutorial(dt);
    // tutorial bubble: above the action bar, or under the top HUD when the thing it points at is in the lower half
    const tb = $('tutorial');
    if (!tb.classList.contains('hidden')) {
      if (this.tutUp) { tb.style.top = (this.R.insets.top + 8) + 'px'; tb.style.bottom = 'auto'; }
      else { tb.style.top = 'auto'; tb.style.bottom = (this.R.insets.bottom + 10) + 'px'; }
    }
  }

  setText(id, v) { if (this.cache[id] !== v) { this.cache[id] = v; $(id).textContent = v; } }

  updateActions(g, s, room) {
    const set = (id, c, label, extra) => {
      const el = $(id);
      const st = (c.ok ? 'afford' : c.max ? 'disabled' : c.locked || c.req || c.cd ? 'locked disabled' : c.poor ? 'poor' : 'disabled') + (extra || '');
      if (el.dataset.st !== st) { el.dataset.st = st; el.className = 'act ' + st; }
      const costEl = el.querySelector('.cost span');
      const ct = c.max ? 'MAX' : c.req ? `Door Lv${c.req}` : c.cd ? mmss(c.cd / PACE).replace(/^0:/, '') + 's' : c.full ? 'Full' : fmt(c.cost || 0);
      if (costEl.textContent !== ct) costEl.textContent = ct;
      if (label) { const lv = el.querySelector('.lv'); if (lv && lv.textContent !== label) lv.textContent = label; }
    };
    const cb = g.canBed(s);
    set('act-bed', cb, 'Lv' + room.bedLvl, cb.ok && this.tut && this.tut.step === 2 ? ' ready' : '');
    $('act-bed').querySelector('.sub').textContent = room.bedLvl >= MAX_BED ? 'Max' : `+${fmt(bedIncome(room.bedLvl + 1) - bedIncome(room.bedLvl))}/s`;
    const bimg = $('act-bed').querySelector('img'); const bs = 'assets/img/' + ('bed' + Math.min(6, Math.ceil((room.bedLvl + 1) * 0.6))) + '.png';
    if (bimg.getAttribute('src') !== bs) bimg.setAttribute('src', bs);
    const cr = g.canRepair(s);
    const frac = g.minDoorFrac(room);
    set('act-repair', cr, null, cr.ok && frac < 0.5 ? ' ready' : '');
    $('act-repair').querySelector('.cd').style.height = cr.cd ? (100 * cr.cd / g.repairCdMax(s)).toFixed(0) + '%' : '0';
    const cd = g.canDoor(s);
    set('act-door', cd, 'Lv' + room.doorLvl, cb.req && cd.ok ? ' ready' : '');
    $('act-door').querySelector('.sub').textContent = `${fmt(doorMaxHp(room.doorLvl + 1))} HP`;
    // ads
    const sc = $('act-adscrap');
    sc.classList.toggle('hidden', g.adScrapUses >= 2 || g.phase === 'rush');
    sc.querySelector('.sub').textContent = '+' + fmt(g.adScrapAmount());
    $('act-adrepair').classList.toggle('hidden', g.adRepairUsed || g.phase !== 'night' || frac > 0.5);
  }

  btnTip(id) {
    const g = this.g, s = g.player, room = s.room; if (!room) return;
    let html = '';
    if (id === 'act-bed') {
      const c = g.canBed(s);
      html = `<b>Bed Lv${room.bedLvl}</b><br>Earns ${fmt(bedIncome(room.bedLvl))} scrap/s while you rest.`;
      if (!c.max) html += `<br>Next: <span class="good">${fmt(bedIncome(room.bedLvl + 1))}/s</span> for ${fmt(c.cost)}`;
      if (c.req) html += `<br><span class="bad">Requires Door Lv${c.req}</span>`;
      if (!c.max) html += `<br><small>Lv${room.bedLvl + 2} will need Door Lv${bedDoorReq(room.bedLvl + 2)}</small>`;
    } else if (id === 'act-repair') {
      const c = g.canRepair(s);
      html = `<b>Repair door (R)</b><br>Restores ${Math.round(REPAIR_FRAC * 100)}% door HP for ${fmt(c.cost)}.<br>Cooldown ${Math.round(g.repairCdMax(s) / PACE)}s.`;
    } else if (id === 'act-door') {
      html = `<b>Door Lv${room.doorLvl} (U)</b><br>Upgrade: max HP ${fmt(g.doorMax(room))} → <span class="good">${fmt(Math.round(g.doorMax(room) * doorMaxHp(room.doorLvl + 1) / doorMaxHp(room.doorLvl)))}</span> and fully repairs.`;
    } else if (id === 'act-adscrap') html = `<b>Watch an ad</b><br>Get ${fmt(g.adScrapAmount())} scrap instantly. (${2 - g.adScrapUses} left tonight)`;
    else if (id === 'act-adrepair') html = '<b>Watch an ad</b><br>Fully repair your door. Once per night.';
    const r = $(id).getBoundingClientRect();
    this.showTip(html, r.left + r.width / 2, r.top - 8, true);
  }

  showTip(html, x, y, above) {
    const t = this.tip;
    if (t.innerHTML !== html) t.innerHTML = html;
    t.classList.remove('hidden');
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = x - w / 2, top = above ? y - h : y + 18;
    left = Math.max(6, Math.min(window.innerWidth - w - 6, left));
    top = Math.max(6, Math.min(window.innerHeight - h - 6, top));
    t.style.left = left + 'px'; t.style.top = top + 'px';
  }
  hideTip() { this.tip.classList.add('hidden'); }

  // ---------------------------------------------------------------- world hover / click
  hoverWorld(w, sx, sy) {
    const g = this.g, s = g.player;
    if (this.bmHover) return;
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    const room = s.room;
    if (this.info.classList.contains('hidden')) this.R.preview = null;
    let html = '';
    const r = roomAt(g.map, w.x, w.y);
    if (room && r === room && s.state === 'inroom') {
      const b = room.buildings.find((o) => o.tx === tx && o.ty === ty);
      if (b) {
        const D = BUILDINGS[b.type];
        html = `<b>${D.name} Lv${b.lvl}</b><br>Click to upgrade or sell`;
        if (D.range || D.kind === 'turret') this.R.setPreview(b.type, b.lvl, b.tx, b.ty, true);
      } else if (tx === room.bed.tx && (ty === room.bed.ty || ty === room.bed.ty + 1)) {
        html = s.lying ? `<b>Your bed (Lv${room.bedLvl})</b><br>Earning ${fmt(bedIncome(room.bedLvl))}/s` : '<b>Your bed</b><br>Click to lie down and earn scrap';
      } else if (g.tileFree(room, tx, ty)) {
        html = '<b>Empty floor</b><br>Click to build';
      }
    } else if (r && r.doors.find((d) => d.tx === tx && d.ty === ty) && r.owner && r === room) {
      html = `<b>Your door Lv${room.doorLvl}</b><br>${fmt(Math.min(...room.doors.map((d) => d.hp)))} / ${fmt(g.doorMax(room))} HP`;
    } else if (r && r.owner && r !== room) {
      const o = r.owner;
      html = o.state === 'dead' ? `<b>${o.name}'s room</b><br><span class="bad">Overrun…</span>` : `<b>${o.name}'s room</b><br>Bed Lv${r.bedLvl} · Door Lv${r.doorLvl} · ${r.buildings.filter((b) => BUILDINGS[b.type].kind === 'turret').length} turrets`;
    } else if (r && !r.owner && g.phase === 'rush' && s.state === 'corridor') {
      html = `<b>Room ${r.label}</b><br>${r.w}×${r.h} · ${r.doors.length} door${r.doors.length > 1 ? 's' : ''}${r.support > 3 ? ' · <span class="good">close neighbours</span>' : ''}<br>Click to claim!`;
    }
    for (const e of g.enemies) {
      if (e.alive && Math.hypot(e.x - w.x, e.y - w.y) < e.r + 0.2) {
        html = e.kind === 'boss' ? `<b>${e.name} Lv${e.lvl}</b><br>${fmt(e.hp)} / ${fmt(e.maxHp)} HP · hits for ${fmt(e.dmg)}<br><small>${e.def.desc}</small>` : `<b>Zombie</b><br>${fmt(e.hp)} HP · hits for ${fmt(e.dmg)}`;
      }
    }
    if (html && this.info.classList.contains('hidden') && this.bm.classList.contains('hidden')) this.showTip(html, sx, sy);
    else this.hideTip();
  }

  clickWorld(w, sx, sy) {
    const g = this.g, s = g.player, room = s.room;
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    this.hideTip();
    if (!room || s.state === 'entering') return;
    const r = roomAt(g.map, w.x, w.y);
    if (r === room && room.alive) {
      // bed
      if (tx === room.bed.tx && (ty === room.bed.ty || ty === room.bed.ty + 1)) {
        if (!s.lying) { g.lieDown(s); return; }
        this.openInfo({ kind: 'bed' }, sx, sy); return;
      }
      const door = room.doors.find((d) => d.tx === tx && d.ty === ty);
      if (door) { this.openInfo({ kind: 'door' }, sx, sy); return; }
      const b = room.buildings.find((o) => o.tx === tx && o.ty === ty);
      if (b) { this.openInfo({ kind: 'building', b }, sx, sy); return; }
      if (g.tileFree(room, tx, ty)) { this.openBuildMenu(tx, ty, sx, sy); return; }
    }
    this.closeMenus();
  }

  menuOpen() { return !this.bm.classList.contains('hidden') || !this.info.classList.contains('hidden'); }
  closeMenus() {
    this.bm.classList.add('hidden'); this.info.classList.add('hidden');
    this.bmTile = null; this.infoObj = null; this.bmHover = null;
    if (this.R) { this.R.selTile = null; this.R.preview = null; }
  }

  place(el, sx, sy) {
    el.classList.remove('hidden');
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = sx + 24, top = sy - h / 2;
    if (left + w > window.innerWidth - 8) left = sx - w - 24;
    left = Math.max(8, left);
    top = Math.max(8, Math.min(window.innerHeight - h - 8, top));
    el.style.left = left + 'px'; el.style.top = top + 'px';
  }

  // ---------------------------------------------------------------- build menu
  openBuildMenu(tx, ty, sx, sy) {
    this.closeMenus();
    this.bmTile = { tx, ty }; this.R.selTile = { tx, ty };
    const list = this.bm.querySelector('.bm-list'); list.innerHTML = '';
    BUILD_ORDER.forEach((type, i) => {
      const D = BUILDINGS[type];
      const el = document.createElement('button');
      el.className = 'bm-item'; el.dataset.type = type;
      el.innerHTML = `<span class="hk">${D.hotkey}</span><img class="ic" src="assets/img/${D.sprites[0]}.png" alt=""><span>${D.name}</span><span class="c"><img src="assets/img/i_scrap.png" alt=""><span class="cv">${fmt(D.cost)}</span></span>`;
      el.addEventListener('mouseenter', () => { this.bmHover = type; Audio.play('hover'); this.bmTip(type, el); });
      el.addEventListener('mouseleave', () => { this.bmHover = null; this.hideTip(); this.R.preview = null; });
      el.addEventListener('click', (e) => { e.stopPropagation(); Audio.unlock(); this.tryBuild(type, tx, ty); this.hideTip(); });
      list.appendChild(el);
    });
    this.refreshBuildMenu();
    this.place(this.bm, sx, sy);
    Audio.play('click');
  }
  refreshBuildMenu() {
    const g = this.g, s = g.player, t = this.bmTile; if (!t) return;
    for (const el of this.bm.querySelectorAll('.bm-item')) {
      const type = el.dataset.type, c = g.canBuild(s, type, t.tx, t.ty);
      const cls = 'bm-item ' + (c.ok ? 'ok' : c.locked ? 'locked' : c.power ? 'nopower' : 'poor');
      if (el.className !== cls) {
        el.className = cls;
        const cv = el.querySelector('.cv');
        cv.textContent = c.locked ? `Night ${BUILDINGS[type].unlock}` : c.power ? `${BUILDINGS[type].power}⚡` : fmt(BUILDINGS[type].cost);
      }
    }
    if (this.bmHover) {
      const c = g.canBuild(s, this.bmHover, t.tx, t.ty);
      this.R.setPreview(this.bmHover, 1, t.tx, t.ty, c.ok);
    }
  }
  bmTip(type, el) {
    const g = this.g, D = BUILDINGS[type], t = this.bmTile;
    const c = g.canBuild(g.player, type, t.tx, t.ty);
    let html = `<b>${D.name}</b> · ${fmt(D.cost)} scrap${D.power > 0 ? ` · ${D.power}⚡ power` : D.power < 0 ? ` · +${-D.power}⚡` : ''}<br>${D.desc}`;
    if (D.kind === 'turret') { const st = turretStats(type, 1, g.perks); html += `<br>Damage ${fmt(st.dmg)} · ${st.rate.toFixed(1)}/s · Range ${st.range.toFixed(1)}`; }
    if (!c.ok) html += `<br><span class="bad">${c.reason}</span>`;
    // show under the menu (or above it when there is no room below) so it never covers the items
    const m = this.bm.getBoundingClientRect();
    if (m.bottom + 110 < window.innerHeight) this.showTip(html, m.left + m.width / 2, m.bottom - 12, false);
    else this.showTip(html, m.left + m.width / 2, m.top - 6, true);
  }

  // ---------------------------------------------------------------- info panel
  openInfo(obj, sx, sy) {
    this.closeMenus();
    this.infoObj = obj; this.infoKey = '';
    this.renderInfo();
    this.place(this.info, sx, sy);
    if (obj.b) this.R.selTile = { tx: obj.b.tx, ty: obj.b.ty };
    Audio.play('click');
  }
  renderInfo() {
    const g = this.g, s = g.player, room = s.room, o = this.infoObj;
    if (!room || !room.alive) { this.closeMenus(); return; }
    let key = '', html = '';
    const stat = (a, b, c) => `<div class="stat">${a}<span><b>${b}</b>${c != null ? ` <i>→ ${c}</i>` : ''}</span></div>`;
    const btn = (id, label, ok, cls) => `<button data-a="${id}" class="${ok ? '' : 'off'} ${cls || ''}">${label}</button>`;
    if (o.kind === 'building') {
      const b = o.b;
      if (!room.buildings.includes(b)) { this.closeMenus(); return; }
      const D = BUILDINGS[b.type], cu = g.canUpgradeB(s, b), cs = g.canSell(s, b);
      key = `${b.id}:${b.lvl}:${cu.ok}:${cs.ok}:${b.disabledT > 0}`;
      if (key === this.infoKey) return;
      html = `<button class="x" data-a="close">&times;</button><h3><img src="assets/img/${spriteFor(b.type, b.lvl)}.png" alt="">${D.name} <small>Lv${b.lvl}</small></h3><div class="desc">${D.desc}${b.disabledT > 0 ? '<br><span style="color:#b8e02a">Jammed by acid!</span>' : ''}</div>`;
      const nx = !cu.max;
      if (D.kind === 'turret') {
        const a = turretStats(b.type, b.lvl, g.perks), n = turretStats(b.type, b.lvl + 1, g.perks);
        html += stat('Damage', fmt(a.dmg), nx ? fmt(n.dmg) : null) + stat('Fire rate', a.rate.toFixed(2) + '/s', nx ? n.rate.toFixed(2) + '/s' : null) + stat('Range', a.range.toFixed(1), nx ? n.range.toFixed(1) : null);
      } else if (b.type === 'generator') html += stat('Power', '+' + D.powerUp * b.lvl, nx ? '+' + D.powerUp * (b.lvl + 1) : null);
      else if (b.type === 'freezer') html += stat('Slow', Math.round(100 * Math.min(D.slowMax, D.slow + D.slowUp * (b.lvl - 1))) + '%', nx ? Math.round(100 * Math.min(D.slowMax, D.slow + D.slowUp * b.lvl)) + '%' : null) + stat('Range', (D.range + D.rangeUp * (b.lvl - 1)).toFixed(1), nx ? (D.range + D.rangeUp * b.lvl).toFixed(1) : null);
      else if (b.type === 'vending') html += stat('Income', fmt(D.income * Math.pow(D.incomeMul, b.lvl - 1)) + '/s', nx ? fmt(D.income * Math.pow(D.incomeMul, b.lvl)) + '/s' : null);
      else if (b.type === 'bench') html += stat('Repair', ((D.heal + D.healUp * (b.lvl - 1)) * 100).toFixed(1) + '%/s', nx ? ((D.heal + D.healUp * b.lvl) * 100).toFixed(1) + '%/s' : null);
      else if (b.type === 'spikes') html += stat('Reflect', Math.round(100 * (D.reflect + D.reflectUp * (b.lvl - 1))) + '%', nx ? Math.round(100 * (D.reflect + D.reflectUp * b.lvl)) + '%' : null);
      else if (b.type === 'radio') html += stat('Fire rate boost', '+' + Math.round(100 * (D.boost + D.boostUp * (b.lvl - 1))) + '%', nx ? '+' + Math.round(100 * (D.boost + D.boostUp * b.lvl)) + '%' : null);
      html += `<div class="btns">${btn('up', cu.max ? 'MAX' : `Upgrade · ${fmt(cu.cost)}`, cu.ok)}${btn('sell', `Sell +${fmt(cs.refund || 0)}`, cs.ok, 'sell')}</div>`;
    } else if (o.kind === 'bed') {
      const c = g.canBed(s);
      key = `bed:${room.bedLvl}:${c.ok}:${c.req}`;
      if (key === this.infoKey) return;
      html = `<button class="x" data-a="close">&times;</button><h3><img src="assets/img/bed${Math.min(6, Math.ceil(room.bedLvl * 0.6))}.png" alt="">Bed <small>Lv${room.bedLvl}</small></h3><div class="desc">Rest here to earn scrap. Each level doubles income.</div>`;
      html += stat('Income', fmt(bedIncome(room.bedLvl)) + '/s', c.max ? null : fmt(bedIncome(room.bedLvl + 1)) + '/s');
      if (c.req) html += `<div class="desc" style="color:#ff9c90">Needs Door Lv${c.req} first!</div>`;
      html += `<div class="btns">${btn('bed', c.max ? 'MAX' : `Upgrade · ${fmt(c.cost)}`, c.ok)}</div>`;
    } else if (o.kind === 'door') {
      const c = g.canDoor(s), cr = g.canRepair(s);
      key = `door:${room.doorLvl}:${c.ok}:${cr.ok}`;
      if (key === this.infoKey) return;
      html = `<button class="x" data-a="close">&times;</button><h3><img src="assets/img/i_door.png" alt="">Door <small>Lv${room.doorLvl}</small></h3><div class="desc">If your door breaks, the night is over!</div>`;
      html += stat('Max HP', fmt(g.doorMax(room)), c.max ? null : fmt(Math.round(g.doorMax(room) * doorMaxHp(room.doorLvl + 1) / doorMaxHp(room.doorLvl))));
      html += `<div class="btns">${btn('repair', `Repair · ${fmt(cr.cost || 0)}`, cr.ok)}${btn('door', c.max ? 'MAX' : `Upgrade · ${fmt(c.cost)}`, c.ok)}</div>`;
    }
    this.infoKey = key;
    this.info.innerHTML = html;
    for (const el of this.info.querySelectorAll('[data-a]')) {
      el.addEventListener('click', (e) => {
        e.stopPropagation(); Audio.unlock();
        const a = el.dataset.a;
        if (a === 'close') { this.closeMenus(); return; }
        let r = null;
        if (a === 'up') r = g.upgradeBuilding(s, o.b);
        if (a === 'sell') { r = g.sellBuilding(s, o.b); if (r.ok) { this.closeMenus(); return; } }
        if (a === 'bed') r = g.upgradeBed(s);
        if (a === 'door') r = g.upgradeDoor(s);
        if (a === 'repair') r = g.repairDoor(s);
        if (r && !r.ok) { Audio.play('error'); this.toast(r.reason, 'bad'); }
        this.infoKey = '';
      });
      if (el.dataset.a === 'up' && o.b) {
        el.addEventListener('mouseenter', () => { const D = BUILDINGS[o.b.type]; if (D.range || D.kind === 'turret') this.R.setPreview(o.b.type, o.b.lvl + 1, o.b.tx, o.b.ty, true); });
        el.addEventListener('mouseleave', () => { this.R.preview = null; });
      }
    }
    if (o.b) { const D = BUILDINGS[o.b.type]; if ((D.range || D.kind === 'turret') && !this.R.preview) this.R.setPreview(o.b.type, o.b.lvl, o.b.tx, o.b.ty, true); }
  }

  // ---------------------------------------------------------------- events / messages
  onEvent(ev) {
    const g = this.g;
    switch (ev.type) {
      case 'phase':
        if (ev.phase === 'grace') {
          this.banner('DOORS LOCKED!', `Two bosses wake in ${Math.round(GRACE_TIME / PACE)}s — get building!`, 2.4);
          if (g.player.room && this.R.vw < 900) this.R.focusRoom(g.player.room);
        }
        break;
      case 'bossWake': this.banner('TWO BOSSES ARE AWAKE!', g.endless ? `Wave ${g.stats.wave}` : `${g.bosses.map((b) => b.name).join(' + ')} — survive until dawn`, 2.6); break;
      case 'bossLevel': { const b = $('boss-box' + Math.max(0, g.bosses.indexOf(ev.e))); b.classList.remove('levelup'); void b.offsetWidth; b.classList.add('levelup'); this.toast(`${ev.e.name} reached level ${ev.lvl}!`, 'bad'); break; }
      case 'bossRetreat': this.toast(`${ev.e.name} is fleeing to heal — finish it!`, 'good'); break;
      case 'bossDown': this.banner('ONE BOSS DOWN!', `${ev.left} to go — finish the other one for ★★★`, 2.2); break;
      case 'doorBreak': if (!ev.player && ev.room.owner) this.toast(`${ev.room.owner.name}'s door was smashed!`, 'bad'); break;
      case 'death': if (!ev.s.isPlayer && ev.why === 'corridor') this.toast(`${ev.s.name} was caught in the hallway!`, 'bad'); break;
      case 'minionSpawn': break;
      case 'claim':
        if (ev.s.isPlayer) {
          this.toast(`Room ${ev.room.label} is yours!`, 'good');
          if (!this.app.userPanned) this.R.focusRoom(ev.room);
        }
        break;
      case 'kill': if (ev.e.kind === 'boss') this.banner(g.endless ? 'BOSS DOWN!' : 'BOSS DEFEATED!', g.endless ? 'Another one is coming…' : 'You win the night!', 2.6); break;
      case 'win': if (!ev.killed) this.banner('DAWN!', 'The zombies retreat from the light', 2.6); break;
      case 'howl': this.toast('The Howler called more zombies!', 'bad'); break;
      case 'acid': if (ev.b.room === g.player.room) this.toast('Acid! A gadget is jammed', 'bad'); break;
      case 'toast': this.toast(ev.text, 'bad'); break;
      case 'waveCleared': this.toast(`Wave ${ev.wave} cleared! Next boss in ${Math.round(12 / PACE)}s`, 'good'); break;
    }
    if (this.tut) this.tutEvent(ev);
  }

  banner(text, sub, dur) {
    const b = $('banner');
    b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    this.bannerT = dur || 2;
  }
  toast(text, cls) {
    const box = $('toasts');
    if (box.children.length > 3) box.firstChild.remove();
    const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.textContent = text;
    box.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  // ---------------------------------------------------------------- tutorial
  tutEvent(ev) {
    const T = this.tut, g = this.g;
    if (ev.type === 'claim' && ev.s.isPlayer && T.step === 0) T.step = 1;
    if (ev.type === 'lie' && ev.s.isPlayer && T.step <= 1) T.step = 2;
    if (ev.type === 'upgrade' && ev.s && ev.s.isPlayer && ev.what === 'bed' && T.step === 2) T.step = 3;
    if (ev.type === 'build' && ev.s.isPlayer && T.step === 3) { T.step = 4; T.t = 0; }
    if (ev.type === 'bossWake' && T.step < 5) { T.step = 5; T.t = 0; }
    if ((ev.type === 'repair' || (ev.type === 'upgrade' && ev.what === 'door')) && ev.s && ev.s.isPlayer && T.step === 5) { T.step = 6; T.t = 0; }
  }
  updateTutorial(dt) {
    const T = this.tut, g = this.g;
    const box = $('tutorial'), arrow = $('tut-arrow');
    if (!T || !g || this.app.isOver()) { box.classList.add('hidden'); arrow.classList.add('hidden'); return; }
    T.t += dt;
    const s = g.player, room = s.room;
    let text = '', target = null, el = null;
    if (T.step === 2 && room && room.bedLvl >= 2) T.step = 3;
    if (T.step === 3 && room && room.buildings.length) { T.step = 4; T.t = 0; }
    if (T.step === 4 && T.t > 7) T.step = 4.5;
    if (T.step === 5 && T.t > 15) { T.step = 6; T.t = 0; }
    if (T.step === 6 && T.t > 7) { T.step = 7; }
    switch (T.step) {
      case 0: {
        text = 'Zombies are coming! <b>Click a free room</b> (green) to run inside before the timer runs out.';
        let best = null, bd = 1e9;
        for (const r of g.map.rooms) if (!r.owner) { const d = Math.hypot(r.doors[0].fx - s.x, r.doors[0].fy - s.y); if (d < bd) { bd = d; best = r; } }
        if (best) target = { x: best.x + best.w / 2, y: best.y + best.h / 2 };
        break;
      }
      case 1: text = 'Safe! Now <b>click your bed</b> to lie down. Resting earns scrap.'; if (room && s.state === 'inroom') target = { x: room.bed.x, y: room.bed.y - 0.6 }; break;
      case 2: text = 'Scrap pours in while you rest. <b>Upgrade your bed (B)</b> to double your income!'; el = $('act-bed'); break;
      case 3: {
        text = '<b>Click an empty floor tile</b> near your door and build a <b>Nail Gun</b>.';
        if (room) {
          const d = room.doors[0];
          const t = room.tiles.filter((q) => g.tileFree(room, q.tx, q.ty)).sort((a, b) => Math.hypot(a.tx - d.tx, a.ty - d.ty) - Math.hypot(b.tx - d.tx, b.ty - d.ty))[0];
          if (t) target = { x: t.tx + 0.5, y: t.ty + 0.2 };
        }
        break;
      }
      case 4: text = 'Nice! Turrets also shoot zombies attacking your <b>neighbours</b> — teamwork keeps everyone alive.'; break;
      case 4.5: text = 'Keep upgrading your bed, turrets and door. <b>The boss wakes up soon!</b>'; break;
      case 5: text = `Two bosses are attacking doors! When yours gets hurt, <b>Repair (R)</b> or <b>Upgrade the door (U)</b>.`; el = $('act-repair'); break;
      case 6: text = 'Survive until <b>dawn</b> — or help shoot the boss down for 3 stars!'; break;
      default: box.classList.add('hidden'); arrow.classList.add('hidden'); this.tut = null; return;
    }
    box.classList.remove('hidden');
    const tt = box.querySelector('.tut-text');
    if (tt.innerHTML !== text) { tt.innerHTML = text; box.querySelector('.tut-step').textContent = `Tutorial ${Math.min(6, Math.floor(T.step) + 1)}/7`; }
    let ax = null, ay = null;
    if (target) { const p = this.R.worldToScreen(target.x, target.y); ax = p.x; ay = p.y - 10; }
    else if (el && !el.closest('.hidden')) { const r = el.getBoundingClientRect(); ax = r.left + r.width / 2; ay = r.top - 6; }
    // world targets in the lower half of the screen push the bubble to the top so it never covers them
    this.tutUp = !!target && ay > this.R.insets.top + (window.innerHeight - this.R.insets.top - this.R.insets.bottom) * 0.5;
    if (ax != null) {
      arrow.classList.remove('hidden');
      arrow.style.left = (ax - 16) + 'px'; arrow.style.top = (ay - 26) + 'px';
    } else arrow.classList.add('hidden');
  }
}
