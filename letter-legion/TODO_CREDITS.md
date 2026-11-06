# Where more Higgsfield credits would make Letter Legion better

Spent so far: see `store/ASSET_LOG.md` (≈18 credits of the 80 cap). Estimates use measured prices
(gpt_image_2_6 medium 1k = 0.5, high 2k = 2.75; elevenlabs_music_v2 60 s ≈ 3.84).

| Priority | Item | Why | Est. credits |
|---|---|---|---|
| 1 | **Gameplay trailer video** (15–30 s: summon reveal → merge → spelling KING → meteor) | CrazyGames featured slots & thumbnails convert much better with video; we generated none (video too expensive for the cap) | 20–60 |
| 2 | **Enemy walk-cycle frames** (2–4 frames per creep, 9 creeps, sheets of 3x3) | enemies currently bob/squash procedurally from a single pose | 4 × 0.5 = 2 per frame set, ≈ 8 |
| 3 | **Boss attack poses** (toad tongue, golem slam, dragon breath, lich cast) | boss abilities are shown with code FX only | 4 × 0.5 = 2 |
| 4 | **Hero full-body sprites** for the board (replacing round portraits) + skill cut-in splash art (8 × 16:9) | bigger "hero arrives" moment when a word is spelled | 8 × 0.5 + 8 × 0.5 = 8 |
| 5 | **Menu music + victory/defeat stingers** (second 60 s calm loop, two 5 s jingles) | currently one battle loop is reused in menus; stingers are synthesized | 3.84 + 2 × ~1 = 6 |
| 6 | **Voice barks** ("Summon!", hero names shouted on spell, rival taunts) via TTS | personality for CPU rivals and the spelling moment | ~0.1–0.5 each, ≈ 5 |
| 7 | **Per-map decorative props** (trees, rocks, flags) on transparent sheets | boards would feel less flat around the road | 4 × 0.5 = 2 |
| 8 | **Animated GIF/sprite of Prince Pip** (happy, worried, cheering on win) | ward reactions are currently 2 static states | 1–3 |
| 9 | **Extra rival portraits** + new rival ladder season (9 more rivals) | longer campaign | 0.5 per sheet of 9 |
| 10 | **Seasonal cover variants** for A/B testing on CrazyGames | marketing | 3 × 2.75 = 8.25 |

Exact prompts follow the pattern in `store/ASSET_LOG.md`; always pass the style anchor job
`d8193f3e-5ba1-4ac5-8dcc-3ad2f1f998ab` as `image_references` to keep the look consistent.
