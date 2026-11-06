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
| 15 | Store cover portrait 2:3 | letter squad charging, baby king behind, open sky for logo | high, 2k, 2:3, ref #1 | 2.75 | `store/cover_800x1200.jpg` (logo composited locally with Titan One) | 15.34 |
| 16 | Store cover square 1:1 | baby king in crib flanked by S/B/L/K, gold tiles confetti | high, 2k, 1:1, ref #1 | 2.75 | `store/cover_800x800.jpg` (logo composited locally) | 18.09 |

Cover 1920x1080 reuses the key art (#1) with the locally composited logo. **Total spent: 18.09 credits** (cap 80).

## Polish pass (parent review)

| # | Asset | Prompt summary | Settings | Cost | Output file(s) | Running total |
|---|---|---|---|---|---|---|
| 17 | Enemy walk-cycle frame B (3x3) | same 9 creeps, alternate stride/flap/squash frame | medium, 1k, transparent, refs: enemy sheet #2 + anchor | 0.5 | `assets/img/enemies_b.webp` (frame A re-exported at shared scale) | 18.59 |
| 18 | Boss attack poses (2x2) | toad tongue lash, golem slam, dragon fire breath, lich casting | medium, 1k, transparent, refs: boss sheet #3 + anchor | 0.5 | `assets/img/bosses_atk.webp` | 19.09 |
| 19 | Hero full-body sprites A (2x2) | king, mage, monk, ninja full body | medium, 1k, transparent, refs: portraits #5 + anchor | 0.5 | `assets/img/heroes_full.webp` (0-3) | 19.59 |
| 20 | Hero full-body sprites B (2x2) | druid, titan, hawk ranger, saint full body | medium, 1k, transparent, refs: portraits #6 + anchor | 0.5 | `assets/img/heroes_full.webp` (4-7) | 20.09 |
| 21 | Skill cut-ins A (2x2 on 16:9) | king/mage/monk/ninja action splash with speed lines | medium, 1k, 16:9, refs #5 + anchor | 0.5 | `assets/img/cutins.webp` (0-3) | 20.59 |
| 22 | Skill cut-ins B (2x2 on 16:9) | druid/titan/hawk/saint action splash | medium, 1k, 16:9, refs #6 + anchor | 0.5 | `assets/img/cutins.webp` (4-7) | 21.09 |
| 23 | Menu music loop (45s) | calm cozy medieval lute/harp/flute, 90 bpm | `elevenlabs_music_v2`, 45s, instrumental | 2.88 | `assets/audio/menu.mp3` (head/tail crossfaded) | 23.97 |
| 24 | Victory stinger (6s) | trumpets, timpani fanfare | `elevenlabs_music_v2`, 6s | 0.39 | `assets/audio/win.mp3` | 24.36 |
| 25 | Defeat stinger (6s) | sad tuba "wah wah" | `elevenlabs_music_v2`, 6s | 0.39 | `assets/audio/lose.mp3` | 24.75 |
| 26-31 | SFX ×6 | gold reveal, box pop, merge pop, boss roar, meteor impact, baby cry | `mirelo_text_to_audio`, 1.5–2s | 3.0 | `assets/audio/sfx_*.mp3` (trimmed + loudnorm, 64 kbps mono) | 27.75 |
| 32-39 | Voice barks ×8 | announcer shouting KING!/MAGE!/MONK!/HAWK!/NINJA!/DRUID!/TITAN!/SAINT! | `seed_audio` | 3.2 | `assets/audio/v_*.mp3` | 30.95 |
| 40-41 | SFX retry ×2 | gold sparkle + merge pop (first takes were near-silent, −38/−48 dB) | `mirelo_text_to_audio` | 1.0 | `assets/audio/sfx_gold.mp3`, `sfx_merge.mp3` | 31.95 |

**Total spent: 31.95 credits** (cap 80; parent asked ≤ ~50).
