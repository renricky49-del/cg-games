// Static game design data: economy curves, buildings, bosses, nights, perks, skins.

export const GAME_TITLE = 'Last Door Standing';

export const RUSH_TIME = 30;      // seconds to pick a room
export const GRACE_TIME = 30;     // seconds after rush before the boss wakes
export const MAX_BED = 10;
export const MAX_DOOR = 12;

// ---- Bed -------------------------------------------------------------------
export const bedIncome = (lvl) => 2 * Math.pow(2, lvl - 1);           // scrap / sec
export const bedCost = (lvl) => Math.round(20 * Math.pow(2.45, lvl - 1)); // cost to go lvl -> lvl+1
export const bedDoorReq = (nextLvl) => Math.max(1, nextLvl - 2);       // min door level for bed level
export const bedSprite = (lvl) => 'bed' + Math.min(6, Math.ceil(lvl * 0.6));

// ---- Door ------------------------------------------------------------------
export const doorMaxHp = (lvl) => Math.round(320 * Math.pow(1.72, lvl - 1));
export const doorCost = (lvl) => Math.round(40 * Math.pow(2.35, lvl - 1));
export const repairCost = (lvl) => Math.round(6 * Math.pow(1.9, lvl - 1));
export const REPAIR_FRAC = 0.35;
export const REPAIR_CD = 10;
export const doorSprite = (lvl) => (lvl >= 7 ? 'door3' : lvl >= 4 ? 'door2' : 'door1');

// ---- Buildings ---------------------------------------------------------------
// kind: turret | util. power: consumed (negative = produced). unlock: night number.
export const BUILDINGS = {
  nail: {
    name: 'Nail Gun', kind: 'turret', cost: 30, power: 0, unlock: 1, hotkey: '1',
    desc: 'Cheap rapid-fire turret. Great early on.',
    dmg: 7, rate: 2.2, range: 3.4, rangeUp: 0.3, dmgMul: 1.75, costMul: 2.2, maxLvl: 9,
    proj: 'nail', sprites: ['nail1', 'nail2', 'nail3'],
  },
  bow: {
    name: 'Crossbow', kind: 'turret', cost: 220, power: 0, unlock: 2, hotkey: '2',
    desc: 'Heavy bolts with long range. Pierces armor.',
    dmg: 60, rate: 0.75, range: 4.6, rangeUp: 0.35, dmgMul: 1.8, costMul: 2.2, maxLvl: 9,
    proj: 'bolt', pierce: true, sprites: ['bow1', 'bow2', 'bow3'],
  },
  tesla: {
    name: 'Tesla Coil', kind: 'turret', cost: 1400, power: 2, unlock: 5, hotkey: '3',
    desc: 'Chains lightning between up to 3 zombies. Needs 2 power.',
    dmg: 150, rate: 1.1, range: 4.0, rangeUp: 0.3, dmgMul: 1.8, costMul: 2.25, maxLvl: 9,
    proj: 'zap', chain: 3, sprites: ['tesla1', 'tesla2', 'tesla3'],
  },
  generator: {
    name: 'Generator', kind: 'util', cost: 120, power: -2, unlock: 3, hotkey: '4',
    desc: 'Produces 2 power per level. Power runs advanced gadgets.',
    powerUp: 2, costMul: 2.4, maxLvl: 6, sprites: ['generator'],
  },
  freezer: {
    name: 'Chill Trap', kind: 'util', cost: 300, power: 1, unlock: 3, hotkey: '5',
    desc: 'Freezing mist slows zombies in range.',
    range: 3.2, rangeUp: 0.3, slow: 0.3, slowUp: 0.06, slowMax: 0.65, costMul: 2.3, maxLvl: 6, sprites: ['freezer'],
  },
  vending: {
    name: 'Vending Machine', kind: 'util', cost: 380, power: 1, unlock: 4, hotkey: '6',
    desc: 'Produces scrap on its own, even while you sleep.',
    income: 5, incomeMul: 2.1, costMul: 2.3, maxLvl: 8, sprites: ['vending'],
  },
  bench: {
    name: 'Repair Bench', kind: 'util', cost: 480, power: 1, unlock: 6, hotkey: '7',
    desc: 'Slowly repairs your door automatically.',
    heal: 0.006, healUp: 0.004, costMul: 2.3, maxLvl: 6, sprites: ['bench'],
  },
  spikes: {
    name: 'Spike Trap', kind: 'util', cost: 350, power: 0, unlock: 7, hotkey: '8',
    desc: 'Reflects part of every door hit back at the attacker.',
    reflect: 0.25, reflectUp: 0.12, costMul: 2.3, maxLvl: 6, sprites: ['spikes'],
  },
  radio: {
    name: 'Signal Tower', kind: 'util', cost: 900, power: 2, unlock: 8, hotkey: '9',
    desc: 'Boosts fire rate of turrets in range.',
    range: 2.6, rangeUp: 0.25, boost: 0.2, boostUp: 0.08, costMul: 2.3, maxLvl: 6, sprites: ['radio'],
  },
};
export const BUILD_ORDER = ['nail', 'bow', 'tesla', 'generator', 'freezer', 'vending', 'bench', 'spikes', 'radio'];

export function upgradeCost(type, lvl) { // cost to go lvl -> lvl+1
  const b = BUILDINGS[type];
  return Math.round(b.cost * Math.pow(b.costMul, lvl));
}
export function totalSpent(type, lvl) {
  let s = BUILDINGS[type].cost;
  for (let l = 1; l < lvl; l++) s += upgradeCost(type, l);
  return s;
}
export function turretStats(type, lvl, perks) {
  const b = BUILDINGS[type];
  const dmgPerk = 1 + 0.08 * (perks ? perks.dmg || 0 : 0);
  return {
    dmg: b.dmg * Math.pow(b.dmgMul, lvl - 1) * dmgPerk,
    rate: b.rate * (1 + 0.04 * (lvl - 1)),
    range: b.range + b.rangeUp * (lvl - 1),
  };
}
export function spriteFor(type, lvl) {
  const s = BUILDINGS[type].sprites;
  if (s.length === 1) return s[0];
  return s[lvl >= 6 ? 2 : lvl >= 3 ? 1 : 0];
}

// ---- Bosses ------------------------------------------------------------------
export const BOSSES = {
  brute:   { name: 'The Brute',    sprite: 'boss_brute',   hp: 1, dmg: 1, speed: 1.6, desc: 'A hulking brawler. Pounds doors with huge fists.' },
  spitter: { name: 'The Spitter',  sprite: 'boss_spitter', hp: 0.9, dmg: 1, speed: 1.6, desc: 'Spits acid that jams your gadgets for a few seconds.', acid: true },
  charger: { name: 'The Charger',  sprite: 'boss_charger', hp: 1.05, dmg: 1, speed: 1.7, desc: 'Charges across the hall and slams doors for triple damage.', charge: true },
  howler:  { name: 'The Howler',   sprite: 'boss_howler',  hp: 0.95, dmg: 0.95, speed: 1.7, desc: 'Its howl calls extra zombies from the stairwell.', howl: true },
  tank:    { name: 'The Riot Tank', sprite: 'boss_tank',   hp: 1.25, dmg: 1, speed: 1.4, desc: 'Armor plates shrug off weak hits. Bring crossbows!', armor: true },
  abom:    { name: 'Abomination',  sprite: 'boss_abom',    hp: 1.2, dmg: 1.05, speed: 1.6, desc: 'Every trick at once. The final nightmare.', acid: true, howl: true, charge: true },
};

// ---- Nights ------------------------------------------------------------------
// diff: multiplier on boss stats. len: seconds from boss release to dawn.
export const NIGHTS = [
  { n: 1,  boss: 'brute',   diff: 1.0, len: 170, map: 0, unlockText: 'Nail Gun turret' },
  { n: 2,  boss: 'brute',   diff: 1.15, len: 190, map: 1, unlockText: 'Crossbow turret' },
  { n: 3,  boss: 'spitter', diff: 1.3, len: 200, map: 2, unlockText: 'Generator & Chill Trap' },
  { n: 4,  boss: 'spitter', diff: 1.45, len: 210, map: 0, unlockText: 'Vending Machine' },
  { n: 5,  boss: 'charger', diff: 1.6, len: 220, map: 1, unlockText: 'Tesla Coil' },
  { n: 6,  boss: 'charger', diff: 1.8, len: 230, map: 2, unlockText: 'Repair Bench' },
  { n: 7,  boss: 'howler',  diff: 2.0, len: 240, map: 0, unlockText: 'Spike Trap' },
  { n: 8,  boss: 'howler',  diff: 2.2, len: 250, map: 1, unlockText: 'Signal Tower' },
  { n: 9,  boss: 'tank',    diff: 2.45, len: 260, map: 2, unlockText: 'The Riot Tank' },
  { n: 10, boss: 'tank',    diff: 2.7, len: 270, map: 0, unlockText: 'Harder nights' },
  { n: 11, boss: 'abom',    diff: 3.0, len: 280, map: 1, unlockText: 'The Abomination' },
  { n: 12, boss: 'abom',    diff: 3.3, len: 300, map: 2, unlockText: 'Endless mode' },
];
export const ENDLESS = { n: 0, endless: true, boss: 'brute', diff: 1.6, len: 99999, map: 1 };

export function bossBase(diff) {
  return { hp: 2600 * diff, dmg: 13 * diff };
}
export const BOSS_LVL_HP = 1.38;   // per boss level
export const BOSS_LVL_DMG = 1.33;
export const bossXpNeed = (lvl) => 10 + lvl * 5;

// ---- Meta progression -----------------------------------------------------
export const PERKS = [
  { id: 'start', name: 'Stash',            desc: '+25 starting scrap', max: 5, cost: (l) => 3 + l * 3 },
  { id: 'door',  name: 'Reinforced Hinges', desc: '+10% door max HP',  max: 5, cost: (l) => 4 + l * 4 },
  { id: 'dmg',   name: 'Sharp Nails',      desc: '+8% turret damage',  max: 5, cost: (l) => 4 + l * 4 },
  { id: 'bed',   name: 'Sweet Dreams',     desc: '+10% bed income',    max: 5, cost: (l) => 4 + l * 4 },
  { id: 'fix',   name: 'Quick Fix',        desc: '-12% repair cooldown', max: 4, cost: (l) => 3 + l * 4 },
];

export const SKINS = [
  { id: 's0', name: 'Rook',  stars: 0 },
  { id: 's1', name: 'Dash',  stars: 3 },
  { id: 's2', name: 'Sarge', stars: 8 },
  { id: 's3', name: 'Ivy',   stars: 14 },
  { id: 's4', name: 'Flash', stars: 20 },
  { id: 's5', name: 'Drizzle', stars: 27 },
];

export const AI_NAMES = ['Dash', 'Sarge', 'Ivy', 'Flash', 'Drizzle', 'Rook', 'Mo', 'Pip', 'Juno', 'Ozzy', 'Tess', 'Kit'];

// AI personalities: weights for spending choices.
export const PERSONALITIES = [
  { id: 'greedy',  bed: 2.6, door: 0.9, turret: 0.8, util: 0.6, repairAt: 0.45, react: 1.2 },
  { id: 'turtle',  bed: 1.0, door: 2.2, turret: 1.0, util: 0.9, repairAt: 0.7, react: 0.8 },
  { id: 'gunner',  bed: 1.1, door: 1.1, turret: 2.4, util: 0.7, repairAt: 0.55, react: 0.9 },
  { id: 'balanced', bed: 1.5, door: 1.4, turret: 1.5, util: 1.0, repairAt: 0.6, react: 1.0 },
  { id: 'rookie',  bed: 1.8, door: 0.7, turret: 0.9, util: 0.4, repairAt: 0.3, react: 2.6 },
];
