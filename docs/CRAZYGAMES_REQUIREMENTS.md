# Shared CrazyGames release checklist (applies to all three games)

## Build
- Pure HTML5, self-contained folder, `index.html` at root, relative paths only, no external CDNs at runtime except the CrazyGames SDK script.
- No build step required to run (plain JS/ES modules, or a committed `dist/` if a bundler is used). Total size target < 20 MB, ideally < 10 MB; initial download < 5 MB.
- Must run in an iframe, any aspect ratio. Primary target 16:9 desktop (1280x720 logical), responsive down to mobile portrait/landscape. Mouse + touch; keyboard shortcuts optional.
- No external links, no "download our app", no other-portal branding, no browser storage reliance that breaks when blocked (wrap in try/catch, prefer CrazyGames SDK `data` module with localStorage fallback).
- Original names, characters and art. Do NOT reference or copy the original Chinese titles' names, characters, logos or art.
- English UI only.

## CrazyGames SDK v3
- Load `https://sdk.crazygames.com/crazygames-sdk-v3.js` in index.html; `await window.CrazyGames.SDK.init()` before use.
- Wrap all calls in a small `cg.js` adapter that no-ops (or simulates ads with a 1s fake overlay) when the SDK is missing / environment is `disabled` / `local`, so the game runs standalone.
- `SDK.game.loadingStart()` / `loadingStop()` around asset loading.
- `SDK.game.gameplayStart()` when the player is actively playing, `gameplayStop()` on pause/menus/level end.
- `SDK.game.happytime()` on big wins (optional).
- Ads: `SDK.ad.requestAd('midgame', callbacks)` at natural breaks (between levels/nights, never more often than every ~3 min, never on first session start); `SDK.ad.requestAd('rewarded', callbacks)` only when the player clicks an explicit "Watch ad for X" button. Mute audio + pause game in `adStarted`, resume in `adFinished`/`adError`. Handle adblock gracefully (button just fails with a toast).
- Save progress via `SDK.data.setItem/getItem` (fallback localStorage).
- Respect `SDK.game.settings.muteAudio` if present; provide an in-game mute toggle.

## Quality bar ("ready to submit")
- Title screen, how-to-play / tutorial (first level teaches the rules interactively), settings (sound/music), pause.
- Progression: level/night select, unlocks, persistent save. Target average session > 10 minutes.
- Juice: tweens, particles, screen shake, floating numbers, sound effects (WebAudio-synthesized is fine), background music loop.
- No console errors. Tested with Playwright: load, play first level end-to-end via scripted input, screenshot key screens.
- Store assets in `<game>/store/`: cover 1920x1080 (16:9), 800x1200 (2:3 portrait), 800x800 (1:1), plus `description.md` (short description, controls, tags) ready to paste into the CG portal.
