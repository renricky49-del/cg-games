// DOM menus & meta screens
import { HEROES, HERO_BY_ID, RIVALS, MAPS, MAP_BY_ID, ITEMS, ITEM_BY_ID, ITEM_PRICES, RARITIES, WEAPON_BASES, LOADOUT, UNITS, xpForLevel, DAILY_BUFFS } from './data.js';
import { P, saveProfile, unlockedHeroIds, mapUnlocked, dailyInfo, refreshShop, REROLL_COST, equippedWeapons, resetProfile, rolloverDaily } from './save.js';
import { stripCss } from './assets.js';
import { Audio } from './audio.js';
import { CG } from './cg.js';

const $ = s => document.querySelector(s);
const root = () => $('#ui');
let api = null; // callbacks into main
export function initUI(a) { api = a; }

function h(html) { root().innerHTML = html; bindSounds(root()); }
function bindSounds(el) {
  el.querySelectorAll('button, .clickable').forEach(b => {
    b.addEventListener('pointerenter', () => Audio.play('hover'));
    b.addEventListener('click', () => { Audio.unlock(); Audio.play('click'); });
  });
}
function rarityOf(id) { return RARITIES.find(r => r.id === id) || RARITIES[0]; }
function topBar(title, back = 'hub') {
  const need = xpForLevel(P.level);
  return `<div class="topbar">
    ${back ? `<button class="btn small ghost" data-go="${back}">◀ Back</button>` : '<span></span>'}
    <div class="tb-title">${title}</div>
    <div class="tb-stats">
      <div class="lvl" title="Player level"><b>Lv ${P.level}</b><div class="xpbar"><i style="width:${Math.min(100, P.xp / need * 100)}%"></i></div></div>
      <div class="coins" title="Coins">🪙 <b>${P.coins}</b></div>
    </div></div>`;
}
function wireGo() { root().querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go))); }
export function toast(msg, ms = 1800) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg; $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
}
export function modal(html, cls = '') {
  const m = document.createElement('div'); m.className = 'modal-bg'; m.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  $('#modals').appendChild(m); bindSounds(m);
  return { el: m, close: () => m.remove() };
}

export function show(name, arg) {
  rolloverDaily();
  root().className = 'screen-' + name;
  root().style.display = '';
  api.onScreen(name);
  ({ title, hub, ladder, daily, prematch, shop, armory, spellbook, settings, quick }[name] || hub)(arg);
}
export function hideUI() { root().style.display = 'none'; root().innerHTML = ''; }

// ---------------- title ----------------
function title() {
  h(`<div class="title-screen">
      <div class="title-bg"></div>
      <div class="logo"><span class="l1">LETTER</span><span class="l2">LEGION</span></div>
      <div class="tagline">Summon letters · Merge them · <b>Spell heroes</b> · Defend Prince Pip!</div>
      <div class="title-btns">
        <button class="btn big gold" id="play">${P.tutorialDone ? 'PLAY' : 'START TUTORIAL'}</button>
        <button class="btn" data-go="settings">Settings</button>
      </div>
      <div class="foot">v1.0 · Rivals are computer-controlled (CPU)</div>
    </div>`);
  $('#play').onclick = () => { if (!P.tutorialDone) api.startTutorial(); else show('hub'); };
  wireGo();
}

// ---------------- hub ----------------
function rivalAvatar(r, px = 64) { return `<div class="avatar" style="${stripCss('rivals', r.portrait, px)}"></div>`; }
function hub() {
  const next = RIVALS[Math.min(P.ladder, RIVALS.length - 1)];
  const done = P.ladder >= RIVALS.length;
  const d = dailyInfo();
  h(`${topBar('Letter Legion', 'title')}
    <div class="hub">
      <div class="card campaign">
        <div class="card-h">⚔ Rival Ladder <span class="muted">${Math.min(P.ladder, RIVALS.length)}/${RIVALS.length} beaten</span></div>
        <div class="rival-row">${rivalAvatar(next, 88)}
          <div><div class="rname">${done ? 'Ladder complete!' : next.name}</div>
          <div class="muted">${done ? 'Rematch any rival for rewards' : `CPU · ${next.tier} · ${MAP_BY_ID[next.map].name}`}</div>
          <div class="quote">“${next.quote}”</div></div></div>
        <div class="row"><button class="btn gold" id="fight">${done ? 'Rematch' : 'FIGHT'}</button><button class="btn small" data-go="ladder">View ladder</button></div>
      </div>
      <div class="card daily">
        <div class="card-h">☀ Daily Duel <span class="muted">${d.key}</span></div>
        <div class="map-thumb" style="background-image:url(assets/img/map_${d.map.id}.webp)"><span>${d.map.name}</span></div>
        <div class="buff">✨ <b>${d.buff.name}</b> — ${d.buff.desc}</div>
        <div class="muted">Today's best: <b>${P.daily.best || '—'}</b> · wins today: ${P.daily.wins}</div>
        <div class="row"><button class="btn green" id="dailyGo">Play daily</button><button class="btn small" data-go="daily">Board</button></div>
      </div>
      <div class="card quick">
        <div class="card-h">🎲 Quick Battle</div>
        <div class="muted">Any unlocked map against any rival you have met.</div>
        <div class="qmaps">${MAPS.map(m => mapUnlocked(m.id) ? `<div class="qmap clickable" data-qm="${m.id}" style="background-image:url(assets/img/map_${m.id}.webp)"><span>${m.name}</span><small>♥${m.lives} · ${m.waves}w</small></div>` : `<div class="qmap locked"><span>🔒 ${m.name}</span></div>`).join('')}</div>
      </div>
      <div class="card roster">
        <div class="card-h">⭐ Level rewards <span class="muted">Lv ${P.level} · ${P.xp}/${xpForLevel(P.level)} XP</span></div>
        <div class="xpbig"><i style="width:${Math.min(100, P.xp / xpForLevel(P.level) * 100)}%"></i></div>
        <div class="unlocks">${HEROES.map(hh => { const got = hh.unlock <= P.level; const next = !got && HEROES.filter(x => x.unlock > P.level)[0] === hh;
          return `<div class="unl ${got ? 'got' : ''} ${next ? 'next' : ''}" title="${hh.word}: ${hh.skill}"><div style="${stripCss('heroes_full', hh.portrait, 64)}"></div><b>${hh.word}</b><small>${got ? '✔' : 'Lv ' + hh.unlock}</small></div>`; }).join('')}</div>
        ${(() => { const nx = HEROES.find(x => x.unlock > P.level); return nx ? `<div class="nextunlock">Next hero at <b>level ${nx.unlock}</b>: <b style="color:${nx.color}">${nx.word}</b> — ${nx.skillDesc}</div>` : '<div class="nextunlock">All heroes unlocked! Collect Legendary weapons to max them out.</div>'; })()}
      </div>
      <div class="card stats">
        <div class="card-h">📜 Your legend</div>
        <div class="statgrid">
          <div><b>${P.stats.matches}</b><span>battles</span></div><div><b>${P.stats.wins}</b><span>victories</span></div>
          <div><b>${P.stats.heroes}</b><span>heroes spelled</span></div><div><b>${P.stats.kills}</b><span>foes defeated</span></div>
          <div><b>${P.weapons.length}</b><span>weapons</span></div><div><b>${Object.keys(P.bests).length}/4</b><span>maps conquered</span></div>
        </div>
        <div class="feat">${(() => { const eqw = equippedWeapons(); const ids = Object.keys(eqw); const hid = ids.length ? ids[0] : unlockedHeroIds()[0]; const hh = HERO_BY_ID[hid]; return `<div style="${stripCss('heroes_full', hh.portrait, 72)}"></div><div><div class="muted small">Featured hero</div><b style="color:${hh.color}">${hh.word}</b> · ${hh.title}<div class="small">${eqw[hid] ? '⚒ ' + eqw[hid].name : hh.skill}</div></div>`; })()}</div>
      </div>
    </div>
    <div class="navbar">
      <button class="nav" data-go="shop">🛒<span>Shop</span></button>
      <button class="nav" data-go="armory">⚒<span>Armory</span></button>
      <button class="nav" data-go="spellbook">📖<span>Spellbook</span></button>
      <button class="nav" id="tut">🎓<span>Tutorial</span></button>
      <button class="nav" data-go="settings">⚙<span>Settings</span></button>
    </div>`);
  wireGo();
  $('#fight').onclick = () => show('prematch', { mode: 'ladder', rivalIndex: Math.min(P.ladder, RIVALS.length - 1) });
  $('#dailyGo').onclick = () => show('prematch', { mode: 'daily' });
  $('#tut').onclick = () => api.startTutorial();
  root().querySelectorAll('[data-qm]').forEach(e => e.onclick = () => show('quick', e.dataset.qm));
}

// ---------------- ladder ----------------
function ladder() {
  h(`${topBar('Rival Ladder')}
    <div class="list">${RIVALS.map((r, i) => {
      const st = i < P.ladder ? 'beaten' : i === P.ladder ? 'next' : 'locked';
      return `<div class="list-item ${st}">${rivalAvatar(r, 64)}
        <div class="li-main"><div class="rname">${i + 1}. ${r.name} <span class="tier t-${r.tier.toLowerCase()}">${r.tier}</span></div>
        <div class="muted">CPU · ${MAP_BY_ID[r.map].name} · strength ${Math.round(r.power * 100)}% · spells ${r.spell ? 'up to ' + r.spell + ' letters' : 'nothing'}</div>
        <div class="quote">“${r.quote}”</div></div>
        <div>${st === 'locked' ? '<span class="lock">🔒</span>' : `<button class="btn ${st === 'next' ? 'gold' : ''} small" data-fight="${i}">${st === 'next' ? 'Fight' : 'Rematch'}</button>`}</div></div>`;
    }).join('')}</div>`);
  wireGo();
  root().querySelectorAll('[data-fight]').forEach(b => b.onclick = () => show('prematch', { mode: 'ladder', rivalIndex: +b.dataset.fight }));
}

// ---------------- quick ----------------
function quick(pre) {
  const maps = MAPS.filter(m => mapUnlocked(m.id));
  const rivals = RIVALS.filter((r, i) => i <= Math.min(P.ladder, RIVALS.length - 1));
  let mi = Math.max(0, maps.findIndex(m => m.id === pre)), ri = rivals.length - 1;
  const draw = () => {
    h(`${topBar('Quick Battle')}
      <div class="quick-wrap">
        <div class="section-h">Map</div>
        <div class="pick-row">${maps.map((m, i) => `<div class="map-pick clickable ${i === mi ? 'sel' : ''}" data-m="${i}" style="background-image:url(assets/img/map_${m.id}.webp)"><span>${m.name}<br><small>♥ ${m.lives} · ${m.waves} waves</small></span></div>`).join('')}
          ${MAPS.filter(m => !mapUnlocked(m.id)).map(m => `<div class="map-pick locked"><span>🔒 ${m.name}<br><small>advance the ladder</small></span></div>`).join('')}</div>
        <div class="section-h">Rival</div>
        <div class="pick-row">${rivals.map((r, i) => `<div class="rival-pick clickable ${i === ri ? 'sel' : ''}" data-r="${i}">${rivalAvatar(r, 56)}<span>${r.name}<br><small>${r.tier}</small></span></div>`).join('')}</div>
        <div class="row center"><button class="btn gold big" id="go">Battle!</button></div>
      </div>`);
    wireGo();
    root().querySelectorAll('[data-m]').forEach(e => e.onclick = () => { mi = +e.dataset.m; draw(); });
    root().querySelectorAll('[data-r]').forEach(e => e.onclick = () => { ri = +e.dataset.r; draw(); });
    $('#go').onclick = () => show('prematch', { mode: 'quick', rivalIndex: RIVALS.indexOf(rivals[ri]), mapId: maps[mi].id });
  };
  draw();
}

// ---------------- daily ----------------
function daily() {
  const d = dailyInfo();
  const hist = P.daily.history;
  const pb = Object.entries(P.bests).map(([k, v]) => `<div class="pb"><b>${MAP_BY_ID[k]?.name || k}</b><span>${v}</span></div>`).join('') || '<div class="muted">No records yet.</div>';
  h(`${topBar('Daily Duel')}
    <div class="daily-wrap">
      <div class="card">
        <div class="card-h">Today · ${d.key}</div>
        <div class="map-thumb big" style="background-image:url(assets/img/map_${d.map.id}.webp)"><span>${d.map.name}</span></div>
        <div class="buff">✨ <b>${d.buff.name}</b> — ${d.buff.desc}</div>
        <div class="muted">Rival of the day: <b>${d.rival.name}</b> (CPU). Same map, seed and buff for the whole day — beat your own best score. Your first 3 daily wins pay +50% coins.</div>
        <div class="big-score">Today's best: <b>${P.daily.best || '—'}</b></div>
        <button class="btn green big" id="go">Play Daily Duel</button>
      </div>
      <div class="card">
        <div class="card-h">Your daily board <span class="muted">(local, this device)</span></div>
        <div class="board">${[{ date: d.key + ' (today)', score: P.daily.best, wins: P.daily.wins }, ...hist].map((r, i) => `<div class="brow ${i === 0 ? 'today' : ''}"><span>${r.date}</span><span>${r.score || '—'}</span><span>${r.wins || 0} win${r.wins === 1 ? '' : 's'}</span></div>`).join('')}</div>
        <div class="card-h" style="margin-top:12px">Personal bests per map</div>
        <div class="pbs">${pb}</div>
      </div>
    </div>`);
  wireGo();
  $('#go').onclick = () => show('prematch', { mode: 'daily' });
}

// ---------------- prematch ----------------
function prematch(arg) {
  let rival, map, buff = null, seed;
  const d = dailyInfo();
  if (arg.mode === 'daily') { rival = d.rival; map = d.map; buff = d.buff; seed = d.seed; arg.rivalIndex = RIVALS.indexOf(rival); }
  else { rival = RIVALS[arg.rivalIndex]; map = MAP_BY_ID[arg.mapId || rival.map]; seed = (Date.now() & 0x7fffffff); buff = d.buff; }
  const lo = P.loadout; const eq = equippedWeapons();
  const itemChip = it => { const def = ITEM_BY_ID[it.id]; const r = RARITIES[it.r]; return `<div class="chip" style="border-color:${r.color}" title="${def.name}: ${def.desc(def.vals[it.r])}"><div style="${stripCss('items', def.icon, 34)}"></div><span>${def.name}</span></div>`; };
  h(`${topBar(arg.mode === 'daily' ? 'Daily Duel' : arg.mode === 'quick' ? 'Quick Battle' : 'Ladder Battle', arg.mode === 'daily' ? 'daily' : 'hub')}
    <div class="prematch">
      <div class="vs">
        <div class="vs-side you"><div class="avatar big" style="${stripCss('wards', 0, 150)}"></div><div class="rname">You</div><div class="muted">guarding Prince Pip</div></div>
        <div class="vs-mid">VS</div>
        <div class="vs-side"><div class="avatar big round" style="${stripCss('rivals', rival.portrait, 150)}"></div><div class="rname">${rival.name}</div><div class="muted">CPU · ${rival.tier} · strength ${Math.round(rival.power * 100)}%</div><div class="quote">“${rival.quote}”</div></div>
      </div>
      <div class="pm-info">
        <div class="map-thumb" style="background-image:url(assets/img/map_${map.id}.webp)"><span>${map.name}</span></div>
        <div><div><b>${map.name}</b> — ${map.blurb}</div>
          <div class="muted">♥ ${map.lives} lives · ${map.waves} waves · boss every 5 waves</div>
          <div class="buff">✨ Daily buff: <b>${buff.name}</b> — ${buff.desc}</div>
          <div class="loadout"><span class="muted">Loadout:</span> ${[...lo.active, ...lo.passive].map(itemChip).join('') || '<span class="muted">none — visit the Shop</span>'}</div>
          <div class="loadout"><span class="muted">Weapons:</span> ${Object.values(eq).map(w => `<span class="wtag" style="color:${rarityOf(w.rarity).color}">${w.hero}: ${w.name}</span>`).join(' ') || '<span class="muted">none — win battles for drops</span>'}</div>
        </div>
      </div>
      <div class="row center"><button class="btn gold big" id="go">To battle!</button></div>
      <div class="muted center small">Tip: win by keeping your ward alive longer than the rival, or by having more lives after the final wave.</div>
    </div>`);
  wireGo();
  $('#go').onclick = () => api.startMatch({ mode: arg.mode, rival, rivalIndex: arg.rivalIndex, mapId: map.id, seed, dailyBuff: buff.id });
}

// ---------------- shop ----------------
function shop() {
  if (!P.shop) refreshShop(false);
  const lo = P.loadout;
  const slot = (it, type, i) => {
    if (!it) return `<div class="slot empty">${type}</div>`;
    const def = ITEM_BY_ID[it.id]; const r = RARITIES[it.r];
    return `<div class="slot" style="border-color:${r.color}" title="${def.desc(def.vals[it.r])}"><div style="${stripCss('items', def.icon, 44)}"></div><div class="sl-name" style="color:${r.color}">${def.name}</div><div class="sl-desc">${def.desc(def.vals[it.r])}</div></div>`;
  };
  h(`${topBar('Item Shop')}
    <div class="shop">
      <div class="offers">${P.shop.offers.map((o, i) => { const def = ITEM_BY_ID[o.id]; const r = RARITIES[o.r];
        return `<div class="offer ${o.sold ? 'sold' : ''}" style="--rc:${r.color}">
          <div class="rar" style="color:${r.color}">${r.name}</div>
          <div class="icon" style="${stripCss('items', def.icon, 84)}"></div>
          <div class="oname">${def.name}</div><div class="otype">${def.type === 'active' ? 'ACTIVE · once per match' : 'PASSIVE · always on'}</div>
          <div class="odesc">${def.desc(def.vals[o.r])}</div>
          <button class="btn ${o.sold ? '' : 'gold'} small" data-buy="${i}" ${o.sold || P.coins < o.price ? 'disabled' : ''}>${o.sold ? 'Sold' : '🪙 ' + o.price}</button></div>`; }).join('')}</div>
      <div class="row center"><button class="btn small" id="reroll" ${P.coins < REROLL_COST ? 'disabled' : ''}>↻ Refresh (🪙 ${REROLL_COST})</button><button class="btn small green" id="rerollAd">▶ Free refresh (ad)</button></div>
      <div class="loadout-box">
        <div class="section-h">Your loadout — ${LOADOUT.active} active, ${LOADOUT.passive} passive slots</div>
        <div class="slots">${[0, 1].map(i => slot(lo.active[i], 'Active', i)).join('')}<div class="sep"></div>${[0, 1, 2].map(i => slot(lo.passive[i], 'Passive', i)).join('')}</div>
        <div class="muted small">The shop refreshes after every battle. Buying when slots are full lets you choose an item to discard.</div>
      </div>
    </div>`);
  wireGo();
  root().querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(+b.dataset.buy));
  $('#reroll').onclick = () => { if (P.coins < REROLL_COST) return; P.coins -= REROLL_COST; refreshShop(true); saveProfile(); shop(); };
  $('#rerollAd').onclick = async () => { const ok = await api.rewarded(); if (ok) { refreshShop(true); saveProfile(); shop(); toast('Shop refreshed!'); } else toast('Ad unavailable — try again later'); };
}
function buy(i) {
  const o = P.shop.offers[i]; if (o.sold || P.coins < o.price) return;
  const def = ITEM_BY_ID[o.id]; const key = def.type === 'active' ? 'active' : 'passive';
  const arr = P.loadout[key]; const cap = LOADOUT[key];
  const commit = (replaceIdx) => {
    P.coins -= o.price; o.sold = true;
    const it = { id: o.id, r: o.r };
    if (replaceIdx === undefined) arr.push(it); else arr[replaceIdx] = it;
    saveProfile(); Audio.play('coin'); shop(); toast(`${def.name} added to your loadout`);
  };
  if (arr.length < cap) return commit();
  const m = modal(`<h2>Loadout full</h2><p>Choose a ${key} item to discard for <b>${def.name}</b>:</p>
    <div class="slots">${arr.map((it, k) => { const d2 = ITEM_BY_ID[it.id]; const r = RARITIES[it.r]; return `<button class="slot clickable" data-rep="${k}" style="border-color:${r.color}"><div style="${stripCss('items', d2.icon, 44)}"></div><div class="sl-name" style="color:${r.color}">${d2.name}</div><div class="sl-desc">${d2.desc(d2.vals[it.r])}</div></button>`; }).join('')}</div>
    <div class="row center"><button class="btn small ghost" id="cancel">Cancel</button></div>`);
  m.el.querySelectorAll('[data-rep]').forEach(b => b.onclick = () => { m.close(); commit(+b.dataset.rep); });
  m.el.querySelector('#cancel').onclick = () => m.close();
}

// ---------------- armory ----------------
function armory() {
  const heroes = HEROES.filter(hh => unlockedHeroIds().includes(hh.id));
  const eq = P.equipped;
  const wcard = (w, extra = '') => { const r = rarityOf(w.rarity); return `<div class="weapon clickable ${extra}" data-w="${w.uid}" style="--rc:${r.color}"><div style="${stripCss('weapons', WEAPON_BASES[w.hero].icon, 56)}"></div><div class="wname" style="color:${r.color}">${w.name}</div><div class="muted small">${w.hero} · ${r.name}</div></div>`; };
  h(`${topBar('Armory')}
    <div class="armory">
      <div class="section-h">Equipped (one weapon per hero)</div>
      <div class="hero-slots">${heroes.map(hh => { const w = P.weapons.find(x => x.uid === eq[hh.id]); return `<div class="hslot"><div class="hp" style="${stripCss('heroes', hh.portrait, 64)}"></div><div class="hw">${hh.word}</div>${w ? wcard(w, 'mini') : '<div class="muted small">empty</div>'}</div>`; }).join('')}</div>
      <div class="section-h">Inventory (${P.weapons.length}/40) — click a weapon to equip or sell</div>
      <div class="inv">${P.weapons.length ? P.weapons.slice().sort((a, b) => RARITIES.findIndex(r => r.id === b.rarity) - RARITIES.findIndex(r => r.id === a.rarity)).map(w => wcard(w, Object.values(eq).includes(w.uid) ? 'equipped' : '')).join('') : '<div class="muted">No weapons yet. Win battles to earn weapon drops (white → green → blue → purple → gold).</div>'}</div>
    </div>`);
  wireGo();
  root().querySelectorAll('[data-w]').forEach(e => e.onclick = () => weaponModal(+e.dataset.w));
}
function weaponModal(uid) {
  const w = P.weapons.find(x => x.uid === uid); if (!w) return;
  const r = rarityOf(w.rarity); const base = WEAPON_BASES[w.hero]; const hero = HERO_BY_ID[w.hero];
  const isEq = P.equipped[w.hero] === uid;
  const canSell = r.sell > 0;
  const m = modal(`<div class="wm" style="--rc:${r.color}"><div style="${stripCss('weapons', base.icon, 96)}"></div>
    <h2 style="color:${r.color}">${w.name}</h2><div class="muted">${r.name} weapon for <b>${hero.word}</b> (${hero.title})</div>
    <ul><li>+${Math.round(r.dmg * 100)}% hero damage</li>${r.cd ? `<li>${Math.round(r.cd * 100)}% faster skill</li>` : ''}${r.upgrade ? `<li>★ Skill upgrade: ${base.upgrade}</li>` : ''}</ul>
    <div class="row center">
      ${isEq ? '<button class="btn small" id="uneq">Unequip</button>' : `<button class="btn gold small" id="eq" ${unlockedHeroIds().includes(w.hero) ? '' : 'disabled'}>Equip on ${hero.word}</button>`}
      ${canSell ? `<button class="btn small red" id="sell">Sell 🪙 ${r.sell}</button>` : '<span class="muted small">Epic & Legendary weapons cannot be sold</span>'}
      <button class="btn small ghost" id="close">Close</button></div></div>`);
  const q = s => m.el.querySelector(s);
  q('#close').onclick = () => m.close();
  if (q('#eq')) q('#eq').onclick = () => { P.equipped[w.hero] = uid; saveProfile(); m.close(); armory(); toast(`Equipped on ${hero.word}`); };
  if (q('#uneq')) q('#uneq').onclick = () => { delete P.equipped[w.hero]; saveProfile(); m.close(); armory(); };
  if (q('#sell')) q('#sell').onclick = () => { P.weapons = P.weapons.filter(x => x.uid !== uid); if (P.equipped[w.hero] === uid) delete P.equipped[w.hero]; P.coins += r.sell; Audio.play('coin'); saveProfile(); m.close(); armory(); };
}

// ---------------- spellbook ----------------
export function spellbookHtml() {
  const un = unlockedHeroIds(); const eq = equippedWeapons();
  return `<div class="spellbook">
    <div class="sb-intro">Place <b>golden letters</b> in neighbouring cells of one row, <b>left → right</b>, to spell a hero's name. The letters fuse into the hero and free the other cells. Spell a hero again to level it up (★3 max).</div>
    <div class="sb-grid">${HEROES.map(hh => { const ok = un.includes(hh.id); const w = eq[hh.id];
      return `<div class="sb-card ${ok ? '' : 'locked'}" style="--hc:${hh.color}">
        <div class="sb-por" style="${stripCss('heroes', hh.portrait, 92)}"></div>
        <div class="sb-word">${hh.word.split('').map(c => `<span>${c}</span>`).join('')}</div>
        <div class="sb-title">${hh.title}</div>
        <div class="sb-skill"><b>${hh.skill}</b> — ${hh.skillDesc}</div>
        ${ok ? (w ? `<div class="small" style="color:${rarityOf(w.rarity).color}">⚒ ${w.name}</div>` : '<div class="muted small">no weapon equipped</div>') : `<div class="lockmsg">🔒 Unlocks at player level ${hh.unlock}</div>`}
      </div>`; }).join('')}</div>
    <div class="sb-letters"><div class="section-h">Letter soldiers</div>${Object.values(UNITS).map(u => `<div class="sb-unit"><b style="color:${u.color}">${u.letter}</b> ${u.name} — ${u.desc}</div>`).join('')}
    <div class="sb-unit"><b style="color:#ffd24a">⛏</b> Shovel — dig open a locked cell.</div></div>
  </div>`;
}
function spellbook() { h(`${topBar('Spellbook')}${spellbookHtml()}`); wireGo(); }

// ---------------- settings ----------------
function settings() {
  const s = P.settings;
  h(`${topBar('Settings', P.tutorialDone ? 'hub' : 'title')}
    <div class="settings">
      <label class="toggle"><input type="checkbox" id="music" ${s.music ? 'checked' : ''}><span>Music</span></label>
      <label class="toggle"><input type="checkbox" id="sfx" ${s.sfx ? 'checked' : ''}><span>Sound effects</span></label>
      <label class="toggle"><input type="checkbox" id="fast" ${s.fast ? 'checked' : ''}><span>Start battles at 2× speed</span></label>
      <div class="row"><button class="btn small" id="tut">Replay tutorial</button><button class="btn small red" id="reset">Reset progress</button></div>
      <div class="help card">
        <div class="card-h">How to play</div>
        <ul>
          <li><b>Summon</b> (Space) recruits a random letter into your tray. Every summon costs more Ink.</li>
          <li><b>Drag</b> recruits onto cells (or click a recruit, then a cell). Press 1–3 to auto-place.</li>
          <li><b>Merge</b>: drop a letter on the same letter of the same level → level up.</li>
          <li><b>Spell heroes</b>: golden letters in one row, left → right (e.g. K-I-N-G).</li>
          <li><b>Shovels</b> dig locked cells. <b>Train</b> boosts every letter of a type.</li>
          <li>Drag to the ✖ bin to sell. Q / W use items. F toggles speed. Esc pauses.</li>
        </ul>
      </div>
      <div class="muted small">Fonts: Titan One & Fredoka (SIL Open Font License). All rivals are computer-controlled.</div>
    </div>`);
  wireGo();
  $('#music').onchange = e => { s.music = e.target.checked; Audio.setMusic(s.music); saveProfile(); };
  $('#sfx').onchange = e => { s.sfx = e.target.checked; Audio.setSfx(s.sfx); saveProfile(); };
  $('#fast').onchange = e => { s.fast = e.target.checked; saveProfile(); };
  $('#tut').onclick = () => api.startTutorial();
  $('#reset').onclick = () => {
    const m = modal(`<h2>Reset all progress?</h2><p>Coins, weapons, items and ladder progress will be erased.</p><div class="row center"><button class="btn red" id="yes">Reset</button><button class="btn ghost" id="no">Cancel</button></div>`);
    m.el.querySelector('#yes').onclick = () => { resetProfile(); m.close(); show('title'); };
    m.el.querySelector('#no').onclick = () => m.close();
  };
}

// ---------------- in-match overlays ----------------
export function pauseMenu(onResume, onQuit) {
  const s = P.settings;
  const m = modal(`<h2>Paused</h2>
    <div class="col">
      <button class="btn gold" id="resume">Resume</button>
      <button class="btn" id="book">Spellbook</button>
      <label class="toggle"><input type="checkbox" id="music" ${s.music ? 'checked' : ''}><span>Music</span></label>
      <label class="toggle"><input type="checkbox" id="sfx" ${s.sfx ? 'checked' : ''}><span>Sound effects</span></label>
      <button class="btn red small" id="quit">Forfeit match</button>
    </div>`, 'pause');
  const q = x => m.el.querySelector(x);
  q('#resume').onclick = () => { m.close(); onResume(); };
  q('#book').onclick = () => { const b = modal(`${spellbookHtml()}<div class="row center"><button class="btn" id="cl">Close</button></div>`, 'wide'); b.el.querySelector('#cl').onclick = () => b.close(); };
  q('#music').onchange = e => { s.music = e.target.checked; Audio.setMusic(s.music); saveProfile(); };
  q('#sfx').onchange = e => { s.sfx = e.target.checked; Audio.setSfx(s.sfx); saveProfile(); };
  q('#quit').onclick = () => { m.close(); onQuit(); };
  return m;
}
export function spellbookModal(onClose) {
  const b = modal(`<h2>Spellbook</h2>${spellbookHtml()}<div class="row center"><button class="btn gold" id="cl">Back to battle</button></div>`, 'wide');
  b.el.querySelector('#cl').onclick = () => { b.close(); onClose(); };
}

export function resultsScreen(res, rewards, onContinue) {
  const won = res.won;
  const w = rewards.weapon; const wr = w ? rarityOf(w.rarity) : null;
  const m = modal(`<div class="results ${won ? 'win' : 'lose'}">
      <div class="res-title">${won ? 'VICTORY!' : 'DEFEAT'}</div>
      <div class="muted">${res.reason}</div>
      <div class="res-grid">
        <div><span>Wave</span><b>${res.wave}</b></div><div><span>Kills</span><b>${res.stats.kills}</b></div>
        <div><span>Heroes spelled</span><b>${res.stats.heroes}</b></div><div><span>Best letter</span><b>Lv ${res.stats.maxLevel}</b></div>
        <div><span>Score</span><b>${res.score}</b></div><div><span>Lives left</span><b>${res.lives}</b></div>
      </div>
      ${rewards.newBest ? '<div class="newbest">★ New personal best on this map!</div>' : ''}
      <div class="rewards"><div class="rw">🪙 <b id="coinsAmt">${rewards.coins}</b> coins</div><div class="rw">✦ <b>${rewards.xp}</b> XP</div></div>
      ${w ? `<div class="drop" style="--rc:${wr.color}"><div class="drop-glow"></div><div style="${stripCss('weapons', WEAPON_BASES[w.hero].icon, 80)}"></div><div><div class="muted small">Weapon drop!</div><div class="wname" style="color:${wr.color}">${w.name}</div><div class="small">${wr.name} · for ${w.hero}</div></div></div>` : ''}
      ${rewards.levelUps.length ? `<div class="levelup">LEVEL UP! You are now level ${P.level}${rewards.unlocks.length ? ' — new hero: <b>' + rewards.unlocks.join(', ') + '</b>' : ''}</div>` : ''}
      ${rewards.ladderUp ? `<div class="levelup">Next rival unlocked: <b>${rewards.ladderUp}</b></div>` : ''}
      <div class="row center">
        ${rewards.coins > 0 ? '<button class="btn green" id="dbl">▶ Double coins (ad)</button>' : ''}
        <button class="btn gold" id="cont">Continue</button>
      </div></div>`, 'res');
  const q = x => m.el.querySelector(x);
  if (q('#dbl')) q('#dbl').onclick = async () => {
    q('#dbl').disabled = true;
    const ok = await api.rewarded();
    if (ok) { P.coins += rewards.coins; saveProfile(); q('#coinsAmt').textContent = rewards.coins * 2; Audio.play('coin'); toast(`+${rewards.coins} bonus coins!`); q('#dbl').remove(); }
    else { toast('Ad unavailable right now'); q('#dbl').disabled = false; }
  };
  q('#cont').onclick = () => { m.close(); onContinue(); };
}
