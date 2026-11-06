# Asset generation log (Higgsfield)

Model: `gpt_image_2_6`. Style anchor = job `d8193f3e-5ba1-4ac5-8dcc-3ad2f1f998ab` (key art), passed as `image_references` to every later generation.

| # | Asset | Prompt summary | Settings | Cost | Output file(s) | Running total |
|---|---|---|---|---|---|---|
| 1 | Key art / style anchor | Storybook fantasy kingdom; letter soldiers S (sword), L (lance), B (bow), K (knight on horse); baby king Prince Pip in crib on castle; goblins/slimes/bats horde; sky open for logo | high, 2k, 16:9 | 2.75 | `assets/img/keyart.webp`, store covers | 2.75 |
| 2 | Enemy creeps sheet (3x3) | goblin, bat, slime, shield orc, wisp, imp, wolf, baby slime, mushroom | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/enemies.webp` | 3.25 |
| 3 | Boss sheet (2x2) | toad king, iron golem, dragon whelp, lich | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/bosses.webp` | 3.75 |
| 4 | Ward castles (2x2) | Pip castle happy/crying (blue), Princess Pom castle happy/crying (red) | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/wards.webp` | 4.25 |
| 5 | Hero portraits A (2x2) | King, Mage, Monk, Ninja | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/heroes.webp` (0-3) | 4.75 |
| 6 | Hero portraits B (2x2) | Druid, Titan, Hawk ranger, Saint | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/heroes.webp` (4-7) | 5.25 |
| 7 | Weapon icons (3x3) | scepter, crystal staff, jade beads, shuriken, oak staff, war hammer, longbow, holy mace, katana | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/weapons.webp` | 5.75 |
| 8 | Item icons (4x3) | ink flask, frost scroll, bomb, clover, shovel, ring, quills, golden ink, pillow, hourglass, purse, war horn | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/items.webp` | 6.25 |
| 9 | Rival avatars (3x3) | knight boy, scribe, witch, baron, pirate, lady, old lord, owl sage, ice queen | medium, 1k, 1:1, transparent, ref #1 | 0.5 | `assets/img/rivals.webp` | 6.75 |
| 10 | Map ground: Ember Plains | top-down meadow texture, no road | medium, 1k, 16:9, ref #1 | 0.5 | `assets/img/map_ember.webp` | 7.25 |
| 11 | Map ground: Misty Marsh | top-down swamp texture | medium, 1k, 16:9, ref #1 | 0.5 | `assets/img/map_marsh.webp` | 7.75 |
| 12 | Map ground: Iron Gate Pass | top-down rocky snowy texture | medium, 1k, 16:9, ref #1 | 0.5 | `assets/img/map_iron.webp` | 8.25 |
| 13 | Map ground: Crimson Bay | top-down beach texture | medium, 1k, 16:9, ref #1 | 0.5 | `assets/img/map_bay.webp` | 8.75 |

Post-processing: sliced into uniform strips with PIL (`alpha bbox trim`, LANCZOS resize), saved as WebP q86.
| 14 | Background music loop (60s) | whimsical medieval battle loop: lute, recorder, pizzicato, light percussion, 120 bpm, instrumental | `elevenlabs_music_v2`, 60s, instrumental | 3.84 | `assets/audio/music.mp3` (head/tail crossfaded in Python for a seamless loop, 96 kbps) | 12.59 |
