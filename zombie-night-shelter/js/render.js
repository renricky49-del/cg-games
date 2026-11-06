// Canvas renderer: static floor layer, entities, particles, lighting, camera.
import { IMG, white } from './assets.js';
import { tileKind } from './map.js';
import { BUILDINGS, bedSprite, doorSprite, spriteFor, turretStats } from './data.js';
import { fmt } from './sim.js';

export const TS = 48; // world pixels per tile
const TAU = Math.PI * 2;

const FLOORS = [
  { a: '#c98d5a', b: '#b97c4b', line: '#9c6438', kind: 'wood' },
  { a: '#8fb5c9', b: '#7fa6bb', line: '#5f8599', kind: 'tile' },
  { a: '#9fb07a', b: '#93a56e', line: '#76885a', kind: 'carpet' },
  { a: '#d6a971', b: '#c79a62', line: '#a77a45', kind: 'wood' },
  { a: '#c7a0c4', b: '#b891b5', line: '#946f91', kind: 'carpet' },
];

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.cam = { x: 0, y: 0, z: 1, tx: null, ty: null, tz: null, shake: 0, fit: 1 };
    this.particles = [];
    this.floaters = [];
    this.zaps = [];
    this.rings = [];
    this.hover = null;          // {tx,ty}
    this.preview = null;        // {x,y,r,color}
    this.selTile = null;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d');
    this.time = 0;
    this.insets = { top: 64, bottom: 96 };
    this.darkness = 0.5;
  }

  setGame(g) {
    this.g = g;
    this.particles.length = 0; this.floaters.length = 0; this.zaps.length = 0; this.rings.length = 0;
    this.buildStatic();
    this.fitCamera(true);
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const w = window.innerWidth, h = window.innerHeight;
    this.vw = w; this.vh = h;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.light.width = Math.ceil(w / 4); this.light.height = Math.ceil(h / 4);
    if (this.g) this.fitCamera(false);
  }

  fitScale() {
    const g = this.g; const W = g.map.W * TS, H = g.map.H * TS;
    const aw = this.vw - 8, ah = this.vh - this.insets.top - this.insets.bottom;
    return Math.min(aw / W, ah / H);
  }
  fitCamera(snap) {
    const g = this.g; if (!g) return;
    const z = this.fitScale();
    this.cam.fit = z;
    const cx = g.map.W * TS / 2, cy = g.map.H * TS / 2;
    if (snap) { this.cam.x = cx; this.cam.y = cy; this.cam.z = z; this.cam.tz = null; }
    else this.focus(cx, cy, z);
    this.clampCam();
  }
  focus(wx, wy, z) { this.cam.tx = wx; this.cam.ty = wy; this.cam.tz = z; }
  focusRoom(room) {
    const z = Math.max(this.cam.fit, Math.min(this.cam.fit * 2.4, (this.vh - this.insets.top - this.insets.bottom) / (TS * 10)));
    const d = room.doors[0];
    this.focus((room.x + room.w / 2) * TS, ((room.top ? room.y + 2.5 : room.y + 2.5) + (d.fy)) / 2 * TS, z);
  }
  clampCam() {
    const g = this.g; if (!g) return;
    const c = this.cam, W = g.map.W * TS, H = g.map.H * TS;
    c.z = Math.max(c.fit * 0.9, Math.min(c.fit * 3.5, c.z));
    const hw = (this.vw / 2) / c.z, hh = ((this.vh - this.insets.top - this.insets.bottom) / 2) / c.z;
    c.x = W <= hw * 2 ? W / 2 : Math.max(hw, Math.min(W - hw, c.x));
    c.y = H <= hh * 2 ? H / 2 : Math.max(hh, Math.min(H - hh, c.y));
  }
  zoomAt(sx, sy, f) {
    const before = this.screenToWorld(sx, sy);
    this.cam.z *= f; this.cam.tz = null; this.cam.tx = null;
    this.clampCam();
    const after = this.screenToWorld(sx, sy);
    this.cam.x += (before.x - after.x) * TS; this.cam.y += (before.y - after.y) * TS;
    this.clampCam();
  }
  pan(dx, dy) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.cam.tx = null; this.cam.tz = null; this.clampCam(); }
  centerY() { return this.insets.top + (this.vh - this.insets.top - this.insets.bottom) / 2; }
  screenToWorld(sx, sy) { // returns tile units
    const c = this.cam;
    return { x: ((sx - this.vw / 2) / c.z + c.x) / TS, y: ((sy - this.centerY()) / c.z + c.y) / TS };
  }
  worldToScreen(x, y) { // tile units -> css px
    const c = this.cam;
    return { x: (x * TS - c.x) * c.z + this.vw / 2, y: (y * TS - c.y) * c.z + this.centerY() };
  }

  // ------------------------------------------------------------------ static layer
  buildStatic() {
    const g = this.g, m = g.map;
    const c = document.createElement('canvas');
    c.width = m.W * TS; c.height = m.H * TS;
    const x = c.getContext('2d');
    const rnd = mul(m.W * 7 + m.rooms.length);
    x.fillStyle = '#1b1c26'; x.fillRect(0, 0, c.width, c.height);
    // floors
    m.rooms.forEach((r, i) => {
      const F = FLOORS[(i * 3 + m.W) % FLOORS.length];
      r.floor = F;
      drawFloor(x, r.x * TS, r.y * TS, r.w * TS, r.h * TS, F, rnd);
    });
    // corridor linoleum
    for (let ty = 7; ty < 10; ty++) for (let tx = 1; tx < m.W - 1; tx++) {
      x.fillStyle = (tx + ty) % 2 ? '#a9b0b8' : '#959ca6';
      x.fillRect(tx * TS, ty * TS, TS, TS);
      x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(tx * TS + 2, ty * TS + 2, TS - 4, 4);
    }
    // corridor runner carpet
    x.fillStyle = '#7b3b3b'; x.fillRect(6 * TS, 8.25 * TS, (m.W - 7) * TS, TS * 0.5);
    x.fillStyle = '#9b4c4a'; x.fillRect(6 * TS, 8.3 * TS, (m.W - 7) * TS, TS * 0.06); x.fillRect(6 * TS, 8.64 * TS, (m.W - 7) * TS, TS * 0.06);
    // lair: dark concrete + stairs
    x.fillStyle = '#3a3d3a'; x.fillRect(1 * TS, 1 * TS, 4 * TS, 15 * TS);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${rnd() < 0.5 ? '20,40,20' : '60,20,20'},${0.15 + rnd() * 0.2})`;
      x.beginPath(); x.ellipse((1 + rnd() * 4) * TS, (1 + rnd() * 15) * TS, 6 + rnd() * 16, 4 + rnd() * 10, rnd() * 3, 0, TAU); x.fill();
    }
    for (let s = 0; s < 6; s++) { // stairs going up/down
      x.fillStyle = s % 2 ? '#4a4d4a' : '#555855';
      x.fillRect(1.2 * TS, (1.3 + s * 0.5) * TS, 3.6 * TS, 0.5 * TS);
      x.fillRect(1.2 * TS, (12.6 + s * 0.5) * TS, 3.6 * TS, 0.5 * TS);
    }
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(1 * TS, 1 * TS, 4 * TS, 15 * TS);
    // walls
    for (let ty = 0; ty < m.H; ty++) for (let tx = 0; tx < m.W; tx++) {
      const k = tileKind(m, tx, ty);
      if (k === 'wall' || k === 'door') drawWall(x, tx, ty, m);
    }
    // inner shadows along walls
    x.fillStyle = 'rgba(0,0,0,0.18)';
    for (const r of m.rooms) { x.fillRect(r.x * TS, r.y * TS, r.w * TS, 8); x.fillRect(r.x * TS, r.y * TS, 6, r.h * TS); }
    x.fillRect(1 * TS, 7 * TS, (m.W - 2) * TS, 8);
    // painted lair sign
    x.save(); x.translate(3 * TS, 8.5 * TS); x.rotate(-Math.PI / 2);
    x.font = `bold ${TS * 0.42}px "Lilita One", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(160,30,30,0.55)'; x.fillText('STAIRWELL', 0, 0); x.restore();
    // room numbers painted on floor
    x.font = `bold ${TS * 0.35}px "Lilita One", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const r of m.rooms) {
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillText(r.label, (r.x + r.w / 2) * TS, (r.top ? r.y + 4.5 : r.y + 0.5) * TS);
    }
    this.staticLayer = c;
  }

  // ------------------------------------------------------------------ events -> fx
  onEvent(ev, isNear) {
    const g = this.g;
    switch (ev.type) {
      case 'hit': {
        if (ev.src === 'nail' || ev.src === 'bolt') this.burst(ev.x, ev.y, ev.src === 'bolt' ? 5 : 2, '#ffd27a', 2.5, 0.25);
        if (ev.player) this.floatText(ev.x + (Math.random() - 0.5) * 0.6, ev.y - 0.4, fmt(ev.dmg), ev.src === 'zap' ? '#8ee7ff' : '#fff', 0.7);
        break;
      }
      case 'doorHit': {
        this.burst(ev.x, ev.y, 6, '#a8743f', 3, 0.5, 'chip');
        if (ev.player) { this.shake(7); this.floatText(ev.x, ev.y - 0.3, '-' + fmt(ev.dmg), '#ff5a4a', 0.9); }
        else this.shake(1.2);
        break;
      }
      case 'doorBreak':
        this.burst(ev.x, ev.y, 26, '#a8743f', 5, 0.9, 'chip'); this.burst(ev.x, ev.y, 14, '#777', 3, 1, 'smoke');
        this.shake(ev.player ? 16 : 6); break;
      case 'destroyed': this.burst(ev.x, ev.y, 10, '#666', 3, 0.8, 'smoke'); break;
      case 'repair': this.burst(ev.x, ev.y, 10, '#7dff8a', 2.5, 0.6, 'plus'); this.ring(ev.x, ev.y, '#7dff8a'); break;
      case 'upgrade':
        this.burst(ev.x, ev.y, 18, '#ffe066', 3.5, 0.7, 'star'); this.ring(ev.x, ev.y, '#ffe066');
        if (ev.s && ev.s.isPlayer) this.floatText(ev.x, ev.y - 0.5, 'Lv ' + ev.lvl, '#ffe066', 1.1, true);
        break;
      case 'build': this.burst(ev.x, ev.y, 14, '#d9d0c0', 3, 0.5, 'smoke'); this.ring(ev.x, ev.y, '#fff'); break;
      case 'sell': this.burst(ev.x, ev.y, 10, '#ffd84a', 3, 0.6); this.floatText(ev.x, ev.y, '+' + fmt(ev.refund), '#ffd84a', 1); break;
      case 'coins':
        if (ev.s.isPlayer) { this.floatText(ev.x, ev.y, '+' + fmt(ev.n), '#ffd84a', 0.9, false, true); }
        break;
      case 'float': this.floatText(ev.x, ev.y, ev.text, ev.color, ev.big ? 1.3 : 0.9, ev.big); break;
      case 'shoot': this.burst(ev.x + Math.cos(ev.angle) * 0.4, ev.y + Math.sin(ev.angle) * 0.4, 2, '#fff2a8', 2, 0.12); break;
      case 'zap': this.zaps.push({ pts: ev.pts, life: 0.16 }); break;
      case 'kill':
        this.burst(ev.x, ev.y, ev.e.kind === 'boss' ? 40 : 14, '#6fbf4a', 4, 0.9, 'goo');
        if (ev.e.kind === 'boss') { this.shake(14); this.ring(ev.x, ev.y, '#fff', 3); }
        break;
      case 'death': this.burst(ev.x, ev.y, 10, '#c33', 2.5, 0.7); break;
      case 'minionSpawn': this.burst(ev.x, ev.y, 12, '#6fbf4a', 2, 0.8, 'smoke'); break;
      case 'bossLevel': this.ring(ev.x, ev.y, '#ff5040', 2.4); this.shake(6); this.floatText(ev.x, ev.y - 1.4, 'LEVEL ' + ev.lvl + '!', '#ff6a50', 1.5, true); break;
      case 'acid': this.acid(ev.x, ev.y, ev.tx, ev.ty); break;
      case 'howl': this.ring(ev.x, ev.y, '#c58cff', 3); this.shake(4); break;
      case 'chargeHit': this.shake(10); this.burst(ev.x, ev.y, 20, '#fff', 4, 0.5); break;
      case 'claim': this.ring(ev.room.doors[0].fx, ev.room.doors[0].fy, ev.s.isPlayer ? '#7dff8a' : '#fff'); break;
      case 'continue': this.ring(g.player.x, g.player.y, '#7dff8a', 4); break;
    }
  }
  shake(a) { this.cam.shake = Math.min(18, Math.max(this.cam.shake, a)); }
  burst(x, y, n, color, spd, life, kind) {
    if (this.particles.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'smoke' ? 0.6 : 0), life: life * (0.6 + Math.random() * 0.6), max: life, color, kind, size: kind === 'smoke' ? 0.18 + Math.random() * 0.15 : 0.06 + Math.random() * 0.06, rot: Math.random() * 6 });
    }
  }
  ring(x, y, color, r = 1.2) { this.rings.push({ x, y, color, r, life: 0.45, max: 0.45 }); }
  floatText(x, y, text, color, size = 1, bold = false, coin = false) {
    if (this.floaters.length > 80) this.floaters.shift();
    this.floaters.push({ x, y, text, color, size, life: 1.1, max: 1.1, bold, coin });
  }
  acid(x, y, tx, ty) {
    for (let i = 0; i < 8; i++) this.particles.push({ x, y, vx: (tx - x) * 1.6 + (Math.random() - 0.5), vy: (ty - y) * 1.6 + (Math.random() - 0.5), life: 0.6, max: 0.6, color: '#b8e02a', kind: 'goo', size: 0.12, rot: 0 });
  }

  update(dt) {
    this.time += dt;
    const c = this.cam;
    if (c.tz != null) {
      const k = Math.min(1, dt * 4);
      c.z += (c.tz - c.z) * k;
      if (c.tx != null) { c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k; }
      this.clampCam();
      if (Math.abs(c.tz - c.z) < 0.002) { c.tz = null; c.tx = null; }
    }
    c.shake = Math.max(0, c.shake - dt * 40);
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const drag = p.kind === 'smoke' ? 0.9 : 0.94;
      p.vx *= Math.pow(drag, dt * 60); p.vy *= Math.pow(drag, dt * 60);
      if (p.kind === 'chip' || p.kind === 'goo') p.vy += dt * 2;
      p.rot += dt * 6;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y -= dt * (f.coin ? 0.7 : 1.1); }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const z of this.zaps) z.life -= dt;
    this.zaps = this.zaps.filter((z) => z.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  // ------------------------------------------------------------------ draw
  draw() {
    const g = this.g, ctx = this.ctx, c = this.cam;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#12131b'; ctx.fillRect(0, 0, this.vw, this.vh);
    if (!g) return;
    const sx = (Math.random() - 0.5) * c.shake, sy = (Math.random() - 0.5) * c.shake;
    ctx.save();
    ctx.translate(this.vw / 2 + sx, this.centerY() + sy);
    ctx.scale(c.z, c.z);
    ctx.translate(-c.x, -c.y);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.staticLayer, 0, 0);
    this.drawRooms(ctx);
    this.drawHover(ctx);
    this.drawBuildings(ctx);
    this.drawSurvivors(ctx);
    this.drawDoors(ctx);
    this.drawEnemies(ctx);
    this.drawProjectiles(ctx);
    this.drawFx(ctx);
    this.drawPreview(ctx);
    ctx.restore();
    this.drawLighting(ctx);
    // world-space overlays drawn above lighting (labels, bars, floaters)
    ctx.save();
    ctx.translate(this.vw / 2 + sx, this.centerY() + sy);
    ctx.scale(c.z, c.z);
    ctx.translate(-c.x, -c.y);
    this.drawLabels(ctx);
    this.drawFloaters(ctx);
    ctx.restore();
  }

  drawRooms(ctx) {
    const g = this.g, t = this.time;
    for (const r of g.map.rooms) {
      // decor (hidden by buildings)
      for (const d of r.decor) {
        if (r.buildings.find((b) => b.tx === d.tx && b.ty === d.ty)) continue;
        const im = IMG[d.kind]; if (!im) continue;
        const s = d.kind === 'rug' ? 0.95 : 0.7;
        drawSprite(ctx, im, (d.tx + 0.5) * TS, (d.ty + 0.5) * TS, TS * s, d.rot);
      }
      // bed
      const bimg = IMG[bedSprite(r.bedLvl)];
      if (bimg) {
        const bw = TS * 0.95, bh = bw * bimg.height / bimg.width;
        const scl = Math.min(1, (TS * 1.95) / bh);
        ctx.save(); ctx.translate((r.bed.tx + 0.5) * TS, (r.bed.ty + 1) * TS);
        if (!r.top) ctx.rotate(Math.PI);
        ctx.drawImage(bimg, -bw * scl / 2, -bh * scl / 2, bw * scl, bh * scl);
        ctx.restore();
      }
      if (r.rubble) {
        ctx.fillStyle = 'rgba(30,10,10,0.35)'; ctx.fillRect(r.x * TS, r.y * TS, r.w * TS, r.h * TS);
        const rim = IMG.rubble;
        if (rim) for (let i = 0; i < 3; i++) drawSprite(ctx, rim, (r.x + 0.8 + ((i * 1.7) % (r.w - 1))) * TS, (r.y + 1 + (i % 2) * 2.5) * TS, TS * 0.9, i);
      }
      // rush: highlight free rooms
      if (g.phase === 'rush' && !r.owner && g.player.state === 'corridor') {
        const a = 0.25 + 0.2 * Math.sin(t * 5);
        ctx.strokeStyle = `rgba(125,255,138,${a + 0.3})`; ctx.lineWidth = 4;
        ctx.strokeRect(r.x * TS + 3, r.y * TS + 3, r.w * TS - 6, r.h * TS - 6);
        if (this.hoverRoom === r) { ctx.fillStyle = 'rgba(125,255,138,0.18)'; ctx.fillRect(r.x * TS, r.y * TS, r.w * TS, r.h * TS); }
      }
      if (g.player.room === r) {
        ctx.strokeStyle = 'rgba(255,216,74,0.55)'; ctx.lineWidth = 3;
        ctx.strokeRect(r.x * TS + 2, r.y * TS + 2, r.w * TS - 4, r.h * TS - 4);
      }
      if (r.flash > 0 && r.owner && r.owner.isPlayer) {
        ctx.fillStyle = `rgba(255,40,30,${r.flash})`; ctx.fillRect(r.x * TS, r.y * TS, r.w * TS, r.h * TS);
      }
    }
  }

  drawHover(ctx) {
    const g = this.g, p = g.player;
    const tiles = [];
    if (this.hover && p.room && p.state === 'inroom' && p.room.alive) {
      const r = p.room, h = this.hover;
      if (h.tx >= r.x && h.tx < r.x + r.w && h.ty >= r.y && h.ty < r.y + r.h) tiles.push({ ...h, sel: false });
    }
    if (this.selTile) tiles.push({ ...this.selTile, sel: true });
    for (const h of tiles) {
      const r = p.room; if (!r) continue;
      const free = g.tileFree(r, h.tx, h.ty);
      const occupied = r.buildings.find((b) => b.tx === h.tx && b.ty === h.ty);
      let col = free ? '125,255,138' : occupied ? '255,216,74' : '255,255,255';
      const bedHit = h.tx === r.bed.tx && (h.ty === r.bed.ty || h.ty === r.bed.ty + 1);
      if (bedHit) col = '255,216,74';
      ctx.fillStyle = `rgba(${col},${h.sel ? 0.3 : 0.16})`;
      ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = h.sel ? 3 : 2;
      if (bedHit) { ctx.fillRect(r.bed.tx * TS, r.bed.ty * TS, TS, TS * 2); ctx.strokeRect(r.bed.tx * TS + 1, r.bed.ty * TS + 1, TS - 2, TS * 2 - 2); }
      else { ctx.fillRect(h.tx * TS, h.ty * TS, TS, TS); roundRect(ctx, h.tx * TS + 2, h.ty * TS + 2, TS - 4, TS - 4, 6); ctx.stroke(); }
    }
  }

  drawBuildings(ctx) {
    const g = this.g, t = this.time;
    for (const b of g.buildings) {
      const D = BUILDINGS[b.type];
      const im = IMG[spriteFor(b.type, b.lvl)]; if (!im) continue;
      const pop = 1 + b.pop * 0.35 * Math.sin(b.pop * 9);
      const cx = b.x * TS, cy = b.y * TS;
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 6, TS * 0.38, TS * 0.3, 0, 0, TAU); ctx.fill();
      let rot = 0;
      if (D.kind === 'turret') rot = b.angle + Math.PI / 2;
      let s = TS * 0.92 * pop;
      if (b.type === 'freezer' || b.type === 'generator') s *= 1 + Math.sin(t * 8 + b.id) * 0.015;
      drawSprite(ctx, im, cx, cy, s, rot);
      if (b.flash > 0) {
        ctx.fillStyle = '#fff6b0';
        ctx.beginPath(); ctx.arc(cx + Math.cos(b.angle) * TS * 0.48, cy + Math.sin(b.angle) * TS * 0.48, TS * 0.13, 0, TAU); ctx.fill();
      }
      if (b.disabledT > 0) {
        ctx.fillStyle = 'rgba(150,220,40,0.45)'; ctx.beginPath(); ctx.arc(cx, cy, TS * 0.42, 0, TAU); ctx.fill();
      }
      if (b.type === 'freezer' && b.disabledT <= 0 && g.phase === 'night') {
        const R = (D.range + D.rangeUp * (b.lvl - 1)) * TS;
        ctx.fillStyle = `rgba(160,220,255,${0.05 + 0.03 * Math.sin(t * 3)})`; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
      }
      // level pip
      if (b.lvl > 1) {
        ctx.fillStyle = '#1d1d28'; ctx.beginPath(); ctx.arc(cx + TS * 0.32, cy + TS * 0.32, TS * 0.16, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd84a'; ctx.font = `bold ${TS * 0.2}px "Lilita One", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(b.lvl, cx + TS * 0.32, cy + TS * 0.33);
      }
    }
  }

  drawSurvivors(ctx) {
    const g = this.g, t = this.time;
    for (const s of g.survivors) {
      if (s.state === 'dead') continue;
      const im = IMG[s.skin]; if (!im) continue;
      const cx = s.x * TS, cy = s.y * TS;
      if (s.lying) {
        // asleep on the bed: head on the pillow
        const r = s.room;
        const hy = r.top ? (r.bed.ty + 0.85) * TS : (r.bed.ty + 1.15) * TS;
        const breathe = 1 + Math.sin(t * 2 + s.id) * 0.03;
        drawSprite(ctx, im, cx, hy, TS * 0.8 * breathe, r.top ? 0 : Math.PI);
        // blanket fold over the body
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(cx - TS * 0.42, r.top ? hy + TS * 0.12 : hy - TS * 0.5, TS * 0.84, TS * 0.38);
        continue;
      }
      const bob = s.path.length || s.vx || s.vy ? Math.sin(s.walkT * 14) * 0.06 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + TS * 0.22, TS * 0.3, TS * 0.16, 0, 0, TAU); ctx.fill();
      drawSprite(ctx, im, cx, cy, TS * 0.85 * (1 + bob), s.dir - Math.PI / 2);
      if (s.isPlayer && g.phase === 'rush') {
        ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, TS * 0.52 + Math.sin(t * 6) * 2, 0, TAU); ctx.stroke();
      }
    }
  }

  drawDoors(ctx) {
    const g = this.g;
    for (const r of g.map.rooms) {
      for (const d of r.doors) {
        const cx = (d.tx + 0.5) * TS, cy = (d.ty + 0.5) * TS;
        if (!r.owner && g.phase === 'rush') { // open door
          const im = IMG.door1; if (!im) continue;
          ctx.save(); ctx.translate(d.tx * TS + 4, r.top ? d.ty * TS : (d.ty + 1) * TS);
          ctx.rotate(r.top ? -Math.PI / 2 : Math.PI / 2);
          ctx.globalAlpha = 0.95;
          const w = TS * 0.95, h = w * im.height / im.width;
          ctx.drawImage(im, 0, -h / 2, w, h); ctx.restore();
          continue;
        }
        if (r.rubble) { const im = IMG.rubble; if (im) drawSprite(ctx, im, cx, cy, TS * 0.9, d.tx); continue; }
        const im = IMG[doorSprite(r.doorLvl)]; if (!im) continue;
        const sh = d.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
        const w = TS * 1.12, h = w * im.height / im.width;
        ctx.drawImage(im, cx - w / 2 + sh, cy - h / 2, w, h);
        if (r.owner) {
          const frac = d.hp / g.doorMax(r);
          drawCracks(ctx, cx + sh, cy, w, h, frac, d.tx * 13 + d.ty);
          if (r.flash > 0) { ctx.fillStyle = `rgba(255,60,40,${r.flash * 3})`; ctx.fillRect(cx - w / 2, cy - h / 2, w, h); }
        }
      }
    }
  }

  drawEnemies(ctx) {
    const g = this.g, t = this.time;
    const list = g.enemies.slice().sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (!e.alive) continue;
      const im = IMG[e.sprite]; if (!im) continue;
      const size = (e.kind === 'boss' ? TS * 2.0 * (e.r / 0.8) : TS * 0.9);
      let cx = e.x * TS, cy = e.y * TS;
      if (e.lunge > 0) { e.lunge -= 1 / 60; cx += Math.cos(e.dir) * 6; cy += Math.sin(e.dir) * 6; }
      const walking = e.state === 'walk' || e.state === 'retreat';
      const wob = walking ? Math.sin(e.walkT * 5) * 0.08 : Math.sin(t * 2 + e.id) * 0.02;
      const alpha = e.rise > 0 ? Math.max(0.2, 1 - e.rise) : 1;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.25, size * 0.36, size * 0.18, 0, 0, TAU); ctx.fill();
      const rot = e.dir - Math.PI / 2 + wob;
      if (e.kind === 'boss' && e.state === 'sleep') {
        drawSprite(ctx, im, cx, cy, size * (1 + Math.sin(t * 1.5) * 0.02), Math.PI / 2);
        ctx.fillStyle = '#fff'; ctx.font = `bold ${TS * 0.4}px "Lilita One", Impact, sans-serif`; ctx.textAlign = 'center';
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2);
        ctx.fillText('z', cx + TS * 0.7, cy - TS * 0.9 - (t * 10 % 10)); ctx.globalAlpha = 1;
      } else {
        drawSprite(ctx, im, cx, cy, size, rot);
      }
      if (e.hitFlash > 0) { ctx.globalAlpha = 0.6; drawSprite(ctx, white(e.sprite), cx, cy, size, rot); ctx.globalAlpha = 1; }
      if (e.slow > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#9fe2ff'; ctx.beginPath(); ctx.arc(cx, cy, size * 0.42, 0, TAU); ctx.fill(); }
      if (e.charging) { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - Math.cos(e.dir) * TS * i * 0.5 - 10, cy - Math.sin(e.dir) * TS * i * 0.5); ctx.lineTo(cx - Math.cos(e.dir) * TS * i * 0.5 + 10, cy - Math.sin(e.dir) * TS * i * 0.5); ctx.stroke(); } }
      if (e.state === 'heal') { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6); ctx.fillStyle = '#7dff8a'; ctx.font = `bold ${TS * 0.5}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('+', cx + Math.sin(t * 3) * TS * 0.5, cy - size * 0.5 - (t * 20 % 20)); }
      ctx.globalAlpha = 1;
    }
  }

  drawProjectiles(ctx) {
    for (const p of this.g.projectiles) {
      const cx = p.x * TS, cy = p.y * TS;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(p.angle || 0);
      if (p.type === 'bolt') {
        ctx.fillStyle = '#6b4a2a'; ctx.fillRect(-14, -2, 24, 4);
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(17, 0); ctx.lineTo(10, 4); ctx.fill();
        ctx.fillStyle = '#e44'; ctx.fillRect(-14, -4, 5, 8);
      } else {
        ctx.fillStyle = '#ffe9a0'; ctx.fillRect(-7, -1.5, 12, 3);
        ctx.fillStyle = 'rgba(255,230,140,0.35)'; ctx.fillRect(-16, -1, 10, 2);
      }
      ctx.restore();
    }
  }

  drawFx(ctx) {
    for (const z of this.zaps) {
      ctx.strokeStyle = `rgba(140,230,255,${z.life * 6})`; ctx.lineWidth = 4;
      ctx.shadowColor = '#7fe0ff'; ctx.shadowBlur = 12;
      ctx.beginPath();
      for (let i = 0; i < z.pts.length - 1; i++) {
        const a = z.pts[i], b = z.pts[i + 1];
        ctx.moveTo(a.x * TS, a.y * TS);
        for (let k = 1; k <= 5; k++) {
          const f = k / 5;
          const jx = k < 5 ? (Math.random() - 0.5) * 16 : 0, jy = k < 5 ? (Math.random() - 0.5) * 16 : 0;
          ctx.lineTo((a.x + (b.x - a.x) * f) * TS + jx, (a.y + (b.y - a.y) * f) * TS + jy);
        }
      }
      ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.shadowBlur = 0;
    }
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * TS * (p.kind === 'smoke' ? 2 - a : 1);
      if (p.kind === 'chip') { ctx.save(); ctx.translate(p.x * TS, p.y * TS); ctx.rotate(p.rot); ctx.fillRect(-s, -s / 2, s * 2, s); ctx.restore(); }
      else if (p.kind === 'plus') { ctx.fillRect(p.x * TS - s, p.y * TS - s / 3, s * 2, s * 0.66); ctx.fillRect(p.x * TS - s / 3, p.y * TS - s, s * 0.66, s * 2); }
      else if (p.kind === 'star') { star(ctx, p.x * TS, p.y * TS, s * 1.4, p.rot); }
      else { ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, s, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const f = 1 - r.life / r.max;
      ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - f; ctx.lineWidth = 4 * (1 - f) + 1;
      ctx.beginPath(); ctx.arc(r.x * TS, r.y * TS, r.r * TS * (0.3 + f), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawPreview(ctx) {
    const p = this.preview; if (!p) return;
    ctx.fillStyle = p.fill || 'rgba(125,255,138,0.10)'; ctx.strokeStyle = p.color || 'rgba(125,255,138,0.85)';
    ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -this.time * 30;
    ctx.beginPath(); ctx.arc(p.x * TS, p.y * TS, p.r * TS, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (p.ghost) {
      const im = IMG[p.ghost];
      if (im) { ctx.globalAlpha = 0.55; drawSprite(ctx, im, p.x * TS, p.y * TS, TS * 0.92, 0); ctx.globalAlpha = 1; }
    }
  }

  drawLighting(ctx) {
    const g = this.g, L = this.lctx, w = this.light.width, h = this.light.height;
    let dark = 0.42;
    let tint = '8,12,40';
    if (g.phase === 'rush') dark = 0.25;
    else if (g.phase === 'grace') dark = 0.25 + 0.2 * (1 - g.phaseT / 30);
    else if (g.phase === 'night' || g.phase === 'lost') {
      dark = 0.48;
      if (!g.endless && g.nightLeft < 25) { dark = 0.48 * (g.nightLeft / 25); tint = '40,20,10'; }
    } else if (g.phase === 'won') { dark = 0; }
    this.darkness += (dark - this.darkness) * 0.05;
    if (this.darkness < 0.02) return;
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, w, h);
    L.fillStyle = `rgba(${tint},${this.darkness})`; L.fillRect(0, 0, w, h);
    L.globalCompositeOperation = 'destination-out';
    const z = this.cam.z / 4;
    const light = (x, y, r, a) => {
      const p = this.worldToScreen(x, y);
      const px = p.x / 4, py = p.y / 4, rr = r * TS * z;
      if (px + rr < 0 || py + rr < 0 || px - rr > w || py - rr > h) return;
      const gr = L.createRadialGradient(px, py, 0, px, py, rr);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = gr; L.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    };
    const t = this.time;
    for (let x = 8; x < g.map.W - 2; x += 7) light(x, 8.5, 3.2, 0.55 + Math.sin(t * 13 + x) * 0.05 * (Math.sin(t * 0.7 + x) > 0.8 ? 6 : 1));
    for (const r of g.map.rooms) {
      if (!r.owner || !r.alive || r.owner.state === 'dead') continue;
      light(r.bed.x, r.bed.y, r.owner.isPlayer ? 4.2 : 3.0, r.owner.isPlayer ? 0.95 : 0.7);
      light(r.x + r.w / 2, r.y + r.h / 2, 3, 0.4);
    }
    for (const b of g.buildings) if (b.flash > 0) light(b.x, b.y, 1.6, 0.8);
    for (const z2 of this.zaps) for (const p of z2.pts) light(p.x, p.y, 1.8, 0.9);
    light(g.boss.x, g.boss.y, 2.2, 0.35);
    L.globalCompositeOperation = 'source-over';
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.light, 0, 0, w, h, 0, 0, w * 4, h * 4);
  }

  drawLabels(ctx) {
    const g = this.g;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // room owner tags + door hp bars
    for (const r of g.map.rooms) {
      if (r.owner) {
        const dead = r.owner.state === 'dead';
        const lx = (r.x + r.w / 2) * TS, ly = (r.top ? r.y + 0.3 : r.y + r.h - 0.3) * TS;
        const name = r.owner.isPlayer ? 'YOU' : r.owner.name;
        ctx.font = `bold ${TS * 0.3}px "Lilita One", Impact, sans-serif`;
        const tw = ctx.measureText(name + '  Lv' + r.bedLvl).width + 16;
        ctx.fillStyle = dead ? 'rgba(80,0,0,0.75)' : r.owner.isPlayer ? 'rgba(255,190,40,0.92)' : 'rgba(20,22,34,0.78)';
        roundRect(ctx, lx - tw / 2, ly - TS * 0.2, tw, TS * 0.4, 8); ctx.fill();
        ctx.fillStyle = r.owner.isPlayer ? '#2a1a00' : dead ? '#ff8a8a' : '#fff';
        ctx.fillText(dead ? name + ' ✖' : name + '  Lv' + r.bedLvl, lx, ly + 1);
        if (!r.alive || dead) continue;
        const m = g.doorMax(r);
        for (const d of r.doors) {
          const f = Math.max(0, d.hp / m);
          const bw = TS * 1.1, bx = (d.tx + 0.5) * TS - bw / 2, by = (r.top ? d.ty + 1.12 : d.ty - 0.27) * TS;
          if (f > 0.999 && r.hitT > 3 && !r.owner.isPlayer) continue;
          ctx.fillStyle = 'rgba(0,0,0,0.7)'; roundRect(ctx, bx - 2, by - 2, bw + 4, TS * 0.16 + 4, 4); ctx.fill();
          ctx.fillStyle = f > 0.6 ? '#62d26f' : f > 0.3 ? '#f2c23a' : '#ff4b3a';
          ctx.fillRect(bx, by, bw * f, TS * 0.16);
          if (r.owner.isPlayer) {
            ctx.font = `bold ${TS * 0.22}px "Lilita One", Impact, sans-serif`;
            ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
            const txt = fmt(d.hp) + '/' + fmt(m);
            const ty = by + (r.top ? TS * 0.36 : -TS * 0.22);
            ctx.strokeText(txt, (d.tx + 0.5) * TS, ty); ctx.fillText(txt, (d.tx + 0.5) * TS, ty);
          }
        }
      }
    }
    // survivor names during rush
    if (g.phase === 'rush') {
      ctx.font = `bold ${TS * 0.26}px "Lilita One", Impact, sans-serif`;
      for (const s of g.survivors) {
        if (s.state !== 'corridor' && s.state !== 'entering') continue;
        ctx.fillStyle = s.isPlayer ? '#ffd84a' : '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
        ctx.strokeText(s.isPlayer ? 'YOU' : s.name, s.x * TS, s.y * TS - TS * 0.6); ctx.fillText(s.isPlayer ? 'YOU' : s.name, s.x * TS, s.y * TS - TS * 0.6);
      }
    }
    // enemy bars
    for (const e of g.enemies) {
      if (!e.alive || e.rise > 0) continue;
      const size = e.kind === 'boss' ? TS * 2.0 * (e.r / 0.8) : TS * 0.9;
      const bw = e.kind === 'boss' ? TS * 1.8 : TS * 0.8;
      const bx = e.x * TS - bw / 2, by = e.y * TS - size * 0.55 - 10;
      if (e.kind === 'minion' && e.hp >= e.maxHp) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; roundRect(ctx, bx - 2, by - 2, bw + 4, (e.kind === 'boss' ? 10 : 6) + 4, 4); ctx.fill();
      ctx.fillStyle = e.kind === 'boss' ? '#ff4b3a' : '#9bd16a';
      ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), e.kind === 'boss' ? 10 : 6);
      if (e.kind === 'boss') {
        // level badge
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(bx - 10, by + 5, 14, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2a1a00'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#2a1a00'; ctx.font = `bold 15px "Lilita One", Impact, sans-serif`;
        ctx.fillText(e.lvl, bx - 10, by + 6);
      }
    }
  }

  drawFloaters(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      const a = Math.min(1, f.life / f.max * 2.5);
      const pop = f.life > f.max - 0.15 ? 1 + (f.life - (f.max - 0.15)) * 3 : 1;
      ctx.globalAlpha = a;
      ctx.font = `${f.bold ? 'bold ' : ''}${Math.round(TS * 0.34 * f.size * pop)}px "Lilita One", Impact, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      let x = f.x * TS;
      if (f.coin && IMG.i_scrap) { const s = TS * 0.3 * f.size; ctx.drawImage(IMG.i_scrap, x - s - ctx.measureText(f.text).width / 2 - 2, f.y * TS - s / 2, s, s); }
      ctx.strokeText(f.text, x, f.y * TS); ctx.fillStyle = f.color; ctx.fillText(f.text, x, f.y * TS);
    }
    ctx.globalAlpha = 1;
  }

  // range preview for a building type/level at tile
  setPreview(type, lvl, tx, ty, ok) {
    if (!type) { this.preview = null; return; }
    const D = BUILDINGS[type];
    let r = D.range ? D.range + (D.rangeUp || 0) * (lvl - 1) : 0.6;
    if (D.kind === 'turret') r = turretStats(type, lvl).range;
    this.preview = {
      x: tx + 0.5, y: ty + 0.5, r,
      color: ok ? 'rgba(125,255,138,0.9)' : 'rgba(255,90,70,0.9)',
      fill: ok ? 'rgba(125,255,138,0.10)' : 'rgba(255,90,70,0.08)',
      ghost: lvl === 1 ? spriteFor(type, 1) : null,
    };
  }
}

// ------------------------------------------------------------------ helpers
export function drawSprite(ctx, im, x, y, size, rot) {
  if (!im) return;
  const s = size / Math.max(im.width, im.height);
  const w = im.width * s, h = im.height * s;
  if (rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
  else ctx.drawImage(im, x - w / 2, y - h / 2, w, h);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
function mul(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function drawFloor(x, px, py, w, h, F, rnd) {
  x.fillStyle = F.a; x.fillRect(px, py, w, h);
  if (F.kind === 'wood') {
    const pw = TS / 3;
    for (let yy = 0; yy < h; yy += pw) {
      x.fillStyle = (yy / pw) % 2 ? F.b : F.a; x.fillRect(px, py + yy, w, pw);
      x.fillStyle = F.line; x.fillRect(px, py + yy, w, 1.5);
      let off = rnd() * TS;
      for (let xx = off; xx < w; xx += TS * (1.2 + rnd())) x.fillRect(px + xx, py + yy, 1.5, pw);
    }
  } else if (F.kind === 'tile') {
    for (let yy = 0; yy < h; yy += TS / 2) for (let xx = 0; xx < w; xx += TS / 2) {
      x.fillStyle = ((xx + yy) / (TS / 2)) % 2 ? F.a : F.b; x.fillRect(px + xx, py + yy, TS / 2, TS / 2);
      x.fillStyle = F.line; x.fillRect(px + xx, py + yy, TS / 2, 1); x.fillRect(px + xx, py + yy, 1, TS / 2);
    }
  } else {
    for (let i = 0; i < w * h / 200; i++) { x.fillStyle = rnd() < 0.5 ? F.b : F.line; x.globalAlpha = 0.35; x.fillRect(px + rnd() * w, py + rnd() * h, 2, 2); }
    x.globalAlpha = 1;
  }
}
function drawWall(x, tx, ty, m) {
  const px = tx * TS, py = ty * TS;
  x.fillStyle = '#3b3f55'; x.fillRect(px, py, TS, TS);
  x.fillStyle = '#4c516c'; x.fillRect(px, py, TS, TS * 0.7);
  x.fillStyle = '#5d6383'; x.fillRect(px, py, TS, 4);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + TS - 6, TS, 6);
  // brick lines
  x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(px, py + TS * 0.35); x.lineTo(px + TS, py + TS * 0.35); x.moveTo(px + ((tx + ty) % 2 ? TS * 0.5 : TS * 0.25), py + 4); x.lineTo(px + ((tx + ty) % 2 ? TS * 0.5 : TS * 0.25), py + TS * 0.35); x.stroke();
}
function drawCracks(ctx, cx, cy, w, h, frac, seed) {
  if (frac > 0.66) return;
  const r = mul(seed);
  const n = frac > 0.33 ? 2 : 5;
  ctx.strokeStyle = 'rgba(20,10,0,0.85)'; ctx.lineWidth = frac > 0.33 ? 1.6 : 2.4;
  for (let i = 0; i < n; i++) {
    let x = cx + (r() - 0.5) * w * 0.7, y = cy + (r() - 0.5) * h * 0.5;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * w * 0.25; y += (r() - 0.5) * h * 0.6; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  if (frac < 0.33) { ctx.fillStyle = 'rgba(255,40,20,0.18)'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h); }
}
