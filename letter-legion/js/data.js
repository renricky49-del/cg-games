// Letter Legion — static game data (pure, no DOM; shared by game + headless sim)

export const TILE = 64; // board units per tile when rendered at scale 1

// ---------- Basic letter units ----------
export const UNITS = {
  S: { letter: 'S', name: 'Swordsman', role: 'Melee splash', color: '#e8453c', dark: '#8f1d17', dmg: 23, rate: 1.0, range: 1.45, kind: 'splash', splash: 0.8,
       desc: 'Swings a blade that splashes nearby foes. Short range — place next to the road.' },
  L: { letter: 'L', name: 'Lancer', role: 'Piercing line', color: '#3d7fe6', dark: '#173f86', dmg: 15, rate: 0.85, range: 2.4, kind: 'pierce', width: 0.42,
       desc: 'Thrusts a lance through every enemy in a line. Ignores armor.' },
  B: { letter: 'B', name: 'Bowman', role: 'Long range', color: '#43b04a', dark: '#1c6122', dmg: 28, rate: 0.75, range: 3.8, kind: 'single',
       desc: 'Bends into a bow and looses arrows at the leading enemy from far away.' },
  K: { letter: 'K', name: 'Knight', role: 'Rapid strikes', color: '#f08a24', dark: '#8a4508', dmg: 10.5, rate: 2.7, range: 1.75, kind: 'single',
       desc: 'Gallops in place, striking very fast. Great against swarms of weak foes.' },
};
export const BASIC_LETTERS = ['S', 'L', 'B', 'K'];
export const MAX_LEVEL = 7;
export const LEVEL_DMG = 2.15;     // damage multiplier per level
export const LEVEL_RATE = 0.09;    // +9% attack speed per level
export const LEVEL_COLORS = ['#c58a4a', '#c9d3dd', '#ffd24a', '#ff5d7a', '#5ac8ff', '#c77dff', '#ffffff'];
export const LEVEL_NAMES = ['Bronze', 'Silver', 'Gold', 'Ruby', 'Sapphire', 'Amethyst', 'Radiant'];

// Gold hero-letter tile basic attack (weak, so tiles aren't dead weight)
export const GOLD_TILE = { dmg: 7, rate: 1.0, range: 2.6 };

// ---------- Heroes (spelled from golden tiles) ----------
// skill: periodic special; dmg values are base at hero level 1.
export const HEROES = [
  { id: 'KING', word: 'KING', title: 'The Boy King', unlock: 1, portrait: 0, color: '#ffcf3a',
    dmg: 75, rate: 1.0, range: 2.6, kind: 'single', cd: 14,
    skill: 'Royal Decree', skillDesc: 'Aura: nearby letters attack 35% faster. Every 14s grants bonus Ink.' },
  { id: 'MAGE', word: 'MAGE', title: 'Archmage Lumi', unlock: 1, portrait: 1, color: '#58a8ff',
    dmg: 90, rate: 0.8, range: 3.6, kind: 'single', cd: 8,
    skill: 'Meteor', skillDesc: 'Every 8s drops a meteor on the thickest crowd of enemies.' },
  { id: 'MONK', word: 'MONK', title: 'Brother Tam', unlock: 1, portrait: 2, color: '#ff9a3a',
    dmg: 48, rate: 3.0, range: 1.8, kind: 'single', cd: 9,
    skill: 'Still Mind', skillDesc: 'Very fast palm strikes. Every 9s a shockwave hits and slows all nearby enemies by 50%.' },
  { id: 'HAWK', word: 'HAWK', title: 'Ranger Wyn', unlock: 2, portrait: 6, color: '#7bd35a',
    dmg: 110, rate: 0.9, range: 5.5, kind: 'single', cd: 12,
    skill: 'Skyfall Volley', skillDesc: 'Every 12s rains arrows on EVERY enemy on your board.' },
  { id: 'NINJA', word: 'NINJA', title: 'Shade Kiri', unlock: 3, portrait: 3, color: '#b07cff',
    dmg: 95, rate: 1.6, range: 2.8, kind: 'single', cd: 6,
    skill: 'Shadow Flurry', skillDesc: 'Every 6s teleports to strike 6 enemies anywhere on the board.' },
  { id: 'DRUID', word: 'DRUID', title: 'Elder Moss', unlock: 4, portrait: 4, color: '#3fcf8e',
    dmg: 70, rate: 1.0, range: 3.4, kind: 'single', cd: 10,
    skill: 'Thornroot', skillDesc: 'Every 10s roots a crowd in place and thorns hurt them over time.' },
  { id: 'TITAN', word: 'TITAN', title: 'Gorm the Titan', unlock: 5, portrait: 5, color: '#c9a27a',
    dmg: 210, rate: 0.6, range: 1.9, kind: 'splash', splash: 1.0, cd: 11,
    skill: 'Quake Shout', skillDesc: 'Huge splash blows. Every 11s stuns all nearby enemies.' },
  { id: 'SAINT', word: 'SAINT', title: 'Saint Aurelle', unlock: 6, portrait: 7, color: '#fff2b0',
    dmg: 80, rate: 1.0, range: 3.2, kind: 'single', cd: 24,
    skill: 'Sanctuary', skillDesc: 'Every 24s restores 1 life to your ward (or smites the strongest foe if full).' },
];
export const HERO_BY_ID = Object.fromEntries(HEROES.map(h => [h.id, h]));
export const HERO_LEVEL_MULT = [1, 2.6, 6.5];
export const HERO_MAX_LEVEL = 3;

// ---------- Enemies ----------
// sprite = index in enemy sheet (0..8) ; boss sprite index in boss sheet (0..3)
export const ENEMIES = {
  goblin:   { name: 'Goblin',    hp: 1.0,  speed: 1.0,  ink: 3, sprite: 0, size: 0.62 },
  bat:      { name: 'Bat',       hp: 0.45, speed: 1.75, ink: 2, sprite: 1, size: 0.55, fly: true },
  slime:    { name: 'Slime',     hp: 1.3,  speed: 0.8,  ink: 3, sprite: 2, size: 0.62, split: 'baby' },
  orc:      { name: 'Shield Orc', hp: 2.2, speed: 0.7,  ink: 6, sprite: 3, size: 0.72, armor: 0.45 },
  wisp:     { name: 'Wisp',      hp: 0.9,  speed: 1.2,  ink: 3, sprite: 4, size: 0.55, regen: 0.06 },
  imp:      { name: 'Imp',       hp: 0.8,  speed: 1.35, ink: 3, sprite: 5, size: 0.55, dodge: 0.2 },
  wolf:     { name: 'Wolf',      hp: 0.7,  speed: 2.0,  ink: 3, sprite: 6, size: 0.62 },
  baby:     { name: 'Slimelet',  hp: 0.35, speed: 1.1,  ink: 1, sprite: 7, size: 0.42 },
  shroom:   { name: 'Shroomling', hp: 2.8, speed: 0.6,  ink: 6, sprite: 8, size: 0.66 },
  // sent by the other side's Hex (never part of a normal wave)
  brute:    { name: 'Hexed Brute', hp: 7, speed: 0.8, ink: 10, sprite: 3, size: 0.86, elite: true },
};
// Hex: kills charge it; when full, curse the rival with a Hexed Brute on their road
export const HEX = { need: 22, step: 12, kill: 1, elite: 3, boss: 6 };
export const BOSSES = [
  { id: 'toad',   name: 'Bog Toad King', hp: 11, speed: 0.55, ink: 60, sprite: 0, size: 1.15, ability: 'tongue', abilityCd: 6 },
  { id: 'golem',  name: 'Iron Golem',    hp: 14, speed: 0.45, ink: 80, sprite: 1, size: 1.25, armor: 0.5, ability: 'quake', abilityCd: 9 },
  { id: 'dragon', name: 'Ember Whelp',   hp: 10, speed: 0.85, ink: 90, sprite: 2, size: 1.15, ability: 'scorch', abilityCd: 7 },
  { id: 'lich',   name: 'Bone Lich',     hp: 12, speed: 0.5,  ink: 100, sprite: 3, size: 1.2, ability: 'raise', abilityCd: 5 },
];

// Wave composition pools by wave tier
export const WAVE_POOLS = [
  { upTo: 3,  pool: ['goblin', 'goblin', 'goblin', 'bat'] },
  { upTo: 6,  pool: ['goblin', 'goblin', 'bat', 'slime', 'wolf'] },
  { upTo: 10, pool: ['goblin', 'bat', 'slime', 'orc', 'wolf', 'imp'] },
  { upTo: 15, pool: ['goblin', 'slime', 'orc', 'wisp', 'wolf', 'imp', 'shroom'] },
  { upTo: 999, pool: ['orc', 'wisp', 'imp', 'wolf', 'shroom', 'slime', 'bat'] },
];
export const BOSS_EVERY = 5;

// HP of a 1.0 enemy at wave w (1-based), multiplied by map difficulty
export function waveHp(w) {
  return 40 * Math.pow(1.19, w - 1) + 12 * (w - 1);
}

// ---------- Maps ----------
// Legend: E entry, # road, W ward (end), o open cell, x locked cell (dig with a shovel), . scenery
export const MAPS = [
  { id: 'ember', name: 'Ember Plains', lives: 7, waves: 15, hpMult: 0.95, bg: 'map_ember', theme: '#7cc254', road: '#d9b27a', roadEdge: '#a77c45',
    blurb: 'Gentle meadows. A wide U-shaped road around your camp.',
    rows: [
      'E#########.',
      '.xxooooxx#.',
      '.xxooooxx#.',
      '.xxooooxx#.',
      'W#########.',
    ] },
  { id: 'marsh', name: 'Misty Marsh', lives: 5, waves: 18, hpMult: 1.0, bg: 'map_marsh', theme: '#4f9b8a', road: '#b9a77a', roadEdge: '#7b6a42',
    blurb: 'The road snakes through the fog, splitting your camp in two.',
    rows: [
      'E########.',
      '.xxoooox#.',
      '.xxoooxx#.',
      '.########.',
      '.#xxoooxx.',
      '.#xxoooox.',
      '.W........',
    ] },
  { id: 'bay', name: 'Crimson Bay', lives: 9, waves: 20, hpMult: 1.3, bg: 'map_bay', theme: '#e0b56d', road: '#f3dcae', roadEdge: '#c0925a',
    blurb: 'A long coastal spiral. Many lives, but the tide brings tough foes.',
    rows: [
      'E#########.',
      '.xxoooox.#.',
      '.#########.',
      '.#xxoooxx..',
      '.#########.',
      '.xxoooox.#.',
      'W#########.',
    ] },
  { id: 'iron', name: 'Iron Gate Pass', lives: 3, waves: 20, hpMult: 1.08, bg: 'map_iron', theme: '#8b97a3', road: '#c7c0b4', roadEdge: '#7f776c',
    blurb: 'A narrow mountain pass. Only 3 lives — every leak hurts.',
    rows: [
      '.E.........',
      '.#.xooooxx.',
      '.#.xxoooox.',
      '.#.xxoooxx.',
      '.#########.',
      '.........#.',
      '.xxoooox.#.',
      '.W########.',
    ] },
];
export const MAP_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));

// ---------- CPU rivals (ladder) ----------
// skill: 0..1 how well the CPU plays; think: seconds between decisions; spell: max word length it attempts
export const RIVALS = [
  { id: 'bumble', power: 0.55, name: 'Sir Bumble', tier: 'Rookie', map: 'ember', portrait: 0, think: 2.2, skill: 0.25, spell: 0, mistakes: 0.3,
    quote: 'I polished my sword! ...Which end is the pointy one?' , ward: 'Princess Pom' },
  { id: 'wren', power: 0.45, name: 'Wren the Scribe', tier: 'Rookie', map: 'ember', portrait: 1, think: 2.0, skill: 0.4, spell: 4, mistakes: 0.25,
    quote: 'I have read every book on tactics. Twice.', ward: 'Princess Pom' },
  { id: 'grizelda', power: 0.66, name: 'Grizelda', tier: 'Adept', map: 'marsh', portrait: 2, think: 1.6, skill: 0.5, spell: 4, mistakes: 0.18,
    quote: 'Hee hee! My bog creatures adore fresh letters.', ward: 'Princess Pom' },
  { id: 'baron', power: 0.72, name: 'Baron Fizzlewick', tier: 'Adept', map: 'marsh', portrait: 3, think: 1.35, skill: 0.6, spell: 4, mistakes: 0.14,
    quote: 'A gentleman never loses. He merely postpones winning.', ward: 'Princess Pom' },
  { id: 'barnacle', power: 1.05, name: 'Captain Barnacle', tier: 'Veteran', map: 'bay', portrait: 4, think: 1.1, skill: 0.68, spell: 5, mistakes: 0.1,
    quote: 'Arr! Me parrot can spell better than ye!', ward: 'Princess Pom' },
  { id: 'plume', power: 1.6, name: 'Madame Plume', tier: 'Veteran', map: 'bay', portrait: 5, think: 0.95, skill: 0.75, spell: 5, mistakes: 0.08,
    quote: 'Elegance, darling. Every letter in its place.', ward: 'Princess Pom' },
  { id: 'inkwell', power: 1.4, name: 'Lord Inkwell', tier: 'Master', map: 'iron', portrait: 6, think: 0.8, skill: 0.82, spell: 5, mistakes: 0.05,
    quote: 'I invented half of these letters. Hmph.', ward: 'Princess Pom' },
  { id: 'hoot', power: 1.6, name: 'Professor Hoot', tier: 'Master', map: 'iron', portrait: 7, think: 0.65, skill: 0.9, spell: 5, mistakes: 0.03,
    quote: 'Whooo will win? Statistically... me.', ward: 'Princess Pom' },
  { id: 'frost', power: 2.1, name: 'Queen Frostquill', tier: 'Grandmaster', map: 'iron', portrait: 8, think: 0.5, skill: 1.0, spell: 5, mistakes: 0.0,
    quote: 'Your words will freeze on your tongue.', ward: 'Princess Pom' },
];
export const RIVAL_BY_ID = Object.fromEntries(RIVALS.map(r => [r.id, r]));
export const TUTOR_RIVAL = { id: 'dummy', power: 0.3, name: 'Princess Pom (practice)', tier: 'Tutorial', map: 'ember', portrait: 2, portraitStrip: 'wards', think: 99, skill: 0.1, spell: 0, mistakes: 1,
  quote: '...', ward: 'Princess Pom', tutorial: true };

// ---------- Weapons ----------
export const RARITIES = [
  { id: 'white',  name: 'Common',    color: '#e8e8e8', dmg: 0.10, cd: 0.00, upgrade: false, sell: 15,  weight: 50 },
  { id: 'green',  name: 'Uncommon',  color: '#6fdc5b', dmg: 0.20, cd: 0.04, upgrade: false, sell: 35,  weight: 30 },
  { id: 'blue',   name: 'Rare',      color: '#4fa8ff', dmg: 0.35, cd: 0.08, upgrade: false, sell: 80,  weight: 14 },
  { id: 'purple', name: 'Epic',      color: '#c372ff', dmg: 0.55, cd: 0.12, upgrade: true,  sell: 0,   weight: 5 },
  { id: 'gold',   name: 'Legendary', color: '#ffc531', dmg: 0.80, cd: 0.18, upgrade: true,  sell: 0,   weight: 1 },
];
// icon index into the weapons sheet
export const WEAPON_BASES = {
  KING:  { name: 'Scepter', icon: 0, upgrade: 'Aura grants +60% speed instead of +35%' },
  MAGE:  { name: 'Crystal Staff', icon: 1, upgrade: 'Meteor strikes twice' },
  MONK:  { name: 'Jade Beads', icon: 2, upgrade: 'Still Mind also deals heavy damage' },
  NINJA: { name: 'Shuriken', icon: 3, upgrade: 'Shadow Flurry strikes 10 times' },
  DRUID: { name: 'Oak Staff', icon: 4, upgrade: 'Thornroot covers a much larger area' },
  TITAN: { name: 'War Hammer', icon: 5, upgrade: 'Quake Shout stuns twice as long' },
  HAWK:  { name: 'Longbow', icon: 6, upgrade: 'Skyfall Volley fires twice' },
  SAINT: { name: 'Holy Mace', icon: 7, upgrade: 'Sanctuary recharges twice as fast' },
};
export const WEAPON_ADJ = {
  white: ['Plain', 'Sturdy', 'Simple'], green: ['Keen', 'Mossy', 'Lucky'], blue: ['Gleaming', 'Tidal', 'Runed'],
  purple: ['Arcane', 'Shadowforged', 'Starlit'], gold: ['Sunborn', 'Royal', 'Mythic'],
};

// ---------- Items (shop) ----------
// value arrays are indexed by rarity 0..4
export const ITEMS = [
  { id: 'flask', type: 'active', name: 'Ink Flask', icon: 0, vals: [60, 90, 130, 180, 250], desc: v => `Instantly gain ${v} Ink.` },
  { id: 'frost', type: 'active', name: 'Frost Scroll', icon: 1, vals: [2, 2.5, 3, 3.5, 4.5], desc: v => `Freeze every enemy for ${v}s.` },
  { id: 'bomb', type: 'active', name: 'Firebomb', icon: 2, vals: [6, 9, 13, 18, 25], desc: v => `Blast every enemy for ${v}× a wave-scaled hit.` },
  { id: 'clover', type: 'active', name: 'Lucky Clover', icon: 3, vals: [1, 1, 2, 2, 3], desc: v => `Your next ${v} summon${v > 1 ? 's are' : ' is'} a golden hero letter.` },
  { id: 'shovel', type: 'active', name: 'Golden Shovel', icon: 4, vals: [1, 1, 2, 2, 3], desc: v => `Gain ${v} shovel${v > 1 ? 's' : ''} to dig locked cells.` },
  { id: 'horn', type: 'active', name: 'War Horn', icon: 11, vals: [6, 8, 10, 12, 15], desc: v => `All letters attack 60% faster for ${v}s.` },
  { id: 'ring', type: 'passive', name: 'Inkwell Ring', icon: 5, vals: [8, 12, 16, 22, 30], desc: v => `+${v}% Ink from defeated enemies.` },
  { id: 'quills', type: 'passive', name: 'Sharp Quills', icon: 6, vals: [5, 8, 12, 16, 22], desc: v => `+${v}% damage for all letters.` },
  { id: 'goldink', type: 'passive', name: 'Golden Ink Pot', icon: 7, vals: [2, 3, 4, 5, 7], desc: v => `+${v}% chance to summon golden hero letters.` },
  { id: 'pillow', type: 'passive', name: 'Royal Pillow', icon: 8, vals: [1, 1, 1, 2, 2], desc: v => `Your ward starts with +${v} life.` },
  { id: 'hourglass', type: 'passive', name: 'Golden Hourglass', icon: 9, vals: [5, 8, 12, 16, 22], desc: v => `Hero skills recharge ${v}% faster.` },
  { id: 'purse', type: 'passive', name: 'Coin Purse', icon: 10, vals: [10, 20, 30, 40, 55], desc: v => `+${v}% coins from matches.` },
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));
export const ITEM_PRICES = [60, 120, 240, 450, 800];
export const SHOP_RARITY_WEIGHTS = [45, 30, 16, 7, 2];
export const LOADOUT = { active: 2, passive: 3 };

// ---------- Daily buffs ----------
export const DAILY_BUFFS = [
  { id: 'sword', name: 'Day of Blades', desc: 'Swordsmen (S) deal +30% damage.' },
  { id: 'lance', name: 'Day of Lances', desc: 'Lancers (L) deal +30% damage.' },
  { id: 'bow', name: 'Day of Arrows', desc: 'Bowmen (B) deal +30% damage.' },
  { id: 'knight', name: 'Day of Steeds', desc: 'Knights (K) attack 25% faster.' },
  { id: 'gold', name: 'Golden Day', desc: 'Golden hero letters are 50% more common.' },
  { id: 'ink', name: 'Overflowing Inkwell', desc: 'Start every match with +60 Ink.' },
  { id: 'hero', name: 'Heroic Day', desc: 'Hero skills recharge 20% faster.' },
];

// ---------- Blessings: pick 1 of 3 before waves 3, 7, 11, 15 and 19 ----------
// icon: { item: i } (items sheet) · { letter: 'S' } (letter soldier) · { wild: true } · { hex: true }
export const DRAFT_WAVES = [3, 7, 11, 15, 19];
export const BOONS = [
  { id: 'serif',  name: 'Sharp Serifs',    col: '#ff8a5c', icon: { item: 6 },  desc: 'All your letters and heroes deal +20% damage.' },
  { id: 'cheap',  name: 'Cheap Ink',       col: '#7fd7ff', icon: { item: 0 },  desc: 'Summons cost 15% less Ink.' },
  { id: 'gilded', name: 'Gilded Quill',    col: '#ffd24a', icon: { item: 7 },  desc: 'Your next 3 summons are FREE golden hero letters, and golden letters turn up 4% more often.' },
  { id: 'lucky',  name: 'Lucky Star',      col: '#7fe08a', icon: { item: 3 },  desc: '+40% chance that a summoned letter arrives at Lv 2.' },
  { id: 'blade',  name: 'Whirling Blades', col: '#e8453c', icon: { letter: 'S' }, desc: 'Swordsmen (S) deal +50% damage with a 30% wider splash. Your next 3 basic summons are S.' },
  { id: 'lance',  name: 'Long Lances',     col: '#3d7fe6', icon: { letter: 'L' }, desc: 'Lancers (L) reach 0.8 tiles further and deal +40% damage. Your next 3 basic summons are L.' },
  { id: 'eagle',  name: 'Eagle Eye',       col: '#43b04a', icon: { letter: 'B' }, desc: 'Bowmen (B) reach 0.8 tiles further and deal +40% damage. Your next 3 basic summons are B.' },
  { id: 'charge', name: 'Cavalry Charge',  col: '#f08a24', icon: { letter: 'K' }, desc: 'Knights (K) attack 70% faster. Your next 3 basic summons are K.' },
  { id: 'rebate', name: 'Merge Rebate',    col: '#c9a7ff', icon: { item: 5 },  desc: 'Every merge refunds Ink: 12 × the new level.' },
  { id: 'tempo',  name: 'Heroic Tempo',    col: '#ffe066', icon: { item: 9 },  desc: 'Hero skills recharge 25% faster.' },
  { id: 'guard',  name: 'Royal Guard',     col: '#ff8fa0', icon: { item: 8 },  desc: 'Your ward gets 2 shield charges. Each one blocks a leaking enemy (shields are not lives).' },
  { id: 'chill',  name: 'Chill Wind',      col: '#bfe9ff', icon: { item: 1 },  desc: 'Enemies on your road move 10% slower.' },
  { id: 'bounty', name: 'Bounty Hunter',   col: '#ffc531', icon: { item: 10 }, desc: '+40% Ink from defeated enemies.' },
  { id: 'crit',   name: 'Critical Ink',    col: '#ff5d7a', icon: { item: 2 },  desc: 'Attacks have a 15% chance to crit for 2.5× damage.' },
  { id: 'slayer', name: 'Giant Slayer',    col: '#ff6b5e', icon: { item: 11 }, desc: 'Double damage against bosses and Hexed Brutes.' },
  { id: 'wild',   name: 'Wildcard',        col: '#e0a8ff', icon: { wild: true }, desc: 'Your next 2 summons are ★ wild letters. A ★ counts as ANY letter in a hero name.' },
  { id: 'hexer',  name: 'Hexcraft',        col: '#b07cff', icon: { hex: true }, desc: 'Your Hex charges twice as fast and your Brutes are 80% tougher.' },
  { id: 'dig',    name: 'Prospector',      col: '#ffd88a', icon: { item: 4 },  desc: '+2 shovels and +100 Ink right now, and shovels turn up more often.' },
];
export const BOON_BY_ID = Object.fromEntries(BOONS.map(b => [b.id, b]));

// ---------- Daily quests (3 per day) ----------
// m(res) → progress this match adds; res = { won, mode, stats, lives }
export const QUESTS = [
  { id: 'win',      text: 'Win 2 duels',                         goal: 2,   coins: 90,  xp: 40, m: r => r.won ? 1 : 0 },
  { id: 'spell',    text: 'Spell 5 heroes',                      goal: 5,   coins: 70,  xp: 30, m: r => r.stats.heroes },
  { id: 'lv5',      text: 'Merge a letter up to Lv 5',           goal: 1,   coins: 70,  xp: 30, m: r => r.stats.maxLevel >= 5 ? 1 : 0 },
  { id: 'kills',    text: 'Defeat 300 enemies',                  goal: 300, coins: 60,  xp: 30, m: r => r.stats.kills },
  { id: 'hex',      text: 'Hex your rivals 4 times',             goal: 4,   coins: 70,  xp: 30, m: r => r.stats.hexes || 0 },
  { id: 'brute',    text: 'Defeat 3 Hexed Brutes',               goal: 3,   coins: 70,  xp: 30, m: r => r.stats.brutes || 0 },
  { id: 'boons',    text: 'Choose 6 blessings',                  goal: 6,   coins: 60,  xp: 30, m: r => r.stats.boons || 0 },
  { id: 'calls',    text: 'Call 5 waves early',                  goal: 5,   coins: 60,  xp: 30, m: r => r.stats.calls || 0 },
  { id: 'daily',    text: 'Play the Daily Duel',                 goal: 1,   coins: 50,  xp: 25, m: r => r.mode === 'daily' ? 1 : 0 },
  { id: 'combo',    text: 'Land a ×3 merge combo',               goal: 1,   coins: 60,  xp: 30, m: r => (r.stats.maxCombo || 0) >= 3 ? 1 : 0 },
  { id: 'flawless', text: 'Win a duel without losing a life',    goal: 1,   coins: 120, xp: 50, m: r => r.won && r.stats.leaks === 0 ? 1 : 0 },
  { id: 'merges',   text: 'Merge letters 40 times',              goal: 40,  coins: 60,  xp: 30, m: r => r.stats.merges },
  { id: 'wild',     text: 'Spell a hero with a ★ wild letter',   goal: 1,   coins: 80,  xp: 35, m: r => r.stats.wildSpells || 0 },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
export const QUEST_ALL_BONUS = 80; // coins for claiming all three

// ---------- Progression ----------
export function xpForLevel(lvl) { return Math.round(100 + (lvl - 1) * 70 + Math.pow(lvl - 1, 2) * 12); }
export const SUMMON_BASE = 10;
export const SUMMON_STEP = 3;
export const PASSIVE_INK = 1.5; // ink per second
export const START_INK = 100;
export const TRAIN_COSTS = [60, 120, 220, 360, 550];
export const TRAIN_BONUS = 0.18; // +18% damage per training rank
