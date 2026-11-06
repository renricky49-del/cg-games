# Report — Teahouse Tile Slide (folder `mahjong-push/`, branch `game/mahjong-push`)

- **Content:** 84 solver-verified levels in 7 chapters (2 interactive tutorials). 7 teahouse areas × 5 restorations, each with an AI "before" background that cross-fades to the restored one.
- **Gameplay and modes:** click-to-match and drag-to-push with live chain preview; Hint (including pushes), Shuffle (solvable) and Undo; dead-board detection with a loss path; 1–3 stars; Daily Puzzle + streak; Endless with combos.
- **Second pass:**
  - Momo the red-panda mascot in the tutorial and on result screens.
  - Painted UI kit: parchment modals, lacquer title banners, jade level nodes.
  - 4 tile-back skins sold for coins (a coin sink).
  - Ambient overlays: petals, snow, fireflies, dust motes, lantern glow.
  - 2-track music playlist (90 s + 30 s).
  - Recorded tea-pour and chime foley.
- **Platform:** CG SDK v3 adapter with standalone fallback; settings, pause and persistent save; high-contrast tiles; portrait board transpose.
- **Tests:**
  - `tests/play.cjs`: levels 1–3 won by real mouse input, failed push reverts, a loss reached, save survives reload, mobile portrait and landscape; 0 console errors.
  - `tests/perf.cjs`: ~60 fps (p95 16.7 ms); +0.4 MB heap over 80 levels.
  - `tools/balance.mjs`: casual-bot win rate per chapter 99 / 74 / 56 / 47 / 26 / 46 / 29 % (chapter 6 is a deliberate breather).
- **Size:** upload zip 6.3 MB (`tools/package.sh`): 3.1 MB backgrounds, 2 MB music, 1.1 MB sprites. About 1 MB loads before the title screen; music and teahouse art stream in afterwards. `store/raw/`, `dist/` and `tests/shots/` are git-ignored, and the store art is JPG.
- **Credits:** 47.94 of the 80 cap (logged in `store/ASSET_LOG.md`).
- **TODO_CREDITS:** only the trailer video remains.
