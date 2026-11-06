// CrazyGames SDK v3 adapter with a standalone fallback (simulated ads, localStorage saves).
const MIDGAME_MIN_GAP = 180000; // never more often than every ~3 minutes

let sdk = null;
let env = 'none';
let lastMidgame = Date.now(); // counts from session start so no ad right at the beginning
let gameplayOn = false;
const hooks = { pause: () => {}, resume: () => {}, muteChange: () => {} };

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
  gameplayStart() {
    if (gameplayOn) return; gameplayOn = true;
    try { sdk && sdk.game.gameplayStart(); } catch (e) { /* */ }
  },
  gameplayStop() {
    if (!gameplayOn) return; gameplayOn = false;
    try { sdk && sdk.game.gameplayStop(); } catch (e) { /* */ }
  },
  happytime() { try { sdk && sdk.game.happytime(); } catch (e) { /* */ } },

  canMidgame() { return Date.now() - lastMidgame >= MIDGAME_MIN_GAP; },

  // Midgame ad at natural breaks; resolves when done (whether shown or not).
  midgame() {
    if (!this.canMidgame()) return Promise.resolve(false);
    lastMidgame = Date.now();
    return this._ad('midgame').then((ok) => ok, () => false);
  },

  // Rewarded ad; resolves true if the reward should be granted.
  rewarded() { return this._ad('rewarded'); },

  _ad(type) {
    return new Promise((resolve) => {
      const wasPlaying = gameplayOn;
      const start = () => { this.gameplayStop(); hooks.pause(); };
      const end = (ok) => { hooks.resume(); if (wasPlaying) this.gameplayStart(); resolve(ok); };
      if (sdk) {
        try {
          sdk.ad.requestAd(type, {
            adStarted: start,
            adFinished: () => end(true),
            adError: (err) => { console.warn('ad error', err && (err.code || err.message || err)); end(false); },
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

  async getItem(key) {
    try {
      if (sdk && sdk.data) { const v = sdk.data.getItem(key); if (v != null) return v; }
    } catch (e) { /* */ }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem(key, val) {
    try { sdk && sdk.data && sdk.data.setItem(key, val); } catch (e) { /* */ }
    try { window.localStorage.setItem(key, val); } catch (e) { /* */ }
  },
  removeItem(key) {
    try { sdk && sdk.data && sdk.data.removeItem(key); } catch (e) { /* */ }
    try { window.localStorage.removeItem(key); } catch (e) { /* */ }
  },
};

// For tests: allow the midgame timer to be reset.
window.__cgDebug = { resetMidgame() { lastMidgame = 0; } };
