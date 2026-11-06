# Where more Higgsfield credits would make Teahouse Tile Slide better

Spent so far: **22.11 credits** (see `store/ASSET_LOG.md`). Prices below assume `gpt_image_2_6`
(medium 1k = 0.5, medium 2k = 1.0, high 2k = 2.75) and the measured music price (~4.4 per 30 s).

| Priority | Item | Why | Est. credits |
|---|---|---|---|
| ★★★ | **Gameplay trailer video** (15–20 s: drag-slide, combo burst, teahouse restore) | Strongest lever for CrazyGames click-through; video generation was deliberately skipped (too expensive for the shared budget). Could also be screen-captured from the build for free. | 15–40 (video model) |
| ★★★ | **Longer music: 2 more tracks** (e.g. 90 s calm "garden" loop + 60 s night "moon terrace" loop) | The current 30 s loop repeats often in 10+ minute sessions. | 2 × ~13 = 26 (90 s) or 2 × 4.4 (30 s) |
| ★★ | **Area "before" variants**: a neglected version of each area background (dust, broken lanterns) shown at 0 % progress, cross-faded to the clean background as tasks complete | Stronger before/after payoff than the current desaturation + silhouettes. | 5 × 1.0 = 5 |
| ★★ | **Chapter 6–7 areas** (e.g. Rooftop Pagoda, Tea Fields) + 2 more 5-item sprite sheets, with 24 more levels | More content for long-term players; level generator and meta already support it (just add rows to `js/meta.js` and extend `tools/build-levels.mjs`). | 2 × (1.0 + 0.5) = 3 |
| ★★ | **Mascot character** (a tea-sprite or red panda innkeeper) in 3 poses: tutorial guide, level-complete cheer, sad "no moves" | Adds personality, replaces the plain tutorial hand and bubbles. | 3 × 0.5 = 1.5 (+0.5 sheet) |
| ★ | **Painted UI kit**: wooden button plates, scroll-style modal frame, star/coin icons | The UI is currently CSS-drawn; a painted kit would match the key art more closely. | 2 × 0.5 = 1 |
| ★ | **Alternate tile-back skins** (jade, cherry, night ink) as cosmetic coin purchases | Coin sink + light monetisation-friendly cosmetic. | 3 × 0.5 = 1.5 |
| ★ | **Ambient animated overlays** (drifting petals sprite sheet, koi swim cycle frames, lantern glow) | More life in the teahouse scenes. | 1–2 |
| ★ | **SFX pass** with `mirelo_text_to_audio` (wood clack, tea pour on area restore, wind chime on 3 stars) | Current SFX are synthesized in WebAudio and sound good, but recorded-style foley would feel richer. | ~0.5–1 each, ~5 total |

Suggested next batch if ~15 credits become available: area "before" variants (5) + one 90 s music track (13).
