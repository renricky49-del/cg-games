// Teahouse renovation meta: 5 areas x 5 tasks. Positions are fractions of the 16:9 scene
// (x = centre, y = bottom edge, w = width). z = draw order (higher = in front).
// before = neglected variant of the background, cross-faded to bg as tasks complete. ambient = overlay effect.
// glow on a task = warm pulsing light (lanterns).
// perk = permanent gameplay bonus granted by the restoration (stacks): coins %, fill (Tea Rush fills %
// faster), rushT (+s Tea Rush), par (+% 3-star time), undo / hint / shuffle (free uses per level),
// gold (+coins per golden pair), gpair (+1 golden pair per level), rushStart (meter starts at %), tips (coins/hour).
export const AREAS = [
  {
    id: 'courtyard', name: 'Courtyard Gate', chapter: 'Chapter 1 · The Old Gate', bg: 'area1', before: 'before1',
    tasks: [
      { name: 'Flower Planter', perk: ['coins', 10], desc: 'Brighten the entrance', img: 'a1_4', cost: 2, x: 0.2, y: 0.97, w: 0.25, z: 5 },
      { name: 'Red Lanterns', perk: ['fill', 15], desc: 'Light the way in', img: 'a1_2', glow: 1, cost: 3, x: 0.8, y: 0.46, w: 0.15, z: 2 },
      { name: 'Bonsai Pine', perk: ['par', 10], desc: 'A patient little tree', img: 'a1_3', cost: 4, x: 0.84, y: 0.93, w: 0.15, z: 4 },
      { name: 'Guardian Lion', perk: ['undo', 1], desc: 'Keeps watch over guests', img: 'a1_1', cost: 5, x: 0.3, y: 0.7, w: 0.1, z: 3 },
      { name: 'Grand Gate', perk: ['tips', 20], desc: 'Restore the painted gateway', img: 'a1_0', cost: 6, x: 0.535, y: 0.585, w: 0.32, z: 1 },
    ],
  },
  {
    id: 'tearoom', name: 'Tea Room', chapter: 'Chapter 2 · The Tea Room', bg: 'area2', before: 'before2',
    tasks: [
      { name: 'Silk Lanterns', perk: ['rushT', 1], desc: 'Warm light overhead', img: 'a2_3', glow: 1, cost: 4, x: 0.5, y: 0.44, w: 0.13, z: 1 },
      { name: 'Tea Shelf', perk: ['coins', 10], desc: 'Jars of fine leaves', img: 'a2_1', cost: 4, x: 0.17, y: 0.78, w: 0.15, z: 2 },
      { name: 'Painted Screen', perk: ['par', 10], desc: 'Misty mountain panels', img: 'a2_2', cost: 5, x: 0.8, y: 0.76, w: 0.24, z: 2 },
      { name: 'Tea Table', perk: ['tips', 25], desc: 'Low table and cushions', img: 'a2_0', cost: 5, x: 0.5, y: 0.95, w: 0.32, z: 3 },
      { name: 'Celadon Tea Set', perk: ['rushStart', 25], desc: 'Ready for the first pour', img: 'a2_4', cost: 6, x: 0.5, y: 0.82, w: 0.13, z: 4 },
    ],
  },
  {
    id: 'pond', name: 'Koi Pond', chapter: 'Chapter 3 · The Koi Pond', bg: 'area3', before: 'before3',
    tasks: [
      { name: 'Water Lilies', perk: ['gold', 15], desc: 'Floating blossoms', img: 'a3_1', cost: 4, x: 0.27, y: 0.8, w: 0.19, z: 2 },
      { name: 'Koi Fish', perk: ['fill', 15], desc: 'Two lucky friends', img: 'a3_2', cost: 5, x: 0.66, y: 0.84, w: 0.12, z: 2, anim: 'swim' },
      { name: 'Stepping Stones', perk: ['undo', 1], desc: 'A path across the water', img: 'a3_3', cost: 5, x: 0.52, y: 0.98, w: 0.36, z: 3 },
      { name: 'Stone Lantern', perk: ['rushT', 1], desc: 'Glows at the water’s edge', img: 'a3_4', glow: 1, cost: 5, x: 0.89, y: 0.62, w: 0.09, z: 1 },
      { name: 'Red Bridge', perk: ['gpair', 1], desc: 'An arch over the pond', img: 'a3_0', cost: 6, x: 0.5, y: 0.6, w: 0.42, z: 1 },
    ],
  },
  {
    id: 'grove', name: 'Blossom Meadow', chapter: 'Chapter 4 · Blossom Meadow', bg: 'area4', before: 'before4', ambient: 'petals',
    tasks: [
      { name: 'Azalea Bush', perk: ['coins', 10], desc: 'Pink and white blooms', img: 'a4_4', cost: 4, x: 0.43, y: 1.0, w: 0.17, z: 5 },
      { name: 'Bamboo Grove', perk: ['rushStart', 25], desc: 'Whispers in the wind', img: 'a4_3', cost: 5, x: 0.92, y: 0.99, w: 0.15, z: 5 },
      { name: 'Garden Bench', perk: ['tips', 30], desc: 'A place to rest', img: 'a4_2', cost: 5, x: 0.52, y: 0.8, w: 0.16, z: 3 },
      { name: 'Little Pavilion', perk: ['hint', 1], desc: 'Shade for tea outdoors', img: 'a4_1', cost: 5, x: 0.75, y: 0.68, w: 0.22, z: 2 },
      { name: 'Cherry Tree', perk: ['par', 10], desc: 'The meadow’s crown', img: 'a4_0', cost: 6, x: 0.2, y: 0.9, w: 0.34, z: 4 },
    ],
  },
  {
    id: 'terrace', name: 'Moon Terrace', chapter: 'Chapter 5 · Moon Terrace', bg: 'area5', before: 'before5', ambient: 'fireflies',
    tasks: [
      { name: 'White Orchids', perk: ['gold', 15], desc: 'Moonlit petals', img: 'a5_4', cost: 4, x: 0.12, y: 0.98, w: 0.17, z: 5 },
      { name: 'Sky Lanterns', perk: ['rushT', 1], desc: 'Wishes drifting up', img: 'a5_1', glow: 1, cost: 5, x: 0.7, y: 0.42, w: 0.15, z: 1, anim: 'float' },
      { name: 'Guqin Zither', perk: ['fill', 20], desc: 'Music for the evening', img: 'a5_3', cost: 5, x: 0.8, y: 0.92, w: 0.25, z: 4 },
      { name: 'Moon Gate', perk: ['coins', 15], desc: 'A circle for the full moon', img: 'a5_0', cost: 5, x: 0.33, y: 0.7, w: 0.3, z: 2 },
      { name: 'Tea Ceremony', perk: ['shuffle', 1], desc: 'A perfect cup under the moon', img: 'a5_2', cost: 6, x: 0.53, y: 0.97, w: 0.24, z: 4 },
    ],
  },
  {
    id: 'terraces', name: 'Tea Terraces', chapter: 'Chapter 6 · Tea Terraces', bg: 'area6', before: 'before6', ambient: 'petals',
    tasks: [
      { name: 'Leaf Baskets', perk: ['tips', 30], desc: 'Fresh pickings', img: 'a6_3', cost: 4, x: 0.3, y: 0.97, w: 0.17, z: 5 },
      { name: 'Hillside Shrine', perk: ['undo', 1], desc: 'Incense for a good harvest', img: 'a6_4', cost: 4, x: 0.88, y: 0.95, w: 0.12, z: 5 },
      { name: 'Drying Rack', perk: ['coins', 15], desc: 'Leaves curing in the sun', img: 'a6_2', cost: 5, x: 0.5, y: 0.76, w: 0.17, z: 3 },
      { name: 'Water Wheel', perk: ['rushStart', 25], desc: 'Turning by the stream', img: 'a6_1', cost: 5, x: 0.14, y: 0.74, w: 0.2, z: 2 },
      { name: 'Pickers\u2019 Hut', perk: ['gpair', 1], desc: 'Shade and a hot pot of tea', img: 'a6_0', cost: 6, x: 0.75, y: 0.7, w: 0.22, z: 2 },
    ],
  },
  {
    id: 'winter', name: 'Winter Courtyard', chapter: 'Chapter 7 · Winter Courtyard', bg: 'area7', before: 'before7', ambient: 'snow',
    tasks: [
      { name: 'Blanket Bench', perk: ['tips', 40], desc: 'Warm seats for guests', img: 'a7_4', cost: 4, x: 0.16, y: 0.95, w: 0.18, z: 5 },
      { name: 'Snow Lantern', perk: ['rushT', 1], desc: 'A glow in the snowfall', img: 'a7_2', glow: 1, cost: 5, x: 0.62, y: 0.86, w: 0.08, z: 4 },
      { name: 'Kettle Brazier', perk: ['par', 10], desc: 'Tea kept hot all winter', img: 'a7_3', cost: 5, x: 0.43, y: 0.98, w: 0.13, z: 5 },
      { name: 'Red Plum Tree', perk: ['gold', 20], desc: 'Blossoms in the cold', img: 'a7_1', cost: 6, x: 0.45, y: 0.7, w: 0.22, z: 2 },
      { name: 'Snowy Pavilion', perk: ['hint', 1], desc: 'The teahouse is complete', img: 'a7_0', cost: 6, x: 0.2, y: 0.68, w: 0.22, z: 3 },
    ],
  },
];

export const LEVELS_PER_CHAPTER = 12;

export const PERK_TEXT = {
  coins: (v) => `+${v}% coins from levels`,
  fill: (v) => `Tea Rush fills ${v}% faster`,
  rushT: (v) => `Tea Rush lasts +${v}s`,
  par: (v) => `+${v}% time for 3 stars`,
  undo: (v) => `${v} free Undo every level`,
  hint: (v) => `${v} free Hint every level`,
  shuffle: (v) => `${v} free Shuffle every level`,
  gold: (v) => `Golden pairs pay +${v} coins`,
  gpair: (v) => `+${v} golden pair every level`,
  rushStart: (v) => `Tea Rush meter starts at ${v}%`,
  tips: (v) => `Guests tip +${v} coins/hour`,
};
