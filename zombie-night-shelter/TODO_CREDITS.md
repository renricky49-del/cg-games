# Where more Higgsfield credits would help

Spent so far: **35.88 credits** (see `store/ASSET_LOG.md`). All cheap polish items (boss/minion animation frames,
sleeping sprites, painted door damage, tileset, furniture, extra skins, menu music, victory/defeat stings, roar/smash/groan
SFX) are now done.

| Priority | Item | Why | Est. cost |
|---|---|---|---|
| 1 | **Gameplay trailer video** (15–20 s: room rush → building → boss smashing door → dawn) | CrazyGames featured slots and the game page autoplay a preview video; biggest conversion boost. Needs a video model. | 15–40 |

### Exact prompts used (for consistency when extending)
All sprite sheets used the anchor job `05a68226-8394-4035-82a9-5fcae3ed7b88` as `image_references` and the phrase:
"Same art style as the reference (bright cartoony casual mobile game, thick dark outlines, soft cel shading). Game sprite sheet, strict TOP-DOWN view from directly above… N×M grid with wide empty transparent gaps, each centered in its cell, same scale… No text, no background, isolated sprites."
Slice new sheets with `python3 -I tools/slice.py <raw_dir> assets/img` after adding them to the `SHEETS` table.
