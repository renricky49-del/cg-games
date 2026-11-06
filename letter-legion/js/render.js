// Match renderer: layout, boards, letter soldiers, enemies, effects and in-match HUD (canvas).
import { UNITS, HERO_BY_ID, HEROES, LEVEL_COLORS, BOSSES, ENEMIES, ITEM_BY_ID, MAX_LEVEL, RARITIES } from './data.js';
import { IMG, drawStrip } from './assets.js';
import { letterGlyph, goldGlyph, EYES, FONT, FONT2 } from './glyphs.js';
import { posAt } from './sim.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = t => 1 - Math.pow(1 - t, 3);
function kf(p, keys) { for (let i = 1; i < keys.length; i++) if (p <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return lerp(va, vb, (p - a) / (b - a || 1)); } return keys[keys.length - 1][1]; }
export function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fmt(n) { n = Math.floor(n); return n >= 100000 ? (n / 1000).toFixed(0) + 'k' : n >= 10000 ? (n / 1000).toFixed(1) + 'k' : String(n); }

export class MatchView {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.W = 1; this.H = 1; this.dpr = 1;
    this.fx = []; this.parts = []; this.texts = []; this.banners = [];
    this.shake = 0; this.time = 0; this.flash = 0;
    this.buttons = []; this.hover = null; this.pointer = { x: -1, y: -1, down: false };
    this.drag = null; this.selected = null;
    this.trayAnim = [0, 0, 0];
    this.wardSad = [0, 0];
    this.tip = null;
    this.cuts = []; this.lastCut = {};
  }
  resize(W, H, dpr) {
    this.W = W; this.H = H; this.dpr = dpr;
    this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr);
    this.cv.style.width = W + 'px'; this.cv.style.height = H + 'px';
    if (this.match) this.layout();
  }
  setMatch(match, ctl) { this.match = match; this.ctl = ctl; this.fx = []; this.parts = []; this.texts = []; this.banners = []; this.layout(); }

  // ---------- layout ----------
  layout() {
    const W = this.W, H = this.H, m = this.match; if (!m) return;
    const map = m.sides[0].map;
    const land = W / H >= 1.15;
    this.land = land;
    const L = {};
    // fit a board into a rect, leaving room for its frame (and for the rival, the castle overhang on top)
    const fit = (rect, mirror) => {
      const padX = 12, padTop = mirror ? 18 : 12, padBot = 12;
      const ts = Math.max(8, Math.floor(Math.min((rect.w - 2 * padX) / map.cols, (rect.h - padTop - padBot) / (map.rows + (mirror ? 0.2 : 0)))));
      const w = ts * map.cols, h = ts * map.rows;
      const extra = mirror ? Math.round(ts * 0.2) : 0;
      return { x: Math.round(rect.x + (rect.w - w) / 2), y: Math.round(rect.y + padTop + extra + (rect.h - padTop - padBot - extra - h) / 2), ts, w, h, cols: map.cols, rows: map.rows, mirror };
    };
    if (land) {
      const k = clamp(Math.min(H / 720, W / 1280), 0.5, 1.5);
      const hudW = clamp(W * 0.22, 150, 310 * Math.max(1, k));
      const areaW = W - hudW;
      const stripH = clamp(H * 0.07, 34, 50);
      const A = { x: 6, y: 4, w: areaW - 12, h: H - stripH - 14 };
      // try stacked and side-by-side arrangements; keep the one with the biggest readable boards
      const cands = [];
      for (const f of [0.3, 0.34, 0.38]) {
        const rh = Math.round(A.h * f);
        cands.push({ rival: { x: A.x, y: A.y, w: A.w, h: rh }, player: { x: A.x, y: A.y + rh + 4, w: A.w, h: A.h - rh - 4 } });
      }
      for (const g of [0.6, 0.66, 0.72]) {
        const pw = Math.round(A.w * g);
        cands.push({ player: { x: A.x, y: A.y, w: pw, h: A.h }, rival: { x: A.x + pw + 6, y: A.y, w: A.w - pw - 6, h: Math.round(A.h * 0.62) }, side: true });
      }
      let best = null;
      for (const c of cands) {
        const gp = fit(c.player, false), gr = fit(c.rival, true);
        let score = gp.ts + 0.45 * gr.ts - (gr.ts < gp.ts * 0.42 ? 1000 : 0);
        if (!best || score > best.score) best = { ...c, gp, gr, score };
      }
      L.rival = best.rival; L.player = best.player; L.side = !!best.side;
      // leftover space under the rival panel (side-by-side) becomes a duel info panel
      if (best.side) { const rb = best.gr.y + best.gr.h + 16; const ih = A.y + A.h - rb; if (ih > 110) L.info = { x: best.rival.x + 6, y: rb, w: best.rival.w - 12, h: Math.min(ih, 360) }; }
      else { const pr = best.gp.x + best.gp.w + 18; const iw = A.x + A.w - pr; if (iw > 150) L.info = { x: pr, y: best.gp.y, w: Math.min(iw, 320), h: best.gp.h }; }
      L.strip = { x: 10, y: H - stripH - 4, w: areaW - 20, h: stripH };
      L.hud = { x: areaW, y: 0, w: hudW, h: H };
      this.hk = k; this.hox = areaW;
      L.hudD = { x: 0, y: 0, w: hudW / k, h: H / k }; // HUD design space
      this.geo = [best.gp, best.gr];
    } else {
      this.hk = 1; this.hox = 0;
      const hudH = clamp(H * 0.25, 170, 260);
      const topH = 44;
      const stripH = 34;
      const avail = H - hudH - topH - stripH - 8;
      L.top = { x: 0, y: 0, w: W, h: topH };
      L.rival = { x: 4, y: topH, w: W - 8, h: avail * 0.36 };
      L.player = { x: 4, y: topH + avail * 0.36 + 2, w: W - 8, h: avail * 0.64 - 2 };
      L.strip = { x: 6, y: L.player.y + L.player.h + 2, w: W - 12, h: stripH };
      L.hud = { x: 0, y: H - hudH, w: W, h: hudH };
      this.geo = [fit(L.player, false), fit(L.rival, true)];
    }
    this.L = L;
    this.buildButtons();
  }
  boardRect(si) { const g = this.geo[si]; return { x: g.x - 8, y: g.y - 8 - (g.mirror ? Math.round(g.ts * 0.2) : 0), w: g.w + 16, h: g.h + 16 + (g.mirror ? Math.round(g.ts * 0.2) : 0) }; }
  layoutRects() { const L = this.L; return { player: this.boardRect(0), rival: this.boardRect(1), hud: this.land ? { x: L.hud.x + 4, y: 0, w: L.hud.w - 4, h: L.hud.h } : L.hud, strip: L.strip, top: L.top || null, info: L.info || null }; }
  toScreen(side, x, y) { const g = this.geo[side]; return [g.x + x * g.ts, g.y + (g.mirror ? g.rows - y : y) * g.ts]; }
  cellRect(side, c) { const g = this.geo[side]; const [sx, sy] = this.toScreen(side, c.col + (g.mirror ? 0 : 0), g.mirror ? c.row + 1 : c.row); return { x: sx, y: sy, w: g.ts, h: g.ts }; }
  cellAt(px, py) {
    const g = this.geo[0]; const s = this.match.sides[0];
    for (const c of s.cells) { const r = this.cellRect(0, c); if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return c; }
    return null;
  }

  buildButtons() {
    const B = []; const L = this.L; const hud = this.land ? L.hudD : L.hud;
    const add = (id, x, y, w, h, extra = {}) => B.push({ id, x, y, w, h, ...extra });
    if (this.land) {
      const px = hud.x + 12, pw = hud.w - 24;
      add('pause', hud.x + hud.w - 50, 8, 40, 40);
      add('speed', hud.x + hud.w - 96, 8, 40, 40);
      add('book', hud.x + hud.w - 142, 8, 40, 40);
      this.rivalCard = { x: px, y: 54, w: pw, h: 62 };
      this.wavePanel = { x: px, y: 122, w: pw, h: 46 };
      this.playerCard = { x: px, y: 174, w: pw, h: 62 };
      const tw = (pw - 18) / 4;
      for (let i = 0; i < 4; i++) add('train' + i, px + i * (tw + 6), 244, tw, 46);
      const iw = (pw - 12) / 3;
      add('item0', px, 298, iw, 50); add('item1', px + iw + 6, 298, iw, 50); this.shovelBox = { x: px + 2 * (iw + 6), y: 298, w: iw, h: 50 };
      add('adSummon', px, 356, (pw - 6) / 2, 34); add('adShovel', px + (pw - 6) / 2 + 6, 356, (pw - 6) / 2, 34);
      const ty = Math.max(400, hud.h - 196);
      this.oddsPanel = ty - 424 > 46 ? { x: px, y: 398, w: pw, h: Math.min(110, ty - 424) } : null;
      const sw = Math.min(70, (pw - 3 * 8) / 4);
      this.trayRects = [0, 1, 2].map(i => ({ x: px + i * (sw + 8), y: ty, w: sw, h: sw }));
      this.trash = { x: px + 3 * (sw + 8), y: ty, w: sw, h: sw };
      add('summon', px, hud.h - 110, pw, 96);
    } else {
      const T = L.top;
      add('pause', T.w - 44, 4, 38, 36); add('speed', T.w - 86, 4, 38, 36); add('book', T.w - 128, 4, 38, 36);
      this.wavePanel = { x: 6, y: 4, w: T.w - 140, h: 36 };
      this.rivalCard = null; this.playerCard = null;
      const px = 8, pw = hud.w - 16, y0 = hud.y + 6;
      const sw = clamp((pw - 160) / 4 - 6, 44, 70);
      this.trayRects = [0, 1, 2].map(i => ({ x: px + i * (sw + 6), y: y0 + 22, w: sw, h: sw }));
      this.trash = { x: px + 3 * (sw + 6), y: y0 + 22, w: sw, h: sw };
      const sx = px + 4 * (sw + 6) + 4;
      add('summon', sx, y0 + 6, pw - (sx - px), sw + 16);
      const row2 = y0 + sw + 30; const bh = clamp(hud.h - (row2 - hud.y) - 8, 36, 56);
      const n = 8, bw = (pw - (n - 1) * 5) / n;
      for (let i = 0; i < 4; i++) add('train' + i, px + i * (bw + 5), row2, bw, bh);
      add('item0', px + 4 * (bw + 5), row2, bw, bh); add('item1', px + 5 * (bw + 5), row2, bw, bh);
      add('adSummon', px + 6 * (bw + 5), row2, bw, bh); add('adShovel', px + 7 * (bw + 5), row2, bw, bh);
      this.shovelBox = null; this.oddsPanel = null;
      this.playerInfo = { x: px, y: y0 - 2, w: pw, h: 20 };
    }
    this.buttons = B;
  }
  toHud(x, y) { return [(x - this.hox) / this.hk, y / this.hk]; }
  btnCenter(id) { const b = this.buttons.find(b => b.id === id); return [this.hox + (b.x + b.w / 2) * this.hk, (b.y + b.h / 2) * this.hk]; }
  trayCenter(i) { const r = this.trayRects[i]; return [this.hox + (r.x + r.w / 2) * this.hk, (r.y + r.h / 2) * this.hk]; }
  buttonAt(x, y) { [x, y] = this.toHud(x, y); for (const b of this.buttons) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b; return null; }
  trayAt(x, y) { [x, y] = this.toHud(x, y); return (this.trayRects || []).findIndex(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h); }
  inTrash(x, y) { [x, y] = this.toHud(x, y); const r = this.trash; return r && x >= r.x - 6 && x < r.x + r.w + 6 && y >= r.y - 6 && y < r.y + r.h + 6; }

  // ---------- events -> effects ----------
  consume(sideIdx, events) {
    const me = sideIdx === 0; const ctl = this.ctl; const A = ctl.audio;
    const g = this.geo[sideIdx];
    for (const e of events) {
      switch (e.t) {
        case 'slash': { const [x, y] = this.toScreen(sideIdx, e.x, e.y); this.fx.push({ k: 'arc', x, y, t: 0, dur: 0.22, r: g.ts * 0.55, col: e.hero ? '#ffe9a8' : '#fff', rot: Math.random() * TAU }); if (me) A.play('slash'); break; }
        case 'thrust': { const c = this.match.sides[sideIdx].cells[e.cell]; const [x0, y0] = this.toScreen(sideIdx, c.x, c.y); const [x1, y1] = this.toScreen(sideIdx, e.x, e.y); this.fx.push({ k: 'line', x0, y0, x1, y1, t: 0, dur: 0.18, w: g.ts * 0.16, col: '#bfe0ff' }); if (me) A.play('thrust'); break; }
        case 'shot': {
          const c = this.match.sides[sideIdx].cells[e.cell]; const [x0, y0] = this.toScreen(sideIdx, c.x, c.y); const [x1, y1] = this.toScreen(sideIdx, e.x, e.y);
          const kind = e.letter === 'B' ? 'arrow' : e.letter === 'K' ? 'none' : e.letter === 'gold' ? 'spark' : HERO_BY_ID[e.letter] ? 'orb' : 'none';
          if (kind === 'none') { this.fx.push({ k: 'hit', x: x1, y: y1, t: 0, dur: 0.15, r: g.ts * 0.25, col: '#ffd9a0' }); if (me) A.play('gallop'); }
          else this.fx.push({ k: kind, x0, y0, x1, y1, t: 0, dur: kind === 'arrow' ? 0.16 : 0.2, s: g.ts, col: e.letter === 'gold' ? '#ffe066' : (HERO_BY_ID[e.letter]?.color || '#fff') });
          if (me) A.play(kind === 'arrow' ? 'arrow' : kind === 'spark' ? 'spark' : 'gallop');
          break;
        }
        case 'dmg': if (me && e.big && this.texts.length < 40) { const [x, y] = this.toScreen(0, e.x, e.y); this.text(x, y - g.ts * 0.4, fmt(e.v), '#ffe14d', g.ts * 0.32); } break;
        case 'kill': {
          const [x, y] = this.toScreen(sideIdx, e.x, e.y);
          this.burst(x, y, e.boss !== undefined ? 30 : 8, e.boss !== undefined ? '#ffcf3a' : '#d7f2ff', g.ts * (e.boss !== undefined ? 0.12 : 0.07));
          if (me) { if (this.texts.length < 50) this.text(x, y - g.ts * 0.3, '+' + e.ink, '#7fd7ff', g.ts * 0.28); A.play(e.boss !== undefined ? 'bosskill' : 'kill'); if (e.boss !== undefined) this.shake = Math.max(this.shake, 10); }
          break;
        }
        case 'dodge': if (me) { const [x, y] = this.toScreen(0, e.x, e.y); this.text(x, y - 18, 'miss', '#fff', 13); } break;
        case 'leak': {
          this.wardSad[sideIdx] = 2.5;
          const w = this.match.sides[sideIdx].map.ward; const [x, y] = this.toScreen(sideIdx, w.x, w.y);
          this.text(x, y - g.ts * 0.8, '-' + e.cost + ' ♥', me ? '#ff4d5e' : '#ffb3bb', g.ts * 0.45);
          this.burst(x, y, 14, '#ff6b7a', g.ts * 0.08);
          if (me) { this.shake = Math.max(this.shake, 14); this.flash = 0.35; A.play('leak'); } else A.play('rivalLeak');
          break;
        }
        case 'merge': {
          const c = this.match.sides[sideIdx].cells[e.cell]; const [x, y] = this.toScreen(sideIdx, c.x, c.y);
          this.fx.push({ k: 'ring', x, y, t: 0, dur: 0.45, r: g.ts * 0.8, col: LEVEL_COLORS[e.unit.level - 1] });
          this.burst(x, y, 16, LEVEL_COLORS[e.unit.level - 1], g.ts * 0.08);
          if (me) { this.text(x, y - g.ts * 0.55, 'Lv ' + e.unit.level + '!', LEVEL_COLORS[e.unit.level - 1], g.ts * 0.34); A.play('merge'); }
          break;
        }
        case 'transmute': { const c = this.match.sides[sideIdx].cells[e.cell]; const [x, y] = this.toScreen(sideIdx, c.x, c.y); this.fx.push({ k: 'ring', x, y, t: 0, dur: 0.5, r: g.ts * 0.7, col: '#ffd24a' }); if (me) { this.text(x, y - g.ts * 0.5, '→ ' + e.unit.letter, '#ffd24a', g.ts * 0.34); A.play('transmute'); } break; }
        case 'place': if (me) A.play('place'); break;
        case 'swap': if (me) A.play('place'); break;
        case 'sell': if (me) { A.play('sell'); const at = e.cell !== undefined ? this.toScreen(0, this.match.sides[0].cells[e.cell].x, this.match.sides[0].cells[e.cell].y) : [this.hox + (this.trash.x + this.trash.w / 2) * this.hk, this.trash.y * this.hk]; this.text(at[0], at[1] - 10, '+' + e.value + ' ink', '#7fd7ff', 16); } break;
        case 'dig': { const c = this.match.sides[sideIdx].cells[e.cell]; const [x, y] = this.toScreen(sideIdx, c.x, c.y); this.burst(x, y, 18, '#a8743f', g.ts * 0.09); if (me) A.play('shovel'); break; }
        case 'train': if (me) { A.play('levelup'); } break;
        case 'summon': if (me) { if (e.slot >= 0) this.trayAnim[e.slot] = 1; A.play('summon'); setTimeout(() => A.play(e.item.kind === 'gold' ? 'gold' : e.item.kind === 'shovel' ? 'shovel' : 'reveal'), 260); if (e.item.kind === 'shovel') this.banner('Shovel found! Click a locked cell to dig', '#ffd88a', 1.6, 0.5); } break;
        case 'spell': {
          const side = this.match.sides[sideIdx]; const tc = side.cells[e.target]; const [tx, ty] = this.toScreen(sideIdx, tc.x, tc.y);
          const h = HERO_BY_ID[e.hero];
          e.cells.forEach((id, k) => { const c = side.cells[id]; const [x, y] = this.toScreen(sideIdx, c.x, c.y); this.fx.push({ k: 'fly', x0: x, y0: y, x1: tx, y1: ty, t: -k * 0.06, dur: 0.55, letter: h.word[k], s: g.ts }); });
          this.fx.push({ k: 'ring', x: tx, y: ty, t: -0.5, dur: 0.7, r: g.ts * 2.2, col: '#ffe066' });
          this.fx.push({ k: 'rays', x: tx, y: ty, t: -0.45, dur: 1.2, r: g.ts * 2.4, col: h.color });
          setTimeout(() => this.burst(tx, ty, 40, '#ffe066', g.ts * 0.12), 520);
          if (me) {
            A.play('spell'); A.voice(h.id); this.shake = Math.max(this.shake, 8); this.cutin(h, e.level > 1 ? `${h.word} ★${e.level}` : h.word);

          } else this.banner(`Rival spelled ${h.word}!`, '#ffb3bb', 1.4, 0.4);
          break;
        }
        case 'skill': {
          const h = HERO_BY_ID[e.hero]; const [cx, cy] = this.toScreen(sideIdx, e.x, e.y);
          if (me) { A.play(e.hero === 'MAGE' ? 'meteor' : 'skill'); const last = this.lastCut[e.hero] || -99; if (this.time - last > 30) this.cutin(h, h.skill.toUpperCase() + '!'); }
          if (e.hero === 'MAGE') for (const t of e.targets) { const [x, y] = this.toScreen(sideIdx, t.x, t.y); this.fx.push({ k: 'meteor', x, y, t: 0, dur: 0.55, s: g.ts }); }
          else if (e.hero === 'HAWK') { for (const t of e.targets) { const [x, y] = this.toScreen(sideIdx, t.x, t.y); this.fx.push({ k: 'rain', x, y, t: -Math.random() * 0.25, dur: 0.35, s: g.ts }); } }
          else if (e.hero === 'NINJA') e.targets.forEach((t, i) => { const [x, y] = this.toScreen(sideIdx, t.x, t.y); this.fx.push({ k: 'cross', x, y, t: -i * 0.07, dur: 0.25, r: g.ts * 0.5, col: '#c99cff' }); });
          else if (e.hero === 'MONK') this.fx.push({ k: 'ring', x: cx, y: cy, t: 0, dur: 0.7, r: g.ts * 3.2, col: '#ffc06a', w: 6 });
          else if (e.hero === 'TITAN') { this.fx.push({ k: 'ring', x: cx, y: cy, t: 0, dur: 0.6, r: g.ts * 3, col: '#e8c49a', w: 10 }); if (me) this.shake = Math.max(this.shake, 9); }
          else if (e.hero === 'DRUID') for (const t of e.targets) { const [x, y] = this.toScreen(sideIdx, t.x, t.y); this.fx.push({ k: 'vines', x, y, t: 0, dur: 2.2, r: g.ts * t.r }); }
          else if (e.hero === 'KING') { this.fx.push({ k: 'rays', x: cx, y: cy, t: 0, dur: 0.8, r: g.ts * 1.2, col: '#ffd24a' }); if (me) this.text(cx, cy - g.ts * 0.7, '+' + e.ink + ' ink', '#7fd7ff', g.ts * 0.36); }
          else if (e.hero === 'SAINT') { this.fx.push({ k: 'beam', x: cx, y: cy, t: 0, dur: 0.9, s: g.ts }); if (e.heal && me) this.text(cx, cy - g.ts * 0.7, '+1 ♥', '#ff8fa0', g.ts * 0.4); for (const t of e.targets) { const [x, y] = this.toScreen(sideIdx, t.x, t.y); this.fx.push({ k: 'beam', x, y, t: 0, dur: 0.9, s: g.ts }); } }
          break;
        }
        case 'disable': {
          const c = this.match.sides[sideIdx].cells[e.cell]; const [x, y] = this.toScreen(sideIdx, c.x, c.y); const [fx, fy] = this.toScreen(sideIdx, e.fx, e.fy);
          this.fx.push({ k: e.kind === 'tongue' ? 'tongue' : 'zap', x0: fx, y0: fy, x1: x, y1: y, t: 0, dur: 0.35, s: g.ts });
          if (me) A.play('disable');
          break;
        }
        case 'raise': { const [x, y] = this.toScreen(sideIdx, e.x, e.y); this.fx.push({ k: 'ring', x, y, t: 0, dur: 0.5, r: g.ts, col: '#b07cff' }); break; }
        case 'boss': if (me) { this.banner('BOSS: ' + BOSSES[e.boss].name, '#ff6b5e', 2.2, 0.6); A.play('boss'); } break;
        case 'wave': if (me) { this.banner(e.overtime ? `Sudden Death! First leak loses` : (e.boss ? `Wave ${e.w} — Boss incoming!` : `Wave ${e.w}`), e.overtime ? '#ff6b5e' : '#fff', 1.4, 0.3); this.text(this.L.hud.x + 40 || 60, 150, '+' + e.ink + ' ink', '#7fd7ff', 16); A.play('wave'); } break;
        case 'item': if (me) { A.play(e.id === 'frost' ? 'freeze' : e.id === 'bomb' ? 'meteor' : 'skill'); this.banner(ITEM_BY_ID[e.id].name + '!', '#bfe9ff', 1.2, 0.3); if (e.id === 'bomb') { this.shake = 12; this.flash = 0.25; } if (e.id === 'frost') this.fx.push({ k: 'frostscreen', t: 0, dur: e.v }); } break;
      }
    }
  }
  cutin(h, label) { this.lastCut[h.id] = this.time; this.cuts = [{ h, label, t: 0, dur: 1.25 }]; }
  drawCutins(dt) {
    const im = IMG.cutins; if (!im || !this.cuts.length) return;
    const g = this.g; const c = this.cuts[0]; c.t += dt; if (c.t > c.dur) { this.cuts.length = 0; return; }
    const p = c.t / c.dur; const geo = this.geo[0];
    const ph = clamp(geo.h * 0.42, 90, 260), pw = ph * 16 / 9 * 1.25;
    const cx = geo.x + geo.w / 2, cy = geo.y + geo.h * 0.38;
    const slide = p < 0.18 ? 1 - easeOut(p / 0.18) : p > 0.82 ? -easeOut((p - 0.82) / 0.18) : 0;
    const x = cx - pw / 2 + slide * (this.W * 0.8);
    g.save(); g.globalAlpha = p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1;
    // dark band
    g.fillStyle = 'rgba(10,6,24,0.55)'; g.fillRect(0, cy - ph / 2 - 8, this.W, ph + 16);
    g.beginPath(); const sk = ph * 0.25;
    g.moveTo(x + sk, cy - ph / 2); g.lineTo(x + pw + sk, cy - ph / 2); g.lineTo(x + pw - sk, cy + ph / 2); g.lineTo(x - sk, cy + ph / 2); g.closePath();
    g.save(); g.clip();
    const i = c.h.portrait; const zoom = 1 + p * 0.08;
    g.drawImage(im, i * 480, 0, 480, 270, x - pw * (zoom - 1) / 2 - sk, cy - ph / 2 - ph * (zoom - 1) / 2, pw * zoom + sk * 2, ph * zoom);
    g.restore();
    g.lineWidth = 4; g.strokeStyle = c.h.color; g.stroke();
    const fs = ph * 0.26; g.font = `${fs}px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.lineWidth = fs * 0.14; g.strokeStyle = '#26160b'; g.strokeText(c.label, x + pw - sk * 0.2, cy + ph / 2 - fs * 0.25);
    g.fillStyle = '#fff3b0'; g.fillText(c.label, x + pw - sk * 0.2, cy + ph / 2 - fs * 0.25);
    g.restore();
  }
  text(x, y, s, col, size) { this.texts.push({ x, y, s, col, size: Math.max(11, size), t: 0, dur: 0.9 }); }
  burst(x, y, n, col, sz) {
    for (let i = 0; i < n && this.parts.length < 700; i++) {
      const a = Math.random() * TAU, sp = (0.4 + Math.random()) * sz * 40;
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - sz * 20, life: 0, max: 0.45 + Math.random() * 0.35, col, s: sz * (0.6 + Math.random() * 0.8) });
    }
  }
  banner(text, col, dur = 1.5, delay = 0, hero = null) { this.banners.push({ text, col, t: -delay, dur, hero }); if (this.banners.length > 3) this.banners.shift(); }

  // ---------- frame ----------
  draw(dt) {
    const g = this.g, m = this.match; if (!m) return;
    this.time += dt;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // backdrop
    const bg = IMG['map_' + m.mapId];
    g.fillStyle = '#1d2433'; g.fillRect(0, 0, this.W, this.H);
    if (bg) { const s = Math.max(this.W / bg.width, this.H / bg.height); g.globalAlpha = 0.45; g.drawImage(bg, (this.W - bg.width * s) / 2, (this.H - bg.height * s) / 2, bg.width * s, bg.height * s); g.globalAlpha = 1; }
    g.fillStyle = 'rgba(15,20,35,0.45)'; g.fillRect(0, 0, this.W, this.H);
    let sx = 0, sy = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake = Math.max(0, this.shake - dt * 40); }
    g.save(); g.translate(sx, sy);
    this.drawBoard(1, dt);
    this.drawBoard(0, dt);
    this.drawFx(dt);
    g.restore();
    this.drawStrip();
    if (this.L.info) this.drawInfo();
    this.drawHud(dt);
    this.drawDrag();
    this.drawCutins(dt);
    this.drawBanners(dt);
    if (this.flash > 0) { g.fillStyle = `rgba(255,40,60,${this.flash * 0.5})`; g.fillRect(0, 0, this.W, this.H); this.flash -= dt; }
    const frost = this.fx.find(f => f.k === 'frostscreen');
    if (frost) { g.fillStyle = 'rgba(150,210,255,0.12)'; g.fillRect(0, 0, this.W, this.H); }
    this.drawTip();
  }

  drawBoard(si, dt) {
    const g = this.g, m = this.match, side = m.sides[si], geo = this.geo[si], ts = geo.ts, map = side.map;
    const bg = IMG['map_' + m.mapId];
    // board panel
    g.save();
    rr(g, geo.x - 8, geo.y - 8, geo.w + 16, geo.h + 16, 16);
    g.fillStyle = si === 0 ? 'rgba(255,240,200,0.22)' : 'rgba(255,190,190,0.16)'; g.fill();
    rr(g, geo.x - 4, geo.y - 4, geo.w + 8, geo.h + 8, 12); g.clip();
    if (bg) { const s = Math.max(geo.w / bg.width, geo.h / bg.height) * 1.05; g.drawImage(bg, geo.x + (geo.w - bg.width * s) / 2, geo.y + (geo.h - bg.height * s) / 2, bg.width * s, bg.height * s); }
    else { g.fillStyle = map.def.theme; g.fillRect(geo.x, geo.y, geo.w, geo.h); }
    if (si === 1) { g.fillStyle = 'rgba(40,0,10,0.12)'; g.fillRect(geo.x, geo.y, geo.w, geo.h); }
    // road
    const pts = map.pts.map(p => this.toScreen(si, p.x, p.y));
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = ts * 0.92; g.stroke();
    g.strokeStyle = map.def.roadEdge; g.lineWidth = ts * 0.84; g.stroke();
    g.strokeStyle = map.def.road; g.lineWidth = ts * 0.68; g.stroke();
    g.setLineDash([ts * 0.12, ts * 0.38]); g.lineDashOffset = -this.time * ts * 0.6;
    g.strokeStyle = 'rgba(120,80,40,0.35)'; g.lineWidth = ts * 0.08; g.stroke(); g.setLineDash([]);
    g.restore();
    // entry portal
    { const [x, y] = this.toScreen(si, map.pts[1].x, map.pts[1].y); const r = ts * 0.42;
      const grd = g.createRadialGradient(x, y, 2, x, y, r); grd.addColorStop(0, 'rgba(40,0,60,0.9)'); grd.addColorStop(0.7, 'rgba(150,60,220,0.6)'); grd.addColorStop(1, 'rgba(150,60,220,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(220,170,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.7, this.time * 3, this.time * 3 + 4); g.stroke(); }
    // cells
    const me = si === 0;
    const dragSrc = this.drag && this.drag.moved ? this.drag.src : null;
    const dragUnit = dragSrc ? side.getSrc(dragSrc) : null;
    for (const c of side.cells) {
      const r = this.cellRect(si, c); const p = ts * 0.06;
      const hov = me && this.hoverCell === c;
      rr(g, r.x + p, r.y + p, r.w - 2 * p, r.h - 2 * p, ts * 0.16);
      if (c.locked) {
        g.fillStyle = 'rgba(60,40,25,0.55)'; g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
        this.drawLock(r.x + r.w / 2, r.y + r.h / 2, ts * 0.22, me && side.shovels > 0, hov);
      } else {
        const grd = g.createLinearGradient(0, r.y, 0, r.y + r.h);
        grd.addColorStop(0, si === 0 ? 'rgba(250,244,228,0.92)' : 'rgba(250,232,228,0.85)'); grd.addColorStop(1, si === 0 ? 'rgba(206,192,160,0.92)' : 'rgba(210,180,175,0.85)');
        g.fillStyle = grd; g.fill(); g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 2; g.stroke();
        if (dragUnit && me) {
          let col = null;
          if (!c.unit) col = 'rgba(80,180,255,0.9)';
          else if (side.canMerge(dragUnit, c.unit)) col = 'rgba(80,230,110,1)';
          else if (dragSrc.cell !== undefined && dragSrc.cell !== c.id) col = 'rgba(255,255,255,0.5)';
          if (col) { g.strokeStyle = col; g.lineWidth = c === this.hoverCell ? 5 : 3; g.stroke(); }
          if (c.unit && side.canMerge(dragUnit, c.unit)) { g.fillStyle = 'rgba(80,230,110,0.18)'; g.fill(); }
        } else if (hov) { g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.stroke(); }
        if (this.ctl.highlightCells && me && this.ctl.highlightCells.includes(c.id)) { g.strokeStyle = `rgba(255,220,60,${0.6 + 0.4 * Math.sin(this.time * 6)})`; g.lineWidth = 5; g.stroke(); }
      }
    }
    // ward castle
    { const w = map.ward; const [x, y] = this.toScreen(si, w.x, w.y); const sad = this.wardSad[si] > 0;
      this.wardSad[si] = Math.max(0, this.wardSad[si] - dt);
      const idx = (si === 0 ? 0 : 2) + (sad || side.lives <= 1 ? 1 : 0);
      const mir = geo.mirror; const h = ts * (mir ? 1.4 : 1.75); const bob = sad ? Math.sin(this.time * 30) * 2 : 0;
      const baseY = mir ? y - ts * 0.7 + h : y + ts * 0.45; // rival castle hangs from the top edge of its board
      if (!drawStrip(g, 'wards', idx, x + bob, baseY, h, { anchor: 'bottom' })) { g.fillStyle = '#aaa'; g.fillRect(x - ts / 2, y - ts / 2, ts, ts); }
      this.drawHearts(x, mir ? baseY + ts * 0.05 : y - h + ts * 0.35, side.lives, side.maxLives, Math.max(9, ts * 0.2), true);
    }
    // units
    for (const c of side.cells) if (c.unit && !(dragSrc && dragSrc.cell === c.id)) this.drawUnit(si, c, c.unit);
    // enemies sorted by y
    const ens = side.enemies.filter(e => e.hp > 0).sort((a, b) => a.y - b.y);
    for (const e of ens) this.drawEnemy(si, e);
    if (side.freezeT > 0) { g.save(); rr(g, geo.x, geo.y, geo.w, geo.h, 10); g.fillStyle = 'rgba(170,225,255,0.18)'; g.fill(); g.restore(); }
    if (side.dead) { g.save(); rr(g, geo.x, geo.y, geo.w, geo.h, 10); g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill(); g.restore(); }
    if (si === 1) { // label
      g.font = `bold ${clamp(ts * 0.3, 11, 16)}px ${FONT2}`; g.textAlign = 'left'; g.textBaseline = 'top';
      const lbl = `CPU RIVAL · ${this.ctl.rival.name}`; const tw = g.measureText(lbl).width;
      const lx = geo.x + geo.w - tw - 10;
      rr(g, lx - 8, geo.y - 6, tw + 16, 22, 8); g.fillStyle = 'rgba(120,20,30,0.85)'; g.fill();
      g.fillStyle = '#fff'; g.fillText(lbl, lx, geo.y - 2);
    } else {
      g.font = `bold ${clamp(ts * 0.3, 11, 16)}px ${FONT2}`; g.textAlign = 'left'; g.textBaseline = 'top';
      const lbl = 'YOU · Prince Pip'; const tw = g.measureText(lbl).width;
      rr(g, geo.x - 6, geo.y - 6, tw + 16, 22, 8); g.fillStyle = 'rgba(20,60,130,0.85)'; g.fill();
      g.fillStyle = '#fff'; g.fillText(lbl, geo.x + 2, geo.y - 2);
    }
  }
  drawLock(x, y, s, canDig, hov) {
    const g = this.g;
    if (canDig) {
      g.save(); g.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 5);
      drawStrip(g, 'items', 4, x, y, s * 3.2 * (hov ? 1.15 : 1));
      g.restore(); return;
    }
    g.fillStyle = 'rgba(255,230,190,0.35)'; g.strokeStyle = 'rgba(255,230,190,0.45)'; g.lineWidth = s * 0.28;
    g.beginPath(); g.arc(x, y - s * 0.35, s * 0.55, Math.PI, 0); g.stroke();
    rr(g, x - s * 0.8, y - s * 0.35, s * 1.6, s * 1.2, s * 0.25); g.fill();
  }
  drawHearts(x, y, n, max, s, center) {
    const g = this.g;
    g.font = `${s * 1.4}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = `♥ ${n}`;
    const w = g.measureText(txt).width + s * 1.2;
    rr(g, x - w / 2, y - s, w, s * 2, s); g.fillStyle = 'rgba(30,10,20,0.7)'; g.fill();
    g.fillStyle = n <= 1 ? '#ff4d5e' : '#ff7b8b'; g.fillText(txt, x, y + 1);
  }
  unitColor(u) { return u.kind === 'basic' ? UNITS[u.letter].color : u.kind === 'gold' ? '#ffd24a' : HERO_BY_ID[u.heroId].color; }

  drawUnit(si, c, u, override = null) {
    const g = this.g; const geo = this.geo[si]; const ts = geo.ts;
    let x, y;
    if (override) { x = override.x; y = override.y; } else { [x, y] = this.toScreen(si, c.x, c.y); }
    const size = override?.size || ts * 0.86;
    const p = 1 - (u.atkT || 0); const atk = (u.atkT || 0) > 0;
    const age = this.match.time - (u.born || 0); const pop = age < 0.3 ? easeOut(age / 0.3) : 1;
    const mt = u.mergeT ? this.match.time - u.mergeT : 9; const mpop = mt < 0.35 ? 1 + 0.35 * Math.sin(mt / 0.35 * Math.PI) : 1;
    const breathe = 1 + 0.025 * Math.sin(this.time * 2.4 + u.uid);
    g.save(); g.translate(x, y);
    const sc = pop * mpop;
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, size * 0.36, size * 0.32, size * 0.09, 0, 0, TAU); g.fill();
    let ax = 0, ay = 0;
    if (u.aimX !== undefined) { const [tx, ty] = this.toScreen(si, u.aimX, u.aimY); ax = tx - x; ay = ty - y; const L = Math.hypot(ax, ay) || 1; ax /= L; ay /= L; }
    if (u.kind === 'basic') {
      const L = u.letter;
      g.scale(sc, sc);
      if (atk) {
        if (L === 'S') { // wind up then slash: rotate + skew
          const a = kf(p, [[0, 0], [0.25, -0.5], [0.55, 0.6], [1, 0]]) * (ax >= 0 ? 1 : -1);
          g.translate(0, size * 0.3); g.rotate(a); g.transform(1, 0, kf(p, [[0, 0], [0.55, -0.35], [1, 0]]) * Math.sign(ax || 1), 1, 0, 0); g.translate(0, -size * 0.3);
        } else if (L === 'L') { // thrust: stretch along the aim direction
          const ang = Math.atan2(ay, ax); const st = kf(p, [[0, 1], [0.25, 0.85], [0.45, 1.45], [1, 1]]); const off = kf(p, [[0, 0], [0.25, -0.08], [0.45, 0.3], [1, 0]]) * size;
          g.translate(ax * off, ay * off); g.rotate(ang); g.scale(st, 1 / Math.sqrt(st)); g.rotate(-ang);
        } else if (L === 'B') { // bend like a drawn bow, then release
          const bx = kf(p, [[0, 1], [0.45, 0.7], [0.55, 1.2], [1, 1]]);
          const ang = Math.atan2(ay, ax);
          g.rotate(ang * 0.15); g.scale(bx, 2 - bx * 0.9 > 1.15 ? 1.15 : 2 - bx * 0.9); g.transform(1, 0, kf(p, [[0, 0], [0.45, 0.25], [0.55, -0.2], [1, 0]]), 1, 0, 0);
        } else if (L === 'K') { // gallop hop
          const hop = Math.sin(p * Math.PI); g.translate(ax * size * 0.12 * hop, -size * 0.22 * hop); g.rotate((ax >= 0 ? 1 : -1) * kf(p, [[0, 0], [0.3, -0.25], [0.7, 0.2], [1, 0]]));
        }
      } else g.scale(breathe, 2 - breathe);
      const gl = letterGlyph(L, u.level);
      g.drawImage(gl.canvas, -size / 2, -size / 2, size, size);
      // eyes (look toward target)
      const [ex, ey, er] = EYES[L]; const blink = (Math.sin(this.time * 1.3 + u.uid * 7) > 0.985) ? 0.15 : 1;
      for (const s of [-1, 1]) {
        const cx = (ex + s * er * 0.95) * size, cy = ey * size;
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, er * size * 0.58, er * size * 0.7 * blink, 0, 0, TAU); g.fill();
        g.lineWidth = 1.5; g.strokeStyle = '#26160b'; g.stroke();
        g.fillStyle = '#1a0f08'; g.beginPath(); g.arc(cx + ax * er * size * 0.2, cy + ay * er * size * 0.2 * blink, er * size * 0.3 * blink, 0, TAU); g.fill();
      }
      // level pips
      if (u.level > 1) {
        const n = u.level, pr = size * 0.045, w = n * pr * 2.6;
        for (let i = 0; i < n; i++) { g.fillStyle = LEVEL_COLORS[u.level - 1]; g.strokeStyle = '#26160b'; g.lineWidth = 1.2; g.beginPath(); g.arc(-w / 2 + pr * 1.3 + i * pr * 2.6, size * 0.43, pr, 0, TAU); g.fill(); g.stroke(); }
      }
      if (u.level >= 5) { g.globalCompositeOperation = 'lighter'; const a = this.time * 2 + u.uid; for (let i = 0; i < 3; i++) { const aa = a + i * TAU / 3; g.fillStyle = LEVEL_COLORS[u.level - 1]; g.globalAlpha = 0.7; g.beginPath(); g.arc(Math.cos(aa) * size * 0.42, Math.sin(aa) * size * 0.3, size * 0.04, 0, TAU); g.fill(); } g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    } else if (u.kind === 'gold') {
      const b = atk ? 1 + 0.08 * Math.sin(p * Math.PI) : 1 + 0.02 * Math.sin(this.time * 3 + u.uid);
      g.scale(sc * b, sc * b);
      const gl = goldGlyph(u.letter); const s2 = size * 0.92;
      g.drawImage(gl.canvas, -s2 / 2, -s2 / 2, s2, s2);
      // sparkle
      const tw = (this.time * 0.7 + u.uid * 0.37) % 1;
      if (tw < 0.25) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,220,0.9)'; this.star(s2 * 0.3, -s2 * 0.3, s2 * 0.12 * Math.sin(tw / 0.25 * Math.PI)); g.globalCompositeOperation = 'source-over'; }
    } else { // hero
      const h = HERO_BY_ID[u.heroId];
      const b = atk ? 1 + 0.1 * Math.sin(p * Math.PI) : 1 + 0.02 * Math.sin(this.time * 2 + u.uid);
      g.scale(sc * b, sc * b);
      const R = size * 0.5;
      // aura
      g.globalCompositeOperation = 'lighter'; const grd = g.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 1.35);
      grd.addColorStop(0, h.color + 'aa'); grd.addColorStop(1, h.color + '00'); g.fillStyle = grd; g.beginPath(); g.arc(0, 0, R * 1.35, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over';
      // golden pedestal + full-body hero sprite
      g.fillStyle = 'rgba(80,40,0,0.35)'; g.beginPath(); g.ellipse(0, R * 0.62, R * 0.8, R * 0.22, 0, 0, TAU); g.fill();
      g.strokeStyle = '#ffd24a'; g.lineWidth = Math.max(2, R * 0.08); g.beginPath(); g.ellipse(0, R * 0.62, R * 0.8, R * 0.22, 0, 0, TAU); g.stroke();
      const hop = atk ? -Math.sin(p * Math.PI) * R * 0.15 : 0;
      if (!drawStrip(g, 'heroes_full', h.portrait, 0, R * 0.7 + hop, R * 2.15, { anchor: 'bottom', flip: ax < -0.3 })) {
        g.save(); g.beginPath(); g.arc(0, -R * 0.05, R * 0.92, 0, TAU); g.clip(); drawStrip(g, 'heroes', h.portrait, 0, -R * 0.05, R * 2.1); g.restore();
      }
      // name plate
      g.font = `${Math.max(9, R * 0.42)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(h.word).width + R * 0.4;
      rr(g, -tw / 2, R * 0.66, tw, R * 0.46, R * 0.2); g.fillStyle = '#7a3a08'; g.fill(); g.strokeStyle = '#ffd24a'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#fff3c4'; g.fillText(h.word, 0, R * 0.9);
      // stars
      for (let i = 0; i < u.level; i++) { g.fillStyle = '#ffe066'; this.star((i - (u.level - 1) / 2) * R * 0.38, -R * 1.5, R * 0.16); }
      // skill cooldown ring
      if (u.skillMax) { const f = 1 - clamp(u.skillCd / u.skillMax, 0, 1); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, R * 0.62, R * 0.95, R * 0.3, 0, -Math.PI / 2, -Math.PI / 2 + f * TAU); g.stroke(); }
      // KING aura radius
      if (u.heroId === 'KING') { g.strokeStyle = 'rgba(255,210,74,0.35)'; g.setLineDash([4, 6]); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, ts * 1.9 / sc, 0, TAU); g.stroke(); g.setLineDash([]); }
    }
    if (u.frozen > 0 && !override) {
      g.fillStyle = 'rgba(150,210,255,0.55)'; rr(g, -size / 2, -size / 2, size, size, size * 0.2); g.fill();
      g.strokeStyle = '#e8f7ff'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#fff'; this.star(0, 0, size * 0.18);
    }
    g.restore();
  }
  star(x, y, r) { const g = this.g; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr2 = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } g.closePath(); g.fill(); }

  drawEnemy(si, e) {
    const g = this.g, ts = this.geo[si].ts;
    const [x, y] = this.toScreen(si, e.x, e.y);
    const boss = e.type === 'boss';
    const h = Math.max(ts * e.size * (boss ? 1.6 : 1.42), boss ? 44 : 30);
    const fly = e.type === 'bat' || e.type === 'wisp';
    const bob = fly ? Math.sin(this.time * 8 + e.id) * ts * 0.06 : -Math.abs(Math.sin(this.time * 9 * e.speed + e.id)) * ts * 0.05;
    const squash = e.type === 'slime' || e.type === 'baby' ? 1 + 0.08 * Math.sin(this.time * 10 + e.id) : 1;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x, y + h * 0.32, h * 0.3, h * 0.08, 0, 0, TAU); g.fill();
    const flip = e.dir < 0;
    const frozen = this.match.sides[si].freezeT > 0 || e.stunT > 0;
    g.save(); g.translate(x, y + h * 0.35 + bob); g.scale(1 / squash, squash);
    const walkB = (Math.floor(this.time * (4 + 3 * e.speed) + e.id * 0.37) & 1) === 1;
    const strip = boss ? (e.castT > 0 ? 'bosses_atk' : 'bosses') : (walkB && !frozen ? 'enemies_b' : 'enemies');
    drawStrip(g, strip, e.sprite, 0, 0, h, { flip, anchor: 'bottom' });
    if (e.hitT > 0) drawStrip(g, strip, e.sprite, 0, 0, h, { flip, anchor: 'bottom', flash: true, alpha: 0.6 });
    g.restore();
    if (frozen) { g.fillStyle = e.stunT > 0 && this.match.sides[si].freezeT <= 0 ? '#ffe066' : '#bfe9ff'; for (let i = 0; i < 3; i++) { const a = this.time * 4 + i * 2.1; this.star(x + Math.cos(a) * h * 0.3, y - h * 0.55 + Math.sin(a) * h * 0.08, h * 0.07); } }
    if (e.slowT > 0) { g.strokeStyle = 'rgba(255,190,100,0.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + h * 0.3, h * 0.35, h * 0.1, 0, 0, TAU); g.stroke(); }
    if (e.dotT > 0) { g.strokeStyle = 'rgba(80,200,90,0.9)'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y + h * 0.3, h * 0.32, h * 0.1, 0, 0, TAU); g.stroke(); }
    // hp bar
    const f = clamp(e.hp / e.maxHp, 0, 1);
    if (f < 1 || boss) {
      const bw = boss ? h * 0.9 : h * 0.6, bh = boss ? 6 : 4, by = y - h * 0.72 + bob;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - bw / 2 - 1, by - 1, bw + 2, bh + 2);
      g.fillStyle = boss ? '#ff5d4a' : f > 0.5 ? '#6fe05b' : f > 0.25 ? '#ffd24a' : '#ff5d4a'; g.fillRect(x - bw / 2, by, bw * f, bh);
      if (e.armor) { g.fillStyle = '#c9d3dd'; g.fillRect(x - bw / 2, by + bh, bw, 1.5); }
    }
  }

  drawFx(dt) {
    const g = this.g;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < f.dur);
    for (const f of this.fx) {
      if (f.t < 0) continue;
      const p = f.t / f.dur;
      g.save();
      switch (f.k) {
        case 'arc': g.translate(f.x, f.y); g.rotate(f.rot + p * 2); g.strokeStyle = f.col; g.globalAlpha = 1 - p; g.lineWidth = f.r * 0.22 * (1 - p) + 1; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, f.r * (0.6 + 0.5 * p), -1.2, 1.0); g.stroke(); break;
        case 'line': g.strokeStyle = f.col; g.globalAlpha = 1 - p; g.lineWidth = f.w * (1 - p) + 1; g.lineCap = 'round'; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(lerp(f.x0, f.x1, Math.min(1, p * 3)), lerp(f.y0, f.y1, Math.min(1, p * 3))); g.stroke(); break;
        case 'hit': g.fillStyle = f.col; g.globalAlpha = 1 - p; g.beginPath(); g.arc(f.x, f.y, f.r * (0.5 + p), 0, TAU); g.fill(); break;
        case 'arrow': { const x = lerp(f.x0, f.x1, p), y = lerp(f.y0, f.y1, p) - Math.sin(p * Math.PI) * f.s * 0.3; const a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0); g.translate(x, y); g.rotate(a); g.strokeStyle = '#6b3f12'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-f.s * 0.25, 0); g.lineTo(f.s * 0.12, 0); g.stroke(); g.fillStyle = '#ddd'; g.beginPath(); g.moveTo(f.s * 0.18, 0); g.lineTo(f.s * 0.08, -4); g.lineTo(f.s * 0.08, 4); g.fill(); g.fillStyle = '#e44'; g.fillRect(-f.s * 0.27, -3, 6, 6); break; }
        case 'spark': case 'orb': { const x = lerp(f.x0, f.x1, easeOut(p)), y = lerp(f.y0, f.y1, easeOut(p)); g.globalCompositeOperation = 'lighter'; g.fillStyle = f.col; g.globalAlpha = 0.9; g.beginPath(); g.arc(x, y, f.s * (f.k === 'orb' ? 0.13 : 0.07), 0, TAU); g.fill(); g.globalAlpha = 0.4; g.beginPath(); g.arc(x, y, f.s * (f.k === 'orb' ? 0.24 : 0.13), 0, TAU); g.fill(); break; }
        case 'ring': g.strokeStyle = f.col; g.globalAlpha = 1 - p; g.lineWidth = (f.w || 4) * (1 - p) + 1; g.beginPath(); g.arc(f.x, f.y, f.r * easeOut(p), 0, TAU); g.stroke(); break;
        case 'rays': { g.translate(f.x, f.y); g.rotate(this.time); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(p * Math.PI) * 0.6; g.fillStyle = f.col; for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(f.r, -f.r * 0.08); g.lineTo(f.r, f.r * 0.08); g.fill(); } break; }
        case 'fly': { const q = easeOut(Math.min(1, p * 1.2)); const x = lerp(f.x0, f.x1, q), y = lerp(f.y0, f.y1, q) - Math.sin(q * Math.PI) * f.s * 0.8; const gl = goldGlyph(f.letter); const s = f.s * 0.8 * (1 - 0.4 * q); g.translate(x, y); g.rotate(q * TAU); g.drawImage(gl.canvas, -s / 2, -s / 2, s, s); break; }
        case 'meteor': { const fall = Math.min(1, p / 0.45); if (fall < 1) { const x = f.x - f.s * 2 * (1 - fall), y = f.y - f.s * 4 * (1 - fall); g.globalCompositeOperation = 'lighter'; const grd = g.createRadialGradient(x, y, 0, x, y, f.s * 0.5); grd.addColorStop(0, '#fff6c0'); grd.addColorStop(0.4, '#ff9a2e'); grd.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, f.s * 0.5, 0, TAU); g.fill(); } else { const q = (p - 0.45) / 0.55; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - q; g.fillStyle = '#ff9a2e'; g.beginPath(); g.arc(f.x, f.y, f.s * 1.3 * easeOut(q), 0, TAU); g.fill(); if (!f.boomed) { f.boomed = true; this.burst(f.x, f.y, 20, '#ffb347', f.s * 0.1); this.shake = Math.max(this.shake, 6); } } break; }
        case 'rain': { const y = f.y - f.s * 2 * (1 - p); g.strokeStyle = '#f5e6c8'; g.lineWidth = 2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(f.x + i * f.s * 0.2, y - f.s * 0.4); g.lineTo(f.x + i * f.s * 0.2, y); g.stroke(); } break; }
        case 'cross': g.translate(f.x, f.y); g.strokeStyle = f.col; g.globalAlpha = 1 - p; g.lineWidth = 4; g.beginPath(); g.moveTo(-f.r, -f.r); g.lineTo(f.r, f.r); g.moveTo(f.r, -f.r); g.lineTo(-f.r, f.r); g.stroke(); break;
        case 'vines': { g.translate(f.x, f.y); g.globalAlpha = Math.min(1, (1 - p) * 3); g.strokeStyle = '#3fae4f'; g.lineWidth = 3; for (let i = 0; i < 7; i++) { const a = i * TAU / 7 + p; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.6) * f.r * 0.6, Math.sin(a + 0.6) * f.r * 0.6, Math.cos(a) * f.r, Math.sin(a) * f.r); g.stroke(); } g.strokeStyle = 'rgba(63,174,79,0.6)'; g.beginPath(); g.arc(0, 0, f.r, 0, TAU); g.stroke(); break; }
        case 'beam': { g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.sin(p * Math.PI); const grd = g.createLinearGradient(f.x, f.y - f.s * 3, f.x, f.y); grd.addColorStop(0, 'rgba(255,250,200,0)'); grd.addColorStop(1, 'rgba(255,250,200,0.9)'); g.fillStyle = grd; g.fillRect(f.x - f.s * 0.3, f.y - f.s * 3, f.s * 0.6, f.s * 3); break; }
        case 'tongue': case 'zap': { const q = Math.min(1, p * 2.5); g.strokeStyle = f.k === 'tongue' ? '#ff6f9a' : '#ffb347'; g.lineWidth = f.k === 'tongue' ? 5 : 3; g.lineCap = 'round'; g.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4; g.beginPath(); g.moveTo(f.x0, f.y0); g.lineTo(lerp(f.x0, f.x1, q), lerp(f.y0, f.y1, q)); g.stroke(); break; }
      }
      g.restore();
    }
    // particles
    for (const pt of this.parts) { pt.life += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const pt of this.parts) { g.globalAlpha = 1 - pt.life / pt.max; g.fillStyle = pt.col; g.fillRect(pt.x - pt.s / 2, pt.y - pt.s / 2, pt.s, pt.s); }
    g.globalAlpha = 1;
    // floating texts
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < t.dur);
    for (const t of this.texts) {
      const p = t.t / t.dur; const s = t.size * (p < 0.15 ? 0.6 + p / 0.15 * 0.4 : 1);
      g.font = `${s}px ${FONT}`; g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      g.lineWidth = 3; g.strokeStyle = 'rgba(20,10,30,0.85)'; g.strokeText(t.s, t.x, t.y - p * 26); g.fillStyle = t.col; g.fillText(t.s, t.x, t.y - p * 26);
    }
    g.globalAlpha = 1;
  }

  drawInfo() {
    const g = this.g, r = this.L.info, m = this.match, [me, riv] = m.sides;
    this.panel(r, 'rgba(20,16,40,0.8)');
    const fs = clamp(r.w / 22, 11, 18);
    g.textAlign = 'left'; g.textBaseline = 'top';
    let y = r.y + 10;
    g.font = `${fs * 1.1}px ${FONT}`; g.fillStyle = '#ffd24a'; g.fillText('DUEL', r.x + 12, y); y += fs * 1.7;
    const rows = [['', 'YOU', 'CPU'], ['Lives', `♥ ${me.lives}`, `♥ ${riv.lives}`], ['Kills', me.stats.kills, riv.stats.kills], ['Heroes', me.stats.heroes, riv.stats.heroes], ['Best letter', 'Lv ' + me.stats.maxLevel, 'Lv ' + riv.stats.maxLevel]];
    const c1 = r.x + 12, c2 = r.x + r.w * 0.52, c3 = r.x + r.w * 0.78;
    for (const [i, row] of rows.entries()) {
      if (y + fs > r.y + r.h - 8) break;
      g.font = i === 0 ? `bold ${fs * 0.8}px ${FONT2}` : `bold ${fs}px ${FONT2}`;
      g.fillStyle = '#b9b2dc'; g.textAlign = 'left'; g.fillText(row[0], c1, y);
      g.textAlign = 'center'; g.fillStyle = i === 0 ? '#7fd7ff' : '#fff'; g.fillText(String(row[1]), c2, y);
      g.fillStyle = i === 0 ? '#ffb3bb' : '#fff'; g.fillText(String(row[2]), c3, y);
      y += fs * 1.45;
    }
    // next wave preview
    const nw = m.previewWave ? m.previewWave() : null;
    if (nw && y + fs * 4 < r.y + r.h) {
      y += fs * 0.4; g.textAlign = 'left'; g.font = `${fs}px ${FONT}`; g.fillStyle = nw.isBoss ? '#ff6b5e' : '#ffd24a';
      g.fillText(nw.isBoss ? `NEXT: WAVE ${nw.w} · BOSS` : `NEXT: WAVE ${nw.w}`, c1, y); y += fs * 1.6;
      const counts = {}; let boss = null;
      for (const sp of nw.list) { if (sp.type === 'boss') boss = sp.boss; else counts[sp.type] = (counts[sp.type] || 0) + 1; }
      const isz = clamp(r.w / 7, 26, 52); let x = c1;
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      if (boss !== null) entries.unshift(['boss', 1]);
      for (const [t, n] of entries) {
        if (x + isz > r.x + r.w - 6) { x = c1; y += isz + fs; }
        if (y + isz > r.y + r.h - 4) break;
        if (t === 'boss') drawStrip(g, 'bosses', boss, x + isz / 2, y + isz, isz * 1.1, { anchor: 'bottom' });
        else drawStrip(g, 'enemies', ENEMIES[t].sprite, x + isz / 2, y + isz, isz, { anchor: 'bottom' });
        g.font = `bold ${fs * 0.85}px ${FONT2}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(t === 'boss' ? BOSSES[boss].name.split(' ').pop() : '×' + n, x + isz / 2, y + isz + 2);
        g.textAlign = 'left'; x += isz + 8;
      }
    }
  }
  drawStrip() {
    const g = this.g, S = this.L.strip, side = this.match.sides[0];
    rr(g, S.x, S.y, S.w, S.h, 10); g.fillStyle = 'rgba(20,16,40,0.72)'; g.fill();
    g.strokeStyle = 'rgba(255,210,74,0.4)'; g.lineWidth = 1.5; g.stroke();
    const held = side.heldGold();
    const heroes = side.unlockedHeroes();
    const onBoard = side.heroesOnBoard();
    const ls = Math.min(S.h - 12, 26); let x = S.x + 10; const y = S.y + (S.h - ls) / 2;
    g.font = `${Math.max(10, ls * 0.5)}px ${FONT2}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffd24a';
    if (this.land) { g.fillText('SPELLBOOK', x, S.y + S.h / 2); x += g.measureText('SPELLBOOK').width + 12; }
    this.stripHits = [];
    // order: most progress first
    const list = heroes.map(h => ({ h, p: side.heroProgress(h), lvl: onBoard.find(u => u.heroId === h.id)?.level || 0 })).sort((a, b) => b.p - a.p);
    for (const { h, lvl } of list) {
      const w = h.word.length * (ls + 2) + 10;
      if (x + w > S.x + S.w - 6) break;
      const hc = held.slice();
      rr(g, x - 3, y - 3, w - 4, ls + 6, 7); g.fillStyle = lvl ? 'rgba(255,210,74,0.25)' : 'rgba(255,255,255,0.06)'; g.fill();
      for (let k = 0; k < h.word.length; k++) {
        const ch = h.word[k]; const i = hc.indexOf(ch); const have = i >= 0; if (have) hc.splice(i, 1);
        if (have) g.drawImage(goldGlyph(ch).canvas, x + k * (ls + 2), y, ls, ls);
        else { rr(g, x + k * (ls + 2) + 1, y + 1, ls - 2, ls - 2, 5); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill(); g.font = `${ls * 0.62}px ${FONT}`; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText(ch, x + k * (ls + 2) + ls / 2, y + ls / 2 + 1); }
      }
      if (lvl) { g.fillStyle = '#ffe066'; g.font = `${ls * 0.5}px ${FONT}`; g.textAlign = 'center'; g.fillText('★' + lvl, x + w - 14, y - 2); }
      this.stripHits.push({ x: x - 3, y: y - 3, w: w - 4, h: ls + 6, hero: h });
      x += w + 4;
    }
  }

  btn(b, { label = '', sub = '', col = '#3d6fd6', enabled = true, icon = null, glow = false, badge = null } = {}) {
    const g = this.g; const hov = this.hover === b && enabled; const down = hov && this.pointer.down;
    const s = down ? 0.96 : hov ? 1.03 : 1;
    g.save(); g.translate(b.x + b.w / 2, b.y + b.h / 2); g.scale(s, s); g.translate(-b.w / 2, -b.h / 2);
    if (glow && enabled) { g.shadowColor = col; g.shadowBlur = 12 + 6 * Math.sin(this.time * 5); }
    rr(g, 0, 0, b.w, b.h, Math.min(14, b.h * 0.3));
    const grd = g.createLinearGradient(0, 0, 0, b.h);
    if (enabled) { grd.addColorStop(0, shadeHex(col, 0.3)); grd.addColorStop(1, shadeHex(col, -0.25)); } else { grd.addColorStop(0, '#666a77'); grd.addColorStop(1, '#3f424c'); }
    g.fillStyle = grd; g.fill(); g.shadowBlur = 0;
    g.lineWidth = 2; g.strokeStyle = enabled ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.15)'; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.14)'; rr(g, 3, 3, b.w - 6, b.h * 0.42, Math.min(10, b.h * 0.25)); g.fill();
    if (icon) icon(g, b);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (label) {
      const fs = Math.min(b.h * (sub ? 0.36 : 0.44), b.w / Math.max(3, label.length) * 1.5);
      g.font = `${fs}px ${FONT}`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.45)';
      const ly = sub ? b.h * 0.4 : b.h / 2 + 1; g.strokeText(label, b.w / 2, ly); g.fillStyle = enabled ? '#fff' : '#bbb'; g.fillText(label, b.w / 2, ly);
    }
    if (sub) { g.font = `bold ${Math.min(b.h * 0.26, 16)}px ${FONT2}`; g.fillStyle = enabled ? '#e8f4ff' : '#aaa'; g.fillText(sub, b.w / 2, b.h * 0.75); }
    if (badge) { g.font = `bold 11px ${FONT2}`; const tw = g.measureText(badge).width + 10; rr(g, b.w - tw + 4, -6, tw, 16, 8); g.fillStyle = '#ff4d6d'; g.fill(); g.fillStyle = '#fff'; g.fillText(badge, b.w - tw / 2 + 4, 2); }
    g.restore();
  }
  panel(r, col = 'rgba(20,16,40,0.78)') { const g = this.g; rr(g, r.x, r.y, r.w, r.h, 12); g.fillStyle = col; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.stroke(); }

  drawHud(dt) {
    const g = this.g, m = this.match, me = m.sides[0], riv = m.sides[1], L = this.L, ctl = this.ctl;
    g.save(); g.translate(this.hox, 0); g.scale(this.hk, this.hk);
    if (this.land) { const D = L.hudD; rr(g, D.x + 4, 4, D.w - 8, D.h - 8, 16); g.fillStyle = 'rgba(14,12,30,0.82)'; g.fill(); g.strokeStyle = 'rgba(255,210,74,0.25)'; g.lineWidth = 2; g.stroke(); }
    else { g.fillStyle = 'rgba(14,12,30,0.88)'; g.fillRect(L.hud.x, L.hud.y, L.hud.w, L.hud.h); g.fillRect(0, 0, L.top.w, L.top.h); }
    const B = id => this.buttons.find(b => b.id === id);
    // small top buttons
    const iconTxt = (t, sz = 0.5) => (gg, b) => { gg.font = `${b.h * sz}px ${FONT}`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillStyle = '#fff'; gg.fillText(t, b.w / 2, b.h / 2 + 1); };
    this.btn(B('pause'), { col: '#5a5f7a', icon: (gg, b) => { gg.fillStyle = '#fff'; gg.fillRect(b.w * 0.33, b.h * 0.28, b.w * 0.12, b.h * 0.44); gg.fillRect(b.w * 0.55, b.h * 0.28, b.w * 0.12, b.h * 0.44); } });
    this.btn(B('speed'), { col: ctl.speed > 1 ? '#e08a1e' : '#5a5f7a', icon: iconTxt(ctl.speed > 1 ? '2x' : '1x', 0.42) });
    this.btn(B('book'), { col: '#7a4fc9', icon: iconTxt('📖', 0.5) });
    // rival card
    if (this.rivalCard) {
      const r = this.rivalCard; this.panel(r, 'rgba(90,20,35,0.75)');
      g.save(); g.beginPath(); g.arc(r.x + 31, r.y + r.h / 2, 25, 0, TAU); g.clip(); drawStrip(g, ctl.rival.portraitStrip || 'rivals', ctl.rival.portrait ?? 0, r.x + 31, r.y + r.h / 2, 54); g.restore();
      g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.font = `15px ${FONT}`; g.fillStyle = '#fff'; g.fillText(ctl.rival.name, r.x + 62, r.y + 22);
      g.font = `bold 12px ${FONT2}`; g.fillStyle = '#ffb3bb'; g.fillText(`CPU · ${ctl.rival.tier}`, r.x + 62, r.y + 38);
      g.fillStyle = '#fff'; g.fillText(`♥ ${riv.lives}   ink ${fmt(riv.ink)}`, r.x + 62, r.y + 54);
    }
    // wave panel
    {
      const r = this.wavePanel; this.panel(r);
      const fw = m.finalWave; const w = m.wave;
      const t = m.timeToNextWave();
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `${Math.min(18, r.h * 0.45)}px ${FONT}`; g.fillStyle = '#fff';
      const label = m.overtime ? `Sudden death ${m.overtime}` : w === 0 ? 'Get ready!' : `Wave ${w}/${fw}`;
      g.fillText(label, r.x + 10, r.y + r.h * 0.38);
      g.font = `bold ${Math.min(12, r.h * 0.3)}px ${FONT2}`; g.fillStyle = '#c8d0ff';
      const nextBoss = Math.ceil((w + 1) / 5) * 5;
      const info = w >= fw ? 'Final wave!' : `next in ${Math.ceil(t)}s · boss at ${nextBoss <= fw ? nextBoss : fw}`;
      g.textAlign = 'right'; g.fillText(info, r.x + r.w - 10, r.y + r.h * 0.38);
      const dur = m.curWave ? m.curWave.dur : 6; const f = clamp(1 - t / dur, 0, 1);
      rr(g, r.x + 10, r.y + r.h - 12, r.w - 20, 6, 3); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fill();
      rr(g, r.x + 10, r.y + r.h - 12, (r.w - 20) * f, 6, 3); g.fillStyle = m.curWave?.isBoss ? '#ff6b5e' : '#7fd7ff'; g.fill();
    }
    // player card / info
    if (this.playerCard) {
      const r = this.playerCard; this.panel(r, 'rgba(20,50,110,0.75)');
      drawStrip(g, 'wards', 0, r.x + 31, r.y + r.h / 2, 54);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.font = `26px ${FONT}`; g.fillStyle = '#7fd7ff'; g.fillText(fmt(me.ink), r.x + 64, r.y + 30);
      const iw = g.measureText(fmt(me.ink)).width; g.font = `bold 12px ${FONT2}`; g.fillText(' INK', r.x + 64 + iw, r.y + 30);
      g.font = `bold 14px ${FONT2}`; g.fillStyle = me.lives <= 1 ? '#ff4d5e' : '#ff9aa6'; g.fillText(`♥ ${me.lives}/${me.maxLives}  lives`, r.x + 64, r.y + 51);
    } else if (this.playerInfo) {
      const r = this.playerInfo; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = `16px ${FONT}`; g.fillStyle = '#7fd7ff'; g.fillText(`${fmt(me.ink)} ink`, r.x, r.y + 10);
      g.fillStyle = '#ff9aa6'; g.fillText(`♥ ${me.lives}`, r.x + 110, r.y + 10);
      g.fillStyle = '#ffb3bb'; g.font = `bold 12px ${FONT2}`; g.fillText(`${ctl.rival.name}: ♥ ${riv.lives}`, r.x + 170, r.y + 10);
      if (me.shovels) { g.fillStyle = '#ffd88a'; g.fillText(`⛏ ${me.shovels}`, r.x + r.w - 40, r.y + 10); }
    }
    // train buttons
    ['S', 'L', 'B', 'K'].forEach((Lt, i) => {
      const b = B('train' + i); const cost = me.trainCost(Lt); const can = cost !== Infinity && me.ink >= cost;
      this.btn(b, { col: UNITS[Lt].dark, enabled: can, sub: cost === Infinity ? 'MAX' : fmt(cost), icon: (gg, bb) => { const gl = letterGlyph(Lt, Math.min(MAX_LEVEL, 1 + me.train[Lt])); const s = bb.h * 0.62; gg.drawImage(gl.canvas, bb.w / 2 - s / 2, bb.h * 0.02, s, s); gg.font = `bold 10px ${FONT2}`; gg.fillStyle = '#ffe066'; gg.textAlign = 'right'; gg.textBaseline = 'top'; gg.fillText(me.train[Lt] ? '+' + me.train[Lt] : '', bb.w - 4, 4); } });
    });
    // items
    for (let i = 0; i < 2; i++) {
      const b = B('item' + i); const it = me.mods.actives[i];
      if (!it) { this.btn(b, { col: '#3a3d52', enabled: false, sub: 'empty' }); continue; }
      const def = ITEM_BY_ID[it.id];
      this.btn(b, { col: RARITIES[it.r].color === '#e8e8e8' ? '#6b7088' : RARITIES[it.r].color, enabled: !it.used, sub: it.used ? 'used' : '', icon: (gg, bb) => drawStrip(gg, 'items', def.icon, bb.w / 2, bb.h * (it.used ? 0.4 : 0.5), bb.h * 0.82, { alpha: it.used ? 0.4 : 1 }) });
    }
    if (this.shovelBox) {
      const r = this.shovelBox; this.panel(r);
      drawStrip(g, 'items', 4, r.x + r.w * 0.35, r.y + r.h / 2, r.h * 0.8, { alpha: me.shovels ? 1 : 0.35 });
      g.font = `18px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = me.shovels ? '#ffd88a' : '#888'; g.fillText('×' + me.shovels, r.x + r.w * 0.72, r.y + r.h / 2);
    }
    // ad buttons
    const adOk = !ctl.tutorial;
    this.btn(B('adSummon'), { col: '#2e9b58', enabled: adOk && !me.adSummonUsed && me.freeTraySlot() >= 0, label: this.land ? '▶ Free Summon' : '▶', sub: this.land ? '' : 'Summon' });
    this.btn(B('adShovel'), { col: '#2e9b58', enabled: adOk && !me.adShovelUsed && me.lockedCells().length > 0, label: this.land ? '▶ Free Shovel' : '▶', sub: this.land ? '' : 'Shovel' });
    if (this.oddsPanel) {
      const r = this.oddsPanel; this.panel(r);
      const locked = me.lockedCells().length > me.shovels; const gold = Math.min(1, me.mods.gold); const sh = locked ? 0.05 : 0;
      g.textAlign = 'left'; g.textBaseline = 'top'; g.font = `bold 12px ${FONT2}`; g.fillStyle = '#c8d0ff';
      g.fillText('SUMMON ODDS', r.x + 10, r.y + 7);
      const rows = [['Letter S·L·B·K', 1 - gold - sh, '#e8e8f0'], ['Golden hero letter', gold, '#ffd24a'], ['Shovel', sh, '#ffd88a']];
      rows.forEach(([n, v, c], i) => { const yy = r.y + 24 + i * 17; if (yy + 14 > r.y + r.h) return; g.fillStyle = c; g.fillText(n, r.x + 10, yy); g.textAlign = 'right'; g.fillText(Math.round(v * 100) + '%', r.x + r.w - 10, yy); g.textAlign = 'left'; });
      if (r.h > 86) { g.fillStyle = '#9aa3d8'; g.fillText(`Summoned ${me.stats.summons} · heroes ${me.stats.heroes} · best Lv ${me.stats.maxLevel}`, r.x + 10, r.y + r.h - 18); }
    }
    // tray
    this.trayAnim = this.trayAnim.map(v => Math.max(0, v - dt * 1.6));
    if (this.trayRects) {
      if (this.land) { g.font = `bold 12px ${FONT2}`; g.fillStyle = '#c8d0ff'; g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText('RECRUITS — drag onto a cell', this.trayRects[0].x, this.trayRects[0].y - 4); }
      this.trayRects.forEach((r, i) => {
        const u = me.tray[i]; const hov = this.hoverTray === i;
        rr(g, r.x, r.y, r.w, r.h, 12); g.fillStyle = hov ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'; g.fill();
        g.strokeStyle = this.selected && this.selected.tray === i ? '#ffe066' : 'rgba(255,255,255,0.25)'; g.lineWidth = this.selected && this.selected.tray === i ? 3 : 1.5; g.stroke();
        if (u && !(this.drag && this.drag.moved && this.drag.src.tray === i)) {
          const a = this.trayAnim[i];
          if (a > 0.55) { // blind box shaking
            const sh = Math.sin(this.time * 60) * 4; g.save(); g.translate(r.x + r.w / 2 + sh, r.y + r.h / 2);
            const s = r.w * 0.6; rr(g, -s / 2, -s / 2, s, s, 8); g.fillStyle = '#8a4b1f'; g.fill(); g.strokeStyle = '#ffd24a'; g.lineWidth = 3; g.stroke();
            g.fillStyle = '#ffd24a'; g.font = `${s * 0.6}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 2); g.restore();
          } else {
            const q = a > 0 ? easeOut(1 - a / 0.55) : 1;
            if (u.kind === 'gold' && a > 0) { g.save(); g.translate(r.x + r.w / 2, r.y + r.h / 2); g.rotate(this.time); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,80,0.5)'; for (let k = 0; k < 8; k++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(r.w * 0.8, -6); g.lineTo(r.w * 0.8, 6); g.fill(); } g.restore(); }
            this.drawUnit(0, null, u, { x: r.x + r.w / 2, y: r.y + r.h / 2, size: r.w * 0.9 * (0.5 + 0.5 * q) });
          }
        }
      });
      const t = this.trash; const hv = this.drag && this.drag.moved && this.inTrash(this.pointer.x, this.pointer.y);
      rr(g, t.x, t.y, t.w, t.h, 12); g.fillStyle = hv ? 'rgba(255,80,80,0.45)' : 'rgba(255,80,80,0.14)'; g.fill(); g.strokeStyle = 'rgba(255,120,120,0.6)'; g.lineWidth = 1.5; g.stroke();
      g.font = `${t.h * 0.42}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffb3b3'; g.fillText('✖', t.x + t.w / 2, t.y + t.h * 0.42);
      g.font = `bold ${Math.max(9, t.h * 0.17)}px ${FONT2}`;
      let sellTxt = 'SELL';
      if (this.drag && this.drag.moved) { const v = me.sellValue(me.getSrc(this.drag.src)); if (v) sellTxt = '+' + v; }
      g.fillText(sellTxt, t.x + t.w / 2, t.y + t.h * 0.8);
    }
    // summon
    const sb = B('summon'); const can = me.canSummon(); const cost = me.summonCost();
    const full = me.freeTraySlot() < 0;
    this.btn(sb, { col: '#d6402f', enabled: can, glow: can && !!ctl.tutorialWants?.('summon'), label: 'SUMMON', sub: full ? 'recruit tray full' : `${fmt(cost)} ink`, icon: (gg, b) => { if (b.w > 150) { gg.save(); gg.translate(b.h * 0.42, b.h * 0.5); gg.rotate(-0.15 + Math.sin(this.time * 3) * 0.05); const s = b.h * 0.5; rr(gg, -s / 2, -s / 2, s, s, 7); gg.fillStyle = '#7a3c12'; gg.fill(); gg.strokeStyle = '#ffd24a'; gg.lineWidth = 2.5; gg.stroke(); gg.fillStyle = '#ffd24a'; gg.font = `${s * 0.6}px ${FONT}`; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('?', 0, 2); gg.restore(); } } });
    if (ctl.cloverLeft || me.cloverLeft) { g.fillStyle = '#7fe08a'; g.font = `bold 12px ${FONT2}`; g.textAlign = 'center'; g.fillText(`🍀 next ${me.cloverLeft} gold`, sb.x + sb.w / 2, sb.y - 6); }
    g.restore();
  }

  drawDrag() {
    if (!this.drag || !this.drag.moved) return;
    const u = this.match.sides[0].getSrc(this.drag.src); if (!u) return;
    const ts = this.geo[0].ts;
    this.g.save(); this.g.globalAlpha = 0.92;
    this.drawUnit(0, null, u, { x: this.pointer.x, y: this.pointer.y - 6, size: ts * 1.0 });
    this.g.restore();
  }
  drawBanners(dt) {
    const g = this.g;
    for (const b of this.banners) b.t += dt;
    this.banners = this.banners.filter(b => b.t < b.dur);
    let y = this.geo[0].y + this.geo[0].ts * 0.55;
    const cx = this.geo[0].x + this.geo[0].w / 2;
    for (const b of this.banners) {
      if (b.t < 0) continue;
      const p = b.t / b.dur;
      const a = p < 0.12 ? p / 0.12 : p > 0.8 ? (1 - p) / 0.2 : 1;
      const s = p < 0.12 ? 0.7 + 0.3 * easeOut(p / 0.12) : 1;
      let fs = clamp(this.geo[0].ts * 0.42, 16, 34) * (b.hero ? 1.2 : 1);
      g.font = `${fs}px ${FONT}`; let tw = g.measureText(b.text).width;
      const maxW = this.geo[0].w * 0.8; if (tw > maxW) { fs *= maxW / tw; g.font = `${fs}px ${FONT}`; tw = g.measureText(b.text).width; }
      g.save(); g.globalAlpha = a; g.translate(cx, y); g.scale(s, s);
      const ph = b.hero ? fs * 2.4 : fs * 1.5;
      rr(g, -tw / 2 - fs * (b.hero ? 2.4 : 0.8), -ph / 2, tw + fs * (b.hero ? 3.2 : 1.6), ph, ph * 0.3);
      g.fillStyle = 'rgba(20,12,40,0.82)'; g.fill(); g.strokeStyle = b.col; g.lineWidth = 3; g.stroke();
      if (b.hero) { g.save(); g.beginPath(); g.arc(-tw / 2 - fs * 1.2, 0, ph * 0.42, 0, TAU); g.clip(); drawStrip(g, 'heroes', b.hero.portrait, -tw / 2 - fs * 1.2, 0, ph * 0.95); g.restore(); }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.6)';
      const tx = b.hero ? fs * 0.4 : 0;
      g.strokeText(b.text, tx, 2); g.fillStyle = b.col; g.fillText(b.text, tx, 2);
      g.restore();
      y += fs * 2.6;
    }
  }
  drawTip() {
    const t = this.tip; if (!t) return;
    const g = this.g; g.font = `bold 13px ${FONT2}`;
    const maxW = 330; const lines = [];
    for (const l of t.lines) {
      const words = String(l).split(' '); let cur = '';
      for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
      lines.push(cur); if (lines.length === 1) lines.first = 1;
    }
    const firstLen = (() => { const words = String(t.lines[0]).split(' '); let cur = '', n = 1; for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { n++; cur = w; } else cur = test; } return n; })();
    const w = Math.min(maxW, Math.max(...lines.map(l => g.measureText(l).width))) + 20; const h = lines.length * 18 + 12;
    let x = clamp(t.x + 16, 4, this.W - w - 4), y = clamp(t.y - h - 10, 4, this.H - h - 4);
    rr(g, x, y, w, h, 8); g.fillStyle = 'rgba(10,8,24,0.94)'; g.fill(); g.strokeStyle = t.col || '#ffd24a'; g.lineWidth = 1.5; g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'top';
    lines.forEach((l, i) => { g.fillStyle = i < firstLen ? (t.col || '#ffd24a') : '#e8e8f0'; g.fillText(l, x + 10, y + 7 + i * 18); });
  }
}
function shadeHex(hex, f) {
  if (!hex.startsWith('#')) return hex;
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
