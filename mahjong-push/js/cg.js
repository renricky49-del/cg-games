// CrazyGames SDK v3 adapter with a standalone fallback (simulated ads, localStorage saves).
const MIDGAME_MIN_GAP = 180000; // never more often than every ~3 minutes
const REWARDED_COOLDOWN = 90000; // rewarded offers are hidden for a while after one was watched

let sdk = null;
let env = 'none';
let lastMidgame = Date.now(); // counts from session start so no ad right at the beginning
let gameplayOn = false;
let adblock = false, lastRewarded = 0, adBusy = false;
const hooks = { pause: () => {}, resume: () => {}, muteChange: () => {} };
let sentOn = false, lastSent = 0, flushT = null;
function syncGameplay() {
  clearTimeout(flushT);
  if (gameplayOn === sentOn) return;
  const wait = lastSent + 1050 - Date.now();
  if (wait > 0) { flushT = setTimeout(syncGameplay, wait); return; }
  sentOn = gameplayOn; lastSent = Date.now();
  try { if (sdk) (sentOn ? sdk.game.gameplayStart() : sdk.game.gameplayStop()); } catch (e) { /* */ }
}

export const CG = {
  get env() { return env; },
  get available() { return !!sdk && env !== 'disabled'; },

  async init(h = {}) {
    Object.assign(hooks, h);
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) {
        sdk = window.CrazyGames.SDK;
        await sdk.init();
        env = sdk.environment || 'crazygames';
        if (env === 'disabled') sdk = null;
        try { if (sdk && sdk.ad && sdk.ad.hasAdblock) adblock = !!(await sdk.ad.hasAdblock()); } catch (e) { /* */ }
        try {
          if (sdk && sdk.game && sdk.game.addSettingsChangeListener) {
            sdk.game.addSettingsChangeListener((s) => hooks.muteChange(!!(s && s.muteAudio)));
          }
        } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn('CrazyGames SDK unavailable, running standalone');
      sdk = null; env = 'none';
    }
  },

  sdkMuted() {
    try { return !!(sdk && sdk.game && sdk.game.settings && sdk.game.settings.muteAudio); } catch (e) { return false; }
  },

  loadingStart() { try { sdk && sdk.game.loadingStart(); } catch (e) { /* */ } },
  loadingStop() { try { sdk && sdk.game.loadingStop(); } catch (e) { /* */ } },
  // gameplayStart/Stop are coalesced: the SDK throttles calls closer than 1 s (and logs an error), so
  // rapid toggles (tutorial auto-advance, quick shuffle after "no moves") collapse into the final state.
  gameplayStart() { gameplayOn = true; syncGameplay(); },
  gameplayStop() { gameplayOn = false; syncGameplay(); },
  happytime() { try { sdk && sdk.game.happytime(); } catch (e) { /* */ } },

  canMidgame() { return Date.now() - lastMidgame >= MIDGAME_MIN_GAP; },

  // Midgame ad at natural breaks; resolves when done (whether shown or not).
  midgame() {
    if (!this.canMidgame()) return Promise.resolve(false);
    lastMidgame = Date.now();
    return this._ad('midgame').then((ok) => ok, () => false);
  },

  // Rewarded offers are shown only when an ad can actually play: never with an adblocker or when the
  // platform has ads disabled (Basic Launch)
  // (CrazyGames rule: no rewarded buttons that do nothing) and not again right after one was watched.
  rewardedAvailable() { return !adblock && !adBusy && Date.now() - lastRewarded >= REWARDED_COOLDOWN; },

  // Rewarded ad; resolves true only if the ad finished (never reward on adError).
  rewarded() {
    if (!this.rewardedAvailable()) return Promise.resolve(false);
    return this._ad('rewarded').then((ok) => { if (ok) lastRewarded = Date.now(); return ok; });
  },

  _ad(type) {
    return new Promise((resolve) => {
      const wasPlaying = gameplayOn;
      adBusy = true;
      // block all UI from the request until the ad finishes or fails
      const blocker = document.createElement('div');
      blocker.style.cssText = 'position:fixed;inset:0;z-index:99;background:transparent';
      document.body.appendChild(blocker);
      let started = false;
      // pause + mute only once the ad actually starts (adStarted), per CrazyGames rules
      const start = () => { started = true; this.gameplayStop(); hooks.pause(); };
      const end = (ok) => { blocker.remove(); adBusy = false; if (started) hooks.resume(); if (wasPlaying) this.gameplayStart(); resolve(ok); };
      if (sdk) {
        try {
          sdk.ad.requestAd(type, {
            adStarted: start,
            adFinished: () => end(true),
            adError: (err) => {
              const code = err && (err.code || err.message || err);
              // adblock, or ads switched off (e.g. Basic Launch): hide rewarded offers from now on
              if (code === 'adblock' || code === 'adsDisabled') adblock = true;
              console.warn('ad error', code); end(false);
            },
          });
        } catch (e) { end(false); }
      } else {
        // standalone: 1s fake overlay
        start();
        const ov = document.createElement('div');
        ov.className = 'fake-ad';
        ov.textContent = type === 'rewarded' ? 'Rewarded ad (simulated)…' : 'Ad break (simulated)…';
        document.body.appendChild(ov);
        setTimeout(() => { ov.remove(); end(true); }, 1000);
      }
    });
  },

  // Progress save: on CrazyGames rely fully on the SDK Data Module (it handles guests and logged-in
  // users); localStorage is only the standalone fallback.
  async getItem(key) {
    if (sdk && sdk.data) { try { return sdk.data.getItem(key); } catch (e) { return null; } }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem(key, val) {
    if (sdk && sdk.data) { try { sdk.data.setItem(key, val); } catch (e) { /* */ } return; }
    try { window.localStorage.setItem(key, val); } catch (e) { /* */ }
  },
  removeItem(key) {
    if (sdk && sdk.data) { try { sdk.data.removeItem(key); } catch (e) { /* */ } return; }
    try { window.localStorage.removeItem(key); } catch (e) { /* */ }
  },
};

// For tests: allow the midgame timer to be reset.
window.__cgDebug = { resetMidgame() { lastMidgame = 0; } };
