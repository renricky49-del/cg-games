// WebAudio: synthesized SFX + a looping music track (generated asset) with mute handling.
let ctx = null, master = null, sfxGain = null, musicGain = null;
let musicBuf = null, musicSrc = null, musicWanted = false;
const state = { sfx: true, music: true, adMuted: false, sdkMuted: false };
const lastPlay = {};

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.55; sfxGain.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    applyMute();
  } catch (e) { ctx = null; }
  return ctx;
}
function applyMute() {
  if (!master) return;
  const silent = state.adMuted || state.sdkMuted;
  master.gain.value = silent ? 0 : 1;
  sfxGain.gain.value = state.sfx ? 0.55 : 0;
  musicGain.gain.value = state.music ? 0.32 : 0;
}
function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0, attack = 0.005 } = {}) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  env(g, t, attack, dur, vol);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + attack + dur + 0.02);
}
let noiseBuf = null;
function noise(dur, { vol = 0.3, filter = 2000, q = 1, type = 'bandpass', delay = 0, slide = 0 } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(filter, t); f.Q.value = q;
  if (slide) f.frequency.exponentialRampToValueAtTime(filter * slide, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, dur, vol);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const N = n => 440 * Math.pow(2, (n - 69) / 12);

const SFX = {
  click: () => { tone(880, 0.05, { type: 'triangle', vol: 0.18 }); },
  hover: () => { tone(1320, 0.025, { type: 'sine', vol: 0.05 }); },
  error: () => { tone(160, 0.14, { type: 'square', vol: 0.12 }); tone(120, 0.16, { type: 'square', vol: 0.1, delay: 0.08 }); },
  summon: () => { noise(0.25, { vol: 0.2, filter: 800, slide: 4, q: 2 }); tone(500, 0.2, { type: 'triangle', vol: 0.12, slide: 2 }); },
  reveal: () => { tone(N(76), 0.12, { type: 'triangle', vol: 0.2 }); tone(N(83), 0.18, { type: 'triangle', vol: 0.16, delay: 0.06 }); },
  gold: () => { [72, 76, 79, 84, 88].forEach((n, i) => tone(N(n), 0.25, { type: 'triangle', vol: 0.16, delay: i * 0.05 })); noise(0.4, { vol: 0.06, filter: 7000, delay: 0.1 }); },
  shovel: () => { noise(0.18, { vol: 0.25, filter: 1200, q: 3 }); tone(300, 0.1, { type: 'square', vol: 0.06, delay: 0.1 }); },
  place: () => { tone(180, 0.09, { type: 'sine', vol: 0.3, slide: 0.6 }); noise(0.05, { vol: 0.1, filter: 900 }); },
  merge: () => { tone(N(67), 0.1, { type: 'triangle', vol: 0.2 }); tone(N(74), 0.1, { type: 'triangle', vol: 0.2, delay: 0.07 }); tone(N(79), 0.22, { type: 'triangle', vol: 0.22, delay: 0.14 }); noise(0.3, { vol: 0.08, filter: 5000, delay: 0.14 }); },
  transmute: () => { tone(N(84), 0.3, { type: 'sine', vol: 0.15, slide: 0.5 }); tone(N(72), 0.3, { type: 'sine', vol: 0.15, slide: 2, delay: 0.1 }); },
  spell: () => { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.35, { type: i % 2 ? 'triangle' : 'sawtooth', vol: 0.09, delay: i * 0.07 })); tone(N(48), 0.8, { type: 'triangle', vol: 0.2, delay: 0.45 }); noise(0.8, { vol: 0.08, filter: 6000, delay: 0.45 }); },
  sell: () => { tone(N(88), 0.08, { type: 'square', vol: 0.07 }); tone(N(93), 0.12, { type: 'square', vol: 0.07, delay: 0.06 }); },
  slash: () => { noise(0.1, { vol: 0.16, filter: 3000, slide: 0.3, q: 0.8 }); },
  thrust: () => { noise(0.08, { vol: 0.12, filter: 1500, slide: 3, q: 4 }); },
  arrow: () => { tone(700, 0.08, { type: 'triangle', vol: 0.07, slide: 0.5 }); noise(0.1, { vol: 0.05, filter: 4000, delay: 0.02 }); },
  gallop: () => { tone(420, 0.03, { type: 'square', vol: 0.05 }); tone(360, 0.03, { type: 'square', vol: 0.05, delay: 0.06 }); },
  spark: () => { tone(1600, 0.05, { type: 'sine', vol: 0.04, slide: 1.5 }); },
  kill: () => { tone(600, 0.08, { type: 'sine', vol: 0.12, slide: 0.4 }); noise(0.06, { vol: 0.08, filter: 2500 }); },
  bosskill: () => { tone(110, 0.8, { type: 'sawtooth', vol: 0.2, slide: 0.3 }); noise(1.0, { vol: 0.25, filter: 400, slide: 0.2 }); [72, 76, 79, 84].forEach((n, i) => tone(N(n), 0.3, { type: 'triangle', vol: 0.14, delay: 0.4 + i * 0.08 })); },
  leak: () => { tone(330, 0.2, { type: 'triangle', vol: 0.25, slide: 0.5 }); tone(220, 0.3, { type: 'triangle', vol: 0.2, slide: 0.5, delay: 0.15 }); },
  rivalLeak: () => { tone(N(79), 0.08, { type: 'triangle', vol: 0.08 }); tone(N(84), 0.12, { type: 'triangle', vol: 0.08, delay: 0.06 }); },
  wave: () => { tone(N(55), 0.35, { type: 'sawtooth', vol: 0.09 }); tone(N(62), 0.45, { type: 'sawtooth', vol: 0.09, delay: 0.2 }); },
  boss: () => { tone(N(43), 1.0, { type: 'sawtooth', vol: 0.16 }); tone(N(46), 1.0, { type: 'sawtooth', vol: 0.12, delay: 0.3 }); noise(0.9, { vol: 0.15, filter: 200, delay: 0.1 }); },
  meteor: () => { noise(0.5, { vol: 0.35, filter: 300, slide: 0.3, type: 'lowpass' }); tone(90, 0.4, { type: 'sine', vol: 0.3, slide: 0.4 }); },
  skill: () => { tone(N(79), 0.15, { type: 'triangle', vol: 0.14 }); tone(N(86), 0.25, { type: 'triangle', vol: 0.14, delay: 0.08 }); noise(0.3, { vol: 0.06, filter: 6000 }); },
  freeze: () => { [96, 91, 88, 84].forEach((n, i) => tone(N(n), 0.2, { type: 'sine', vol: 0.1, delay: i * 0.05 })); noise(0.5, { vol: 0.1, filter: 8000 }); },
  disable: () => { tone(200, 0.25, { type: 'sawtooth', vol: 0.08, slide: 0.5 }); },
  coin: () => { tone(N(88), 0.07, { type: 'square', vol: 0.06 }); tone(N(95), 0.18, { type: 'square', vol: 0.06, delay: 0.07 }); },
  win: () => { [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => tone(N(n + 12), 0.3, { type: 'triangle', vol: 0.15, delay: i * 0.11 })); },
  lose: () => { [67, 64, 60, 55].forEach((n, i) => tone(N(n), 0.4, { type: 'triangle', vol: 0.15, delay: i * 0.2 })); },
  levelup: () => { [72, 76, 79, 84, 88, 91].forEach((n, i) => tone(N(n), 0.2, { type: 'triangle', vol: 0.13, delay: i * 0.06 })); },
  drop: () => { tone(N(60), 0.4, { type: 'sine', vol: 0.2, slide: 2 }); noise(0.4, { vol: 0.1, filter: 5000, delay: 0.3 }); },
};
const MIN_GAP = { slash: 0.05, thrust: 0.05, arrow: 0.05, gallop: 0.12, spark: 0.08, kill: 0.04, hover: 0.04 };

export const Audio = {
  state,
  unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().then(() => this.playMusic()); else this.playMusic(); },
  play(name) {
    if (!state.sfx || state.adMuted || state.sdkMuted) return;
    if (!ensure() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = MIN_GAP[name] || 0.02;
    if (lastPlay[name] && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;
    try { SFX[name] && SFX[name](); } catch (e) { /* ignore */ }
  },
  async loadMusic(url) {
    try {
      if (!ensure()) return;
      const res = await fetch(url); const ab = await res.arrayBuffer();
      musicBuf = await new Promise((ok, bad) => ctx.decodeAudioData(ab, ok, bad));
      if (musicWanted) this.playMusic();
    } catch (e) { console.warn('music load failed', e); }
  },
  playMusic() {
    musicWanted = true;
    if (!ctx || !musicBuf || musicSrc || ctx.state !== 'running') return;
    musicSrc = ctx.createBufferSource(); musicSrc.buffer = musicBuf; musicSrc.loop = true;
    musicSrc.connect(musicGain); musicSrc.start();
  },
  setMusicIntensity(v) { if (musicGain && state.music) musicGain.gain.setTargetAtTime(0.32 * v, ctx.currentTime, 0.4); },
  setSfx(on) { state.sfx = on; applyMute(); },
  setMusic(on) { state.music = on; applyMute(); },
  setAdMuted(m) { state.adMuted = m; applyMute(); },
  setSdkMuted(m) { state.sdkMuted = m; applyMute(); },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
};
