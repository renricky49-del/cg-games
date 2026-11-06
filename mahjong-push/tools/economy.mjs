// Star/coin economy model: expected stars per level from its difficulty (casual-bot win rate) for
// three player types, checked against each chapter's teahouse cost (each area gates the next chapter).
// node tools/economy.mjs
import { LEVELS } from '../js/levels-data.js';
import { AREAS } from '../js/meta.js';
const players = {
  // P(3★), P(2★), P(1★) on first clear, by difficulty bucket (easy / medium / hard)
  casual: { easy: [0.6, 0.3, 0.1], mid: [0.35, 0.45, 0.2], hard: [0.15, 0.45, 0.4] },
  average: { easy: [0.75, 0.2, 0.05], mid: [0.5, 0.38, 0.12], hard: [0.3, 0.45, 0.25] },
  skilled: { easy: [0.9, 0.1, 0], mid: [0.75, 0.22, 0.03], hard: [0.55, 0.38, 0.07] },
};
const bucket = (w) => (w >= 0.7 ? 'easy' : w >= 0.35 ? 'mid' : 'hard');
for (const [name, P] of Object.entries(players)) {
  let bank = 0, spent = 0; const rows = [];
  for (let c = 0; c < AREAS.length; c++) {
    let got = 0;
    for (let i = 0; i < 12; i++) { const lv = LEVELS[c * 12 + i]; if (!lv) continue; const p = P[lv.tut ? 'easy' : bucket(lv.win)]; got += 3 * p[0] + 2 * p[1] + p[2]; }
    bank += got;
    const cost = AREAS[c].tasks.reduce((s, t) => s + t.cost, 0);
    const short = Math.max(0, spent + cost - bank);
    rows.push(`ch${c + 1}: +${got.toFixed(1)}★ cost ${cost} → ${short > 0 ? `SHORT ${short.toFixed(1)}★` : `surplus ${(bank - spent - cost).toFixed(1)}★`}`);
    spent += Math.min(cost, bank - spent);
  }
  console.log(name.padEnd(8), rows.join(' | '));
}
