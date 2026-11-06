# Where more Higgsfield credits would make Teahouse Tile Slide better

Spent so far: **47.94 credits** (see `store/ASSET_LOG.md`). The second pass already delivered the earlier wish-list:
before/after area variants, chapters 6–7 art, the mascot, a painted UI kit, a second (90 s) music track and
recorded tea-pour / wind-chime foley. Tile-back skins and ambient overlays (petals, snow, fireflies, lantern glow)
are code-drawn and needed no credits.

| Priority | Item | Why | Est. credits |
|---|---|---|---|
| ★★ | **Stylized trailer video** (the mandatory 20 s preview videos are already recorded from the build: `store/preview_*.mp4`) (15–20 s: drag-slide with chain push, combo burst, a teahouse before→after restore, Momo cheering) | Strongest lever for CrazyGames click-through. Deliberately skipped because video is expensive on the shared budget. A screen capture of the build (e.g. Playwright video of `tests/play.cjs`) is a free fallback. | 15–40 (video model) |

Notes for whoever picks this up:
- Percussive SFX prompts (tile clack, bell, slide) came back as near-silent noise from `mirelo_text_to_audio` twice, so the game keeps its WebAudio-synthesized clack/bell/slide. Don't spend more credits there.
