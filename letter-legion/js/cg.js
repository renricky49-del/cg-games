// CrazyGames SDK v3 adapter with a standalone fallback (fake ad overlay, localStorage saves).
const listeners = { adStart: [], adEnd: [] };
let sdk = null;
let env = 'standalone';
let initDone = false;
let lastMidgame = 0;
let gameplayOn = false;
let adsDisabled = false; // CrazyGames Basic Launch: the SDK refuses every ad request
let adblocked = false;

function fakeAd(kind) {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.className = 'fake-ad';
    el.innerHTML = `<div class="fake-ad-box"><div class="fake-ad-title">Advertisement</div><div class="fake-ad-sub">(${kind} ad placeholder — standalone build)</div><div class="fake-ad-bar"><i></i></div></div>`;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); resolve(true); }, 1000);
  });
}

export const CG = {
  get env() { return env; },
  get available() { return !!sdk; },
  async init() {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) {
        sdk = window.CrazyGames.SDK;
        await Promise.race([sdk.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('SDK init timeout')), 6000))]);
        env = sdk.environment || 'crazygames';
        if (env === 'disabled' || env === 'local') sdk = null; // standalone fallback outside CrazyGames
      }
      if (sdk) {
        // During Basic Launch ads are disabled: prefetchAd throws 'adsDisabledBasicLaunch'. Detect it up front so no
        // rewarded button is ever shown that would do nothing.
        try { if (sdk.ad && sdk.ad.prefetchAd) sdk.ad.prefetchAd('rewarded'); } catch (e) { if (e && e.code === 'adsDisabledBasicLaunch') adsDisabled = true; }
        try { if (sdk.ad && sdk.ad.hasAdblock) sdk.ad.hasAdblock().then(b => { adblocked = !!b; }).catch(() => {}); } catch (e) { /* ignore */ }
      }
    } catch (e) { console.warn('CrazyGames SDK init failed, running standalone', e); sdk = null; }
    initDone = true;
    return env;
  },
  // rewarded-ad buttons are only shown when an ad can actually play
  rewardedAvailable() { return !adsDisabled && !adblocked; },
  get adblocked() { return adblocked; },
  onAdStart(fn) { listeners.adStart.push(fn); },
  onAdEnd(fn) { listeners.adEnd.push(fn); },
  muteAudioSetting() {
    try { return !!(sdk && sdk.game && sdk.game.settings && sdk.game.settings.muteAudio); } catch (e) { return false; }
  },
  onSettingsChange(fn) {
    try { if (sdk && sdk.game && sdk.game.addSettingsChangeListener) sdk.game.addSettingsChangeListener(fn); } catch (e) { /* ignore */ }
  },
  loadingStart() { try { sdk && sdk.game.loadingStart(); } catch (e) { /* ignore */ } },
  loadingStop() { try { sdk && sdk.game.loadingStop(); } catch (e) { /* ignore */ } },
  gameplayStart() {
    if (gameplayOn) return; gameplayOn = true;
    try { sdk && sdk.game.gameplayStart(); } catch (e) { /* ignore */ }
  },
  gameplayStop() {
    if (!gameplayOn) return; gameplayOn = false;
    try { sdk && sdk.game.gameplayStop(); } catch (e) { /* ignore */ }
  },
  happytime() { try { sdk && sdk.game.happytime(); } catch (e) { /* ignore */ } },
  // Midgame: only at natural breaks, never more than every 3 minutes, never on first session start.
  midgameAllowed() { return Date.now() - lastMidgame > 180000; },
  markSessionStart() { lastMidgame = Date.now(); }, // prevents an ad right after the game starts
  requestAd(kind) {
    // resolves true if the ad finished (for rewarded: reward granted), false if it failed / was blocked
    return new Promise(resolve => {
      const start = () => listeners.adStart.forEach(f => f());
      const end = () => listeners.adEnd.forEach(f => f());
      if (kind === 'midgame') lastMidgame = Date.now();
      if (!sdk) {
        start();
        fakeAd(kind).then(() => { end(); resolve(true); });
        return;
      }
      let started = false;
      try {
        sdk.ad.requestAd(kind, {
          adStarted: () => { started = true; start(); },
          adFinished: () => { if (started) end(); resolve(true); },
          adError: (err) => { if (started) end(); if (err && err.code === 'adsDisabledBasicLaunch') adsDisabled = true; resolve(false); },
        });
      } catch (e) { if (started) end(); resolve(false); }
    });
  },
  async midgame() {
    if (!this.midgameAllowed()) return false;
    return this.requestAd('midgame');
  },
  rewarded() { return this.requestAd('rewarded'); },
  // ---- data (SDK data module, localStorage fallback) ----
  getItem(key) {
    try { if (sdk && sdk.data) { const v = sdk.data.getItem(key); if (v !== null && v !== undefined) return v; } } catch (e) { /* ignore */ }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem(key, val) {
    try { if (sdk && sdk.data) sdk.data.setItem(key, val); } catch (e) { /* ignore */ }
    try { window.localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  },
  removeItem(key) {
    try { if (sdk && sdk.data) sdk.data.removeItem(key); } catch (e) { /* ignore */ }
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  },
};
