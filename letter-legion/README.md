# Letter Legion

A random-summon **merge tower defense** where every unit is a living **letter** and heroes are summoned by **spelling their names** with golden letter tiles. 1v1 against a computer-controlled rival on mirrored boards. Built for CrazyGames (HTML5, SDK v3).

## Run locally
No build step. Serve the folder with any static server:

```bash
cd letter-legion
python3 -m http.server 8123
# open http://127.0.0.1:8123/
```

To publish, run `./build_release.sh 1.1`. It writes `release/letter-legion-v1.1.zip`, containing only `index.html`, `css/`, `js/` and `assets/`, with `index.html` at the zip root. Upload that zip to the CrazyGames developer portal. The field-by-field submission sheet and the requirements checklist are in `store/SUBMISSION_CN.md`. The covers and the two required preview videos are in `store/` and `store/video/`.

Total size: about 2.6 MB for the game files (store/ and tests/ are not needed in the upload) (images are WebP, music is a 96 kbps MP3, fonts are woff2).

## How to play
- **Summon** (Space) costs Ink and gets more expensive each time. You get a random blind-box recruit: **S** Swordsman (melee splash), **L** Lancer (piercing line, ignores armor), **B** Bowman (long range), **K** Knight (rapid strikes). You can also get a **golden hero letter** or a **Shovel**.
- **Deploy** recruits from the 3-slot tray by dragging them onto cells. You can also click a recruit, then click a cell, or press 1–3 to auto-place.
- **Merge** by dropping a letter on the same letter of the same level. The result is one level higher, up to Lv 7, with more damage, faster attacks and a flashier glyph.
- **Spell heroes** by placing golden letters left to right in neighbouring cells of one row: KING, MAGE, MONK, HAWK, NINJA, DRUID, TITAN or SAINT. The letters fuse into a hero with a periodic skill. Spelling the same hero again levels it up, to ★3 at most. Dropping a golden letter on an identical one transmutes it into a letter you still need.
- **Shovels** dig open locked cells. **Train** buttons give +18% damage to every letter of one type. Drag to the ✖ bin to sell.
- **Blessings.** Before waves 3, 7, 11, 15 and 19 the battle pauses and you pick 1 of 3 blessings (keys 1–3, one free reroll per battle). There are 18, from +20% damage or cheaper summons to longer Lancer reach, crits, Giant Slayer and ★ wild letters. The CPU rival picks too, and the draft screen shows its choice.
- **Hex.** Every kill charges your Hex (bosses ×6, Hexed Brutes ×3). When it's full, click the purple orb or press H to send a **Hexed Brute** (a tough cursed elite) down the rival's road. The CPU does the same to you. Each hex needs a little more charge than the last.
- **★ Wild letters** sometimes appear instead of a golden letter. A ★ counts as any letter in a hero name.
- **Combos and luck.** Merges less than 3.5 s apart chain into a combo that pays bonus Ink. Some summons arrive as a Lucky Lv 2 letter.
- **Daily quests.** Three quests a day (win 2 duels, hex your rivals 4 times, land a ×3 combo, ...) pay coins and XP, plus a bonus for clearing all three.
- Enemies that reach your castle cost lives (a boss costs 2). The match ends as soon as one ward falls. If both survive the final wave, the side with more lives wins. If lives are tied, a sudden-death overtime starts and the first side to leak loses.

## Structure
```
index.html          entry; loads the CrazyGames SDK + js/main.js (ES modules)
css/style.css       all menu / overlay styling
js/data.js          all tuning data: units, heroes, enemies, bosses, maps (ASCII), rivals, items, weapons, daily buffs
js/rng.js           deterministic PRNG (mulberry32) + date helpers
js/sim.js           pure match simulation (no DOM): Side (board, tray, combat, spelling) and Match (waves, win rules)
js/ai.js            CPU rival brain; it uses exactly the player's actions (summon/place/merge/sell/dig/train)
js/render.js        canvas renderer: layout, boards, letter soldiers + attack deformations, enemies, FX, HUD
js/glyphs.js        code-rendered letter glyphs (Titan One font + gradients/outlines/gloss), cached per letter/level
js/game.js          match controller: fixed-step loop, input (drag & drop, click-select, keys), tutorial script, items, ad buttons
js/ui.js            DOM screens: title, hub, ladder, quick battle, daily, pre-match, shop, armory, spellbook, settings, pause, results
js/save.js          profile (coins/XP/level/ladder/weapons/loadout/daily board), shop & weapon rolls
js/cg.js            CrazyGames SDK v3 adapter with a standalone fallback (fake 1 s ad overlay, localStorage)
js/audio.js         WebAudio-synthesized SFX + looping music, with mute handling for ads and SDK settings
js/assets.js        image loading, sprite strips, hit-flash silhouettes
assets/img          WebP sprite strips: enemies + walk frame B, bosses + attack poses, wards, hero portraits + full-body sprites, skill cut-ins, weapons, items, rivals; 4 map grounds; key art
assets/fonts        Titan One + Fredoka (SIL OFL, licence files included)
assets/audio        battle loop (music.mp3) + menu loop (menu.mp3), win/lose stingers, 6 sampled SFX, 8 hero voice barks (all generated). Synthesized WebAudio SFX are the fallback and cover everything else
store/              covers, screenshots, description.md, ASSET_LOG.md
tests/              Playwright + Node test scripts (see below)
```

## CrazyGames SDK integration (`js/cg.js`)
- `SDK.init()` at boot; `loadingStart/Stop` around asset loading.
- `gameplayStart` when a match runs; `gameplayStop` on pause, menus, the results screen and while an ad plays.
- `happytime()` on a victory.
- **Midgame ads** play only when you leave a results screen. The adapter limits them to one every 3 minutes and blocks them right after the session starts.
- **Rewarded ads** play only from explicit buttons, and never on the active battle screen:
  - **Head start** on the pre-battle screen: +60 Ink and +1 Shovel. It also costs 50 coins as a non-ad alternative.
  - **Free shop refresh**: once per shop rotation. The coin refresh is the alternative.
  - **Double coins** on the results screen.
  - If the ad fails, the player gets no reward.
  - After a rewarded ad on the results screen, the following midgame ad is skipped, so a break never has both.
- **Basic Launch and adblock.** During Basic Launch the SDK disables ads. `prefetchAd` throws `adsDisabledBasicLaunch`, which the adapter detects at boot, then hides every ad button so none would do nothing. With an ad blocker the buttons are hidden as well, a short notice is shown, and the coin alternatives stay available.
- When an ad starts, audio is muted and the match is paused. Both resume when it finishes or errors. The `muteAudio` SDK setting is respected.
- Saves go through `SDK.data`, with `localStorage` as a fallback. Every storage call is wrapped in try/catch.
- Without the SDK (offline, adblock or local), the game runs standalone and ads become a 1-second placeholder overlay.

## Tests
These need a static server on port 8123 (see above). Chromium and Playwright are preinstalled in the build container.
- `node tests/balance.mjs 10 ladder`: a headless CPU-vs-CPU simulation that models a decent player against every ladder rival with the gear expected at that point. It prints win rate, average wave and match length.
- `node tests/balance.mjs 8 solo`: how far each AI profile survives alone on each map.
- `node tests/tutorial.cjs`: plays the whole tutorial with **real mouse input** (summon, drag, merge, spell K-I-N-G), then wins the match.
- `node tests/fullmatch.cjs both`: one full ladder **win** and one full **loss** through the real UI, checking the rewards and the ladder progress.
- `node tests/perf.cjs`: a long soak test (Crimson Bay, 1× then 4×) that samples FPS and JS heap size.
- `node tests/smoke.cjs`: load, title, hub, pre-match, match screenshots and a console-error check.
- `node tests/fuzz_sim.mjs 150`: sim fuzzer. Both sides take random, often invalid actions every tick. Checks invariants every step: finite ink, valid lives, no unit object in two places, no units on locked cells, no hero in the tray, no duplicate heroes, finite enemy state, and every match ending.
- `node tests/monkey.cjs 3`: browser monkey test. Random clicks, drags, keys and ad/item/spellbook buttons across menus and complete matches. Fails on any page error, a stuck pause or a leftover drag state.
- `node tests/pacing.mjs 20 [call]`: opening-pace metrics: time to first enemy, merge and hero, idle seconds in the first 2 minutes, summons by 60 s. `call` models a player who calls waves early.
- `node tests/analyze.mjs 6 [early]`: balance analyzer. Reports damage share by source (each letter, golden tiles, each hero's attacks and skills), heroes spelled per match, how matches end, and per-map win rate and length.
- `node tests/layout.cjs`: checks that no board, HUD, spell strip or info panel overlaps another, and that no two HUD controls overlap. Runs across 1280x720, 1920x1080, 1366x768, iPhone portrait/landscape, 568x270, 640x360 and 360x640, on all 4 maps. Saves screenshots.
- `node tests/features.cjs`: the v1.1 mechanics through the real UI: the blessing draft pauses the battle, reroll and key picks work, the Hex button sends a Brute, a CPU hex lands on your road, a ★ completes MAGE, quick merges pay a combo, and quests can be claimed.
- `tests/glyphs.html`: a visual sheet of every letter, level and attack pose.
- `node tests/store_shots.cjs`: regenerates the 1920×1080 store screenshots.

## Design notes & decisions
- **Originality.** I reskinned the genre as a fantasy kingdom of letter soldiers. All names are new: Prince Pip, Princess Pom, the 9 rivals, the 8 heroes and the 4 maps. All art was generated fresh in one consistent storybook style, anchored on the key art. The title was checked on CrazyGames and no game uses it.
- **The letter is the soldier.** Units are drawn in code from the bundled Titan One font, not from sprites. Each letter has gradients, an ink outline, a gloss layer, a level-coloured ring (bronze → radiant), a glow from Lv 4 and orbiting sparks from Lv 5. Cartoon eyes look at the current target and blink. On attack the glyph deforms into its action: **S** winds up and slashes (rotate + skew), **L** stretches into a thrust toward the target, **B** squeezes like a drawn bow and releases an arrow, **K** hops like a galloping horse.
- **Recruit tray.** Summons land in a 3-slot tray instead of a random cell, so the player decides where every unit goes: merge it, keep it, slot a gold letter into a word, or sell it. This keeps the "drag units onto cells" brief and makes spelling deliberate.
- **Spelling bias and pity.** The base golden-letter chance is 22%. About 65% of golden rolls go to a missing letter of the word you're closest to finishing; the rest are random letters from your unlocked words, with shorter words slightly favoured. **Pity:** you never go more than 5 summons without a golden letter. The effective rate is about 29%. The HUD odds panel shows the chances and a countdown to the guaranteed letter. Once every unlocked hero is ★3, no more golden letters drop.
- **Honest CPU.** The rival plays by exactly the same rules and actions (see `ai.js`). Tiers differ in think speed, mistake rate, word length they attempt and placement smarts. They also get a **CPU strength** damage multiplier (×0.45–×2.1), tuned per map; Iron Gate Pass has only 3 lives, so its rivals need less. The ladder and pre-match screens show difficulty as ★ by ladder position, with the exact multiplier in the tooltip, and every rival is labelled "CPU". It keeps the ladder curve smooth while the player's gear grows.
- **Win condition.** A side reaching 0 lives loses. After the final wave the side with more lives wins; if lives are tied, sudden-death overtime waves with steeply scaling HP start and the first leak loses. This keeps matches decisive and around 4–9 minutes long.
- **Balance.** Tuned with the headless simulation (`tests/balance.mjs`, `tests/analyze.mjs`). A decent player with the gear expected at each stage beats the rivals at about 100 / 71 / 71 / 64 / 50 / 57 / 50 / 43 / 36% in ladder order, measured with 14 runs each after the fast-opening changes. Iron Gate Pass has only 3 lives, which makes it the noisiest map.
  - **Second pass:** the letters' damage shares were B 35% vs K 11.5%. After a Bowman range cut (4.4 → 3.8) and Knight/Swordsman buffs they are about 22/18/13/12.
  - Heroes per match went from about 1.3 to about 2.1 (pity plus a stronger bias), and heroes now deal about 30% of the damage.
  - Per-hero power is closer: MAGE meteor 4× → 3× every 8 s, HAWK volley 1.4× → 1.1×, MONK 34 → 48 damage plus a shockwave, KING 60 → 75.
  - The CPU now places letters by "road covered within range" instead of distance to the road. Real players also unlock heroes (player levels 1–6), weapons and shop items. Enemy HP grows about 19% per wave. Letter damage grows ×2.15 per merge level. Hero power grows 11% per wave so heroes stay relevant without dominating.
- **Meta.** Coins, XP and level persist. Weapon drops come in five rarities, one weapon per hero: +damage, faster skill, and a skill upgrade at Epic and Legendary. Common to Rare weapons can be sold. The shop has 4 random offers that refresh after every battle, with a reroll for coins or a rewarded ad. The loadout holds 2 active and 3 passive items, and buying into a full loadout asks which item to discard. **Daily Duel**: the map, seed, buff and rival of the day come from a hash of the date. The day's buff also applies to all other battles that day. The best score per day is kept, along with a 14-day **local** board and personal bests per map. Nothing pretends to be an online leaderboard.
- **Fast opening.**
  - The first wave arrives after 2.5 s. Waves 1–4 last 12/14/16/18 s instead of 21 s and spawn evenly, slightly denser.
  - You start with 100 Ink, enough for about 5 summons.
  - Until your first hero, golden letters lean 85% toward the closest word and are guaranteed at least every 4 summons; after that, every 6. Both sides play by these rules.
  - When your board is clear you can click the wave bar (or press N) to **call the next wave early**. The bonus is the remaining seconds × (2 + 0.6 × wave).
  - Measured with `tests/pacing.mjs` against the first rival: first enemy 6 s → 2.5 s, first merge 18 s → 14 s, first hero (median) 110 s → 39 s. Idle time in the first two minutes went from 45 s to 30 s, or about 2 s when calling waves early. The first duel takes about 2.7 min instead of 3.4.
  - New players can skip the tutorial from the title screen. Otherwise the tutorial is a short scripted lesson plus a 4-wave practice. Its Continue button leads straight into the first ladder duel.
- **v1.1 fun pass.** The goal was more decisions per battle, more interaction with the rival, and a reason to come back each day.
  - **Blessing draft** (roguelite pick 1 of 3): each battle builds differently, and players get a decision moment every few waves. The 18 blessings are deliberately close in power: in mirrored CPU-vs-CPU tests the pick heuristic beats random picks only 53% of the time, so no blessing is a must-pick.
  - **Hex**: the duel used to be two parallel games. Now each side can push a Brute onto the other's road, and killing a Brute sent at you refills your own Hex, so a good defence turns into a counter-attack. Brutes have 7× a normal enemy's wave HP and walk slowly; each hex needs 12 more charge than the previous one, so a 15-wave battle sees about 4–6 per side.
  - **★ wild letters** (5% of golden letters, or 2 guaranteed from the Wildcard blessing) take the edge off waiting for one specific letter.
  - **Combos, Lucky Lv 2 summons and crits** add small, frequent rewards.
  - **Daily quests** give three short goals a day that point players at different mechanics.
  - Both sides get stronger with each blessing, so after every draft enemy HP rises by 12% (of the base) to keep battles from drifting into overtime.
  - CPU strength was retuned for the new mechanics. A decent player with the expected gear now beats the ladder at about 100 / 85 / 78 / 73 / 50 / 50 / 40 / 45 / 28% (40 simulated duels per rival, so each number is ±8%). Sir Bumble got a little sturdier so the first real duel lasts long enough to reach the first blessing draft.
  - Blessings and Hex are disabled in the tutorial. The first charged Hex and the first ★ letter each show a one-time hint.
- **Tutorial.** It uses a scripted summon order (S, S, then golden K-I-N-G). Waves are held until the player has summoned, deployed, merged and spelled their first hero, then the match continues against a passive practice rival for 6 waves.
- **Input.** Desktop mouse first: hover highlights, tooltips for every unit and button, pointer and grab cursors, and drop-target colours (blue = move, green = merge). Touch works with the same drag flow. Keyboard shortcuts are optional.
- **Layout.** In landscape, the game tries both stacked and side-by-side arrangements of your board and the rival's mirrored, smaller board. It keeps whichever gives the biggest readable tiles. Leftover space becomes a duel panel with a live scoreboard and a next-wave preview of enemy icons. The HUD sits in a side panel drawn in its own design space, scaled 0.5×–1.5× so it fits phones in landscape and 1080p alike. Portrait puts the HUD at the bottom. `tests/layout.cjs` checks automatically that nothing overlaps.
- **Juice.** Enemies alternate two walk frames, bosses switch to an attack pose when they use an ability, and heroes stand on the board as full-body sprites. Spelling a hero, and its first skill cast each 30 s, triggers a sliding cut-in splash plus an announcer voice shouting the hero's name. Music crossfades between the menu and battle tracks.
