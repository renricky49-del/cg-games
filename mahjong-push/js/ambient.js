// Lightweight ambient overlay for menus/teahouse: drifting petals, snow, fireflies or dust motes.
export class Ambient {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.mode = 'none'; this.p = []; this.running = false; this.last = 0;
    window.addEventListener('resize', () => this._size());
    this._size();
  }
  _size() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    this.d = d; this.cv.width = innerWidth * d; this.cv.height = innerHeight * d;
  }
  set(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.p = [];
    const n = mode === 'snow' ? 70 : mode === 'fireflies' ? 26 : mode === 'motes' ? 30 : mode === 'petals' ? 26 : 0;
    for (let i = 0; i < n; i++) this.p.push(this._spawn(true));
    this.cv.style.display = n ? 'block' : 'none';
    if (n && !this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this._loop(t)); }
  }
  _spawn(anywhere) {
    const W = innerWidth, H = innerHeight, m = this.mode;
    const o = { x: Math.random() * W, y: anywhere ? Math.random() * H : -20, t: Math.random() * 10, s: 0.6 + Math.random() * 0.8 };
    if (m === 'petals') { o.vx = 18 + Math.random() * 25; o.vy = 22 + Math.random() * 25; o.r = Math.random() * 6; o.vr = (Math.random() - 0.5) * 3; }
    else if (m === 'snow') { o.vx = -6 + Math.random() * 12; o.vy = 18 + Math.random() * 30; }
    else { o.vx = (Math.random() - 0.5) * 14; o.vy = (Math.random() - 0.5) * 10; if (!anywhere) o.y = Math.random() * H; }
    return o;
  }
  _loop(now) {
    if (this.mode === 'none' || !this.p.length) { this.running = false; this.g.clearRect(0, 0, this.cv.width, this.cv.height); return; }
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const g = this.g, d = this.d, W = innerWidth, H = innerHeight, m = this.mode;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); g.setTransform(d, 0, 0, d, 0, 0);
    for (let i = 0; i < this.p.length; i++) {
      const o = this.p[i];
      o.t += dt;
      o.x += (o.vx + Math.sin(o.t * 1.3) * 12) * dt; o.y += o.vy * dt;
      if (m === 'fireflies' || m === 'motes') {
        if (o.x < -10) o.x = W + 10; if (o.x > W + 10) o.x = -10; if (o.y < -10) o.y = H + 10; if (o.y > H + 10) o.y = -10;
      } else if (o.y > H + 20 || o.x > W + 30) { this.p[i] = this._spawn(false); continue; }
      if (m === 'petals') {
        o.r += o.vr * dt;
        g.save(); g.translate(o.x, o.y); g.rotate(o.r); g.scale(1, 0.55 + 0.45 * Math.sin(o.t * 2));
        g.fillStyle = 'rgba(255,183,201,.85)'; g.beginPath(); g.ellipse(0, 0, 7 * o.s, 4.5 * o.s, 0, 0, 7); g.fill();
        g.restore();
      } else if (m === 'snow') {
        g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(o.x, o.y, 2.6 * o.s, 0, 7); g.fill();
      } else {
        const a = m === 'fireflies' ? 0.35 + 0.65 * Math.max(0, Math.sin(o.t * 2.2)) : 0.25 + 0.2 * Math.sin(o.t);
        const r = m === 'fireflies' ? 9 * o.s : 3 * o.s;
        const gr = g.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
        gr.addColorStop(0, m === 'fireflies' ? `rgba(255,240,150,${a})` : `rgba(255,230,180,${a})`); gr.addColorStop(1, 'rgba(255,220,120,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, r, 0, 7); g.fill();
      }
    }
    requestAnimationFrame((t) => this._loop(t));
  }
}
