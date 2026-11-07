// Image loading + cached white silhouettes (for hit flashes).
export const IMG_NAMES = [
  's0', 's1', 's2', 's3', 's4', 's5',
  'boss_brute', 'boss_spitter', 'boss_charger', 'boss_howler', 'boss_tank', 'boss_abom',
  'minion0', 'minion1', 'minion2', 'minion3',
  'a_flash', 'a_molotov', 'crate', 'crate_chute',
  'flame1', 'flame2', 'flame3', 'mortar1', 'mortar2', 'mortar3',
  'nail1', 'nail2', 'nail3', 'bow1', 'bow2', 'bow3', 'tesla1', 'tesla2', 'tesla3',
  'generator', 'freezer', 'bench', 'vending', 'spikes', 'radio',
  'bed1', 'bed2', 'bed3', 'bed4', 'bed5', 'bed6',
  'i_scrap', 'i_power', 'i_door', 'i_star', 'i_medal', 'i_repair', 'i_up', 'i_lock', 'i_clock', 'i_skull', 'i_ad', 'i_moon',
  'door1', 'door2', 'door3', 'rug', 'plant', 'boxes', 'lamp', 'chair', 'rubble',
  's6', 's7', 's8', 's9', 's10', 's11', 'z0', 'z1', 'z2', 'z3', 'z4', 'z5',
  'door1_d1', 'door2_d1', 'door3_d1', 'door1_d2', 'door2_d2', 'door3_d2',
  'f_fridge', 'f_shelf', 'f_desk', 'f_couch', 'f_wardrobe', 'f_kitchen', 'f_tv', 'f_armchair', 'f_table', 'f_lamp', 'f_pizza', 'f_laundry',
  ...['brute', 'spitter', 'charger', 'howler', 'tank', 'abom'].flatMap((b) => [0, 1, 2].map((f) => `boss_${b}_${f}`)),
  ...[0, 1, 2, 3].flatMap((m) => [`minion${m}_a`, `minion${m}_b`]),
];
export const TILE_NAMES = ['t_wood', 't_tile', 't_green', 't_purple', 't_parquet', 't_hall', 't_concrete', 't_brick', 't_beige'];

export const IMG = {};
const WHITE = {};

export function loadImages(onProgress) {
  let done = 0;
  const all = IMG_NAMES.map((n) => [n, `assets/img/${n}.png`]).concat(TILE_NAMES.map((n) => [n, `assets/img/${n}.jpg`]));
  return Promise.all(all.map(([n, src]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { IMG[n] = im; done++; onProgress && onProgress(done / all.length); res(); };
    im.onerror = () => { console.warn('missing image', n); done++; res(); };
    im.src = src;
  })));
}

export function white(name) {
  if (WHITE[name]) return WHITE[name];
  const im = IMG[name]; if (!im) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  WHITE[name] = c;
  return c;
}
