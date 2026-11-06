// Image loading + sprite strips
export const IMG = {};
export const STRIPS = {
  enemies: { file: 'enemies.webp', size: 128 },
  bosses: { file: 'bosses.webp', size: 224 },
  wards: { file: 'wards.webp', size: 256 },
  heroes: { file: 'heroes.webp', size: 192 },
  weapons: { file: 'weapons.webp', size: 112 },
  items: { file: 'items.webp', size: 112 },
  rivals: { file: 'rivals.webp', size: 160 },
};
const MAPS = ['ember', 'marsh', 'iron', 'bay'];
function load(src) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => { console.warn('failed to load', src); res(null); };
    im.src = src;
  });
}
export async function loadAll(onProgress) {
  const jobs = [];
  for (const [k, s] of Object.entries(STRIPS)) jobs.push(['strip_' + k, 'assets/img/' + s.file]);
  for (const m of MAPS) jobs.push(['map_' + m, 'assets/img/map_' + m + '.webp']);
  jobs.push(['keyart', 'assets/img/keyart.webp']);
  let done = 0;
  await Promise.all(jobs.map(async ([k, src]) => { IMG[k] = await load(src); done++; onProgress && onProgress(done / jobs.length); }));
  // white silhouettes for hit flashes
  for (const k of ['enemies', 'bosses']) {
    const im = IMG['strip_' + k]; if (!im) continue;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    IMG['flash_' + k] = c;
  }
}
// draw sprite i of a strip centered at (x,y) with height h (keeps aspect: square cells)
export function drawStrip(ctx, strip, i, x, y, h, { flip = false, anchor = 'center', alpha = 1, flash = false } = {}) {
  const s = STRIPS[strip]; const im = flash ? IMG['flash_' + strip] : IMG['strip_' + strip]; if (!im) return false;
  const sz = s.size;
  ctx.save();
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  const dy = anchor === 'bottom' ? -h : -h / 2;
  ctx.drawImage(im, i * sz, 0, sz, sz, -h / 2, dy, h, h);
  ctx.restore();
  return true;
}
// CSS background for DOM icons
export function stripCss(strip, i, px) {
  const s = STRIPS[strip];
  const n = Math.round((IMG['strip_' + strip]?.width || s.size) / s.size);
  return `background-image:url(assets/img/${s.file});background-size:${n * px}px ${px}px;background-position:-${i * px}px 0;width:${px}px;height:${px}px;`;
}
