// App bootstrap: screens, input, game loop, save/progression, ads.
import { CG } from './cg.js';
import { Audio } from './audio.js';
import { loadImages, IMG } from './assets.js';
import { Renderer, TS } from './render.js';
import { Game, fmt } from './sim.js';
import { NIGHTS, ENDLESS, BOSSES, PERKS, SKINS, BUILD_ORDER, BUILDINGS } from './data.js';
import { roomAt } from './map.js';
import { HUD } from './ui.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_SAVE = { v: 1, stars: {}, medals: 0, perks: {}, skin: 's0', music: true, sfx: true, shake: true, tutDone: false, bestEndless: 0, nightsPlayed: 0, lastNight: 1 };
const ENDLESS_UNLOCK = 6;

const App = {
  save: null, game: null, renderer: null, hud: null,
  paused: false, speed: 1, screen: 'loading', nightIdx: 0,
  lastAdTime: 0, sessionNights: 0, resultsShown: false, endTimer: 0,
  pointers: new Map(), drag: null, pinch: null,

  async boot() {
    CG.loadingStart();
    const sdkP = CG.init().catch(() => {});
    this.renderer = new Renderer($('game'));
    this.renderer.resize();
    this.hud = new HUD(this);
    await Promise.all([loadImages((f) => { $('load-fill').style.width = Math.round(f * 100) + '%'; }), sdkP]);
    try { await document.fonts.load('20px "Lilita One"'); } catch (e) { /* noop */ }
    const saved = await CG.load();
    this.save = Object.assign({}, DEFAULT_SAVE, saved || {});
    if (CG.sdkMuted) Audio.sdkMuted = true;
    CG.onMuteChange = (m) => { Audio.sdkMuted = m; Audio.applyMute(); };
    CG.onAdStart = () => { this.adPause = true; Audio.adMuted = true; Audio.applyMute(); CG.gameplayStop(); };
    CG.onAdEnd = () => { this.adPause = false; Audio.adMuted = false; Audio.applyMute(); if (this.screen === 'game' && !this.paused) CG.gameplayStart(); };
    Audio.musicOn = this.save.music; Audio.sfxOn = this.save.sfx; this.renderer.noShake = !this.save.shake;
    CG.loadingStop();
    this.bindUI();
    this.bindInput();
    window.addEventListener('resize', () => { this.renderer.resize(); this.hud.layout(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.screen === 'game' && !this.paused && this.game && !this.isOver()) this.pause(); });
    this.showTitle();
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    window.__app = this; // for automated tests
  },

  persist() { CG.save(this.save); },

  // ---------------------------------------------------------------- screens
  show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
    this.screen = id || 'game';
  },
  showTitle() {
    this.show('title');
    $('hud').classList.add('hidden');
    this.game = null; this.renderer.g = null;
    this.updateBadges();
    CG.gameplayStop();
  },
  updateBadges() {
    const affordable = PERKS.some((p) => (this.save.perks[p.id] || 0) < p.max && this.save.medals >= p.cost(this.save.perks[p.id] || 0));
    const b = $('medal-badge'); b.textContent = this.save.medals; b.classList.toggle('zero', !affordable);
  },
  totalStars() { return Object.values(this.save.stars).reduce((a, b) => a + b, 0); },
  nightUnlocked(n) { return n === 1 || (this.save.stars[n - 1] || 0) >= 1; },
  endlessUnlocked() { return (this.save.stars[ENDLESS_UNLOCK] || 0) >= 1; },
  nextNightIndex() {
    for (let i = 0; i < NIGHTS.length; i++) if (!this.save.stars[NIGHTS[i].n]) return i;
    return NIGHTS.length - 1;
  },

  showNights() {
    const grid = $('night-grid'); grid.innerHTML = '';
    $('stars-total').textContent = this.totalStars();
    const cur = this.nextNightIndex();
    NIGHTS.forEach((N, i) => {
      const el = document.createElement('button');
      const un = this.nightUnlocked(N.n), st = this.save.stars[N.n] || 0;
      el.className = 'night' + (un ? '' : ' locked') + (i === cur ? ' current' : '');
      el.innerHTML = `<div>Night ${N.n}</div><img class="b" src="assets/img/${BOSSES[N.boss].sprite}.png" alt=""><div class="nm">${BOSSES[N.boss].name}</div><div class="st">${[1, 2, 3].map((k) => `<img src="assets/img/i_star.png" class="${st >= k ? '' : 'off'}" alt="">`).join('')}</div>`;
      el.onclick = () => { if (!un) { this.toast('Survive the previous night to unlock'); Audio.play('error'); return; } Audio.play('click'); this.startNight(i); };
      grid.appendChild(el);
    });
    const e = document.createElement('button');
    const eu = this.endlessUnlocked();
    e.className = 'night endless' + (eu ? '' : ' locked');
    e.innerHTML = `<div>Endless</div><img class="b" src="assets/img/boss_abom.png" alt=""><div class="nm">Best: ${eu ? this.save.bestEndless + ' waves' : 'Clear Night ' + ENDLESS_UNLOCK}</div><div class="st">&nbsp;</div>`;
    e.onclick = () => { if (!eu) { this.toast(`Survive Night ${ENDLESS_UNLOCK} to unlock`); Audio.play('error'); return; } Audio.play('click'); this.startNight(-1); };
    grid.appendChild(e);
    this.show('nights');
  },

  showPerks() {
    const list = $('perk-list'); list.innerHTML = '';
    $('medals-total').textContent = this.save.medals;
    for (const P of PERKS) {
      const lvl = this.save.perks[P.id] || 0, max = lvl >= P.max, cost = P.cost(lvl);
      const el = document.createElement('div'); el.className = 'perk';
      el.innerHTML = `<div class="pi"><div class="pn">${P.name}</div><div class="pd">${P.desc} per level</div><div class="pips">${Array.from({ length: P.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</div></div>`;
      const b = document.createElement('button'); b.className = 'btn' + (max || this.save.medals < cost ? ' off' : '');
      b.innerHTML = max ? 'MAX' : `<img src="assets/img/i_medal.png" alt="">${cost}`;
      b.onclick = () => {
        if (max || this.save.medals < cost) return;
        this.save.medals -= cost; this.save.perks[P.id] = lvl + 1; this.persist();
        Audio.play('upgrade'); this.showPerks(); this.updateBadges();
      };
      el.appendChild(b); list.appendChild(el);
    }
    this.show('perks');
  },

  showSkins() {
    const grid = $('skin-grid'); grid.innerHTML = '';
    const stars = this.totalStars();
    for (const S of SKINS) {
      const un = stars >= S.stars;
      const el = document.createElement('button');
      el.className = 'skin' + (this.save.skin === S.id ? ' sel' : '') + (un ? '' : ' locked');
      el.innerHTML = `<img class="p" src="assets/img/${S.id}.png" alt=""><div>${S.name}</div>${un ? (this.save.skin === S.id ? '<div class="req">Selected</div>' : '<div class="req">Tap to pick</div>') : `<div class="req"><img src="assets/img/i_star.png" alt="">${S.stars}</div>`}`;
      el.onclick = () => { if (!un) { Audio.play('error'); this.toast(`Collect ${S.stars} stars to unlock ${S.name}`); return; } this.save.skin = S.id; this.persist(); Audio.play('click'); this.showSkins(); };
      grid.appendChild(el);
    }
    this.show('skins');
  },

  showSettings(back) {
    $('set-music').checked = this.save.music; $('set-sfx').checked = this.save.sfx; $('set-shake').checked = this.save.shake;
    this.settingsBack = back || 'title';
    this.show('settings');
  },

  // ---------------------------------------------------------------- game flow
  async startNight(idx, skipAd) {
    // midgame ad between nights (never on the first night of a session, max every 3 minutes)
    if (!skipAd && this.sessionNights > 0 && performance.now() - this.lastAdTime > 180000) {
      this.lastAdTime = performance.now();
      await CG.requestAd('midgame');
    }
    this.nightIdx = idx;
    const night = idx < 0 ? ENDLESS : NIGHTS[idx];
    const B = BOSSES[night.boss];
    $('intro-night').textContent = idx < 0 ? 'Endless Mode' : `Night ${night.n}`;
    $('intro-boss').src = `assets/img/${B.sprite}.png`;
    $('intro-name').textContent = idx < 0 ? 'The Endless Horde' : B.name;
    $('intro-desc').textContent = idx < 0 ? 'Bosses keep coming, each one stronger. How many waves can you hold?' : B.desc;
    const newB = idx < 0 ? null : BUILD_ORDER.filter((t) => BUILDINGS[t].unlock === night.n).map((t) => BUILDINGS[t].name);
    $('intro-unlock').textContent = newB && newB.length ? 'New: ' + newB.join(' & ') + '!' : '';
    this.prepareGame(night);
    this.show('intro');
    $('hud').classList.add('hidden');
  },

  prepareGame(night) {
    const tutorial = night.n === 1 && !this.save.tutDone;
    this.game = new Game({ night, perks: this.save.perks, skin: this.save.skin, tutorial, rushTime: tutorial ? 40 : undefined });
    this.renderer.setGame(this.game);
    this.hud.reset(this.game, tutorial);
    this.portraitCam();
    this.resultsShown = false; this.endTimer = 0; this.speed = 1; this.userPanned = false; $('btn-speed').textContent = 'x1';
  },

  beginPlay() {
    Audio.unlock();
    this.show(null);
    $('hud').classList.remove('hidden');
    this.hud.layout();
    this.paused = false;
    Audio.startMusic();
    CG.gameplayStart();
    this.sessionNights++;
    this.save.nightsPlayed++;
    this.hud.banner(this.game.endless ? 'ENDLESS!' : 'GRAB A ROOM!', 'Before the timer runs out', 2.2);
    Audio.play('alarm');
  },

  pause() {
    if (!this.game || this.isOver()) return;
    this.paused = true; CG.gameplayStop();
    $('pause-music').checked = this.save.music; $('pause-sfx').checked = this.save.sfx;
    this.show('pause');
  },
  resume() { this.paused = false; this.show(null); CG.gameplayStart(); },
  isOver() { return this.game && (this.game.phase === 'won' || this.game.phase === 'lost'); },

  frame(dt) {
    const g = this.game, R = this.renderer;
    if (g && this.screen === 'game' && !this.paused && !this.adPause) {
      const sdt = dt * this.speed;
      const steps = Math.ceil(sdt / (1 / 60));
      for (let i = 0; i < steps; i++) g.tick(sdt / steps);
      this.processEvents();
      if (this.isOver()) {
        this.endTimer += dt;
        if (!this.resultsShown && this.endTimer > (g.phase === 'won' ? 2.6 : 1.4)) this.onGameOver();
      }
    } else if (g && this.screen === 'intro') {
      g.events.length = 0;
    }
    if (g) {
      // zoomed-in camera follows the player while they run for a room (until the user pans manually)
      const pl = g.player;
      if (!this.userPanned && (pl.state === 'corridor' || pl.state === 'entering') && R.cam.z > R.cam.fit * 1.15 && R.cam.tz == null) {
        const k = Math.min(1, dt * 3);
        R.cam.x += (pl.x * TS - R.cam.x) * k; R.cam.y += (pl.y * TS - R.cam.y) * k; R.clampCam();
      }
      R.update(this.paused || this.adPause ? 0 : dt); this.hud.update(dt);
      this.hoverT = (this.hoverT || 0) + dt;
      if (this.mouse && this.hoverT > 0.2 && this.pointers.size === 0) { this.hoverT = 0; this.onHover(this.mouse.x, this.mouse.y); }
    }
    R.draw();
  },

  processEvents() {
    const g = this.game, R = this.renderer, hud = this.hud;
    const pr = g.player.room;
    for (const ev of g.events) {
      R.onEvent(ev);
      hud.onEvent(ev);
      const near = (x, y) => !pr || Math.hypot(x - (pr.x + pr.w / 2), y - (pr.y + pr.h / 2)) < 9;
      switch (ev.type) {
        case 'shoot': if (ev.player) Audio.play(ev.type === 'shoot' && ev.b.type === 'bow' ? 'bolt' : 'nail', 0.8); break;
        case 'zap': if (near(ev.x, ev.y)) Audio.play('zap', ev.b.room === pr ? 1 : 0.4); break;
        case 'doorHit': Audio.play(ev.player ? 'doorHit' : 'doorHitFar', near(ev.x, ev.y) ? 1 : 0.5); break;
        case 'doorBreak': Audio.play('doorBreak', ev.player ? 1 : 0.6); break;
        case 'repair': if (ev.s && ev.s.isPlayer) Audio.play('repair'); break;
        case 'upgrade': if (ev.s && ev.s.isPlayer) Audio.play('upgrade'); break;
        case 'build': if (ev.s && ev.s.isPlayer) Audio.play('build'); break;
        case 'sell': if (ev.s.isPlayer) Audio.play('sell'); break;
        case 'coins': if (ev.s.isPlayer) Audio.play('coin'); break;
        case 'bossWake': Audio.play('roar'); Audio.play('alarm'); break;
        case 'bossLevel': Audio.play('roar', 0.6); break;
        case 'howl': Audio.play('howl'); break;
        case 'acid': Audio.play('acid', near(ev.x, ev.y) ? 1 : 0.3); break;
        case 'kill': Audio.play(ev.e.kind === 'boss' ? 'bossDie' : 'kill', near(ev.x, ev.y) ? 1 : 0.4); break;
        case 'death': Audio.play('death', 0.6); break;
        case 'claim': Audio.play('door_close', ev.s.isPlayer ? 1 : 0.3); break;
        case 'lie': if (ev.s.isPlayer) Audio.play('lie'); break;
        case 'win': Audio.play('win'); CG.happytime(); break;
        case 'lose': Audio.play('lose'); break;
        case 'chargeHit': Audio.play('doorHit', 1); break;
      }
    }
    g.events.length = 0;
    const under = pr && pr.hitT < 2;
    Audio.setIntensity(!!under);
  },

  onGameOver() {
    const g = this.game;
    this.resultsShown = true;
    CG.gameplayStop();
    if (g.phase === 'lost' && !g.continueUsed && g.player.room && g.lostReason.includes('door')) {
      this.show('continue');
      return;
    }
    this.showResults();
  },

  showResults() {
    const g = this.game, r = g.results();
    const night = g.night;
    let medals = 0;
    if (g.endless) {
      medals = Math.floor(r.time / 30) + (r.wave - 1) * 4;
      if (r.wave - 1 > this.save.bestEndless) this.save.bestEndless = r.wave - 1;
    } else if (r.won) {
      const prev = this.save.stars[night.n] || 0;
      medals = 2 + r.stars * 2 + (prev === 0 ? 4 : 0);
      if (r.stars > prev) this.save.stars[night.n] = r.stars;
      if (night.n === 1) this.save.tutDone = true;
    } else {
      medals = r.time > 60 ? 1 : 0;
    }
    this.save.medals += medals;
    this.persist();
    this.lastMedals = medals; this.doubled = false;
    $('res-title').textContent = g.endless ? 'The horde got you!' : r.won ? (r.killed ? 'BOSS DOWN!' : 'You saw the dawn!') : 'Overrun!';
    $('res-title').className = r.won || g.endless ? '' : 'red';
    $('res-sub').textContent = g.endless ? `Waves survived: ${r.wave - 1}  ·  Best: ${this.save.bestEndless}` : r.won ? (r.stars < 3 ? (r.stars < 2 ? 'Tip: keep 4+ survivors alive for ★★, kill the boss for ★★★' : 'Kill the boss for ★★★') : 'Perfect night!') : (r.reason || 'Your door was broken.');
    const stars = $('res-stars').children;
    for (let i = 0; i < 3; i++) {
      stars[i].classList.remove('on');
      if (i < r.stars) setTimeout(() => { stars[i].classList.add('on'); Audio.play('star'); }, 400 + i * 350);
    }
    $('res-stars').style.display = g.endless ? 'none' : 'flex';
    const t = Math.floor(r.time);
    $('res-stats').innerHTML = [
      ['Time survived', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`],
      ['Scrap earned', fmt(r.earned)],
      ['Survivors alive', `${r.alive}/${g.survivors.length}`],
      ['Boss level', r.bossLvl],
      ['Zombies defeated', r.minions + (r.killed ? 1 : 0)],
    ].map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
    $('res-medal-n').textContent = '+' + medals;
    $('btn-double').classList.toggle('hidden', medals <= 0);
    $('btn-double').classList.remove('off');
    const hasNext = !g.endless && this.nightIdx < NIGHTS.length - 1 && this.nightUnlocked(NIGHTS[this.nightIdx + 1].n);
    $('btn-next').classList.toggle('hidden', !hasNext);
    $('btn-retry').textContent = r.won ? 'Replay' : 'Retry';
    this.show('results');
    this.updateBadges();
  },

  // ---------------------------------------------------------------- rewarded ads
  async rewarded(kind) {
    const g = this.game;
    const ok = await CG.requestAd('rewarded');
    if (!ok) { this.toast('Ad not available right now', 'bad'); return false; }
    if (kind === 'scrap' && g) { const n = g.adScrapAmount(); g.adScrapUses++; g.grantScrap(g.player, n); Audio.play('upgrade'); }
    if (kind === 'repair' && g) { g.adRepairUsed = true; g.fullRepair(g.player); Audio.play('repair'); }
    if (kind === 'continue' && g) {
      if (g.continueAfterLoss()) { this.resultsShown = false; this.endTimer = 0; this.show(null); CG.gameplayStart(); this.hud.banner('BACK IN THE FIGHT!', 'Door rebuilt', 1.6); }
    }
    if (kind === 'double') {
      this.save.medals += this.lastMedals; this.persist();
      $('res-medal-n').textContent = '+' + this.lastMedals * 2; $('btn-double').classList.add('off');
      Audio.play('upgrade'); this.updateBadges();
    }
    return true;
  },

  toast(text, cls) { this.hud.toast(text, cls); },

  // ---------------------------------------------------------------- UI bindings
  bindUI() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { Audio.unlock(); Audio.play('click'); fn(e); });
    click('btn-play', () => {
      if (!this.save.tutDone) this.startNight(0, true);
      else this.startNight(this.nextNightIndex());
    });
    click('btn-nights', () => this.showNights());
    click('btn-perks', () => this.showPerks());
    click('btn-skins', () => this.showSkins());
    click('btn-settings', () => this.showSettings('title'));
    click('btn-how', () => this.show('how'));
    document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => {
      Audio.play('click');
      if (b.closest('#settings') && this.settingsBack === 'pause') this.show('pause');
      else this.show('title');
    }));
    const setMusic = (v) => { this.save.music = v; Audio.musicOn = v; Audio.applyMute(); this.persist(); };
    const setSfx = (v) => { this.save.sfx = v; Audio.sfxOn = v; Audio.applyMute(); this.persist(); };
    $('set-music').onchange = (e) => setMusic(e.target.checked);
    $('set-sfx').onchange = (e) => setSfx(e.target.checked);
    $('set-shake').onchange = (e) => { this.save.shake = e.target.checked; this.renderer.noShake = !e.target.checked; this.persist(); };
    $('pause-music').onchange = (e) => setMusic(e.target.checked);
    $('pause-sfx').onchange = (e) => setSfx(e.target.checked);
    click('btn-reset', () => {
      if (!confirm('Reset all progress? This cannot be undone.')) return;
      const keep = { music: this.save.music, sfx: this.save.sfx };
      this.save = Object.assign({}, DEFAULT_SAVE, keep, { stars: {}, perks: {} });
      this.persist(); this.toast('Progress reset'); this.showTitle();
    });
    click('btn-start', () => this.beginPlay());
    click('btn-pause', () => this.pause());
    click('btn-resume', () => this.resume());
    click('btn-restart', () => { this.startNight(this.nightIdx, true); });
    click('btn-quit', () => { Audio.stopMusic(); this.showTitle(); });
    click('btn-speed', () => { this.speed = this.speed === 1 ? 2 : 1; $('btn-speed').textContent = 'x' + this.speed; });
    click('btn-zoom', () => this.toggleZoom());
    click('btn-continue', () => this.rewarded('continue'));
    click('btn-giveup', () => this.showResults());
    click('btn-double', () => this.rewarded('double'));
    click('btn-res-menu', () => { Audio.stopMusic(); this.showTitle(); });
    click('btn-retry', () => this.startNight(this.nightIdx));
    click('btn-next', () => this.startNight(this.nightIdx + 1));
  },

  // On tall/narrow screens the whole floor is tiny: start zoomed in on the player (drag to pan).
  portraitCam() {
    const R = this.renderer, g = this.game;
    requestAnimationFrame(() => {
      if (!g) return;
      let z;
      if (R.vw / R.vh <= 1.25) z = Math.min(R.cam.fit * 2.3, (R.vh - R.insets.top - R.insets.bottom) / (TS * 11));
      else if (R.cam.fit * TS < 24) z = 26 / TS; // tiny tiles on short landscape screens
      else return;
      R.cam.z = Math.max(R.cam.fit, z); R.cam.x = g.player.x * TS; R.cam.y = 8.5 * TS; R.cam.tz = null; R.clampCam();
    });
  },

  toggleZoom() {
    const R = this.renderer, g = this.game; if (!g) return;
    if (R.cam.z > R.cam.fit * 1.15 || !g.player.room) R.fitCamera(false);
    else R.focusRoom(g.player.room);
  },

  // ---------------------------------------------------------------- input
  bindInput() {
    const cv = $('game');
    cv.addEventListener('pointerdown', (e) => {
      Audio.unlock();
      cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, button: e.button });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) { this.onHover(e.clientX, e.clientY); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.renderer.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinch.d);
        this.pinch.d = d; p.moved = true;
        return;
      }
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8) p.moved = true;
      if (p.moved && this.game) { this.userPanned = true; this.renderer.pan(dx, dy); cv.classList.add('grab'); this.hud.closeMenus(); }
      else this.onHover(e.clientX, e.clientY);
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      cv.classList.remove('grab');
      if (p && !p.moved && p.button === 0 && this.pointers.size === 0) this.onClick(e.clientX, e.clientY);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', (e) => { this.pointers.delete(e.pointerId); this.pinch = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); if (this.game) this.renderer.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerleave', () => { this.mouse = null; this.renderer.hover = null; this.hud.hideTip(); });
    const keys = new Set();
    const moveKeys = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
    const applyMove = () => {
      const g = this.game; if (!g) return;
      let vx = 0, vy = 0;
      for (const k of keys) if (moveKeys[k]) { vx += moveKeys[k][0]; vy += moveKeys[k][1]; }
      const l = Math.hypot(vx, vy) || 1;
      g.player.vx = vx / l; g.player.vy = vy / l;
      if (vx || vy) { g.player.path = []; g.player.targetRoom = null; }
    };
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (this.screen !== 'game' || !this.game) {
        if ((k === 'escape' || k === 'p') && this.screen === 'pause') this.resume();
        return;
      }
      if (moveKeys[k]) { keys.add(k); applyMove(); e.preventDefault(); return; }
      if (k === 'escape') { if (this.hud.menuOpen()) this.hud.closeMenus(); else this.pause(); return; }
      if (k === 'p') { this.pause(); return; }
      if (e.repeat) return;
      this.hud.hotkey(k);
    });
    window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (keys.delete(k)) applyMove(); });
    window.addEventListener('blur', () => { keys.clear(); applyMove(); });
  },

  onHover(sx, sy) {
    const g = this.game; this.mouse = { x: sx, y: sy };
    if (!g || this.screen !== 'game') return;
    const w = this.renderer.screenToWorld(sx, sy);
    const tx = Math.floor(w.x), ty = Math.floor(w.y);
    this.renderer.hover = { tx, ty };
    const p = g.player;
    let pointer = false;
    this.renderer.hoverRoom = null;
    if (p.state === 'corridor') {
      const r = roomAt(g.map, w.x, w.y);
      if (r && !r.owner) { pointer = true; this.renderer.hoverRoom = r; }
    } else if (p.room && p.state === 'inroom') {
      const r = roomAt(g.map, w.x, w.y);
      if (r === p.room) pointer = true;
    }
    $('game').classList.toggle('pointer', pointer);
    this.hud.hoverWorld(w, sx, sy);
  },

  onClick(sx, sy) {
    const g = this.game; if (!g || this.screen !== 'game' || this.isOver()) return;
    const w = this.renderer.screenToWorld(sx, sy);
    const p = g.player;
    if (p.state === 'corridor') {
      const r = roomAt(g.map, w.x, w.y);
      if (r && !r.owner) { if (g.goToRoom(p, r)) Audio.play('click'); }
      else if (r && r.owner) { this.toast(`${r.owner.isPlayer ? 'Your' : r.owner.name + "'s"} room is taken!`, 'bad'); Audio.play('error'); }
      else { g.moveTo(p, w.x, w.y); }
      return;
    }
    this.hud.clickWorld(w, sx, sy);
  },
};

window.addEventListener('load', () => App.boot());
export default App;
