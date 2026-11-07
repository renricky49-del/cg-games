// Code-rendered letter soldiers (bundled OFL "Titan One" font + canvas effects), cached per letter/level.
import { UNITS, LEVEL_COLORS } from './data.js';
import { IMG, STRIPS } from './assets.js';

export const FONT = '"Titan One", "Arial Black", "Arial Rounded MT Bold", sans-serif';
export const FONT2 = '"Fredoka", "Trebuchet MS", sans-serif';
const G = 160;
const cache = new Map();

// where the cartoon eyes sit on each letter (fraction of glyph box, relative to center)
export const EYES = { S: [0.02, -0.17, 0.12], L: [-0.085, -0.1, 0.07], B: [-0.04, -0.17, 0.11], K: [-0.105, -0.1, 0.07] };

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
function mk() { const c = document.createElement('canvas'); c.width = G; c.height = G; return c; }
function centerY(g, text, cy) { const m = g.measureText(text); return cy + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2; }

export function letterGlyph(letter, level) {
  const key = 'b' + letter + level;
  if (cache.has(key)) return cache.get(key);
  const def = UNITS[letter]; const c = mk(); const g = c.getContext('2d');
  const cx = G / 2, fs = 104;
  g.font = `${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const y = centerY(g, letter, G / 2 + 2);
  const lc = LEVEL_COLORS[level - 1];
  // aura glow for high levels
  if (level >= 4) { g.save(); g.shadowColor = lc; g.shadowBlur = 10 + level * 4; g.lineWidth = 18; g.strokeStyle = lc; g.strokeText(letter, cx, y); g.restore(); }
  // level ring
  g.lineWidth = 17 + Math.min(level, 5); g.strokeStyle = level >= 2 ? lc : '#4a2c16'; g.strokeText(letter, cx, y);
  // dark ink outline
  g.lineWidth = level >= 2 ? 9 : 11; g.strokeStyle = '#26160b'; g.strokeText(letter, cx, y);
  // body with gloss via temp canvas
  const t = mk(); const tg = t.getContext('2d');
  tg.font = g.font; tg.textAlign = 'center'; tg.textBaseline = 'alphabetic';
  const grad = tg.createLinearGradient(0, 30, 0, 130);
  grad.addColorStop(0, shade(def.color, 0.45)); grad.addColorStop(0.45, def.color); grad.addColorStop(1, shade(def.color, -0.45));
  tg.fillStyle = grad; tg.fillText(letter, cx, y);
  tg.globalCompositeOperation = 'source-atop';
  tg.fillStyle = 'rgba(255,255,255,0.38)';
  tg.beginPath(); tg.ellipse(cx - 6, 46, 46, 18, -0.2, 0, Math.PI * 2); tg.fill();
  tg.fillStyle = 'rgba(0,0,0,0.18)'; tg.fillRect(0, 118, G, 40);
  if (level >= 3) { // metallic sheen stripes
    tg.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 3; i++) { tg.save(); tg.translate(40 + i * 34, 0); tg.rotate(0.5); tg.fillRect(0, -20, 8, 220); tg.restore(); }
  }
  g.drawImage(t, 0, 0);
  const out = { canvas: c, size: G };
  cache.set(key, out);
  return out;
}

function starPath(g, x, y, r, inner = 0.45, n = 5) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n; const rr = i % 2 ? r * inner : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}
// ★ wild letter: a rainbow-rimmed tile with a big star (counts as any letter)
function wildGlyph() {
  const c = mk(); const g = c.getContext('2d');
  const r = 26, x0 = 14, y0 = 14, w = G - 28;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.save(); g.shadowColor = 'rgba(220,140,255,0.95)'; g.shadowBlur = 16;
  rr(x0, y0, w, w, r); g.fillStyle = '#4a1a6b'; g.fill(); g.restore();
  const rim = g.createLinearGradient(x0, y0, x0 + w, y0 + w);
  ['#ff6b8b', '#ffd24a', '#7fe08a', '#5ac8ff', '#c77dff'].forEach((col, i) => rim.addColorStop(i / 4, col));
  rr(x0 + 3, y0 + 3, w - 6, w - 6, r - 2); g.fillStyle = rim; g.fill();
  const body = g.createLinearGradient(0, y0, 0, y0 + w); body.addColorStop(0, '#fff6d0'); body.addColorStop(0.45, '#ffd34a'); body.addColorStop(1, '#d08a10');
  rr(x0 + 10, y0 + 10, w - 20, w - 20, r - 8); g.fillStyle = body; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(G / 2 - 10, y0 + 30, 38, 11, -0.15, 0, Math.PI * 2); g.fill();
  starPath(g, G / 2, G / 2 + 4, 44); g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#6b3a02'; g.stroke();
  const sg = g.createLinearGradient(0, G / 2 - 44, 0, G / 2 + 44); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#e9b8ff');
  g.fillStyle = sg; g.fill();
  return { canvas: c, size: G };
}
// purple hex orb used for the Hex button, Hexcraft blessing and the flying curse
export function hexGlyph() {
  if (cache.has('hex')) return cache.get('hex');
  const c = mk(); const g = c.getContext('2d'); const cx = G / 2, cy = G / 2;
  const grd = g.createRadialGradient(cx - 18, cy - 22, 6, cx, cy, 64);
  grd.addColorStop(0, '#f3d9ff'); grd.addColorStop(0.35, '#b26bff'); grd.addColorStop(0.8, '#4b1585'); grd.addColorStop(1, '#2a0a4d');
  g.save(); g.shadowColor = 'rgba(190,110,255,0.9)'; g.shadowBlur = 18; g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.fill(); g.restore();
  g.lineWidth = 6; g.strokeStyle = '#26092f'; g.beginPath(); g.arc(cx, cy, 62, 0, Math.PI * 2); g.stroke();
  // swirl
  g.strokeStyle = 'rgba(255,230,255,0.85)'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 3.2; const rr = 6 + i * 1.05; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke();
  // glint
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(cx - 26, cy - 30, 14, 8, -0.6, 0, Math.PI * 2); g.fill();
  const out = { canvas: c, size: G }; cache.set('hex', out); return out;
}
// round badge for a blessing (used on canvas and, via toDataURL, in the DOM)
export function boonIcon(b) {
  const key = 'boon' + b.id;
  if (cache.has(key)) return cache.get(key);
  const c = mk(); const g = c.getContext('2d'); const cx = G / 2;
  const bg = g.createRadialGradient(cx, cx - 20, 10, cx, cx, 78); bg.addColorStop(0, shade(b.col, 0.25)); bg.addColorStop(1, shade(b.col, -0.55));
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cx, 74, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#fff3c4'; g.stroke();
  const ic = b.icon || {}; let im = null;
  if (ic.letter) im = letterGlyph(ic.letter, 3).canvas;
  else if (ic.wild) im = goldGlyph('*').canvas;
  else if (ic.hex) im = hexGlyph().canvas;
  if (im) g.drawImage(im, 22, 22, G - 44, G - 44);
  else if (ic.item !== undefined && IMG.strip_items) { const sz = STRIPS.items.size; g.drawImage(IMG.strip_items, ic.item * sz, 0, sz, sz, 16, 16, G - 32, G - 32); }
  const out = { canvas: c, size: G, url: null };
  cache.set(key, out); return out;
}
export function boonIconUrl(b) { const o = boonIcon(b); if (!o.url) o.url = o.canvas.toDataURL(); return o.url; }

export function goldGlyph(letter) {
  const key = 'g' + letter;
  if (cache.has(key)) return cache.get(key);
  if (letter === '*') { const w = wildGlyph(); cache.set(key, w); return w; }
  const c = mk(); const g = c.getContext('2d');
  const r = 26, x0 = 14, y0 = 14, w = G - 28;
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.save(); g.shadowColor = 'rgba(255,200,40,0.9)'; g.shadowBlur = 14;
  rr(x0, y0, w, w, r); g.fillStyle = '#7a4a07'; g.fill(); g.restore();
  const grad = g.createLinearGradient(0, y0, 0, y0 + w);
  grad.addColorStop(0, '#fff3b0'); grad.addColorStop(0.35, '#ffd34a'); grad.addColorStop(1, '#c98a10');
  rr(x0 + 5, y0 + 5, w - 10, w - 10, r - 4); g.fillStyle = grad; g.fill();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(G / 2 - 10, y0 + 28, 40, 12, -0.15, 0, Math.PI * 2); g.fill();
  g.font = `86px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const y = centerY(g, letter, G / 2 + 4);
  g.fillStyle = 'rgba(255,255,255,0.65)'; g.fillText(letter, G / 2 + 2, y + 3);
  g.fillStyle = '#6b3a02'; g.fillText(letter, G / 2, y);
  const out = { canvas: c, size: G };
  cache.set(key, out);
  return out;
}

export function clearGlyphCache() { cache.clear(); }
