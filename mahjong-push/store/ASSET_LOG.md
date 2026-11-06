# Higgsfield asset log — Teahouse Tile Slide

Model: `gpt_image_2_6` for all images. Style anchor = key art job `bc0c8b2c-cca3-4db1-988b-e883facf3e0e`, passed as `image_references` to every later generation.
Raw downloads live in `store/raw/` (git-ignored, large PNGs); shipped assets are resized/compressed WebP under `assets/img/`.

| # | What | Prompt summary | Settings | Cost | Output | Running total |
|---|---|---|---|---|---|---|
| 1 | Key art / style anchor | Restored Chinese teahouse in tea garden at golden hour, lanterns, red bridge, koi pond, cherry tree, teapot + 3 jade-backed tiles on table; painterly storybook, no text | high, 2k, 16:9 | 2.75 | `assets/img/bg/keyart.webp`, store covers | 2.75 |
| 2 | Area 1 bg — Courtyard | Empty neglected entrance courtyard, plain walls, empty paved yard | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/area1.webp` | 3.75 |
| 3 | Area 2 bg — Tea Room | Empty bare wooden tea room interior, lattice windows | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/area2.webp` | 4.75 |
| 4 | Area 3 bg — Koi Pond | Plain empty pond, grassy banks, hills | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/area3.webp` | 5.75 |
| 5 | Area 4 bg — Blossom Meadow | Empty hillside lawn, tea terraces far away | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/area4.webp` | 6.75 |
| 6 | Area 5 bg — Moon Terrace | Empty wooden deck at dusk, full moon | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/area5.webp` | 7.75 |
| 7 | Area 1 items sheet | Ornate red gate, stone guardian lion, red lantern pair, bonsai pot, flower planter | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/items/a1_0..4.webp` | 8.25 |
| 8 | Area 2 items sheet | Tea table + cushions, tea shelf, folding screen, silk lanterns, celadon tea set | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/items/a2_*.webp` | 8.75 |
| 9 | Area 3 items sheet | Red arched bridge, lily pads, two koi, stepping stones, stone lantern | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/items/a3_*.webp` | 9.25 |
| 10 | Area 4 items sheet | Cherry tree, hexagonal pavilion, bench, bamboo cluster, azalea bush | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/items/a4_*.webp` | 9.75 |
| 11 | Area 5 items sheet | Moon gate wall, sky lanterns, tea ceremony set, guqin on stand, orchid pots | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/items/a5_*.webp` | 10.25 |
| 12 | Level map bg | Top-down tea garden terraces, open centre, no paths | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/mapbg.webp` | 11.25 |
| 13 | Gameplay bg | Top-down wooden tea table, bamboo mat edges, petals, teacup corner | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/tablebg.webp` | 12.25 |
| 14 | Music loop | Calm tea-garden puzzle music: guzheng, bamboo flute, soft pad, light wood percussion, pentatonic, 75 bpm, instrumental | elevenlabs_music_v2_5, 30 s | 4.36 | `assets/audio/music.mp3` | 16.61 |
| 15 | Cover art portrait | Portrait variant of key art, calm upper third for the title | high, 2k, 2:3, ref #1 | 2.75 | `store/cover_800x1200.jpg` | 19.36 |
| 16 | Cover art square | Square variant of key art, tilted sliding tile, calm upper third | high, 2k, 1:1, ref #1 | 2.75 | `store/cover_800x800.jpg` | 22.11 |
| 17–21 | "Before" variants, areas 1–5 | Same composition as each area bg (passed as reference), neglected: cracks, weeds, dust, murky water, broken planks, grey overcast | medium, 2k, 16:9, ref = area job | 5 × 1.00 | `assets/img/bg/before1..5.webp` | 27.11 |
| 22 | Area 6 bg — Tea Terraces | Empty clearing among terraced tea hills, morning light | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/area6.webp` | 28.11 |
| 23 | Area 7 bg — Winter Courtyard | Empty snowy courtyard behind the teahouse, falling snow | medium, 2k, 16:9, ref #1 | 1.00 | `assets/img/bg/area7.webp` | 29.11 |
| 24 | Area 6 items sheet | Thatched pickers' hut, water wheel, drying rack, leaf baskets, hillside shrine | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/items/a6_*.webp` | 29.61 |
| 25 | Area 7 items sheet | Snowy pavilion, red plum tree, snow lantern, brazier + kettle, blanket bench | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/items/a7_*.webp` | 30.11 |
| 26 | Mascot sheet | Original red-panda teahouse keeper "Momo" (jade apron, straw hat): pointing, cheering with teacup, sad with empty cup | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/mascot_0..2.webp` | 30.61 |
| 27 | Painted UI kit | Red lacquer plaque banner, parchment panel, jade medallion button (all blank) | medium, 1k, 3:2, transparent, ref #1 | 0.50 | `assets/img/uikit_0..2.webp` | 31.11 |
| 28–29 | "Before" variants, areas 6–7 | As 17–21 for the new areas | medium, 2k, 16:9, ref = area job | 2 × 1.00 | `assets/img/bg/before6..7.webp` | 33.11 |
| 30–34 | SFX (mirelo_text_to_audio) | tile clack 1 s, bell 1.5 s, tea pour 2 s, wind chime 2 s, tile slide 1 s | 0.25 each | 1.25 | pour + chime → `assets/audio/sfx/`; clack/bell/slide came back as near-silent noise (peak < −45 dB) and were **rejected** (synth kept) | 34.36 |
| 35–36 | SFX retry | clack 2 s, singing-bowl ding 2 s | 0.25 each | 0.50 | both again near-silent noise → rejected; percussive prompts don't work with this model | 34.86 |
| 37 | Music track 2 | Calm tea-garden dusk: erhu + guzheng, bamboo flute, warm pad, light percussion, 70 bpm, 90 s | elevenlabs_music_v2_5, 90 s | 13.08 | `assets/audio/music2.mp3` (plays in sequence with track 1) | **47.94** |

Total spent: **47.94 credits** of the 80 cap (second pass approved by the orchestrating session with a ~60 ceiling).

The 1920x1080 cover reuses the key art (#1). Titles/logos are composited locally (`tools/covers.cjs`), never AI-rendered.
