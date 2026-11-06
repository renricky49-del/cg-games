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
