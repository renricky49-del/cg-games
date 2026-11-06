// Code-drawn mahjong tile faces (crisp at any size). Cached per face/size/mode.
// Face ids: 0-8 dots 1-9, 9-17 bamboo 1-9, 18-20 dragons (red, green, white),
// 21-24 winds (E S W N), 25-33 characters 1-9, 34-37 flowers (plum, orchid, chrysanthemum, lotus)

const GLYPHS = '一二三四五六七八九萬東南西北中發';
let glyphImg = null;
const tintCache = new Map();

export function loadGlyphs(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { glyphImg = img; res(); };
    img.onerror = () => res();
    img.src = src;
  });
}

function tinted(ch, color) {
  const key = ch + color;
  if (tintCache.has(key)) return tintCache.get(key);
  const i = GLYPHS.indexOf(ch);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  if (glyphImg && i >= 0) {
    g.drawImage(glyphImg, i * 128, 0, 128, 128, 0, 0, 128, 128);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  } else {
    g.fillStyle = color; g.font = 'bold 100px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, 64, 70);
  }
  tintCache.set(key, c);
  return c;
}

const COL = { blue: '#1f5ea8', green: '#178a4a', red: '#c92f2b', black: '#1d2430', gold: '#c9971a' };

export const SUITS = ['dots', 'bamboo', 'dragon', 'wind', 'char', 'flower'];
export function suitOf(face) {
  if (face < 9) return 0; if (face < 18) return 1; if (face < 21) return 2;
  if (face < 25) return 3; if (face < 34) return 4; return 5;
}
export function faceName(face) {
  const s = suitOf(face);
  if (s === 0) return `${face + 1} Dots`;
  if (s === 1) return `${face - 8} Bamboo`;
  if (s === 2) return ['Red Dragon', 'Green Dragon', 'White Dragon'][face - 18];
  if (s === 3) return ['East Wind', 'South Wind', 'West Wind', 'North Wind'][face - 21];
  if (s === 4) return `${face - 24} Characters`;
  return ['Plum', 'Orchid', 'Chrysanthemum', 'Lotus'][face - 34];
}
function indexLabel(face) {
  const s = suitOf(face);
  if (s === 0) return String(face + 1);
  if (s === 1) return String(face - 8);
  if (s === 2) return ['R', 'G', 'W'][face - 18];
  if (s === 3) return ['E', 'S', 'W', 'N'][face - 21];
  if (s === 4) return String(face - 24);
  return ['P', 'O', 'C', 'L'][face - 34];
}
const HC_BG = ['#cfe2ff', '#c9f2d4', '#ffe7a3', '#e1e1e8', '#ffd0cc', '#f7d4f3'];
const HC_INK = ['#0b3d91', '#0a6b2f', '#8a5a00', '#222', '#a1140f', '#8a1a7a'];

function dot(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fffaf0';
  g.beginPath(); g.arc(x, y, r * 0.62, 0, Math.PI * 2); g.fill();
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y, r * 0.36, 0, Math.PI * 2); g.fill();
}

const DOT_LAYOUT = {
  1: [[0.5, 0.5, 'red', 1.9]],
  2: [[0.5, 0.27, 'green'], [0.5, 0.73, 'blue']],
  3: [[0.24, 0.2, 'blue'], [0.5, 0.5, 'red'], [0.76, 0.8, 'green']],
  4: [[0.27, 0.27, 'blue'], [0.73, 0.27, 'green'], [0.27, 0.73, 'green'], [0.73, 0.73, 'blue']],
  5: [[0.25, 0.22, 'blue'], [0.75, 0.22, 'green'], [0.5, 0.5, 'red'], [0.25, 0.78, 'green'], [0.75, 0.78, 'blue']],
  6: [[0.3, 0.18, 'green'], [0.7, 0.18, 'green'], [0.3, 0.5, 'red'], [0.7, 0.5, 'red'], [0.3, 0.82, 'red'], [0.7, 0.82, 'red']],
  7: [[0.2, 0.13, 'green'], [0.5, 0.25, 'green'], [0.8, 0.37, 'green'], [0.3, 0.6, 'red'], [0.7, 0.6, 'red'], [0.3, 0.86, 'red'], [0.7, 0.86, 'red']],
  8: [[0.3, 0.13, 'blue'], [0.7, 0.13, 'blue'], [0.3, 0.38, 'blue'], [0.7, 0.38, 'blue'], [0.3, 0.62, 'blue'], [0.7, 0.62, 'blue'], [0.3, 0.87, 'blue'], [0.7, 0.87, 'blue']],
  9: [[0.2, 0.18, 'blue'], [0.5, 0.18, 'blue'], [0.8, 0.18, 'blue'], [0.2, 0.5, 'red'], [0.5, 0.5, 'red'], [0.8, 0.5, 'red'], [0.2, 0.82, 'green'], [0.5, 0.82, 'green'], [0.8, 0.82, 'green']],
};

function drawDots(g, n, fx, fy, fw, fh) {
  const L = DOT_LAYOUT[n];
  const base = Math.min(fw, fh) * (n === 1 ? 0.2 : n <= 4 ? 0.17 : n <= 6 ? 0.135 : n <= 8 ? 0.11 : 0.13);
  for (const [px, py, c, s] of L) {
    const r = base * (s || 1);
    if (s) { // big 1-dot: decorative petals
      g.fillStyle = COL.green;
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        g.beginPath(); g.arc(fx + px * fw + Math.cos(a) * r * 1.08, fy + py * fh + Math.sin(a) * r * 1.08, r * 0.2, 0, Math.PI * 2); g.fill();
      }
    }
    dot(g, fx + px * fw, fy + py * fh, r, COL[c]);
  }
}

function stick(g, cx, cy, sw, sh, color) {
  g.fillStyle = color;
  const r = sw / 2;
  g.beginPath(); g.roundRect(cx - r, cy - sh / 2, sw, sh, r); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillRect(cx - r * 0.18, cy - sh / 2 + sh * 0.12, r * 0.36, sh * 0.76);
  g.fillStyle = color;
  for (const t of [0.5]) g.fillRect(cx - r * 1.15, cy - sh / 2 + sh * t - sh * 0.045, r * 2.3, sh * 0.09);
  g.fillRect(cx - r * 1.1, cy - sh / 2, r * 2.2, sh * 0.08);
  g.fillRect(cx - r * 1.1, cy + sh / 2 - sh * 0.08, r * 2.2, sh * 0.08);
}

const BAM_LAYOUT = {
  2: [[0.5, 0.27], [0.5, 0.73]],
  3: [[0.5, 0.27], [0.3, 0.73], [0.7, 0.73]],
  4: [[0.3, 0.27], [0.7, 0.27], [0.3, 0.73], [0.7, 0.73]],
  5: [[0.22, 0.27], [0.78, 0.27], [0.5, 0.5, 'red'], [0.22, 0.73], [0.78, 0.73]],
  6: [[0.2, 0.27], [0.5, 0.27], [0.8, 0.27], [0.2, 0.73, 'blue'], [0.5, 0.73, 'blue'], [0.8, 0.73, 'blue']],
  7: [[0.5, 0.17, 'red'], [0.2, 0.5], [0.5, 0.5], [0.8, 0.5], [0.2, 0.83], [0.5, 0.83], [0.8, 0.83]],
  8: [[0.14, 0.27], [0.38, 0.27], [0.62, 0.27], [0.86, 0.27], [0.14, 0.73, 'blue'], [0.38, 0.73, 'blue'], [0.62, 0.73, 'blue'], [0.86, 0.73, 'blue']],
  9: [[0.2, 0.17, 'red'], [0.5, 0.17, 'blue'], [0.8, 0.17, 'red'], [0.2, 0.5, 'red'], [0.5, 0.5, 'blue'], [0.8, 0.5, 'red'], [0.2, 0.83, 'red'], [0.5, 0.83, 'blue'], [0.8, 0.83, 'red']],
};

function drawBird(g, fx, fy, fw, fh) {
  const cx = fx + fw * 0.5, cy = fy + fh * 0.52, s = Math.min(fw, fh * 0.75);
  // tail
  g.fillStyle = COL.green;
  g.beginPath(); g.moveTo(cx - s * 0.05, cy + s * 0.05);
  g.quadraticCurveTo(cx - s * 0.5, cy + s * 0.35, cx - s * 0.42, cy + s * 0.62);
  g.quadraticCurveTo(cx - s * 0.12, cy + s * 0.45, cx + s * 0.05, cy + s * 0.15); g.fill();
  g.fillStyle = COL.blue;
  g.beginPath(); g.moveTo(cx, cy + s * 0.1);
  g.quadraticCurveTo(cx - s * 0.15, cy + s * 0.55, cx + s * 0.02, cy + s * 0.7);
  g.quadraticCurveTo(cx + s * 0.08, cy + s * 0.4, cx + s * 0.12, cy + s * 0.12); g.fill();
  // body
  g.fillStyle = COL.green;
  g.beginPath(); g.ellipse(cx + s * 0.05, cy - s * 0.02, s * 0.24, s * 0.19, -0.5, 0, Math.PI * 2); g.fill();
  // wing
  g.fillStyle = COL.red;
  g.beginPath(); g.ellipse(cx - s * 0.02, cy + s * 0.0, s * 0.13, s * 0.08, -0.7, 0, Math.PI * 2); g.fill();
  // head
  g.fillStyle = COL.red;
  g.beginPath(); g.arc(cx + s * 0.22, cy - s * 0.24, s * 0.12, 0, Math.PI * 2); g.fill();
  g.fillStyle = COL.gold;
  g.beginPath(); g.moveTo(cx + s * 0.32, cy - s * 0.27); g.lineTo(cx + s * 0.45, cy - s * 0.22); g.lineTo(cx + s * 0.32, cy - s * 0.18); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + s * 0.25, cy - s * 0.27, s * 0.035, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(cx + s * 0.255, cy - s * 0.27, s * 0.018, 0, Math.PI * 2); g.fill();
}

function drawBamboo(g, n, fx, fy, fw, fh) {
  if (n === 1) return drawBird(g, fx, fy, fw, fh);
  const L = BAM_LAYOUT[n];
  const rows = n <= 6 || n === 8 ? 2 : 3;
  const cols = n === 8 ? 4 : n <= 4 ? 2 : 3;
  const sh = fh / rows * (rows === 2 ? 0.8 : 0.78);
  const sw = Math.min(fw / cols * 0.55, sh * 0.32);
  for (const [px, py, c] of L) stick(g, fx + px * fw, fy + py * fh, sw, sh, COL[c || 'green']);
}

function drawGlyph(g, ch, color, cx, cy, size) {
  g.drawImage(tinted(ch, color), cx - size / 2, cy - size / 2, size, size);
}

function drawFlower(g, k, fx, fy, fw, fh) {
  const cx = fx + fw / 2, cy = fy + fh * 0.44, s = Math.min(fw, fh) * 0.42;
  // stem + leaves
  g.strokeStyle = COL.green; g.lineWidth = s * 0.09; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx - s * 0.2, cy + s * 0.8, cx + s * 0.05, fy + fh * 0.97); g.stroke();
  g.fillStyle = COL.green;
  g.beginPath(); g.ellipse(cx + s * 0.32, cy + s * 0.85, s * 0.3, s * 0.11, -0.6, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx - s * 0.32, cy + s * 0.6, s * 0.26, s * 0.1, 0.6, 0, Math.PI * 2); g.fill();
  if (k === 0) { // plum: 5 round petals
    g.fillStyle = '#e8577c';
    for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.57; g.beginPath(); g.arc(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42, s * 0.34, 0, 7); g.fill(); }
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(cx, cy, s * 0.22, 0, 7); g.fill();
  } else if (k === 1) { // orchid: 3 long petals + 2 small
    g.fillStyle = '#8f4fc9';
    for (const a of [-1.57, -1.57 + 2.1, -1.57 - 2.1]) { g.beginPath(); g.ellipse(cx + Math.cos(a) * s * 0.45, cy + Math.sin(a) * s * 0.45, s * 0.5, s * 0.2, a, 0, 7); g.fill(); }
    g.fillStyle = '#c99be8';
    for (const a of [-0.5, -2.64]) { g.beginPath(); g.ellipse(cx + Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.3, s * 0.3, s * 0.14, a, 0, 7); g.fill(); }
    g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(cx, cy, s * 0.14, 0, 7); g.fill();
  } else if (k === 2) { // chrysanthemum
    for (let ring = 0; ring < 2; ring++) {
      g.fillStyle = ring ? '#f7c51e' : '#e39a12';
      const n = 14, R = ring ? s * 0.42 : s * 0.62;
      for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n + ring * 0.2; g.beginPath(); g.ellipse(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, R * 0.5, R * 0.13, a, 0, 7); g.fill(); }
    }
    g.fillStyle = '#b8640a'; g.beginPath(); g.arc(cx, cy, s * 0.15, 0, 7); g.fill();
  } else { // lotus
    g.fillStyle = '#f08fb0';
    for (const a of [-2.4, -0.74, -1.57, -2.0, -1.14]) { g.beginPath(); g.ellipse(cx + Math.cos(a) * s * 0.38, cy + s * 0.15 + Math.sin(a) * s * 0.38, s * 0.42, s * 0.17, a, 0, 7); g.fill(); }
    g.fillStyle = '#d9507c';
    g.beginPath(); g.ellipse(cx, cy - s * 0.1, s * 0.16, s * 0.4, 0, 0, 7); g.fill();
    g.fillStyle = '#2f9a5a'; g.beginPath(); g.ellipse(cx, cy + s * 0.32, s * 0.6, s * 0.12, 0, 0, 7); g.fill();
  }
}

function drawFace(g, face, fx, fy, fw, fh, hc) {
  const s = suitOf(face);
  if (s === 0) drawDots(g, face + 1, fx, fy, fw, fh);
  else if (s === 1) drawBamboo(g, face - 8, fx, fy, fw, fh);
  else if (s === 2) {
    const k = face - 18;
    if (k === 0) drawGlyph(g, '中', COL.red, fx + fw / 2, fy + fh / 2, Math.min(fw, fh) * 1.0);
    else if (k === 1) drawGlyph(g, '發', COL.green, fx + fw / 2, fy + fh / 2, Math.min(fw, fh) * 1.0);
    else {
      g.strokeStyle = COL.blue; g.lineWidth = fw * 0.07;
      g.strokeRect(fx + fw * 0.12, fy + fh * 0.1, fw * 0.76, fh * 0.8);
      g.lineWidth = fw * 0.035;
      g.strokeRect(fx + fw * 0.25, fy + fh * 0.2, fw * 0.5, fh * 0.6);
    }
  } else if (s === 3) {
    drawGlyph(g, '東南西北'[face - 21], COL.black, fx + fw / 2, fy + fh * 0.54, Math.min(fw, fh) * 0.95);
  } else if (s === 4) {
    const n = face - 24;
    drawGlyph(g, '一二三四五六七八九'[n - 1], COL.blue, fx + fw / 2, fy + fh * 0.27, fw * 0.66);
    drawGlyph(g, '萬', COL.red, fx + fw / 2, fy + fh * 0.72, fw * 0.74);
  } else drawFlower(g, face - 34, fx, fy, fw, fh);
  // corner index: always for chars/winds/flowers (readability for new players), all suits in high-contrast mode
  if (hc || s >= 3) {
    const lab = indexLabel(face);
    const fs = Math.max(8, fw * (hc ? 0.34 : 0.24));
    g.font = `800 ${fs}px Inter, "Segoe UI", Arial, sans-serif`;
    g.textAlign = 'left'; g.textBaseline = 'top';
    if (hc) {
      g.fillStyle = HC_INK[s];
      g.fillText(lab, fx - fw * 0.04, fy - fh * 0.04);
    } else {
      g.fillStyle = s === 4 ? COL.red : s === 5 ? '#8a1a7a' : COL.black;
      g.fillText(lab, fx - fw * 0.02, fy - fh * 0.02);
    }
  }
}

const cache = new Map();

// Returns a canvas with the full tile (body + face) drawn at pixel size (pw x ph) (already DPR scaled).
// The tile occupies the canvas; depth (green back) is the bottom `depth` px.
export function tileCanvas(face, pw, ph, hc) {
  const key = `${face}|${pw}|${ph}|${hc ? 1 : 0}`;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  const g = c.getContext('2d');
  const depth = Math.round(ph * 0.1);
  const r = pw * 0.14;
  // back (jade) layer
  const bg = g.createLinearGradient(0, 0, 0, ph);
  bg.addColorStop(0, '#2e9d74'); bg.addColorStop(1, '#155c43');
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(0, depth * 0.6, pw, ph - depth * 0.6, r); g.fill();
  // ivory front
  const fh = ph - depth;
  const fg = g.createLinearGradient(0, 0, pw, fh);
  if (hc) { fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, HC_BG[suitOf(face)]); }
  else { fg.addColorStop(0, '#fffdf6'); fg.addColorStop(1, '#efe4cc'); }
  g.fillStyle = '#d9cdb2';
  g.beginPath(); g.roundRect(0, 0, pw, fh + depth * 0.25, r); g.fill();
  g.fillStyle = fg;
  g.beginPath(); g.roundRect(0, 0, pw, fh, r); g.fill();
  // bevel highlight
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = Math.max(1, pw * 0.03);
  g.beginPath(); g.roundRect(pw * 0.04, pw * 0.04, pw * 0.92, fh - pw * 0.08, r * 0.8); g.stroke();
  g.strokeStyle = 'rgba(120,96,60,0.25)'; g.lineWidth = Math.max(1, pw * 0.02);
  g.beginPath(); g.roundRect(pw * 0.01, pw * 0.01, pw * 0.98, fh - pw * 0.02, r); g.stroke();
  // face
  const pad = pw * 0.13;
  drawFace(g, face, pad, pad, pw - pad * 2, fh - pad * 2, hc);
  cache.set(key, c);
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return c;
}

export function stoneCanvas(pw, ph) {
  const key = `stone|${pw}|${ph}`;
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  const g = c.getContext('2d');
  const cx = pw / 2, cy = ph * 0.55;
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath(); g.ellipse(cx, ph * 0.86, pw * 0.46, ph * 0.1, 0, 0, 7); g.fill();
  const gr = g.createRadialGradient(cx - pw * 0.15, cy - ph * 0.2, pw * 0.05, cx, cy, pw * 0.6);
  gr.addColorStop(0, '#b9bdb5'); gr.addColorStop(0.6, '#7d847c'); gr.addColorStop(1, '#565d57');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(pw * 0.1, ph * 0.8);
  g.bezierCurveTo(pw * 0.0, ph * 0.45, pw * 0.2, ph * 0.18, pw * 0.48, ph * 0.2);
  g.bezierCurveTo(pw * 0.8, ph * 0.16, pw * 1.0, ph * 0.45, pw * 0.9, ph * 0.82);
  g.closePath(); g.fill();
  // moss
  g.fillStyle = '#5f9a4c';
  g.beginPath(); g.ellipse(pw * 0.4, ph * 0.26, pw * 0.2, ph * 0.07, -0.2, 0, 7); g.fill();
  g.fillStyle = '#7dbb5e';
  g.beginPath(); g.ellipse(pw * 0.36, ph * 0.24, pw * 0.1, ph * 0.04, -0.2, 0, 7); g.fill();
  g.strokeStyle = 'rgba(40,44,40,0.35)'; g.lineWidth = Math.max(1, pw * 0.025);
  g.beginPath(); g.moveTo(pw * 0.6, ph * 0.4); g.lineTo(pw * 0.68, ph * 0.55); g.lineTo(pw * 0.62, ph * 0.66); g.stroke();
  cache.set(key, c);
  return c;
}

export function clearTileCache() { cache.clear(); }
