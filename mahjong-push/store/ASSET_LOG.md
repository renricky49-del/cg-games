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
