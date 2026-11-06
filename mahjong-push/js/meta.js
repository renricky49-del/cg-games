// Teahouse renovation meta: 5 areas x 5 tasks. Positions are fractions of the 16:9 scene
// (x = centre, y = bottom edge, w = width). z = draw order (higher = in front).
// before = neglected variant of the background, cross-faded to bg as tasks complete. ambient = overlay effect.
// glow on a task = warm pulsing light (lanterns).
export const AREAS = [
  {
    id: 'courtyard', name: 'Courtyard Gate', chapter: 'Chapter 1 · The Old Gate', bg: 'area1', before: 'before1',
    tasks: [
      { name: 'Flower Planter', desc: 'Brighten the entrance', img: 'a1_4', cost: 2, x: 0.2, y: 0.97, w: 0.25, z: 5 },
      { name: 'Red Lanterns', desc: 'Light the way in', img: 'a1_2', glow: 1, cost: 3, x: 0.8, y: 0.46, w: 0.15, z: 2 },
      { name: 'Bonsai Pine', desc: 'A patient little tree', img: 'a1_3', cost: 3, x: 0.84, y: 0.93, w: 0.15, z: 4 },
      { name: 'Guardian Lion', desc: 'Keeps watch over guests', img: 'a1_1', cost: 4, x: 0.3, y: 0.7, w: 0.1, z: 3 },
      { name: 'Grand Gate', desc: 'Restore the painted gateway', img: 'a1_0', cost: 5, x: 0.535, y: 0.585, w: 0.32, z: 1 },
    ],
  },
  {
    id: 'tearoom', name: 'Tea Room', chapter: 'Chapter 2 · The Tea Room', bg: 'area2', before: 'before2',
    tasks: [
      { name: 'Silk Lanterns', desc: 'Warm light overhead', img: 'a2_3', glow: 1, cost: 3, x: 0.5, y: 0.44, w: 0.13, z: 1 },
      { name: 'Tea Shelf', desc: 'Jars of fine leaves', img: 'a2_1', cost: 4, x: 0.17, y: 0.78, w: 0.15, z: 2 },
      { name: 'Painted Screen', desc: 'Misty mountain panels', img: 'a2_2', cost: 4, x: 0.8, y: 0.76, w: 0.24, z: 2 },
      { name: 'Tea Table', desc: 'Low table and cushions', img: 'a2_0', cost: 5, x: 0.5, y: 0.95, w: 0.32, z: 3 },
      { name: 'Celadon Tea Set', desc: 'Ready for the first pour', img: 'a2_4', cost: 6, x: 0.5, y: 0.82, w: 0.13, z: 4 },
    ],
  },
  {
    id: 'pond', name: 'Koi Pond', chapter: 'Chapter 3 · The Koi Pond', bg: 'area3', before: 'before3',
    tasks: [
      { name: 'Water Lilies', desc: 'Floating blossoms', img: 'a3_1', cost: 4, x: 0.27, y: 0.8, w: 0.19, z: 2 },
      { name: 'Koi Fish', desc: 'Two lucky friends', img: 'a3_2', cost: 4, x: 0.66, y: 0.84, w: 0.12, z: 2, anim: 'swim' },
      { name: 'Stepping Stones', desc: 'A path across the water', img: 'a3_3', cost: 5, x: 0.52, y: 0.98, w: 0.36, z: 3 },
      { name: 'Stone Lantern', desc: 'Glows at the water’s edge', img: 'a3_4', glow: 1, cost: 5, x: 0.89, y: 0.62, w: 0.09, z: 1 },
      { name: 'Red Bridge', desc: 'An arch over the pond', img: 'a3_0', cost: 6, x: 0.5, y: 0.6, w: 0.42, z: 1 },
    ],
  },
  {
    id: 'grove', name: 'Blossom Meadow', chapter: 'Chapter 4 · Blossom Meadow', bg: 'area4', before: 'before4', ambient: 'petals',
    tasks: [
      { name: 'Azalea Bush', desc: 'Pink and white blooms', img: 'a4_4', cost: 4, x: 0.43, y: 1.0, w: 0.17, z: 5 },
      { name: 'Bamboo Grove', desc: 'Whispers in the wind', img: 'a4_3', cost: 5, x: 0.92, y: 0.99, w: 0.15, z: 5 },
      { name: 'Garden Bench', desc: 'A place to rest', img: 'a4_2', cost: 5, x: 0.52, y: 0.8, w: 0.16, z: 3 },
      { name: 'Little Pavilion', desc: 'Shade for tea outdoors', img: 'a4_1', cost: 6, x: 0.75, y: 0.68, w: 0.22, z: 2 },
      { name: 'Cherry Tree', desc: 'The meadow’s crown', img: 'a4_0', cost: 6, x: 0.2, y: 0.9, w: 0.34, z: 4 },
    ],
  },
  {
    id: 'terrace', name: 'Moon Terrace', chapter: 'Chapter 5 · Moon Terrace', bg: 'area5', before: 'before5', ambient: 'fireflies',
    tasks: [
      { name: 'White Orchids', desc: 'Moonlit petals', img: 'a5_4', cost: 5, x: 0.12, y: 0.98, w: 0.17, z: 5 },
      { name: 'Sky Lanterns', desc: 'Wishes drifting up', img: 'a5_1', glow: 1, cost: 5, x: 0.7, y: 0.42, w: 0.15, z: 1, anim: 'float' },
      { name: 'Guqin Zither', desc: 'Music for the evening', img: 'a5_3', cost: 6, x: 0.8, y: 0.92, w: 0.25, z: 4 },
      { name: 'Moon Gate', desc: 'A circle for the full moon', img: 'a5_0', cost: 6, x: 0.33, y: 0.7, w: 0.3, z: 2 },
      { name: 'Tea Ceremony', desc: 'A perfect cup under the moon', img: 'a5_2', cost: 7, x: 0.53, y: 0.97, w: 0.24, z: 4 },
    ],
  },
  {
    id: 'terraces', name: 'Tea Terraces', chapter: 'Chapter 6 · Tea Terraces', bg: 'area6', before: 'before6', ambient: 'petals',
    tasks: [
      { name: 'Leaf Baskets', desc: 'Fresh pickings', img: 'a6_3', cost: 5, x: 0.3, y: 0.97, w: 0.17, z: 5 },
      { name: 'Hillside Shrine', desc: 'Incense for a good harvest', img: 'a6_4', cost: 6, x: 0.88, y: 0.95, w: 0.12, z: 5 },
      { name: 'Drying Rack', desc: 'Leaves curing in the sun', img: 'a6_2', cost: 6, x: 0.5, y: 0.76, w: 0.17, z: 3 },
      { name: 'Water Wheel', desc: 'Turning by the stream', img: 'a6_1', cost: 7, x: 0.14, y: 0.74, w: 0.2, z: 2 },
      { name: 'Pickers\u2019 Hut', desc: 'Shade and a hot pot of tea', img: 'a6_0', cost: 7, x: 0.75, y: 0.7, w: 0.22, z: 2 },
    ],
  },
  {
    id: 'winter', name: 'Winter Courtyard', chapter: 'Chapter 7 · Winter Courtyard', bg: 'area7', before: 'before7', ambient: 'snow',
    tasks: [
      { name: 'Blanket Bench', desc: 'Warm seats for guests', img: 'a7_4', cost: 6, x: 0.16, y: 0.95, w: 0.18, z: 5 },
      { name: 'Snow Lantern', desc: 'A glow in the snowfall', img: 'a7_2', glow: 1, cost: 6, x: 0.62, y: 0.86, w: 0.08, z: 4 },
      { name: 'Kettle Brazier', desc: 'Tea kept hot all winter', img: 'a7_3', cost: 7, x: 0.43, y: 0.98, w: 0.13, z: 5 },
      { name: 'Red Plum Tree', desc: 'Blossoms in the cold', img: 'a7_1', cost: 7, x: 0.45, y: 0.7, w: 0.22, z: 2 },
      { name: 'Snowy Pavilion', desc: 'The teahouse is complete', img: 'a7_0', cost: 8, x: 0.2, y: 0.68, w: 0.22, z: 3 },
    ],
  },
];

export const LEVELS_PER_CHAPTER = 12;
