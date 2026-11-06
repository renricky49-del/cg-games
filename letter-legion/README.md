# Letter Legion

A random-summon **merge tower defense** where every unit is a living **letter** and heroes are summoned by **spelling their names** with golden letter tiles. 1v1 against a computer-controlled rival on mirrored boards. Built for CrazyGames (HTML5, SDK v3).

## Run locally
No build step. Serve the folder with any static server:

```bash
cd letter-legion
python3 -m http.server 8123
# open http://127.0.0.1:8123/
```

To publish: zip the **contents** of this folder (with `index.html` at the root) and upload it to the CrazyGames developer portal. The `tests/` folder can be left out of the zip.

Total size: about 2.6 MB for the game files (store/ and tests/ are not needed in the upload) (images are WebP, music is a 96 kbps MP3, fonts are woff2).

## How to play
- **Summon** (Space) costs Ink and gets more expensive each time. You get a random blind-box recruit: **S** Swordsman (melee splash), **L** Lancer (piercing line, ignores armor), **B** Bowman (long range), **K** Knight (rapid strikes). You can also get a **golden hero letter** or a **Shovel**.
- **Deploy** recruits from the 3-slot tray by dragging them onto cells. You can also click a recruit, then click a cell, or press 1–3 to auto-place.
- **Merge** by dropping a letter on the same letter of the same level. The result is one level higher, up to Lv 7, with more damage, faster attacks and a flashier glyph.
- **Spell heroes** by placing golden letters left to right in neighbouring cells of one row: KING, MAGE, MONK, HAWK, NINJA, DRUID, TITAN or SAINT. The letters fuse into a hero with a periodic skill. Spelling the same hero again levels it up, to ★3 at most. Dropping a golden letter on an identical one transmutes it into a letter you still need.
- **Shovels** dig open locked cells. **Train** buttons give +18% damage to every letter of one type. Drag to the ✖ bin to sell.
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
assets/img          WebP sprite strips (enemies, bosses, wards, heroes, weapons, items, rivals), 4 map grounds, key art
assets/fonts        Titan One + Fredoka (SIL OFL, licence files included)
assets/audio        music.mp3 (generated, loop-crossfaded)
store/              covers, screenshots, description.md, ASSET_LOG.md
tests/              Playwright + Node test scripts (see below)
```

## CrazyGames SDK integration (`js/cg.js`)
- `SDK.init()` at boot; `loadingStart/Stop` around asset loading.
- `gameplayStart` when a match runs; `gameplayStop` on pause, menus, the results screen and while an ad plays.
- `happytime()` on a victory.
- **Midgame ads** play only when you leave a results screen. The adapter limits them to one every 3 minutes and blocks them right after the session starts.
- **Rewarded ads** play only from explicit buttons: Free Summon and Free Shovel (once per match each), Free shop refresh, and Double coins after a match. If the ad fails or is blocked, the player sees a toast and gets no reward.
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
- `tests/glyphs.html`: a visual sheet of every letter, level and attack pose.

## Design notes & decisions
- **Originality.** I reskinned the genre as a fantasy kingdom of letter soldiers. All names are new: Prince Pip, Princess Pom, the 9 rivals, the 8 heroes and the 4 maps. All art was generated fresh in one consistent storybook style, anchored on the key art. The title was checked on CrazyGames and no game uses it.
- **The letter is the soldier.** Units are drawn in code from the bundled Titan One font, not from sprites. Each letter has gradients, an ink outline, a gloss layer, a level-coloured ring (bronze → radiant), a glow from Lv 4 and orbiting sparks from Lv 5. Cartoon eyes look at the current target and blink. On attack the glyph deforms into its action: **S** winds up and slashes (rotate + skew), **L** stretches into a thrust toward the target, **B** squeezes like a drawn bow and releases an arrow, **K** hops like a galloping horse.
- **Recruit tray.** Summons land in a 3-slot tray instead of a random cell, so the player decides where every unit goes: merge it, keep it, slot a gold letter into a word, or sell it. This keeps the "drag units onto cells" brief and makes spelling deliberate.
- **Spelling bias.** About 60% of golden-letter rolls go to a missing letter of the word you're closest to finishing. The rest are random letters from your unlocked words, with shorter words slightly favoured. The odds panel in the HUD shows the summon chances openly.
- **Honest CPU.** The rival plays by exactly the same rules and actions (see `ai.js`). Tiers differ in think speed, mistake rate, word length they attempt and placement smarts. They also get a **CPU strength** damage multiplier (60% → 145%). This is shown openly on the ladder and pre-match screens, and every rival is labelled "CPU". It keeps the ladder curve smooth while the player's gear grows.
- **Win condition.** A side reaching 0 lives loses. After the final wave the side with more lives wins; if lives are tied, sudden-death overtime waves with steeply scaling HP start and the first leak loses. This keeps matches decisive and around 4–9 minutes long.
- **Balance.** Tuned with the headless simulation (`tests/balance.mjs`). A decent player with the gear expected at each stage beats the Rookies about 100% / 70% of the time, Adepts about 80% / 60%, and Veterans to Grandmaster about 50–70%. Real players also unlock heroes (player levels 1–6), weapons and shop items. Enemy HP grows about 19% per wave. Letter damage grows ×2.15 per merge level. Hero power grows 11% per wave so heroes stay relevant without dominating.
- **Meta.** Coins, XP and level persist. Weapon drops come in five rarities, one weapon per hero: +damage, faster skill, and a skill upgrade at Epic and Legendary. Common to Rare weapons can be sold. The shop has 4 random offers that refresh after every battle, with a reroll for coins or a rewarded ad. The loadout holds 2 active and 3 passive items, and buying into a full loadout asks which item to discard. **Daily Duel**: the map, seed, buff and rival of the day come from a hash of the date. The day's buff also applies to all other battles that day. The best score per day is kept, along with a 14-day **local** board and personal bests per map. Nothing pretends to be an online leaderboard.
- **Tutorial.** It uses a scripted summon order (S, S, then golden K-I-N-G). Waves are held until the player has summoned, deployed, merged and spelled their first hero, then the match continues against a passive practice rival for 6 waves.
- **Input.** Desktop mouse first: hover highlights, tooltips for every unit and button, pointer and grab cursors, and drop-target colours (blue = move, green = merge). Touch works with the same drag flow. Keyboard shortcuts are optional.
- **Layout.** Landscape puts the HUD in a side panel, scaled for short screens such as phones in landscape. Portrait puts the HUD at the bottom. The rival board is mirrored and smaller.
