// Static game design data: economy curves, buildings, bosses, nights, perks, skins.

export const GAME_TITLE = 'Last Door Standing';

export const RUSH_TIME = 22;      // real seconds to pick a room (runs at normal speed)
// After the rush the whole simulation runs PACE× faster (boss, turrets, income, cooldowns, dawn timer
// all scale together), so balance is identical but a night plays out in about half the time.
export const PACE = 2.0;
export const GRACE_TIME = 38;     // game-seconds after the rush before the boss wakes (19 s real at PACE 2)
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
    dmg: 7, rate: 2.2, range: 5.5, rangeUp: 0.4, dmgMul: 1.75, costMul: 2.2, maxLvl: 9,
    proj: 'nail', sprites: ['nail1', 'nail2', 'nail3'],
  },
  bow: {
    name: 'Crossbow', kind: 'turret', cost: 160, power: 0, unlock: 1, hotkey: '2',
    desc: 'Heavy bolts with long range. Pierces armor.',
    dmg: 48, rate: 0.75, range: 6.8, rangeUp: 0.45, dmgMul: 1.8, costMul: 2.2, maxLvl: 9,
    proj: 'bolt', pierce: true, sprites: ['bow1', 'bow2', 'bow3'],
  },
  flame: {
    name: 'Fire Sprayer', kind: 'turret', cost: 70, power: 0, unlock: 1, hotkey: '3',
    desc: 'Sprays fire that burns every zombie in its range at once.',
    dmg: 4, rate: 5, range: 3.8, rangeUp: 0.3, dmgMul: 1.75, costMul: 2.2, maxLvl: 9,
    proj: 'flame', aoe: true, sprites: ['flame1', 'flame2', 'flame3'],
  },
  mortar: {
    name: 'Mortar', kind: 'turret', cost: 180, power: 0, unlock: 1, hotkey: '4',
    desc: 'Lobs explosive shells across the whole hallway. Splash damage.',
    dmg: 50, rate: 0.45, range: 9.0, rangeUp: 0.4, dmgMul: 1.8, costMul: 2.2, maxLvl: 9,
    proj: 'shell', splash: 1.4, sprites: ['mortar1', 'mortar2', 'mortar3'],
  },
  tesla: {
    name: 'Tesla Coil', kind: 'turret', cost: 1400, power: 2, unlock: 3, hotkey: '5',
    desc: 'Chains lightning between up to 3 zombies. Needs 2 power.',
    dmg: 150, rate: 1.1, range: 5.4, rangeUp: 0.4, dmgMul: 1.8, costMul: 2.25, maxLvl: 9,
    proj: 'zap', chain: 3, sprites: ['tesla1', 'tesla2', 'tesla3'],
  },
  generator: {
    name: 'Generator', kind: 'util', cost: 120, power: -2, unlock: 1, hotkey: '6',
    desc: 'Produces 2 power per level. Power runs advanced gadgets.',
    powerUp: 2, costMul: 2.4, maxLvl: 6, sprites: ['generator'],
  },
  freezer: {
    name: 'Chill Trap', kind: 'util', cost: 300, power: 1, unlock: 1, hotkey: '7',
    desc: 'Freezing mist slows zombies in range.',
    range: 4.2, rangeUp: 0.35, slow: 0.3, slowUp: 0.06, slowMax: 0.65, costMul: 2.3, maxLvl: 6, sprites: ['freezer'],
  },
  spikes: {
    name: 'Spike Trap', kind: 'util', cost: 350, power: 0, unlock: 1, hotkey: '8',
    desc: 'Reflects part of every door hit back at the attacker.',
    reflect: 0.25, reflectUp: 0.12, costMul: 2.3, maxLvl: 6, sprites: ['spikes'],
  },
  vending: {
    name: 'Vending Machine', kind: 'util', cost: 380, power: 1, unlock: 2, hotkey: '9',
    desc: 'Produces scrap on its own, even while you sleep.',
    income: 5, incomeMul: 2.1, costMul: 2.3, maxLvl: 8, sprites: ['vending'],
  },
  bench: {
    name: 'Repair Bench', kind: 'util', cost: 480, power: 1, unlock: 4, hotkey: '0',
    desc: 'Slowly repairs your door automatically.',
    heal: 0.006, healUp: 0.004, costMul: 2.3, maxLvl: 6, sprites: ['bench'],
  },
  radio: {
    name: 'Signal Tower', kind: 'util', cost: 900, power: 2, unlock: 5, hotkey: '',
    desc: 'Boosts fire rate of turrets in range.',
    range: 3.4, rangeUp: 0.3, boost: 0.2, boostUp: 0.08, costMul: 2.3, maxLvl: 6, sprites: ['radio'],
  },
};
export const BUILD_ORDER = ['nail', 'bow', 'flame', 'mortar', 'tesla', 'generator', 'freezer', 'spikes', 'vending', 'bench', 'radio'];

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
  const h = (perks && perks.hero) || {}; // the player's survivor bonus
  return {
    dmg: b.dmg * Math.pow(b.dmgMul, lvl - 1) * dmgPerk * ((h.dmg && h.dmg[type]) || 1),
    rate: b.rate * (1 + 0.04 * (lvl - 1)) * ((h.rate && h.rate[type]) || 1),
    range: b.range + b.rangeUp * (lvl - 1) + ((h.range && h.range[type]) || 0),
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
  { n: 1,  boss: 'brute',   count: 2, lvl: 1, diff: 0.6, len: 170, map: 0, unlockText: 'Nail Gun turret' },
  { n: 2,  boss: 'brute',   count: 2, lvl: 2, diff: 0.71, len: 190, map: 1, unlockText: 'Crossbow turret' },
  { n: 3,  boss: 'spitter', count: 3, lvl: 1, diff: 0.98, len: 200, map: 2, unlockText: 'Generator & Chill Trap' },
  { n: 4,  boss: 'spitter', count: 3, lvl: 2, diff: 0.88, len: 210, map: 0, unlockText: 'Vending Machine' },
  { n: 5,  boss: 'charger', count: 3, lvl: 3, diff: 0.76, len: 220, map: 1, unlockText: 'Tesla Coil' },
  { n: 6,  boss: 'charger', count: 4, lvl: 1, diff: 1.18, len: 230, map: 2, unlockText: 'Repair Bench' },
  { n: 7,  boss: 'howler',  count: 4, lvl: 2, diff: 0.92, len: 240, map: 0, unlockText: 'Spike Trap' },
  { n: 8,  boss: 'howler',  count: 4, lvl: 3, diff: 0.84, len: 250, map: 1, unlockText: 'Signal Tower' },
  { n: 9,  boss: 'tank',    count: 4, lvl: 4, diff: 0.94, len: 260, map: 2, unlockText: 'The Riot Tank' },
  { n: 10, boss: 'tank',    count: 5, lvl: 1, diff: 1.67, len: 270, map: 0, unlockText: 'Harder nights' },
  { n: 11, boss: 'abom',    count: 5, lvl: 2, diff: 1.34, len: 280, map: 1, unlockText: 'The Abomination' },
  { n: 12, boss: 'abom',    count: 5, lvl: 3, diff: 1.35, len: 300, map: 2, unlockText: 'Endless mode' },
  // Nights 13-22: mixed packs, 5-6 bosses, start levels 4-8. Balanced around upgraded perks (tools/tune.mjs).
  { n: 13, title: 'Mixed Company', boss: 'abom', kinds: ['abom', 'tank', 'howler', 'charger', 'spitter'], count: 5, lvl: 4, diff: 1.39, len: 300, map: 0 },
  { n: 14, title: 'Iron Rain', boss: 'tank', kinds: ['tank', 'tank', 'howler', 'howler', 'abom'], count: 5, lvl: 4, diff: 1.61, len: 305, map: 1 },
  { n: 15, title: 'Stampede', boss: 'charger', kinds: ['charger', 'charger', 'charger', 'abom', 'tank'], count: 5, lvl: 5, diff: 1.13, len: 310, map: 2 },
  { n: 16, title: 'Choir of the Dead', boss: 'howler', kinds: ['howler', 'howler', 'spitter', 'spitter', 'abom'], count: 5, lvl: 5, diff: 1.27, len: 315, map: 0 },
  { n: 17, title: 'Heavy Metal', boss: 'abom', kinds: ['abom', 'abom', 'tank', 'tank', 'charger'], count: 5, lvl: 6, diff: 0.92, len: 320, map: 1 },
  { n: 18, title: 'Lockdown', boss: 'tank', kinds: ['tank', 'tank', 'tank', 'abom', 'abom'], count: 5, lvl: 6, diff: 1.11, len: 325, map: 2 },
  { n: 19, title: 'Six Feet Closer', boss: 'abom', kinds: ['abom', 'howler', 'charger', 'spitter', 'tank', 'brute'], count: 6, lvl: 6, diff: 1.43, len: 330, map: 0 },
  { n: 20, title: 'Riot Season', boss: 'abom', kinds: ['abom', 'abom', 'tank', 'tank', 'howler', 'howler'], count: 6, lvl: 7, diff: 0.97, len: 340, map: 1 },
  { n: 21, title: 'Red Moon', boss: 'abom', kinds: ['abom', 'abom', 'abom', 'tank', 'charger', 'spitter'], count: 6, lvl: 7, diff: 0.92, len: 350, map: 2 },
  { n: 22, title: 'The Last Door', boss: 'abom', kinds: ['abom', 'abom', 'abom', 'abom', 'abom', 'abom'], count: 6, lvl: 8, diff: 0.79, len: 360, map: 0 },
];
// Several bosses every night: count = how many, lvl = the level they all start at.
// Boss 1 is the night's boss (and the hunter); the others walk down the chain of earlier variants.
export const BOSS_CHAIN = ['brute', 'spitter', 'charger', 'howler', 'tank', 'abom'];
export function bossKinds(main, count) {
  const i = BOSS_CHAIN.indexOf(main);
  return Array.from({ length: count }, (_, k) => BOSS_CHAIN[Math.max(0, i - k)]);
}
// per-boss share of a solo boss's HP / damage, by group size (tuned with tools/balance.mjs)
export const GROUP_HP = { 1: 1, 2: 0.62, 3: 0.47, 4: 0.38, 5: 0.32, 6: 0.28 };
export const GROUP_DMG = { 1: 1, 2: 0.7, 3: 0.55, 4: 0.46, 5: 0.4, 6: 0.35 };
// the boss list for a night: an explicit mixed pack if the night defines one, else the chain
export const nightKinds = (night) => night.kinds || bossKinds(night.boss, night.count || 2);
export const AI_COUNT = 3;          // allies (4 survivors, 4 apartments)
export const AID_FRAC = 0.35;        // "Send scrap" gives this share of your scrap
export const AID_FRAC_REPAIR = 0.5; // a repair you pay for on an ally's door restores this much (more than your own 35%)
export const AID_CD = 6;             // cooldown (game-s) between repairs you pay for on the same ally door
export const TEAM_BOUNTY_S = 20;     // boss kill: every living survivor gets this many seconds of bed income
// ---- Player abilities (click a button, then click the map) ----------------------
// cd in game-seconds (shown halved in real time at PACE 2)
export const ABILITIES = {
  flash: { name: 'Flashbang', key: 'Q', unlock: 1, cd: 36, radius: 2.6, stunBoss: 3, stunMinion: 5, icon: 'a_flash',
    desc: 'Stuns every zombie in the blast. Stunned bosses stop smashing doors.' },
  molotov: { name: 'Molotov', key: 'E', unlock: 2, cd: 48, radius: 2.0, dur: 7, bossPct: 0.016, minionPct: 0.14, icon: 'a_molotov',
    desc: 'Leaves a pool of fire that burns zombies standing in it.' },
};
// ---- Supply drops: a crate falls into the hallway every so often during the night; click it to grab it
export const CRATE_EVERY = [44, 64];  // game-seconds between drops (random in range)
export const CRATE_LIFE = 18;         // game-seconds before it is gone
// Minion waves: zombies shuffle out of the stairwell during the night (more on later nights)
export const MINION_WAVE = { every: 26, first: 14, hpF: 0.25, dmgF: 0.3 };
export const minionWaveSize = (n) => Math.min(8, 2 + Math.floor(n / 3));
export const HUNT_CHANCE = 0.6; // chance the main boss picks the player's door whenever it chooses a target
export const ENDLESS = { n: 0, endless: true, boss: 'brute', count: 2, lvl: 1, diff: 1.6, len: 99999, map: 1 };

export function bossBase(diff) {
  return { hp: 5400 * diff, dmg: 13 * diff };
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

// Unlocked by total stars (22 nights × 3 = 66). The last three need stars from Nights 13-22.
export const SKINS = [
  { id: 's0', name: 'Rook', stars: 0 },
  { id: 's1', name: 'Dash', stars: 3 },
  { id: 's6', name: 'Bun', stars: 7 },
  { id: 's2', name: 'Sarge', stars: 12 },
  { id: 's7', name: 'Chef Remy', stars: 17 },
  { id: 's3', name: 'Ivy', stars: 23 },
  { id: 's8', name: 'Hardhat', stars: 29 },
  { id: 's4', name: 'Flash', stars: 34 },
  { id: 's9', name: 'Spike', stars: 40 },
  { id: 's5', name: 'Drizzle', stars: 47 },
  { id: 's10', name: 'Granny Mae', stars: 55 },
  { id: 's11', name: 'Cosmo', stars: 63 },
];
// Every survivor has a passive bonus that applies to the player while they play as them.
export const HEROES = {
  s0: { title: 'Handyman', desc: 'Repairs restore 45% instead of 35%.', repair: 0.10 },
  s1: { title: 'Sprinter', desc: '+35% running speed in the room rush and +40 starting scrap.', speed: 1.35, startScrap: 40 },
  s6: { title: 'Lucky Rabbit', desc: 'Supply crates drop 30% more often and give +50% scrap.', crateEvery: 0.7, crateScrap: 1.5 },
  s2: { title: 'Drill Sergeant', desc: 'Nail Guns fire 20% faster.', rate: { nail: 1.2 } },
  s7: { title: 'Head Chef', desc: 'Vending Machines make +50% scrap, bed income +5%.', vending: 1.5, bed: 0.05 },
  s3: { title: 'Sharpshooter', desc: 'Crossbows deal +25% damage and reach +0.5 tiles further.', dmg: { bow: 1.25 }, range: { bow: 0.5 } },
  s8: { title: 'Contractor', desc: 'All buildings and their upgrades cost 15% less.', buildCost: 0.85 },
  s4: { title: 'Pyromaniac', desc: 'Fire Sprayers and Molotovs deal +30% damage; Molotov recharges 25% faster.', dmg: { flame: 1.3 }, molotovDmg: 1.3, cd: { molotov: 0.75 } },
  s9: { title: 'Ironclad', desc: 'Door upgrades cost 15% less and Spike Traps reflect +50% more.', doorCost: 0.85, reflect: 1.5 },
  s5: { title: 'Frostbite', desc: 'Chill Traps slow 15% more; Flashbang stuns last 50% longer.', slow: 0.15, stun: 1.5 },
  s10: { title: 'Good Neighbour', desc: 'Helping allies costs 30% less, team bounties pay +50%, and allies return favours more readily.', aidCost: 0.7, bounty: 1.5, goodwill: 1.5 },
  s11: { title: 'Tech Whiz', desc: 'Tesla Coils deal +30% damage and need 1 less power; abilities recharge 20% faster.', dmg: { tesla: 1.3 }, teslaPower: 1, cd: { flash: 0.8, molotov: 0.8 } },
};

// thresholds before the 22-night update; used once to keep skins old saves had already unlocked
export const OLD_SKIN_STARS = { s0: 0, s1: 3, s6: 5, s2: 8, s7: 10, s3: 14, s8: 17, s4: 20, s9: 24, s5: 27, s10: 30, s11: 36 };

export const AI_NAMES = ['Dash', 'Sarge', 'Ivy', 'Flash', 'Drizzle', 'Rook', 'Mo', 'Pip', 'Juno', 'Ozzy', 'Tess', 'Kit'];

// AI personalities: weights for spending choices.
export const PERSONALITIES = [
  { id: 'greedy',  bed: 2.6, door: 0.9, turret: 0.8, util: 0.6, repairAt: 0.45, react: 1.2 },
  { id: 'turtle',  bed: 1.0, door: 2.2, turret: 1.0, util: 0.9, repairAt: 0.7, react: 0.8 },
  { id: 'gunner',  bed: 1.1, door: 1.1, turret: 2.4, util: 0.7, repairAt: 0.55, react: 0.9 },
  { id: 'balanced', bed: 1.5, door: 1.4, turret: 1.5, util: 1.0, repairAt: 0.6, react: 1.0 },
  { id: 'rookie',  bed: 1.8, door: 0.7, turret: 0.9, util: 0.4, repairAt: 0.3, react: 2.6 },
];
