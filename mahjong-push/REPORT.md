# Report — Teahouse Tile Slide (folder `mahjong-push/`, branch `game/mahjong-push`)

- **Implemented:** title, map, teahouse, game and modals; 60 solver-verified campaign levels (2 interactive tutorials); click-to-match and drag-to-push with live chain preview; Hint (including push hints), Shuffle (solvable) and Undo; dead-board detection; 1–3 stars; 5-area × 5-task renovation that gates chapters; Daily Puzzle + streak; Endless with combo scoring; high-contrast tiles; settings and pause; persistent save; CG SDK v3 adapter (midgame ≥3 min apart, never before level 3; rewarded ads on explicit buttons; mute on ads; data module + localStorage).
- **Tests:** `tests/play.cjs` (levels 1–3 won by real mouse input, failed push reverts, a loss reached, save survives reload, mobile portrait/landscape, 0 console errors). `tests/perf.cjs`: about 60 fps (p95 16.7 ms) and +0.3 MB heap over 80 levels. Balance: casual-bot win rate per chapter is 99 / 74 / 56 / 47 / 26 %, with a smooth curve (`store/balance_report.txt`).
- **Credits:** 22.11 (logged in `store/ASSET_LOG.md`).
- **TODO_CREDITS highlights:** trailer video, longer music tracks, "before" area variants, extra chapters, a mascot.
