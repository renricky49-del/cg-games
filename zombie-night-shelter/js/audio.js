// WebAudio: generated music loop (file) + synthesized SFX. Everything fails silently.
export const Audio = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  musicOn: true, sfxOn: true, adMuted: false, sdkMuted: false,
  musicBuf: null, musicSrc: null, wantMusic: false, last: {}, noiseBuf: null, musicRate: 1,

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.38; this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.6; this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyMute();
      this.loadMusic();
    } catch (e) { this.ctx = null; }
  },
  unlock() {
    this.init();
    try { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { /* noop */ }
  },
  async loadMusic() {
    try {
      const r = await fetch('assets/audio/night_loop.mp3');
      if (!r.ok) return;
      const ab = await r.arrayBuffer();
      this.musicBuf = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej));
      if (this.wantMusic) this.startMusic();
    } catch (e) { /* music optional */ }
  },
  applyMute() {
    if (!this.ctx) return;
    const muted = this.adMuted || this.sdkMuted;
    this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(this.musicOn ? 0.38 : 0, this.ctx.currentTime, 0.1);
    this.sfxGain.gain.value = this.sfxOn ? 0.6 : 0;
  },
  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || !this.musicBuf || this.musicSrc) return;
    try {
      const s = this.ctx.createBufferSource();
      s.buffer = this.musicBuf; s.loop = true; s.playbackRate.value = this.musicRate;
      s.connect(this.musicGain); s.start();
      this.musicSrc = s;
    } catch (e) { /* noop */ }
  },
  stopMusic() {
    this.wantMusic = false;
    try { if (this.musicSrc) this.musicSrc.stop(); } catch (e) { /* noop */ }
    this.musicSrc = null;
  },
  setIntensity(hi) { // speed music up slightly while your door is under attack
    const r = hi ? 1.08 : 1;
    if (r === this.musicRate) return;
    this.musicRate = r;
    try { if (this.musicSrc) this.musicSrc.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.4); } catch (e) { /* noop */ }
  },

  // ---------------------------------------------------------------- synth helpers
  _ok(name, gap) {
    if (!this.ctx || !this.sfxOn || this.ctx.state !== 'running') return false;
    const t = this.ctx.currentTime;
    if (this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t; return true;
  },
  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, freq = 1000, q = 1, type = 'bandpass', delay = 0, slide = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },

  play(name, vol = 1) {
    try { this._play(name, vol); } catch (e) { /* ignore */ }
  },
  _play(name, v) {
    switch (name) {
      case 'click': if (this._ok(name, 0.03)) this.tone(660, 0.06, 'triangle', 0.18 * v, 1.4); break;
      case 'hover': if (this._ok(name, 0.05)) this.tone(900, 0.03, 'sine', 0.05 * v); break;
      case 'error': if (this._ok(name, 0.1)) { this.tone(180, 0.14, 'square', 0.1 * v); this.tone(150, 0.16, 'square', 0.1 * v, 0, 0.08); } break;
      case 'nail': if (this._ok(name, 0.045)) { this.noise(0.05, 0.12 * v, 3000, 2); this.tone(1400, 0.03, 'square', 0.03 * v, 0.5); } break;
      case 'bolt': if (this._ok(name, 0.08)) { this.tone(260, 0.12, 'triangle', 0.18 * v, 0.6); this.noise(0.08, 0.1 * v, 1800, 3); } break;
      case 'zap': if (this._ok(name, 0.08)) { this.noise(0.18, 0.18 * v, 5000, 0.8, 'highpass'); this.tone(90, 0.15, 'sawtooth', 0.08 * v, 2); } break;
      case 'doorHit': if (this._ok(name, 0.07)) { this.tone(80, 0.18, 'sine', 0.5 * v, 0.5); this.noise(0.16, 0.35 * v, 600, 1.2); } break;
      case 'doorHitFar': if (this._ok(name, 0.15)) { this.tone(70, 0.12, 'sine', 0.12 * v, 0.6); this.noise(0.1, 0.07 * v, 500, 1); } break;
      case 'doorBreak': this.noise(0.7, 0.6 * v, 400, 0.6, 'lowpass', 0, 0.3); this.tone(60, 0.6, 'sawtooth', 0.25 * v, 0.4); this.noise(0.4, 0.3 * v, 2000, 1, 'bandpass', 0.05); break;
      case 'repair': for (let i = 0; i < 3; i++) this.tone(1200 + i * 150, 0.07, 'triangle', 0.15 * v, 0.9, i * 0.09); break;
      case 'build': this.tone(140, 0.12, 'square', 0.15 * v, 0.6); this.noise(0.12, 0.2 * v, 900, 1); this.tone(880, 0.15, 'triangle', 0.12 * v, 1.5, 0.08); break;
      case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.16 * v, 1, i * 0.06)); break;
      case 'coin': if (this._ok(name, 0.12)) { this.tone(1320, 0.06, 'square', 0.04 * v); this.tone(1760, 0.08, 'square', 0.04 * v, 1, 0.05); } break;
      case 'sell': this.tone(990, 0.08, 'triangle', 0.12 * v); this.tone(660, 0.1, 'triangle', 0.12 * v, 1, 0.07); break;
      case 'roar': this.tone(110, 0.9, 'sawtooth', 0.28 * v, 0.45); this.tone(73, 1.0, 'square', 0.12 * v, 0.6); this.noise(0.9, 0.25 * v, 500, 0.7, 'lowpass', 0, 0.4); break;
      case 'howl': this.tone(300, 1.2, 'sine', 0.2 * v, 2.2); this.tone(305, 1.2, 'triangle', 0.1 * v, 2.1); break;
      case 'alarm': for (let i = 0; i < 3; i++) { this.tone(880, 0.22, 'square', 0.1 * v, 0.7, i * 0.32); } break;
      case 'death': this.tone(400, 0.5, 'triangle', 0.2 * v, 0.3); break;
      case 'kill': if (this._ok(name, 0.06)) { this.noise(0.2, 0.2 * v, 700, 1); this.tone(200, 0.2, 'square', 0.06 * v, 0.4); } break;
      case 'bossDie': this.noise(1.2, 0.5 * v, 300, 0.6, 'lowpass', 0, 0.3); this.tone(150, 1.2, 'sawtooth', 0.25 * v, 0.2); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.18 * v, 1, i * 0.12)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.1 * v, 0.98, i * 0.22)); break;
      case 'tick': if (this._ok(name, 0.5)) this.tone(1000, 0.05, 'square', 0.08 * v); break;
      case 'acid': this.noise(0.4, 0.2 * v, 1500, 2, 'bandpass', 0, 0.4); break;
      case 'star': this.tone(1047, 0.25, 'triangle', 0.2 * v, 1.5); break;
      case 'lie': this.tone(330, 0.3, 'sine', 0.12 * v, 0.7); break;
      case 'door_close': this.noise(0.15, 0.3 * v, 300, 1, 'lowpass'); this.tone(110, 0.15, 'sine', 0.3 * v, 0.7); break;
    }
  },
};
