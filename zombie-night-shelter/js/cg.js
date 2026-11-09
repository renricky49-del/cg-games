// CrazyGames SDK v3 adapter with a standalone fallback.
// Every call is safe: when the SDK is missing / disabled / local, ads are simulated
// with a short fake overlay and data falls back to localStorage (wrapped in try/catch).

const SAVE_KEY = 'lds_save_v1';

function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }

export const CG = {
  sdk: null,
  env: 'disabled',
  ready: false,
  inGameplay: false,
  adActive: false,
  adsOff: false,     // true once the SDK says ads are disabled for this session or an adblocker is detected
  onAdStart: null,   // set by game: pause + mute
  onAdEnd: null,     // set by game: resume + unmute
  onMuteChange: null,
  onAdsOff: null,    // set by game: hide rewarded-ad buttons
  loading: false,

  // Never blocks the loading screen for long: the SDK gets 5 s, after that the game starts and the SDK is adopted when it arrives.
  init() {
    const S = window.CrazyGames && window.CrazyGames.SDK;
    if (!S) { this.ready = true; return Promise.resolve(); }
    const adopt = S.init().then(() => this._adopt(S)).catch(() => { console.warn('[cg] SDK init failed, running standalone'); this.sdk = null; });
    return Promise.race([adopt, new Promise((r) => setTimeout(r, 5000))]).then(() => { this.ready = true; });
  },
  _adopt(S) {
    let env = 'disabled';
    try { env = S.environment || 'crazygames'; } catch (e) { env = 'disabled'; }
    this.env = env;
    // 'local' (localhost) and 'disabled' (not on CrazyGames) run in standalone mode with simulated ads
    if (env === 'disabled' || env === 'local') { this.sdk = null; return; }
    this.sdk = S;
    if (this.loading) { try { S.game.loadingStart(); } catch (e) { /* noop */ } }
    if (this.inGameplay) { try { S.game.gameplayStart(); } catch (e) { /* noop */ } }
    // Ads can be unavailable for the whole session (Basic Launch, kids mode, adblock): learn it early so no
    // rewarded button is ever shown without effect. Reads the init info defensively; adError stays the fallback.
    try {
      const info = S.instance && (S.instance.initializeReply || (S.instance.ad && S.instance.ad.initInfo));
      const pl = info && info.adsAllowedByPlacement && info.adsAllowedByPlacement.rewarded;
      if (pl != null) { if (pl.allowed === false) this._adsOff(); } else if (info && info.launchFlow === 'basic') this._adsOff();
    } catch (e) { /* ignore */ }
    try { // adblock check in the background (it can take seconds): never awaited during loading
      if (S.ad && S.ad.hasAdblock) S.ad.hasAdblock().then((v) => { if (v) this._adsOff(); }).catch(() => {});
    } catch (e) { /* ignore */ }
    try {
      if (S.game && S.game.addSettingsChangeListener) {
        S.game.addSettingsChangeListener((st) => {
          if (this.onMuteChange && st && typeof st.muteAudio === 'boolean') this.onMuteChange(st.muteAudio);
        });
      }
    } catch (e) { /* ignore */ }
  },
  _adsOff() { this.adsOff = true; if (this.onAdsOff) this.onAdsOff(); },

  get sdkMuted() {
    try { return !!(this.sdk && this.sdk.game && this.sdk.game.settings && this.sdk.game.settings.muteAudio); }
    catch (e) { return false; }
  },

  loadingStart() { this.loading = true; try { this.sdk && this.sdk.game.loadingStart(); } catch (e) { /* noop */ } },
  loadingStop() { this.loading = false; try { this.sdk && this.sdk.game.loadingStop(); } catch (e) { /* noop */ } },

  gameplayStart() {
    if (this.inGameplay) return;
    this.inGameplay = true;
    try { this.sdk && this.sdk.game.gameplayStart(); } catch (e) { /* noop */ }
  },
  gameplayStop() {
    if (!this.inGameplay) return;
    this.inGameplay = false;
    try { this.sdk && this.sdk.game.gameplayStop(); } catch (e) { /* noop */ }
  },
  happytime() { try { this.sdk && this.sdk.game.happytime(); } catch (e) { /* noop */ } },

  // type: 'midgame' | 'rewarded'. Resolves true when a rewarded ad finished (reward granted).
  requestAd(type) {
    return new Promise((resolve) => {
      if (this.adActive) { resolve(false); return; }
      this.adActive = true;
      let done = false;
      const start = () => { if (this.onAdStart) this.onAdStart(); };
      // always un-pause when an ad ends; the promise resolves only once
      const finish = (ok) => {
        this.adActive = false;
        if (this.onAdEnd) this.onAdEnd();
        if (!done) { done = true; resolve(ok); }
      };
      if (this.sdk) {
        // safety net: if the platform never answers, the game must not stay frozen
        // (15 s for the ad to start, 3 min to finish; an ad that still starts late pauses and un-pauses normally)
        let started = false;
        setTimeout(() => { if (!started && !done) finish(false); }, 15000);
        setTimeout(() => { if (!done) finish(false); }, 180000);
        try {
          this.sdk.ad.requestAd(type, {
            adStarted: () => { started = true; start(); },
            adFinished: () => finish(true),
            adError: (err) => {
              const code = err && err.code;
              console.warn('[cg] ad error', code);
              if (code === 'adsDisabled' || code === 'adblock' || code === 'adsDisabledBasicLaunch') this._adsOff();
              finish(false);
            },
          });
        } catch (e) { finish(false); }
        return;
      }
      // Standalone: simulate the ad with a 1s overlay.
      start();
      const ov = document.createElement('div');
      ov.className = 'fake-ad';
      ov.textContent = type === 'rewarded' ? 'Rewarded ad (simulated)…' : 'Ad break (simulated)…';
      document.body.appendChild(ov);
      setTimeout(() => { ov.remove(); finish(true); }, 1000);
    });
  },

  async load() {
    let raw = null;
    try {
      if (this.sdk && this.sdk.data) raw = this.sdk.data.getItem(SAVE_KEY);
    } catch (e) { raw = null; }
    if (!raw) raw = lsGet(SAVE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  },

  save(obj) {
    const raw = JSON.stringify(obj);
    try { if (this.sdk && this.sdk.data) this.sdk.data.setItem(SAVE_KEY, raw); } catch (e) { /* noop */ }
    lsSet(SAVE_KEY, raw);
  },
};
