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
  onAdStart: null,   // set by game: pause + mute
  onAdEnd: null,     // set by game: resume + unmute
  onMuteChange: null,

  async init() {
    try {
      const S = window.CrazyGames && window.CrazyGames.SDK;
      if (S) {
        await S.init();
        this.sdk = S;
        this.env = S.environment || 'crazygames';
        // 'local' (localhost) and 'disabled' (not on CrazyGames) run in standalone mode with simulated ads
        if (this.env === 'disabled' || this.env === 'local') this.sdk = null;
        if (this.sdk && this.sdk.game && this.sdk.game.addSettingsChangeListener) {
          try {
            this.sdk.game.addSettingsChangeListener((s) => {
              if (this.onMuteChange && s && typeof s.muteAudio === 'boolean') this.onMuteChange(s.muteAudio);
            });
          } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      console.warn('[cg] SDK init failed, running standalone');
      this.sdk = null;
    }
    this.ready = true;
  },

  get sdkMuted() {
    try { return !!(this.sdk && this.sdk.game && this.sdk.game.settings && this.sdk.game.settings.muteAudio); }
    catch (e) { return false; }
  },

  loadingStart() { try { this.sdk && this.sdk.game.loadingStart(); } catch (e) { /* noop */ } },
  loadingStop() { try { this.sdk && this.sdk.game.loadingStop(); } catch (e) { /* noop */ } },

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
      const finish = (ok) => {
        if (done) return; done = true;
        this.adActive = false;
        if (this.onAdEnd) this.onAdEnd();
        resolve(ok);
      };
      if (this.sdk) {
        try {
          this.sdk.ad.requestAd(type, {
            adStarted: start,
            adFinished: () => finish(true),
            adError: (err) => { console.warn('[cg] ad error', err && err.code); finish(false); },
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
