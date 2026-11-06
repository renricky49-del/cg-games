# Where more Higgsfield credits would help

Spent so far: **16.59 credits** (see `store/ASSET_LOG.md`). Estimates use measured prices
(gpt_image_2_6 medium 1k = 0.5, high 2k = 2.75; ElevenLabs music 60 s ≈ 3.84).

| Priority | Item | Why | Est. cost |
|---|---|---|---|
| 1 | **Gameplay trailer video** (15–20 s: room rush → building → boss smashing door → dawn) | CrazyGames featured slots and the game page autoplay a preview video; this is the biggest conversion boost. Needs a video model. | 15–40 |
| 2 | **Boss walk/attack frames** (2–3 frames per boss × 6 bosses, as one sheet per boss) | Bosses currently "waddle" via rotation wobble + lunge. Real punch frames would sell the hits. | 6 × 0.5 = 3 |
| 3 | **Survivor "sleeping" sprites** (6 survivors lying under a blanket, top-down) | Sleeping survivors currently reuse the standing sprite with a breathing scale. | 0.5–1 |
| 4 | **Minion walk frames** (2 frames × 4) | Same as bosses. | 1–2 |
| 5 | **Second music track** for the title/menu (calmer) and a short **dawn victory sting** | Only one loop exists; menus reuse it. Victory/defeat use synthesized jingles. | 2 × 3.84 + ~1 |
| 6 | **Door damage overlays** (3 hand-painted crack states per door tier) | Cracks are procedurally drawn lines right now. | 0.5–1 |
| 7 | **Floor/wall tileset** (wood, tile, carpet, linoleum, brick wall top-down) | Floors/walls are code-drawn; a painted tileset would match the sprite style better. | 1–2 |
| 8 | **More beds/skins** (seasonal skins, golden bed) for meta progression | Adds collection goals. | 0.5 per sheet |
| 9 | **Voice barks** (boss roar, "Door's breaking!", "Dawn!") | Juice; currently all SFX are WebAudio-synthesized. | ~1–3 |

### Exact prompts used (for consistency when extending)
All sprite sheets used the anchor job `05a68226-8394-4035-82a9-5fcae3ed7b88` as `image_references` and the phrase:
"Same art style as the reference (bright cartoony casual mobile game, thick dark outlines, soft cel shading). Game sprite sheet, strict TOP-DOWN view from directly above… N×M grid with wide empty transparent gaps, each centered in its cell, same scale… No text, no background, isolated sprites."
Slice new sheets with `python3 -I tools/slice.py <raw_dir> assets/img` after adding them to the `SHEETS` table.
