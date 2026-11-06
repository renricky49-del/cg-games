// Board scene: rendering, input (click-to-match + drag-to-push), animations and effects.
import * as L from './logic.js';
import { tileCanvas, stoneCanvas, clearTileCache } from './tiles.js';
import { Audio } from './audio.js';

const ASPECT = 1.3;          // tile height / width
const COMBO_WINDOW = 3.0;    // seconds between matches to keep a combo
const DRAG_THRESHOLD = 7;    // px before a press becomes a drag

let uid = 1;
const ease = (t) => 1 - Math.pow(1 - t, 3);

export class BoardView {
  constructor(canvas, fx) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.fx = fx; this.fg = fx.getContext('2d');
    this.tiles = []; this.stones = [];
    this.w = 0; this.h = 0;
    this.particles = []; this.floaters = [];
    this.active = false; this.paused = false; this.locked = false;
    this.cb = {};
    this.insets = () => ({ top: 70, bottom: 100, left: 10, right: 10 });
    this.dpr = 1;
    this.shake = 0;
    this.time = 0;
    this.hover = null; this.sel = null; this.partners = new Set();
    this.hint = null; this.drag = null; this.press = null;
    this.combo = 0; this.lastMatch = -99;
    this.hc = false;
    this._bindInput();
    window.addEventListener('resize', () => this.layout());
    this._last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
      if (this.active) { this.update(dt); this.render(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---------- setup ----------
  start(board, cb = {}) {
    this.cb = cb;
    this.w = board.w; this.h = board.h;
    this.tiles = []; this.stones = [];
    board.cells.forEach((v, i) => {
      const x = i % board.w, y = (i / board.w) | 0;
      if (v === L.STONE) this.stones.push({ x, y });
      else if (v >= 0) this.tiles.push(this._mk(v, x, y, true));
    });
    this.history = [];
    this.sel = null; this.partners.clear(); this.hint = null; this.drag = null; this.press = null; this.hover = null;
    this.combo = 0; this.lastMatch = -99; this.solCache = null;
    this.particles = []; this.floaters = [];
    this.active = true; this.paused = false; this.locked = false; this.over = false;
    this.layout();
    // intro: tiles drop in with a stagger
    this.tiles.forEach((t) => { t.intro = -((t.x + t.y) * 0.035) ; t.alpha = 0; });
  }
  stop() { this.active = false; this.g.clearRect(0, 0, this.cv.width, this.cv.height); this.fg.clearRect(0, 0, this.fx.width, this.fx.height); }

  _mk(face, x, y, fresh) {
    return { id: uid++, face, x, y, vx: x, vy: y, ox: 0, oy: 0, lift: 0, alpha: 1, scale: 1, rm: -1, intro: fresh ? 0 : 1, flash: 0 };
  }

  cells() {
    const c = new Array(this.w * this.h).fill(L.EMPTY);
    for (const s of this.stones) c[s.y * this.w + s.x] = L.STONE;
    for (const t of this.tiles) if (t.rm < 0) c[t.y * this.w + t.x] = t.face;
    return c;
  }
  tileAt(x, y) { return this.tiles.find((t) => t.rm < 0 && t.x === x && t.y === y) || null; }
  tileAtIdx(i) { return this.tileAt(i % this.w, (i / this.w) | 0); }
  remaining() { return this.tiles.filter((t) => t.rm < 0).length; }

  layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const c of [this.cv, this.fx]) {
      c.width = Math.round(vw * this.dpr); c.height = Math.round(vh * this.dpr);
    }
    if (!this.w) return;
    const ins = this.insets();
    const aw = vw - ins.left - ins.right, ah = vh - ins.top - ins.bottom;
    const fit = (cols, rows) => Math.min(aw / (cols + 0.7), ah / (rows * ASPECT + 0.7 * ASPECT));
    const a = fit(this.w, this.h), b = fit(this.h, this.w);
    this.T = b > a * 1.08; // transpose view when it gives clearly bigger tiles (portrait screens)
    const cw = Math.min(this.T ? b : a, 110);
    this.cw = cw; this.ch = cw * ASPECT;
    const cols = this.T ? this.h : this.w, rows = this.T ? this.w : this.h;
    this.bw = cols * cw; this.bh = rows * this.ch;
    this.ox = ins.left + (aw - this.bw) / 2;
    this.oy = ins.top + (ah - this.bh) / 2;
    clearTileCache();
    this._buildFrame();
  }

  // logical -> screen (top-left of cell)
  sx(x, y) { return this.ox + (this.T ? y : x) * this.cw; }
  sy(x, y) { return this.oy + (this.T ? x : y) * this.ch; }
  // screen -> logical cell
  hit(px, py) {
    const c = Math.floor((px - this.ox) / this.cw), r = Math.floor((py - this.oy) / this.ch);
    const x = this.T ? r : c, y = this.T ? c : r;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return { x, y };
  }
  // screen delta -> logical delta in cells
  toLogical(dx, dy) {
    const a = dx / this.cw, b = dy / this.ch;
    return this.T ? { x: b, y: a } : { x: a, y: b };
  }

  _buildFrame() {
    const d = this.dpr, pad = this.cw * 0.32;
    const c = document.createElement('canvas');
    c.width = Math.ceil((this.bw + pad * 2 + 24) * d); c.height = Math.ceil((this.bh + pad * 2 + 30) * d);
    const g = c.getContext('2d'); g.scale(d, d);
    const x0 = 12, y0 = 10, W = this.bw + pad * 2, H = this.bh + pad * 2;
    g.shadowColor = 'rgba(30,15,0,.45)'; g.shadowBlur = 22; g.shadowOffsetY = 10;
    const wood = g.createLinearGradient(0, y0, 0, y0 + H);
    wood.addColorStop(0, '#9a5a2c'); wood.addColorStop(1, '#6b3a18');
    g.fillStyle = wood; g.beginPath(); g.roundRect(x0, y0, W, H, pad * 0.9); g.fill();
    g.shadowColor = 'transparent';
    g.strokeStyle = '#d9a35c'; g.lineWidth = 2.5; g.beginPath(); g.roundRect(x0 + 3, y0 + 3, W - 6, H - 6, pad * 0.8); g.stroke();
    // felt
    const fp = pad * 0.45;
    const felt = g.createRadialGradient(x0 + W / 2, y0 + H / 2, 10, x0 + W / 2, y0 + H / 2, Math.max(W, H) * 0.7);
    felt.addColorStop(0, '#2f7d5a'); felt.addColorStop(1, '#1b5a3f');
    g.fillStyle = felt; g.beginPath(); g.roundRect(x0 + fp, y0 + fp, W - fp * 2, H - fp * 2, pad * 0.5); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.stroke();
    // slots
    const cols = this.T ? this.h : this.w, rows = this.T ? this.w : this.h;
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      g.beginPath(); g.roundRect(x0 + pad + q * this.cw + this.cw * 0.06, y0 + pad + r * this.ch + this.ch * 0.06, this.cw * 0.88, this.ch * 0.88, this.cw * 0.12); g.fill();
    }
    this.frame = { c, x: this.ox - pad - x0, y: this.oy - pad - y0 };
  }

  // ---------- input ----------
  _bindInput() {
    const cv = this.cv;
    const pos = (e) => ({ x: e.clientX, y: e.clientY });
    cv.addEventListener('pointerdown', (e) => {
      if (!this.active || this.paused || this.locked || this.over) return;
      Audio.unlock();
      const p = pos(e);
      const cell = this.hit(p.x, p.y);
      const t = cell && this.tileAt(cell.x, cell.y);
      if (!t) { this._clearSel(); return; }
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* */ }
      this.press = { t, x0: p.x, y0: p.y, id: e.pointerId };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!this.active) return;
      const p = pos(e);
      if (!this.press) {
        const cell = this.hit(p.x, p.y);
        const t = cell && !this.paused ? this.tileAt(cell.x, cell.y) : null;
        this.hover = t ? t.id : null;
        cv.style.cursor = t ? 'pointer' : 'default';
        return;
      }
      const dx = p.x - this.press.x0, dy = p.y - this.press.y0;
      if (!this.drag && Math.hypot(dx, dy) > DRAG_THRESHOLD) this._beginDrag(dx, dy);
      if (this.drag) this._moveDrag(dx, dy);
    });
    const up = (e) => {
      if (!this.press) return;
      const pr = this.press; this.press = null;
      if (this.drag) this._endDrag();
      else this._click(pr.t);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { if (this.drag) this._cancelDrag(); this.press = null; });
    cv.addEventListener('pointerleave', () => { this.hover = null; });
  }

  _clearSel() { this.sel = null; this.partners.clear(); }

  _click(t) {
    if (t.rm >= 0) return;
    const cells = this.cells();
    if (this.sel && this.sel !== t.id && this.partners.has(t.id)) {
      const a = this.tiles.find((q) => q.id === this.sel);
      this._commitMatch({ type: 'match', a: a.y * this.w + a.x, b: t.y * this.w + t.x });
      return;
    }
    if (this.sel === t.id) { this._clearSel(); Audio.play('select'); return; }
    this.sel = t.id;
    this.partners = new Set(L.partnersOf(cells, this.w, this.h, t.y * this.w + t.x).map((j) => this.tileAtIdx(j).id));
    Audio.play('clack');
    if (!this.partners.size) t.flash = 1;
    this.cb.onSelect && this.cb.onSelect(t, this.partners.size);
  }

  _beginDrag(dx, dy) {
    const t = this.press.t;
    const l = this.toLogical(dx, dy);
    const axis = Math.abs(l.x) >= Math.abs(l.y) ? 'x' : 'y';
    const cells = this.cells();
    const i = t.y * this.w + t.x;
    // both directions on the chosen axis
    const dNeg = axis === 'x' ? 2 : 0, dPos = axis === 'x' ? 3 : 1;
    this.drag = {
      t, axis, i, cells,
      neg: { d: dNeg, ...L.pushInfo(cells, this.w, this.h, i, dNeg) },
      pos: { d: dPos, ...L.pushInfo(cells, this.w, this.h, i, dPos) },
      off: 0, k: 0, move: null, side: null,
    };
    this._clearSel(); this.hint = null;
    this.cv.style.cursor = 'grabbing';
  }

  _moveDrag(dx, dy) {
    const D = this.drag;
    const l = this.toLogical(dx, dy);
    let off = D.axis === 'x' ? l.x : l.y;
    const side = off < 0 ? D.neg : D.pos;
    const max = side.maxK;
    const sign = off < 0 ? -1 : 1;
    off = sign * Math.min(Math.abs(off), max + 0.18 * (1 - Math.exp(-Math.max(0, Math.abs(off) - max) * 3)));
    // reset chain offsets of the other side
    for (const s of [D.neg, D.pos]) for (const ci of s.chain) { const tt = this.tileAtIdx(ci); tt.ox = 0; tt.oy = 0; tt.lift = 0; }
    for (const ci of side.chain) {
      const tt = this.tileAtIdx(ci);
      if (D.axis === 'x') tt.ox = off; else tt.oy = off;
      tt.lift = 0.5;
    }
    const k = Math.min(max, Math.round(Math.abs(off)));
    if (k !== D.k || side !== D.side) {
      if (k !== D.k && k > 0) Audio.play('select');
      D.k = k; D.side = side;
      D.move = k > 0 ? L.tryPush(D.cells, this.w, this.h, D.i, side.d, k, side) : null;
    }
    D.off = off;
  }

  _resetChain(D) {
    for (const s of [D.neg, D.pos]) for (const ci of s.chain) {
      const tt = this.tileAtIdx(ci);
      if (!tt) continue;
      // keep visual where it is so it eases back
      tt.vx = tt.x + tt.ox; tt.vy = tt.y + tt.oy; tt.ox = 0; tt.oy = 0; tt.lift = 0;
    }
  }

  _cancelDrag() { const D = this.drag; this.drag = null; this._resetChain(D); this.cv.style.cursor = 'default'; }

  _endDrag() {
    const D = this.drag;
    this.drag = null;
    this.cv.style.cursor = 'default';
    if (D.move) {
      this._resetChain(D);
      this._commitMatch(D.move);
    } else {
      this._resetChain(D);
      if (D.k > 0) {
        Audio.play('deny');
        D.t.flash = 1;
        this.cb.onFailedPush && this.cb.onFailedPush();
      }
    }
  }

  // ---------- moves ----------
  snapshot() { return this.tiles.filter((t) => t.rm < 0).map((t) => ({ id: t.id, face: t.face, x: t.x, y: t.y })); }

  _commitMatch(m) {
    this.history.push(this.snapshot());
    if (this.history.length > 60) this.history.shift();
    let a, b;
    if (m.type === 'push') {
      const [dx, dy] = L.DIRS[m.dir];
      const moved = m.chain.map((ci) => this.tileAtIdx(ci));
      for (const t of moved) { t.x += dx * m.k; t.y += dy * m.k; }
      a = this.tileAtIdx(m.to); b = this.tileAtIdx(m.partner);
      Audio.play('slide');
    } else {
      a = this.tileAtIdx(m.a); b = this.tileAtIdx(m.b);
    }
    this._clearSel(); this.hint = null;
    // combo
    if (this.time - this.lastMatch <= COMBO_WINDOW) this.combo++; else this.combo = 1;
    this.lastMatch = this.time;
    const delay = m.type === 'push' ? 0.12 : 0.02;
    a.rm = 0; b.rm = 0; a.rmDelay = delay; b.rmDelay = delay;
    a.lift = 1; b.lift = 1;
    setTimeout(() => {
      Audio.play('match', this.combo);
      this._burst(a); this._burst(b);
      if (this.combo >= 3) this.shake = Math.min(8, 2 + this.combo);
    }, delay * 1000);
    this.cb.onMatch && this.cb.onMatch(this.combo, m, a, b);
    // win / stuck check after animations
    const left = this.remaining();
    if (left === 0) {
      this.over = true;
      setTimeout(() => this.cb.onWin && this.cb.onWin(), 650);
    } else {
      const cells = this.cells();
      if (!L.hasMove(cells, this.w, this.h)) setTimeout(() => { if (this.active && !this.over) this.cb.onStuck && this.cb.onStuck(); }, 700);
    }
  }

  canUndo() { return this.history.length > 0 && !this.over; }
  undo() {
    const snap = this.history.pop();
    if (!snap) return false;
    const old = new Map(this.tiles.map((t) => [t.id, t]));
    this.tiles = snap.map((s) => {
      const o = old.get(s.id);
      if (o && o.rm < 0) { o.x = s.x; o.y = s.y; return o; }
      const n = this._mk(s.face, s.x, s.y, false); n.id = s.id; n.alpha = 0; n.scale = 1.3;
      if (o) { n.vx = o.vx; n.vy = o.vy; }
      return n;
    });
    this._clearSel(); this.hint = null; this.combo = 0; this.solCache = null;
    Audio.play('slide');
    return true;
  }

  // Finds a good next move (solver first, any legal move as fallback). Returns the move or null.
  findHint() {
    const cells = this.cells();
    const key = cells.join(',');
    let move = null;
    if (this.solCache && this.solCache.keys[0] === key) move = this.solCache.moves[0];
    if (!move) {
      const r = L.solve(cells, this.w, this.h, 25000);
      if (r.solution && r.solution.length) {
        const keys = []; let c = cells;
        for (const mv of r.solution) { keys.push(c.join(',')); c = L.applyMove(c, this.w, mv); }
        this.solCache = { keys, moves: r.solution };
        move = r.solution[0];
      }
    }
    if (!move) {
      const all = L.allMoves(cells, this.w, this.h);
      move = all[0] || null;
    }
    return move;
  }
  showHint(move) {
    this.hint = { move, t: 0 };
    this._clearSel();
    Audio.play('hint');
  }

  shuffle(rnd) {
    const cells = this.cells();
    const nc = L.shuffleBoard(cells, this.w, this.h, rnd);
    const pool = new Map();
    for (const t of this.tiles) if (t.rm < 0) { if (!pool.has(t.face)) pool.set(t.face, []); pool.get(t.face).push(t); }
    nc.forEach((f, i) => {
      if (f < 0) return;
      const t = pool.get(f).pop();
      t.x = i % this.w; t.y = (i / this.w) | 0; t.lift = 1; t.spin = 1;
    });
    this.history = []; this._clearSel(); this.hint = null; this.solCache = null;
    Audio.play('shuffle');
    setTimeout(() => this.tiles.forEach((t) => { t.lift = 0; }), 450);
    return L.hasMove(nc, this.w, this.h);
  }

  // ---------- effects ----------
  _center(t) {
    const x = this.sx(t.vx + t.ox, t.vy + t.oy) + this.cw / 2;
    const y = this.sy(t.vx + t.ox, t.vy + t.oy) + this.ch / 2;
    return { x, y };
  }
  _burst(t) {
    const { x, y } = this._center(t);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 180;
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.7 + Math.random() * 0.5, age: 0,
        kind: i % 3 === 0 ? 'spark' : 'petal', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10,
        size: (i % 3 === 0 ? 3 : 6) * (0.7 + Math.random() * 0.6) * Math.max(0.7, this.cw / 60),
        col: ['#ffb7c9', '#ff8fb1', '#fff0f4', '#ffd56b'][i % 4],
      });
    }
    // ring
    this.particles.push({ x, y, kind: 'ring', life: 0.45, age: 0, size: this.cw * 0.4 });
  }
  floatText(text, x, y, color = '#fff6c8') {
    this.floaters.push({ text, x, y, age: 0, life: 1.1, color });
  }

  // ---------- frame ----------
  update(dt) {
    if (this.paused) return;
    this.time += dt;
    const k = Math.min(1, dt * 16);
    for (const t of this.tiles) {
      if (t.intro < 1) { t.intro += dt * 3.2; t.alpha = Math.max(0, Math.min(1, t.intro)); }
      t.vx += (t.x - t.vx) * k; t.vy += (t.y - t.vy) * k;
      if (Math.abs(t.x - t.vx) < 0.002) t.vx = t.x;
      if (Math.abs(t.y - t.vy) < 0.002) t.vy = t.y;
      if (t.rm < 0) { t.alpha = Math.min(1, t.alpha + dt * 5); t.scale += (1 - t.scale) * k; }
      t.flash = Math.max(0, t.flash - dt * 2.2);
      t.spin = Math.max(0, (t.spin || 0) - dt * 2.2);
      const targetLift = t.lift;
      t.vl = (t.vl || 0) + (targetLift - (t.vl || 0)) * k;
    }
    for (const t of this.tiles) {
      if (t.rm >= 0) {
        if (t.rmDelay > 0) { t.rmDelay -= dt; continue; }
        t.rm += dt;
      }
    }
    this.tiles = this.tiles.filter((t) => t.rm < 0.35);
    for (const p of this.particles) {
      p.age += dt;
      if (p.kind !== 'ring') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.98; p.rot += p.vr * dt; }
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
    for (const f of this.floaters) { f.age += dt; f.y -= 40 * dt; }
    this.floaters = this.floaters.filter((f) => f.age < f.life);
    this.shake = Math.max(0, this.shake - dt * 30);
    if (this.hint) this.hint.t += dt;
    if (this.combo && this.time - this.lastMatch > COMBO_WINDOW) { this.combo = 0; this.cb.onComboEnd && this.cb.onComboEnd(); }
  }

  render() {
    const g = this.g, d = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.cv.width, this.cv.height);
    const sh = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sv = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    g.setTransform(d, 0, 0, d, sh * d, sv * d);
    if (this.frame) g.drawImage(this.frame.c, this.frame.x, this.frame.y, this.frame.c.width / d, this.frame.c.height / d);
    const cw = this.cw, ch = this.ch;
    const tw = cw * 0.94, th = ch * 0.94;
    const pw = Math.round(tw * d), ph = Math.round(th * d);
    // stones
    const sc = stoneCanvas(pw, ph);
    for (const s of this.stones) g.drawImage(sc, this.sx(s.x, s.y) + (cw - tw) / 2, this.sy(s.x, s.y) + (ch - th) / 2, tw, th);
    // drag target ghost
    const D = this.drag;
    if (D && D.move) this._ring(this.tileAtIdx(D.move.partner), '#7dff9b', 1);
    // tiles, sorted so lifted ones draw on top
    const list = this.tiles.slice().sort((a, b) => (a.vl || 0) - (b.vl || 0) || a.vy - b.vy);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 6);
    for (const t of list) {
      let x = this.sx(t.vx + t.ox, t.vy + t.oy) + (cw - tw) / 2;
      let y = this.sy(t.vx + t.ox, t.vy + t.oy) + (ch - th) / 2;
      let s = t.scale, a = t.alpha;
      const lift = (t.vl || 0) * ch * 0.08 + (this.hover === t.id && !D ? ch * 0.03 : 0) + (this.sel === t.id ? ch * 0.06 : 0);
      if (t.intro < 1) { const e = ease(Math.max(0, t.intro)); y -= (1 - e) * ch * 0.6; }
      if (t.rm >= 0) { const r = Math.min(1, t.rm / 0.35); s = 1 + 0.25 * Math.sin(r * Math.PI) - r * 0.6; a = 1 - r * r; }
      if (t.flash > 0) x += Math.sin(t.flash * 40) * t.flash * cw * 0.06;
      const scx = t.spin > 0 ? Math.abs(Math.cos(t.spin * Math.PI)) : 1;
      g.globalAlpha = Math.max(0, a);
      // shadow
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath(); g.roundRect(x + tw * 0.06, y + th * 0.1 + lift * 0.3, tw * 0.98 * s, th * 0.95 * s, tw * 0.14); g.fill();
      const cx = x + tw / 2, cy = y + th / 2 - lift;
      g.save();
      g.translate(cx, cy); g.scale(s * scx, s);
      g.drawImage(tileCanvas(t.face, pw, ph, this.hc), -tw / 2, -th / 2, tw, th);
      g.restore();
      // highlights
      if (this.sel === t.id) this._outline(x, y - lift, tw, th, '#ffd23a', 3.5);
      else if (this.partners.has(t.id)) this._outline(x, y - lift, tw, th, `rgba(90,255,140,${0.55 + 0.45 * pulse})`, 3.5);
      else if (this.hover === t.id && !D) this._outline(x, y - lift, tw, th, 'rgba(255,255,255,.7)', 2);
      if (this.hint && this.hint.move) this._hintMark(t, x, y - lift, tw, th, pulse);
      if (t.flash > 0) this._outline(x, y - lift, tw, th, `rgba(255,80,60,${t.flash})`, 3);
    }
    g.globalAlpha = 1;
    if (this.hint && this.hint.move && this.hint.move.type === 'push') this._hintArrow(this.hint.move, pulse);
    this._renderFx();
  }

  _outline(x, y, w, h, col, lw) {
    const g = this.g;
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath(); g.roundRect(x - 1.5, y - 1.5, w + 3, h * 0.9 + 3, w * 0.16); g.stroke();
  }
  _ring(t, col) {
    if (!t) return;
    const x = this.sx(t.vx, t.vy) + this.cw * 0.03, y = this.sy(t.vx, t.vy) + this.ch * 0.03;
    const g = this.g;
    g.save(); g.shadowColor = col; g.shadowBlur = 18;
    this._outline(x, y, this.cw * 0.94, this.ch * 0.94, col, 4);
    g.restore();
  }
  _hintMark(t, x, y, w, h, pulse) {
    const m = this.hint.move;
    const idx = t.y * this.w + t.x;
    const ids = m.type === 'match' ? [m.a, m.b] : [m.from, m.partner];
    if (!ids.includes(idx)) return;
    const g = this.g;
    g.save(); g.shadowColor = '#5cc8ff'; g.shadowBlur = 16;
    this._outline(x, y, w, h, `rgba(92,200,255,${0.5 + 0.5 * pulse})`, 4);
    g.restore();
  }
  _hintArrow(m, pulse) {
    const g = this.g;
    const fx = m.from % this.w, fy = (m.from / this.w) | 0;
    const tx = m.to % this.w, ty = (m.to / this.w) | 0;
    const x1 = this.sx(fx, fy) + this.cw / 2, y1 = this.sy(fx, fy) + this.ch / 2;
    const x2 = this.sx(tx, ty) + this.cw / 2, y2 = this.sy(tx, ty) + this.ch / 2;
    const t = (this.hint.t * 0.9) % 1;
    g.save();
    g.strokeStyle = 'rgba(92,200,255,.9)'; g.lineWidth = Math.max(4, this.cw * 0.1); g.lineCap = 'round';
    g.setLineDash([this.cw * 0.15, this.cw * 0.12]); g.lineDashOffset = -this.hint.t * 40;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.setLineDash([]);
    const ang = Math.atan2(y2 - y1, x2 - x1), hs = this.cw * 0.32;
    g.fillStyle = '#5cc8ff';
    g.beginPath(); g.moveTo(x2 + Math.cos(ang) * hs * 0.6, y2 + Math.sin(ang) * hs * 0.6);
    g.lineTo(x2 + Math.cos(ang + 2.5) * hs, y2 + Math.sin(ang + 2.5) * hs);
    g.lineTo(x2 + Math.cos(ang - 2.5) * hs, y2 + Math.sin(ang - 2.5) * hs); g.fill();
    // ghost tile travelling
    g.globalAlpha = 0.35 + 0.2 * pulse;
    const gx = x1 + (x2 - x1) * ease(t), gy = y1 + (y2 - y1) * ease(t);
    const tile = this.tileAtIdx(m.from);
    if (tile) g.drawImage(tileCanvas(tile.face, Math.round(this.cw * 0.94 * this.dpr), Math.round(this.ch * 0.94 * this.dpr), this.hc), gx - this.cw * 0.47, gy - this.ch * 0.47, this.cw * 0.94, this.ch * 0.94);
    g.restore();
  }

  _renderFx() {
    const g = this.fg, d = this.dpr;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.fx.width, this.fx.height);
    g.setTransform(d, 0, 0, d, 0, 0);
    for (const p of this.particles) {
      const r = p.age / p.life;
      g.globalAlpha = 1 - r;
      if (p.kind === 'ring') {
        g.strokeStyle = '#fff3c4'; g.lineWidth = 4 * (1 - r);
        g.beginPath(); g.arc(p.x, p.y, p.size * (0.6 + r * 1.8), 0, 7); g.stroke();
      } else if (p.kind === 'spark') {
        g.fillStyle = '#ffe58a';
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillRect(-p.size, -p.size * 0.25, p.size * 2, p.size * 0.5); g.fillRect(-p.size * 0.25, -p.size, p.size * 0.5, p.size * 2);
        g.restore();
      } else {
        g.fillStyle = p.col;
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
        g.beginPath(); g.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 7); g.fill();
        g.restore();
      }
    }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of this.floaters) {
      const r = f.age / f.life;
      g.globalAlpha = r < 0.7 ? 1 : 1 - (r - 0.7) / 0.3;
      g.font = `900 ${Math.max(18, this.cw * 0.42)}px Georgia, serif`;
      g.lineWidth = 5; g.strokeStyle = '#6b2a0c'; g.strokeText(f.text, f.x, f.y);
      g.fillStyle = f.color; g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  }
}
