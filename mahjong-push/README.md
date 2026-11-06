# Teahouse Tile Slide

A slide-and-match mahjong puzzle for CrazyGames. Match identical tiles that see each other in a row or column. When nothing lines up, drag a tile to push it (and the tiles in front of it) until it does. Stars from cleared levels restore a teahouse and tea garden, area by area, and each finished area opens the next chapter.

Working title in the brief was "Mahjong Push". The final title, **Teahouse Tile Slide**, was checked against CrazyGames listings: "Mahjong Gardens" exists there, and an iOS app called "Mahjong Tea House" exists, so I avoided both names.

## Run locally

```bash
cd mahjong-push
python3 -m http.server 8123     # any static server works
# open http://localhost:8123/
```

There is no build step and no runtime dependency except the CrazyGames SDK script, which is optional: without it the game runs standalone with simulated 1-second ads and localStorage saves. To upload to CrazyGames, zip the **contents** of this folder, excluding `store/`, `tools/`, `tests/`, `*.md` and `.gitignore`. The shipped game is about 6.3 MB; about 1 MB loads before the title screen, and music and teahouse art stream in afterwards.

## Structure

```
index.html          screens/HUD markup + SVG icon sprite, loads CG SDK v3
css/style.css       all UI styling (responsive, landscape + portrait)
js/main.js          screens, progression, save, boosters, modes, tutorial, ads flow
js/game.js          BoardView: canvas rendering, drag/click input, animations, particles
js/logic.js         pure rules: matching, pushing, solver, generator, shuffle, level codec
js/levels-data.js   84 pinned campaign levels (tools/build-levels.mjs + reorder.mjs + build-extra.mjs)
js/meta.js          7 teahouse areas, renovation tasks (cost, sprite, placement, before-bg, ambient)
js/ambient.js       menu/teahouse overlay: drifting petals, snow, fireflies, dust motes
js/tiles.js         code-drawn mahjong tile faces + 4 tile-back skins
js/audio.js         WebAudio SFX (synthesized + recorded pour/chime) + 2-track music playlist
js/cg.js            CrazyGames SDK v3 adapter with standalone fallback
assets/img/         backgrounds + before-variants (WebP), item sprites, mascot, UI kit, CJK glyph atlas
assets/audio/       music2.mp3 (90 s) + music.mp3 (30 s), sfx/pour.mp3, sfx/chime.mp3
tools/              level builder, balance bot, sprite slicer, glyph atlas, cover compositor
tests/              Playwright tests (play-through, perf/leak, area placement)
store/              covers (JPG), screenshots (JPG), description.md, ASSET_LOG.md, balance_report.txt
                    (store/raw/ = original generations, git-ignored; never shipped)
```

## Rules and the decisions behind them

- **Direct match:** two identical tiles in the same row or column with only empty cells between them. Click one, and its valid partners glow. Click a partner to clear the pair.
- **Push:** drag a tile horizontally or vertically. The contiguous chain of tiles in front of it in that direction moves too, by any number of free cells. Movement is live while dragging and snaps to the grid on release. Stones and the board edge stop the chain.
- **Pushes that create no match (decided):** a push is committed only if, afterwards, the **dragged tile** has a clear line to an identical tile. The pair is then removed automatically, so a push is always "push + match" in one move. If several partners line up, the nearest one is taken. A push that creates no match animates back with a soft "nope" sound and costs nothing but time. While you drag, the partner that would match glows green, so you know before you let go.
  - *Why auto-remove instead of asking for a tap:* it is one gesture with immediate payoff, it can't leave the board in a half-state, and it matches what the solver models.
  - Only the dragged tile is checked, not every tile in the chain. This keeps the rule easy to explain, and a chained tile that now lines up can simply be matched next turn.
- **Dead board:** no direct match and no committable push. The game detects this after every move and offers Shuffle, Undo, or a rewarded-ad shuffle. "Give up" is the loss path, followed by Retry or Map.
- **Boosters:** Hint shows the solver's next move, including an animated arrow for push moves, and falls back to any legal move. Shuffle redistributes the remaining faces over the same positions until the solver finds a solution. Undo restores the previous tile state. They are limited (start: 3 / 2 / 3) and can be refilled with coins or a rewarded ad. Hint and Shuffle cost a star on that level; Undo does not.
- **Stars:** 3, minus 1 if your time is over par (20 s + 4.2 s per pair), minus 1 if you used Hint or Shuffle. The minimum is 1. Only stars above your previous best on a level are added to the spendable star bank.

## Level generation and difficulty

- `js/logic.js` contains the solver: a DFS over direct matches and committable pushes. It tries direct matches first and shorter pushes first, de-duplicates resulting states, and memoizes dead states.
- `tools/build-levels.mjs` generates each campaign slot from a seeded random board (size, density, tile types and stones all ramp with progress). It keeps only candidates the solver proves solvable and scores them by:
  - a **casual-player bot** win rate without boosters (`tools/bot.mjs`: prefers direct matches, 1-ply lookahead against instant dead ends),
  - the random-playout dead-end ratio and average branching factor.

  The candidate closest to a smooth target curve wins (bot win rate about 100% at the start, about 25–30% at level 60, with small breathers at each chapter start). Levels are then ordered within each chapter, easiest first. The results are **pinned** as strings in `js/levels-data.js`, so the campaign is fully deterministic. Rebuild with `node tools/build-levels.mjs` (takes a few minutes).
- `node tools/balance.mjs` prints the bot win rate for every level, as a quick view of the curve.
- Chapters 6–7 (levels 61–84) were added later by `tools/build-extra.mjs`, which appends to the pinned list without touching levels 1–60. They use the same pipeline, with 100-run bot estimates to avoid winner's-curse picks, and are tuned as an expert tier: a breather after chapter 5's hard finale, then a ramp back down to about 15–20% bot win.
- Levels 1–2 are hand-made interactive tutorials: level 1 teaches direct matches, level 2 can only be solved by pushes. Level 3 teaches chain pushing, and later tips introduce stones (level 13), flowers (25) and characters (37).
- Daily Puzzle: the board is seeded from the local date and solver-verified at runtime. The first clear each day gives 50 coins and 2 stars, and updates the streak.
- Endless: boards grow over time and are generated and verified at runtime. Time starts at 75 s, with +1 s per match and +15 s per cleared board. Score is 10 × combo per match plus a board bonus. Dead boards auto-shuffle for −5 s.

## Meta

There are 7 areas × 5 restorations (Courtyard Gate, Tea Room, Koi Pond, Blossom Meadow, Moon Terrace, Tea Terraces, Winter Courtyard), with costs of 2–8 stars. Chapter *n+1* unlocks when chapter *n*'s last level is cleared **and** area *n* is fully restored. Per-chapter costs (17 / 22 / 24 / 26 / 29 / 31 / 34 stars) fit inside the 36 stars a chapter offers. Surplus from the early chapters and the daily puzzle carry players through the pricier late areas. Each area has an AI-generated **neglected "before" background** (same composition) that cross-fades into the restored one in fifths as tasks complete. Every restoration plays a drop-in animation with sparkles, a build fanfare and a tea-pour sound. Unrestored items show as silhouettes, so the "after" is always teased. Lanterns glow, koi swim, sky lanterns float, and each area has its own ambient layer (dust motes, petals, fireflies on the Moon Terrace, snow in the Winter Courtyard).

**Momo**, an original red-panda teahouse keeper, guides the tutorial and reacts on result screens: pointing, cheering on 3 stars and area restores, and sad when you're out of moves.

**Coin sinks:** boosters, plus 3 cosmetic tile-back skins (Cherry Lacquer 400, Night Ink 600, Imperial Gold 900) under Settings → Tile backs.

## CrazyGames SDK

`js/cg.js` follows `docs/CRAZYGAMES_REQUIREMENTS.md`:
- `init` before use, and `loadingStart`/`loadingStop` around asset loading.
- `gameplayStart` while a board is live, and `gameplayStop` on pause, modals, level end and menus.
- `happytime` on 3-star clears and area completion.
- **Midgame** ads only after a level/daily/endless result, never before level 3, and never more than once every 3 minutes (the timer starts at session start, so there is no ad on first load).
- **Rewarded** ads only on explicit buttons: double coins, +2 boosters, and the free shuffle when stuck. Failure or adblock shows a toast.
- Audio is muted and the game paused during ads. The game respects `settings.muteAudio` and listens for changes.
- Saves go through `SDK.data` with a localStorage mirror, all wrapped in try/catch.

## Testing

Start a static server in `mahjong-push/` on port 8123, then:

```bash
node tests/play.cjs      # full play-through: tutorials + level 3 by real mouse input, failed push revert,
                         # hint/pause, forced loss, teahouse restore, daily, endless, save reload, mobile
node tests/perf.cjs      # 25 s auto-played endless (fps), 80 level starts/clears (heap growth)
node tests/areas.cjs     # renders each restored area for placement review (OUT=<dir>)
node tools/balance.mjs   # difficulty curve via the casual bot
```

Results from the last run are in `REPORT.md`.

## Accessibility

- Tiles are drawn in code at the exact pixel size (DPR aware), so they stay crisp. Characters, winds and flowers always carry a small corner index.
- **High-contrast mode** (Settings or Pause) tints each suit's tile background and adds a large corner number/letter to every tile.
- On portrait screens the board is shown transposed (rows↔columns, a symmetry of the rules), so tiles stay as large as possible.
- Desktop: hover lift + pointer cursor on tiles, grab cursor while dragging, large click targets, keyboard shortcuts.
