# Report — Teahouse Tile Slide (folder `mahjong-push/`, branch `game/mahjong-push`)

**Game:** 84 solver-verified levels in 7 chapters. Click-to-match and push-to-slide. Obstacles: stones and red-cord tied tiles. Juice: Tea Rush, Mega Slide and golden pairs.

**Meta:** a teahouse with 35 restorations, each granting a perk, with before/after scenes. Also guest orders, tips, 17 trophies, a 7-day gift calendar, hot streaks and a daily first win. Modes: Daily Puzzle and Endless. Momo the mascot appears throughout.

**CrazyGames:**
- SDK v3 with Data Module saves.
- Ads: midgame only on Next/Retry/Again; rewarded hidden with adblock, with ads disabled, and during a 90 s cooldown.
- No Escape key, and new players land in gameplay with 0 clicks.
- Covers show the title only, and both preview videos are 1080p, about 20 s and silent.

**Tests (all passing, 0 console errors):**
- `play.cjs`
- `sdk.cjs` (normal, adblock and Basic Launch modes)
- `retention.cjs` (15 checks)
- `mobile.cjs` (9 viewports × 16 screens, plus a legacy-Safari pass)
- `fuzz.cjs`
- `trap.cjs`
- `pace.cjs`
- `perf.cjs` (60 fps, +0.4 MB heap over 80 levels)
- `tools/stress.mjs` and `tools/balance.mjs`

**Upload:** `bash tools/package.sh` → `dist/teahouse-tile-slide.zip` (about 6.3 MB). Portal values are in `store/SUBMISSION.md`.

**Credits:** 47.94 of the 80 cap. Only a stylized trailer remains in TODO_CREDITS.
