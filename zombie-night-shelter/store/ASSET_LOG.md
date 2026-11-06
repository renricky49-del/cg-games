# Higgsfield asset log

Model: `gpt_image_2_6`. Sprite sheets are sliced locally with `tools/slice.py` (trim, haze removal, resize to ≤2× display size).
Style anchor = job `05a68226` (survivors sheet), passed as `image_references` to every later generation.

| # | Asset | Prompt summary | Settings | Cost | Output | Running total |
|---|---|---|---|---|---|---|
| 1 | survivors (style anchor) | 6 top-down cartoony survivors, 3x2 grid | medium 1k, transparent | 0.50 | assets/img/s0–s5.png | 0.50 |
| 2 | bosses | 6 top-down boss zombies (Brute, Spitter, Charger, Howler, Tank, Abomination) | medium 1k, transparent, ref #1 | 0.50 | boss_*.png | 1.00 |
| 3 | minions | 4 top-down zombie minions in survivor clothes | medium 1k, transparent, ref #1 | 0.50 | minion0–3.png | 1.50 |
| 4 | turrets | nail gun / crossbow / tesla × 3 tiers, top-down, barrel up | medium 1k, transparent, ref #1 | 0.50 | nail1–3, bow1–3, tesla1–3 | 2.00 |
| 5 | gadgets | generator, freezer, repair bench, vending, spikes, radio | medium 1k, transparent, ref #1 | 0.50 | generator.png … radio.png | 2.50 |
| 6 | beds | 6 bed tiers top-down | medium 1k, transparent, ref #1 | 0.50 | bed1–6.png | 3.00 |
| 7 | UI icons | 12 icons (scrap, power, door, star, medal, repair, up, lock, clock, skull, ad TV, moon) | medium 1k, transparent, ref #1 | 0.50 | i_*.png | 3.50 |
| 8 | doors + decor | 3 door tiers + rug, plant, boxes, lamp, chair, rubble | medium 1k, transparent, ref #1 | 0.50 | door1–3, decor | 4.00 |
| 9 | music loop | ElevenLabs Music v2, 60s instrumental tense/playful loop; crossfaded to a seamless 57s loop with ffmpeg, 96 kbps | elevenlabs_music_v2 | 3.84 | assets/audio/night_loop.mp3 | 7.84 |
| 10 | key art 16:9 | hallway at night, Brute smashing door, survivor + nail turret in cutaway room; refs #1 #2 | high 2k | 2.75 | store covers, assets/img/title_bg.jpg | 10.59 |
| 11 | title logo | "LAST DOOR STANDING" chunky cartoon logo, door-shaped O, zombie hands | medium 1k, transparent, ref #1 | 0.50 | assets/img/logo.png | 11.09 |
| 12 | cover art 2:3 | portrait re-composition of the key art; ref #10 | high 2k | 2.75 | store/cover_800x1200.jpg | 13.84 |
| 13 | cover art 1:1 | square re-composition of the key art; ref #10 | high 2k | 2.75 | store/cover_800x800.jpg | 16.59 |

### Polish pass
| # | Asset | Prompt summary | Settings | Cost | Output | Running total |
|---|---|---|---|---|---|---|
| 14–19 | boss animation frames ×6 | per boss: 3 frames in a row (walk L, walk R, attack), ref bosses sheet #2 | medium 1k 16:9, transparent | 6 × 0.50 | boss_<kind>_0..2.png | 19.59 |
| 20 | minion walk frames | 4 minions × 2 walk frames, ref #3 | medium 1k, transparent | 0.50 | minion<i>_a/_b.png | 20.09 |
| 21 | sleeping survivors | 6 survivors asleep under blankets, ref #1 | medium 1k, transparent | 0.50 | z0–z5.png | 20.59 |
| 22 | door damage states | 3 door tiers × (intact, damaged, almost broken), ref #8 | medium 1k, transparent | 0.50 | door1–3, door*_d1, door*_d2 | 21.09 |
| 23 | floor/wall tileset | 9 seamless textures (woods, tiles, carpets, parquet, hallway, concrete, brick) | medium 1k, opaque | 0.50 | t_*.jpg | 21.59 |
| 24 | 6 extra survivor skins | bunny hoodie, chef, hard hat, punk, granny, astronaut, ref #1 | medium 1k, transparent | 0.50 | s6–s11.png | 22.09 |
| 25 | furniture sheet | fridge, shelf, desk, couch, wardrobe, kitchen, TV, armchair, table, lamp, pizza boxes, laundry | medium 1k, transparent | 0.50 | f_*.png | 22.59 |
| 26 | menu music | ElevenLabs Music v2, 45 s calm music-box/marimba loop (crossfaded) | elevenlabs_music_v2 | 2.88 | assets/audio/menu_loop.mp3 | 25.47 |
| 27 | dawn victory sting | 8 s brass + glockenspiel fanfare | elevenlabs_music_v2 | 0.52 | assets/audio/win.mp3 | 25.99 |
| 28 | defeat sting | 6 s sad trombone | elevenlabs_music_v2 | 0.39 | assets/audio/lose.mp3 | 26.38 |
| 29–31 | SFX: boss roar, door smash, zombie groan | 2 s each, loudness-normalised, mono 64 kbps | mirelo_text_to_audio | 3 × 0.50 | roar/smash/groan.mp3 | 27.88 |

**Total spent: 27.88 credits** (cap 95; parent asked ≤ ~45). Covers are composited locally by `tools/covers.py` (key art + logo + soft shadow).
Post-processing: all PNG sprites quantized to 256 colours (PIL FASTOCTREE, no dither) — 2.0 MB → 0.45 MB with no visible loss.
