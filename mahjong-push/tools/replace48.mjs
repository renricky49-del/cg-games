// One-off: replaces campaign level 48 (chapter-4 finale outlier) with a solver-verified board near 30% bot win.
import * as L from '../js/logic.js';
import { LEVELS } from '../js/levels-data.js';
import { botWinRate } from './bot.mjs';
import { writeFileSync, readFileSync } from 'fs';
const faces = [...Array(38).keys()];
let best = null;
for (let s = 0; s < 40; s++) {
  const seed = 4800000 + s * 7919, rnd = L.mulberry32(seed);
  const pool = L.shuffleArr(faces.slice(), rnd).slice(0, 14);
  const b = L.generateBoard({ w: 10, h: 8, pairs: 24, types: 14, stones: 4, typePool: pool }, seed);
  if (!L.hasMove(b.cells, 10, 8) || !L.solve(b.cells, 10, 8, 40000).solution) continue;
  const w = botWinRate(b, 120, seed);
  if (!best || Math.abs(w - 0.32) < Math.abs(best.w - 0.32)) best = { b, w };
  if (Math.abs(w - 0.32) < 0.03) break;
}
console.log('new level 48 win', best.w);
const src = readFileSync(new URL('../js/levels-data.js', import.meta.url), 'utf8');
const old = JSON.stringify(LEVELS[47]);
const nw = JSON.stringify({ ...LEVELS[47], s: L.encode(best.b), win: +best.w.toFixed(3) });
writeFileSync(new URL('../js/levels-data.js', import.meta.url), src.replace(old, nw));
