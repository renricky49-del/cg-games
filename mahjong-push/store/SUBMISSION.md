# CrazyGames submission sheet — Teahouse Tile Slide

Copy each value into the CrazyGames Developer Portal (developer.crazygames.com → Submit game).
Field names in the portal may be worded slightly differently; the values below map onto them.

## Upload
| Field | Value |
|---|---|
| Game type / engine | HTML5 |
| Game files | `dist/teahouse-tile-slide.zip` (build with `bash tools/package.sh`; `index.html` at the zip root; 74 files, 6.6 MB) |
| Uses CrazyGames SDK | Yes — SDK v3 (gameplayStart/Stop, loadingStart/Stop, midgame + rewarded video ads, Data Module, muteAudio) |
| Progress save | **Yes, using the Data Module from the CrazyGames SDK** |
| Account integration / user module | No |
| Multiplayer | No |
| In-game purchases (real money) | No (coins are earned in-game only) |
| Orientation | Landscape (the layout also adapts to portrait; choose "both" if the form offers it) |
| Mobile support | Yes — touch supported on phones and tablets (portrait and landscape) |
| Languages | English |
| Age suitability | Everyone / PEGI 3-level content (no violence, no text chat, no gambling) — compliant with the PEGI 12 requirement |

## Texts

**Title**
```
Teahouse Tile Slide
```

**Short description** (≤ 160 characters)
```
Slide mahjong tiles to line up matching pairs, clear calm puzzle boards and spend your stars restoring a charming old teahouse and tea garden.
```

**Description**
```
Teahouse Tile Slide is a relaxing mahjong puzzle with a twist: tiles don't just sit still, you push them around!

Match two identical tiles when they share a row or column with nothing between them. When no pair lines up, drag a tile and every tile in front of it slides along into the empty space. If your slide lines the tile up with its twin, both disappear. Plan your pushes, chain quick matches into combos and clear the whole board.

Every board is checked by a solver, so each level can always be cleared. The difficulty rises gently over 84 hand-picked levels, from tiny tutorial boards to big 10×8 layouts with mossy stones that never move.

Earn up to three stars per level by playing fast and without boosters, then spend them in the teahouse. Restore seven lovely areas, from the Courtyard Gate and Tea Room to the Koi Pond, Blossom Meadow, Moon Terrace, Tea Terraces and a snowy Winter Courtyard. Watch each one change from neglected to beautiful. Each restored area opens the next chapter. Momo the red panda, the teahouse keeper, cheers you on.

Features:
- 84 campaign levels in 7 chapters, all guaranteed solvable
- Interactive tutorial: learn matching, then sliding
- Teahouse renovation: 35 restorations across 7 areas, with before/after transformations
- Daily Puzzle with a streak counter
- Endless mode: race the clock, clear boards and build combos for a high score
- Hint (it shows slides too), Undo and Shuffle boosters
- Unlockable tile-back skins
- Optional high-contrast tiles with coloured suits and big corner numbers
- Relaxing music and satisfying tile clacks
- Progress saves automatically
```

**Controls**
```
Mouse / touch: click a tile, then click its matching twin (glowing tiles show valid partners).
Drag a tile up, down, left or right to slide it together with the tiles in front of it.
Keyboard: H = Hint, Z = Undo, S = Shuffle, P = Pause.
```

## Classification
| Field | Value |
|---|---|
| Category | Puzzle (sub-category: Mahjong if offered) |
| Tags (pick the ones the portal offers) | Mahjong, Tile Matching, Puzzle, Matching, Logic, Brain, Relaxing, Casual, Mouse, Single Player |

## Media
| Field | File | Spec check |
|---|---|---|
| Landscape cover 16:9 | `store/cover_1920x1080.jpg` | 1920×1080, title text only, no borders/icons |
| Portrait cover 2:3 | `store/cover_800x1200.jpg` | 800×1200, title text only |
| Square cover 1:1 | `store/cover_800x800.jpg` | 800×800, title text only |
| Preview video landscape | `store/preview_landscape_1920x1080.mp4` | 1920×1080, 19.8 s, H.264, no audio, 4.0 MB, opens on the cover, no cursor |
| Preview video portrait | `store/preview_portrait_1080x1620.mp4` | 1080×1620 (2:3), 19.8 s, H.264, no audio, 3.5 MB, opens on the cover, no cursor |
| Screenshots (if asked) | `store/screenshots/*.jpg` | gameplay, map, teahouse before/after, mobile |
