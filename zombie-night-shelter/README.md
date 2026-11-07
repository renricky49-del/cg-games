# Last Door Standing (folder: `zombie-night-shelter/`)

Cartoony idle tower defense for CrazyGames: grab an apartment during the room rush, rest on your bed to earn scrap,
build turrets and gadgets, and keep your door standing against a levelling-up zombie boss until dawn.

Plain HTML5 + Canvas 2D + vanilla ES modules. No build step, no runtime dependencies except the CrazyGames SDK v3 script.
Total size ≈ 3.3 MB (sprites/textures ≈ 1.5 MB, music + stings + SFX ≈ 1.4 MB, title art 0.3 MB).

## Run locally
```bash
cd zombie-night-shelter
python3 -m http.server 8123      # any static server works (ES modules need http://, not file://)
# open http://localhost:8123/
```
On localhost the SDK reports `environment: local`; the adapter then runs standalone (1-second simulated ads,
localStorage saves). To upload: zip the **contents** of this folder (index.html at the root) — `tools/`, `store/`,
`package.json` and the `.md` files can be left out of the zip.

## Tests / tools (need Node 18+, Playwright with the preinstalled Chromium)
| Command | What it does |
|---|---|
| `node tools/balance.mjs 20 balanced` | Headless fast-forward sim of all 12 nights (player slot driven by the survivor AI). Prints win %, boss-kill %, stars, AI deaths, boss level. Optional 3rd arg: perks JSON, e.g. `'{"start":2,"door":2,"dmg":2,"bed":2,"fix":2}'`. Personalities: `balanced greedy turtle gunner rookie`. |
| `node tools/endless_test.mjs` | Headless endless-mode runs (waves survived / duration). |
| `node tools/playtest.cjs <outdir>` | Browser test (server on :8123): Night 1 via real clicks/hotkeys (claim room, click bed, B, build menu, info panel) then AI fast-forward to the results screen; a loss with the rewarded Continue flow; menus; frame-time check; iPhone portrait + landscape. Fails on any console error. |
| `node tools/perf.cjs <outdir>` | Late-night (Night 11, maxed perks) frame time + heap measurement. |
| `node tools/screens.cjs` | Regenerates `store/screenshots/`. |
| `python3 -I tools/slice.py <raw> assets/img` | Slices Higgsfield sprite sheets (trim, haze removal, resize). |
| `python3 -I tools/covers.py <raw> assets/img/logo.png store` | Composites the three store covers. |

Last results: all Playwright flows pass with **no console errors**; frame time 16.6 ms avg / 16.8 ms p95 at a busy
late night (60 fps, vsync-bound), JS heap stays ≈ 5–10 MB.

## Structure
```
index.html            DOM shell: HUD, screens (title, nights, upgrades, survivors, settings, how-to, pause, intro, continue, results)
css/style.css         All UI styling, responsive breakpoints (≤900px, ≤640px, ≤500px tall)
js/main.js            App: boot, screens, save/progression, input (mouse/touch/keys), game loop, ads, event → audio
js/ui.js              HUD: resource pills, phase timer, boss card, action bar, build menu, info panels, tooltips, tutorial
js/sim.js             Pure simulation (no DOM): survivors, rooms, doors, buildings, boss/minion AI, projectiles, results
js/ai.js              Survivor AI: room picking + spending heuristics per personality
js/map.js             3 apartment-floor layouts (4 big apartments, some with 2 doors), tile queries
js/data.js            All tuning: economy curves, buildings, bosses, 12 nights, perks, skins, personalities
js/render.js          Canvas renderer: pre-rendered floor layer, sprites, cracks, particles, floaters, night lighting, camera
js/audio.js           WebAudio: music loop (file) + synthesized SFX
js/cg.js              CrazyGames SDK v3 adapter with standalone fallback
assets/img            Sliced, 256-colour-quantized sprites; logo; title background
assets/audio          night_loop.mp3 (generated, crossfaded loop)
assets/fonts          Lilita One (SIL OFL, bundled locally — no Google Fonts at runtime)
store/                Covers, screenshots, description.md, ASSET_LOG.md
tools/                Test + asset pipeline scripts (not needed at runtime)
```

## Design notes
**Pace:** after the room rush the whole simulation runs at `PACE = 2` (data.js) — boss movement/attacks, turret fire
rate, projectiles, income, cooldowns and the dawn timer all scale together, so balance is unchanged but nights play
twice as fast. All numbers below are in game-seconds; the HUD shows real seconds.

**One night:** Room rush (22 s real, normal speed; 40 s on the tutorial night) → 38 game-s (19 s real) to build → the boss
wakes and walks out of the stairwell lair → dawn timer (170–300 game-s = 85–150 s real) or kill the boss.
Typical real lengths with modest perks: Night 1 ≈ 1:15, Night 4 ≈ 1:55, Night 7 ≈ 2:30, Night 12 ≈ 2:55. Your door breaking = loss (one rewarded
continue per night).

**Economy:** bed income doubles per level (2 → 1024 scrap/s), bed cost grows ×2.45 per level, so each upgrade's payback
time creeps up slowly. Bed level N requires door level N−2 — the core greed-vs-safety trade-off. Door HP ×1.72 per level,
upgrading refills it. Repair = +35 % HP, cheap, 10 s cooldown.

**Buildings (unlock night):** Night 1 already offers 4 weapons — Nail Gun, Crossbow (pierces armor), Fire Sprayer (burns
everything in range), Mortar (long-range splash shells) — plus Generator, Chill Trap and Spike Trap. Vending Machine (2),
Tesla Coil (3, chains, needs 2 power), Repair Bench (4), Signal Tower (5, fire-rate aura).
Turret ranges are long (Nail 5.5, Crossbow 6.8, Mortar 9 tiles, +0.4/level) and each floor has only 4 big apartments, so your
turrets reach the bosses almost anywhere in the hallway (in-range 40–63 % of that time vs 9–15 % before;
`node tools/engagement.mjs` measures it) — rooms whose doors
are close together (shown as "close neighbours" when hovering a room in the rush) are the strongest picks.

**Cooperation (4 survivors, 4 apartments):** click an ally's room to *send scrap* (35 % of yours), *repair their door*
(+50 %, 6 game-s cooldown per door) or *reinforce their door* (pay their next door level). Survivors remember who helped
them (`goodwill`) and pay it back by repairing that person's door when it is breaking; without goodwill each AI only gives
one free favour per night to the player (two to other AIs), so a passive player is not carried. Allies in trouble show a
red HELP! bubble. Every boss kill pays a team bounty (20 s of bed income to every living survivor) and patches all doors
by 25 %. ★★ = everyone survives. `node tools/agency.mjs` compares a player who helps vs never helps: on Night 9 allies lost
1.1 → 0.25, win 25 % → 60 %, ★★ 20 % → 60 %.

**Player abilities:** Flashbang (Q, Night 1+): stuns every zombie in a 2.6-tile blast (bosses 3 game-s, minions 5 s),
36 game-s recharge. Molotov (E, Night 2+): a 2-tile fire pool for 7 s that burns bosses for 1.6 % max HP/s and minions for
14 %/s, 48 game-s recharge. Click the button then the map, or press Q/E with the mouse over the spot; Esc/right-click
cancels. Damage is percent-based so it stays useful on every night.

**Supply drops:** every 44–64 game-s during the night a crate parachutes into the hallway and stays for 18 game-s.
Click it for scrap (25 s of income), an instant ability recharge, or +50 % door HP.

**Daily supplies:** a 7-day login streak (3, 4, 5, 6, 8, 10, 15 medals; claim double with a rewarded ad). Missing a day
resets the streak. Shown on the title screen once per day after the first night has been played.

**Upgrade sounds:** bed (springs + cash register), door (steel plate + drill), turrets/gadgets (ratchet + reload).

**Bosses per night (count / start level):** N1 2/Lv1, N2 2/Lv2, N3 3/Lv1, N4 3/Lv2, N5 3/Lv3, N6 4/Lv1, N7 4/Lv2,
N8 4/Lv3, N9 4/Lv4, N10 5/Lv1, N11 5/Lv2, N12 5/Lv3 (`count`, `lvl` in `NIGHTS`). Boss 1 is the night's boss, the others
walk down the chain of earlier variants. Each boss gets `GROUP_HP` / `GROUP_DMG` of a solo boss (2: 62/70 %, 3: 47/55 %,
4: 38/46 %, 5: 32/40 %); per-night `diff` was auto-tuned with `node tools/tune.mjs` to keep the same difficulty curve.
Boss 1 is a **hunter**: whenever it picks a target it goes for the player's door 60 % of the time (`HUNT_CHANCE`) and
rarely backs off; the others go for the weakest doors and avoid doors another boss is already on. A boss is on the
player's door 23–58 % of the night (was 0–3 % with one boss). Win = dawn or all bosses dead; ★★★ = all dead.
Endless: waves start with 2 bosses and add one every second wave (max 5).

**Each boss:** gains XP from door hits, broken doors, destroyed buildings and slowly over time; each level is ×1.38 HP,
×1.33 damage and a bigger sprite + level badge. It targets doors by a score (current HP, hits-to-break, turret DPS
covering that door, distance), switches doors when taking heavy fire, and retreats to the lair to heal at 28 % HP
(1–2 times per night). Variants: Spitter (acid jams gadgets), Charger (dashes to another door, 3× hit), Howler
(summons minions), Riot Tank (50 % damage reduction vs. non-piercing), Abomination (all of the above).
Eliminated survivors (door broken or caught in the hallway) rise as minions.

**AI survivors:** 5 personalities (greedy, turtle, gunner, balanced, rookie) with spending weights and reaction speeds.
They pick rooms by size, neighbour support and distance, repair under fire, and save towards a weighted goal. Rookies
sometimes freeze in the hallway on later nights, creating early minions.

**Stars / meta:** ★ survive, ★★ survive with 4+ survivors alive, ★★★ kill the boss. Medals: 2 + 2/star (+4 first clear),
spent on 5 permanent perks. 6 survivor skins unlock by total stars. Endless mode unlocks after Night 6
(bosses keep coming, each ×1.55 stronger).

**Balance:** tuned with `tools/balance.mjs` (16 seeds/night). Without perks Nights 1–6 are ~100 % survivable for the
balanced AI (boss-kill 80 % → 13 %), Nights 7–12 drop to 56 % → 0 %; with level-2 perks (≈55 medals, ~5–6 nights of
earnings) Nights 7–12 become 75–100 % survivable. The game expects players to grind perks a little for the last nights.

## CrazyGames integration (js/cg.js)
- `SDK.init()` before use; `environment` `local`/`disabled` → standalone mode.
- `loadingStart/Stop` around asset loading; `gameplayStart` when a night begins / resumes, `gameplayStop` on pause,
  results, menus and during ads; `happytime` on wins.
- Midgame ad when starting a night from results/night select — never on the first night of a session, at most every 3 min.
- Rewarded ads only on explicit buttons: "Free scrap" (2× per night), "Full repair" (once per night, shown when the door
  is below 50 %), "Continue" after your door breaks (once per night), "Double medals" on the results screen.
  Ad failure / adblock → toast "Ad not available right now", no reward.
- Audio muted + game paused in `adStarted`, restored in `adFinished`/`adError`; respects `SDK.game.settings.muteAudio`
  and the settings-change listener.
- Saves via `SDK.data.setItem/getItem` with localStorage fallback (all storage access wrapped in try/catch).

## Decisions made (autonomously)
- Title **"Last Door Standing"** — searched CrazyGames, no existing game with that name. The folder keeps the working title.
- Doors have 3 painted states per tier (intact / damaged < 66 % / almost broken < 33 %, plus a pulsing red tint).
- Camera: closer default zoom (≈44 px tiles during the rush centred on you, ≈56–66 px on your room after you claim it);
  Z / the button toggles a whole-floor overview. In-world labels never render below ~12–13 px.
- Two generated music loops (calm menu track, tense night track), generated victory/defeat stings, and recorded-style
  generated samples for every combat/economy sound (shots, zaps, fire, mortar, explosions, door thuds, repair, build,
  upgrade, coins, zombie hits, roar). Only tiny UI clicks are still synthesized.
- Boss frames: walk A/B while moving, attack frame on each hit; minions alternate two walk frames.
- Rooms get 1–3 pieces of furniture on back-wall tiles (not buildable) plus small clutter that disappears under buildings.
- Room rush allows click-to-claim *and* WASD walking; the tutorial night requires clicking the bed, later nights
  auto-rest on arrival to reduce friction.
- Speed toggle (x1/x2) added for idle-style players.
- The camera follows the player during the rush until they pan manually; drag/pinch/wheel to look around.
- 12 survivor skins (6 extra generated in the polish pass), unlocked by total stars (max 36).
