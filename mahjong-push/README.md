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
- **Boosters:** Hint shows the solver's next move, including an animated arrow for push moves. If the solver proves the position can no longer be cleared, Hint is not charged and suggests Undo/Shuffle instead. Shuffle first permutes the remaining faces; if that can't help (e.g. the last pair is stuck behind stones) it scatters the tiles over free cells, and as a last resort places a pair side by side, so **a shuffle always leaves at least one move** and prefers a solver-proven clearable layout (time budget about 150 ms). Undo restores the previous tile state and is disabled in Endless (it would allow re-scoring matches). Boosters start at 3 / 2 / 3; refills cost coins or a rewarded ad, and every restored area gives +1 Hint and +1 Shuffle. Hint and Shuffle cost a star on that level; Undo does not.
- **Stars:** 3, minus 1 if your time is over par, minus 1 if you used Hint or Shuffle (minimum 1). Par = 20 s + pairs × (3.5 + 4 × (1 − bot win rate)) s, rounded to 5 s, so harder boards get more thinking time (level 3: 40 s, level 30: 105 s, level 60: 200 s). Only stars above your previous best on a level are added to the spendable star bank.

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

There are 7 areas × 5 restorations (Courtyard Gate, Tea Room, Koi Pond, Blossom Meadow, Moon Terrace, Tea Terraces, Winter Courtyard), with costs of 2–8 stars. Chapter *n+1* unlocks when chapter *n*'s last level is cleared **and** area *n* is fully restored. Area costs are 20 / 24 / 25 / 25 / 25 / 24 / 26 stars. `tools/economy.mjs` models casual, average and skilled players from each level's difficulty: even the casual profile never runs short at a chapter gate (about 10–16 stars spare), so nobody has to grind replays to continue (`store/economy_report.txt`). Restoring a whole area also gives 100 coins, +1 Hint and +1 Shuffle. Each area has an AI-generated **neglected "before" background** (same composition) that cross-fades into the restored one in fifths as tasks complete. Every restoration plays a drop-in animation with sparkles, a build fanfare and a tea-pour sound. Unrestored items show as silhouettes, so the "after" is always teased. Lanterns glow, koi swim, sky lanterns float, and each area has its own ambient layer (dust motes, petals, fireflies on the Moon Terrace, snow in the Winter Courtyard).

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
node tests/areas.cjs     # renders each area before/after for placement review (OUT=<dir>)
node tests/fuzz.cjs      # ~2.7k random clicks/drags/keys/pauses/resizes + real moves on 35 sessions; checks
                         # no overlap/out-of-bounds/odd pair counts/NaN, never wedged without a dialog
node tests/trap.cjs      # regression: last pair trapped behind stones -> stuck dialog -> Shuffle rescues it
node tools/stress.mjs    # rule properties on 500 random mid-game states + worst-case hint/shuffle time
node tools/economy.mjs   # star economy vs teahouse costs for three player profiles
node tools/balance.mjs   # difficulty curve via the casual bot
```

Results from the last run are in `REPORT.md`.

## Accessibility

- Tiles are drawn in code at the exact pixel size (DPR aware), so they stay crisp. Characters, winds and flowers always carry a small corner index.
- **High-contrast mode** (Settings or Pause) tints each suit's tile background and adds a large corner number/letter to every tile.
- On portrait screens the board is shown transposed (rows↔columns, a symmetry of the rules), so tiles stay as large as possible.
- Desktop: hover lift + pointer cursor on tiles, grab cursor while dragging, large click targets, keyboard shortcuts (H/Z/S/P; Esc is deliberately unused because it exits CrazyGames fullscreen).

## CrazyGames compliance checklist (checked against docs.crazygames.com on 2026-11-06)

| Requirement | Status |
|---|---|
| Size: initial download ≤ 50 MB (≤ 20 MB for mobile homepage), total ≤ 250 MB, ≤ 1500 files | 6.6 MB total, 74 files; about 1 MB loads before the title |
| Relative paths only; works in an iframe; Chrome/Edge/Safari; touch | Yes; only absolute URL is the SDK script |
| English; PEGI 12; original content; no external links or cross-promotion | Yes |
| No custom fullscreen button; avoid Escape (closes fullscreen) | No fullscreen button; pause is P/button, Esc unused |
| Legible at small 16:9 iframes at DPR 1 (e.g. 800×450) | Checked: 10×8 boards keep about 35 px tiles at 800×450 |
| Frame-rate independent animation | Everything is dt-based |
| New users reach gameplay in ≤ 1 click | Title → Play → tutorial level 1 |
| user-select none, iOS AudioContext resumed in click/touchend | Yes |
| SDK v3: init, loadingStart/Stop, gameplayStart/Stop on play/pause/level end, none on focus change | Yes (`tests/sdk.cjs`) |
| muteAudio respected (priority over in-game toggles) | Yes |
| Ads only via SDK; midgame only at the level-to-level break (Next/Retry/Again), never on navigation buttons | Yes (`tests/sdk.cjs`) |
| Game paused + audio muted on adStarted, UI blocked until adFinished/adError, game continues on adError | Yes |
| Rewarded: optional extras with coin alternatives, no reward on error, hidden with adblock, 90 s cooldown | Yes |
| Adblock never blocks play | Yes, only rewarded buttons are hidden |
| Progress via Data Module (1 MB limit) | Save is under 2 KB; only SDK data is used when the SDK is present |
| 3 covers (1920×1080, 800×1200, 800×800), title text only, no borders/icons | `store/cover_*.jpg` |
| Preview videos: landscape 1080p 16:9 + portrait 1080p 2:3, 15–20 s, no sound, opens on the cover, no cursor, ≤ 50 MB | `store/preview_*.mp4` (`tools/preview.cjs`) |

Paste-ready portal values: `store/SUBMISSION.md`.

## Opening pace (measured by `tests/pace.cjs`, an instantly-reacting new player)

| Moment | Before | Now |
|---|---|---|
| Load → first playable board | 1.58 s, 1 click (title → Play) | **0.56 s, 0 clicks** (new players skip the title and land in the tutorial) |
| Tutorial hand appears | 0.33 s | 0.05 s |
| Tutorial 1 → 2 → level 3 | result screen + click each | **auto-advance**, about 1.5 s, 0 clicks |
| Level clear → next board (normal levels) | about 1.5 s | **about 0.7 s** (shorter clear delay, faster tile drop-in and star animation) |
| First teahouse visit | only at chapter end (after level 12) | **after level 3**: one-time "Restore the teahouse" prompt; affordable restorations pulse; teahouse "Play" goes straight to the next level |

Afterwards, whenever a restoration becomes affordable, the result screen shows a "Teahouse" button with a red dot next to "Next".


## Fun layer (added after launch prep)

| Feature | What it does | Notes |
|---|---|---|
| **Red-cord tied tiles** | Tied tiles match normally but can never slide, and any chain containing one cannot be pushed. Shuffle unties them. | Introduced at level 27 (tip), 1–4 per level up to 84, also in Daily (2) and Endless (later boards). Stored as a +64 flag on the tile value (`L.TIED`), so solver, hint, undo and bot handle them for free. `tools/add-ties.mjs` picked solver-proven tie sets that only lower bot win rate by about 0.04 on average (max 0.09). Level code: `!` before a letter. |
| **Tea Rush** | Matches fill a meter (more for combos, mega slides and golden pairs; it decays slowly). When full: "TEA RUSH!", 6 s with the clock frozen, a glowing tray, +2 coins per match (double points in Endless). | A frozen clock helps players reach 3-star par. |
| **Mega Slide** | A push that moves 3+ tiles into a match: big burst, bonus coins (3 × tiles), extra meter. 5+ tiles = "AVALANCHE!". 2-tile pushes show "Chain slide!". | Rewards mastering the core mechanic. |
| **Golden pair** | One pair per level (from level 4, plus Daily and every Endless board) has a shimmering gold rim: +20 coins (Endless: +5 s, +150 points). | Visual only, no effect on solvability. |
| **Trophies** | 16 achievements (combos, mega slides, golden pairs, rushes, tied tiles, 3-star levels, stars, areas, daily streak, endless score, all levels), each with a coin reward, a pop-up, and a Trophies screen with progress bars. | Tracked in `S.stats` / `S.ach` (Data Module save). |
| **Lucky Teapot** | A free daily gift on the title screen (coins, hints, shuffles or 2 stars). | Retention hook; no ads required. |


## Meaningful stars: perks, guest orders and tips

Players said stars "only buy fixed decorations". Now every star purchase changes how you play:

| System | How it works |
|---|---|
| **Perks** | Each of the 35 restorations grants a permanent, stacking bonus (shown on its card; a "Perks" screen shows the totals). Types: +% level coins, Tea Rush fills faster, Tea Rush lasts longer, +% par time (easier 3 stars), free Undo / Hint / Shuffle every level (HUD badge shows FREE), golden pairs pay more, extra golden pair per level, Tea Rush meter starts partly full, guest tips per hour. Within an area you choose which perk to buy first. Totals when complete: +70% coins, +40% par, Tea Rush +4 s / fills +50% / starts 75%, 3 free undos, 2 free hints, 1 free shuffle, +2 golden pairs, +50 coins per golden pair. Defined in `js/meta.js` (`perk`, `PERK_TEXT`). |
| **Guest orders** | 3 daily requests from named guests, seeded by date (clear N levels, 3-star N levels, N Mega Slides, N golden pairs, N Tea Rushes, a ×N combo, untie N red cords, the Daily Puzzle, an Endless score). Serving an order pays 1–2 stars + 40–80 coins; serving all three pays a daily bonus of +2 stars and +100 coins. Progress pops up in-game; red dots on Title/Map/Teahouse show orders ready to serve. |
| **Guest tips** | Restored pieces attract guests: 3 coins/hour per restored piece plus tip perks (up to about 280/h when complete), stored for up to 12 h. Collect them from the tip jar in the teahouse. |
