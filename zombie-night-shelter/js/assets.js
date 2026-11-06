// Image loading + cached white silhouettes (for hit flashes).
export const IMG_NAMES = [
  's0', 's1', 's2', 's3', 's4', 's5',
  'boss_brute', 'boss_spitter', 'boss_charger', 'boss_howler', 'boss_tank', 'boss_abom',
  'minion0', 'minion1', 'minion2', 'minion3',
  'nail1', 'nail2', 'nail3', 'bow1', 'bow2', 'bow3', 'tesla1', 'tesla2', 'tesla3',
  'generator', 'freezer', 'bench', 'vending', 'spikes', 'radio',
  'bed1', 'bed2', 'bed3', 'bed4', 'bed5', 'bed6',
  'i_scrap', 'i_power', 'i_door', 'i_star', 'i_medal', 'i_repair', 'i_up', 'i_lock', 'i_clock', 'i_skull', 'i_ad', 'i_moon',
  'door1', 'door2', 'door3', 'rug', 'plant', 'boxes', 'lamp', 'chair', 'rubble',
];

export const IMG = {};
const WHITE = {};

export function loadImages(onProgress) {
  let done = 0;
  return Promise.all(IMG_NAMES.map((n) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { IMG[n] = im; done++; onProgress && onProgress(done / IMG_NAMES.length); res(); };
    im.onerror = () => { console.warn('missing image', n); done++; res(); };
    im.src = `assets/img/${n}.png`;
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
