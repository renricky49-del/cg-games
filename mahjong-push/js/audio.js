// WebAudio sound effects + music (file loop if present, otherwise a generated pentatonic loop).
let ctx = null, master = null, sfxGain = null, musicGain = null;
let musicOn = true, sfxOn = true, suspendedByAd = false, sdkMute = false;
let musicBuffer = null, musicSrc = null, synthTimer = null, synthStep = 0, nextTime = 0;
let noiseBuf = null;
let musicArr = null, decoding = false;
async function decodeMusic() {
  if (decoding || !musicArr) return;
  decoding = true;
  try {
    const buf = makeLoop(await ctx.decodeAudioData(musicArr.slice(0)), 2.0);
    musicBuffer = buf;
    if (synthTimer || musicSrc) { Audio.stopMusic(); Audio.startMusic(); }
  } catch (e) { musicBuffer = null; }
}

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyMaster();
  return ctx;
}

function applyMaster() {
  if (!master) return;
  master.gain.value = suspendedByAd || sdkMute ? 0 : 1;
}

export const Audio = {
  async loadMusic(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      musicArr = await res.arrayBuffer();
      if (ctx) await decodeMusic();
    } catch (e) { musicArr = null; }
  },
  unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (musicArr && !musicBuffer && !decoding) decodeMusic();
    if (musicOn) this.startMusic();
  },
  setMusic(on) { musicOn = on; if (on) { if (ctx) this.startMusic(); } else this.stopMusic(); },
  setSfx(on) { sfxOn = on; },
  get musicOn() { return musicOn; },
  get sfxOn() { return sfxOn; },
  adPause(p) { suspendedByAd = p; applyMaster(); },
  setSdkMute(m) { sdkMute = m; applyMaster(); },

  startMusic() {
    if (!ensure() || !musicOn) return;
    if (musicSrc || synthTimer) return;
    musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, ctx.currentTime);
    musicGain.gain.linearRampToValueAtTime(musicBuffer ? 0.45 : 0.32, ctx.currentTime + 2);
    if (musicBuffer) {
      musicSrc = ctx.createBufferSource();
      musicSrc.buffer = musicBuffer; musicSrc.loop = true;
      musicSrc.connect(musicGain); musicSrc.start();
    } else {
      nextTime = ctx.currentTime + 0.1;
      synthTimer = setInterval(scheduleSynth, 120);
    }
  },
  stopMusic() {
    if (musicSrc) { try { musicSrc.stop(); } catch (e) { /* */ } musicSrc = null; }
    if (synthTimer) { clearInterval(synthTimer); synthTimer = null; }
  },

  play(name, arg = 0) {
    if (!sfxOn || !ensure() || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (fn) fn(ctx.currentTime, arg);
  },
};

// Builds a seamless loop: drops the first `sec` seconds and crossfades them into the tail.
function makeLoop(buf, sec) {
  const F = Math.floor(buf.sampleRate * sec), N = buf.length;
  if (N < F * 3) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, N - F, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    dst.set(src.subarray(F));
    const L = N - F;
    for (let i = 0; i < F; i++) {
      const t = i / F;
      dst[L - F + i] = src[N - F + i] * Math.cos(t * Math.PI / 2) + src[i] * Math.sin(t * Math.PI / 2);
    }
  }
  return out;
}

// ---------- helpers ----------
function env(g, t, a, peak, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(t, freq, type, peak, a, d, dest = sfxGain, detune = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  env(g, t, a, peak, d);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + a + d + 0.05);
  return o;
}
function noise(t, peak, d, ftype, freq, q = 1, dest = sfxGain) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.002, peak, d);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t); s.stop(t + d + 0.05);
  return f;
}
const PENTA = [0, 2, 4, 7, 9];
const noteHz = (semi) => 261.63 * Math.pow(2, semi / 12);
function pentaHz(step, base = 0) {
  const oct = Math.floor(step / 5), k = ((step % 5) + 5) % 5;
  return noteHz(base + PENTA[k] + 12 * oct);
}

const SFX = {
  // tile clack: crisp click with a woody body
  clack(t) {
    noise(t, 0.5, 0.035, 'bandpass', 2600, 3);
    tone(t, 820, 'triangle', 0.18, 0.001, 0.05);
    tone(t + 0.012, 1300, 'sine', 0.08, 0.001, 0.03);
  },
  select(t) { noise(t, 0.3, 0.025, 'bandpass', 3400, 4); tone(t, 1250, 'sine', 0.08, 0.001, 0.05); },
  slide(t) {
    const f = noise(t, 0.25, 0.16, 'bandpass', 900, 1.5);
    f.frequency.exponentialRampToValueAtTime(2200, t + 0.15);
  },
  match(t, combo) {
    const s = Math.min(combo, 8);
    SFX.clack(t);
    tone(t + 0.04, pentaHz(5 + s, 0), 'sine', 0.22, 0.005, 0.6);
    tone(t + 0.1, pentaHz(7 + s, 0), 'sine', 0.16, 0.005, 0.7);
    tone(t + 0.04, pentaHz(5 + s, 12), 'sine', 0.05, 0.005, 0.4);
  },
  deny(t) { tone(t, 180, 'sine', 0.25, 0.005, 0.12); tone(t + 0.09, 140, 'sine', 0.2, 0.005, 0.14); },
  hint(t) { tone(t, pentaHz(10), 'sine', 0.15, 0.01, 0.4); tone(t + 0.12, pentaHz(12), 'sine', 0.12, 0.01, 0.5); },
  shuffle(t) { for (let i = 0; i < 8; i++) SFX.clack(t + i * 0.045 + Math.random() * 0.02); },
  star(t, i) { tone(t, pentaHz(10 + i * 2), 'triangle', 0.2, 0.005, 0.5); tone(t, pentaHz(15 + i * 2), 'sine', 0.08, 0.005, 0.6); },
  coin(t) { tone(t, 1568, 'square', 0.05, 0.002, 0.08); tone(t + 0.07, 2093, 'square', 0.05, 0.002, 0.18); },
  win(t) { [0, 2, 4, 5, 7, 10].forEach((s, i) => tone(t + i * 0.09, pentaHz(s + 5), 'triangle', 0.18, 0.005, 0.6)); },
  lose(t) { [4, 3, 1, 0].forEach((s, i) => tone(t + i * 0.16, pentaHz(s + 3), 'sine', 0.18, 0.01, 0.5)); },
  build(t) {
    noise(t, 0.3, 0.3, 'lowpass', 600, 0.7);
    [0, 2, 4, 7, 9, 12].forEach((s, i) => tone(t + 0.15 + i * 0.07, pentaHz(s + 5), 'triangle', 0.16, 0.005, 0.7));
    tone(t + 0.6, pentaHz(17), 'sine', 0.12, 0.01, 1.2);
  },
  click(t) { tone(t, 660, 'sine', 0.1, 0.001, 0.06); noise(t, 0.12, 0.02, 'highpass', 3000); },
};

// ---------- synthesized background music: gentle pentatonic plucks over a drone ----------
const BPM = 72, STEP = 60 / BPM / 2; // eighth notes
const MELODY = [
  7, -1, 9, 7, 5, -1, 4, -1, 5, -1, 7, -1, 4, 2, -1, -1,
  2, -1, 4, 5, 7, -1, 9, -1, 10, 9, 7, -1, 5, -1, -1, -1,
  7, -1, 9, 10, 12, -1, 10, 9, 7, -1, 5, 4, 5, -1, -1, -1,
  4, -1, 2, -1, 4, 5, 7, -1, 5, -1, 4, 2, 0, -1, -1, -1,
];
const BASS = [0, -3, -5, -2]; // per 16-step bar (penta steps)

function pluck(t, freq, peak) {
  const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(freq * 6, t); f.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.6);
  o.type = 'triangle'; o.frequency.setValueAtTime(freq * 1.01, t); o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
  o2.type = 'sine'; o2.frequency.value = freq * 2;
  const g2 = ctx.createGain(); g2.gain.value = 0.3;
  env(g, t, 0.004, peak, 1.4);
  o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(musicGain);
  o.start(t); o2.start(t); o.stop(t + 1.5); o2.stop(t + 1.5);
}
function pad(t, freq, dur) {
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq; o.detune.value = det;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.05);
  }
}
function scheduleSynth() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.4) {
    const i = synthStep % MELODY.length;
    const m = MELODY[i];
    if (m >= 0) pluck(nextTime, pentaHz(m, 0), 0.16);
    if (i % 16 === 0) {
      const b = BASS[(i / 16) % BASS.length];
      pad(nextTime, pentaHz(b, -12), STEP * 16);
      pluck(nextTime, pentaHz(b, -12), 0.12);
    }
    if (i % 4 === 2 && Math.random() < 0.3) pluck(nextTime, pentaHz(m >= 0 ? m + 5 : 12, 0), 0.04);
    nextTime += STEP;
    synthStep++;
  }
}
