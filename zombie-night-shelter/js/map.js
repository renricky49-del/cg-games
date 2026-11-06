// Apartment floor layouts. All coordinates are in tiles; tile (x,y) covers [x,x+1)x[y,y+1).
// Rows: 0 outer wall | 1-5 top apartments | 6 door wall | 7-9 corridor | 10 door wall | 11-15 bottom apartments | 16 outer wall
// Columns: 0 outer wall | 1-4 stairwell (zombie lair) | 5 wall | rooms ... | last outer wall

export const MAP_H = 17;
export const CORR_Y0 = 7, CORR_Y1 = 10; // continuous corridor band

const LAYOUTS = [
  {
    name: 'Maple Court',
    top: [[5, [4]], [4, [0]], [6, [1, 4]], [5, [2]], [5, [4]]],
    bottom: [[4, [1]], [6, [5]], [5, [0]], [4, [2]], [6, [0, 5]]],
  },
  {
    name: 'Elm Tower',
    top: [[6, [0, 5]], [4, [3]], [5, [0]], [5, [2]], [5, [4]]],
    bottom: [[5, [4]], [5, [0]], [4, [2]], [6, [1, 4]], [5, [0]]],
  },
  {
    name: 'Birch Block',
    top: [[4, [3]], [5, [0]], [5, [2]], [6, [0, 5]], [5, [1]]],
    bottom: [[6, [2]], [4, [3]], [5, [0]], [5, [4]], [5, [0]]],
  },
];

const ROOM_NAMES_TOP = ['1A', '1B', '1C', '1D', '1E'];
const ROOM_NAMES_BOT = ['2A', '2B', '2C', '2D', '2E'];

export function buildMap(index, rng) {
  const L = LAYOUTS[index % LAYOUTS.length];
  const rooms = [];
  let maxX = 0;
  const addRow = (row, isTop) => {
    let x = 6;
    row.forEach(([w, doorOffs], i) => {
      const y = isTop ? 1 : 11, h = 5;
      const room = {
        id: rooms.length, label: (isTop ? ROOM_NAMES_TOP : ROOM_NAMES_BOT)[i],
        x, y, w, h, top: isTop, doors: [], tiles: [], bed: null, decor: [],
      };
      for (const o of doorOffs) {
        const dx = x + o;
        room.doors.push({
          tx: dx, ty: isTop ? 6 : 10,
          fx: dx + 0.5, fy: isTop ? CORR_Y0 + 0.55 : CORR_Y1 - 0.55, // stand point in corridor
          ix: dx + 0.5, iy: isTop ? 5.5 : 11.5,                       // just inside
          hp: 0, crack: 0, shake: 0,
        });
      }
      // bed: in the far row, in the column furthest from all doors
      let best = x, bestD = -1;
      for (let cx = x; cx < x + w; cx++) {
        const d = Math.min(...room.doors.map((dd) => Math.abs(dd.tx - cx)));
        if (d > bestD || (d === bestD && rng() < 0.5)) { bestD = d; best = cx; }
      }
      const by = isTop ? 1 : 14;
      room.bed = { tx: best, ty: by, x: best + 0.5, y: by + 1 };
      const reserved = new Set([`${best},${by}`, `${best},${by + 1}`]);
      for (const d of room.doors) reserved.add(`${d.tx},${isTop ? 5 : 11}`);
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (!reserved.has(`${tx},${ty}`)) room.tiles.push({ tx, ty });
        }
      }
      // a couple of decorative props (hidden when something is built on the tile)
      const decorKinds = ['rug', 'plant', 'boxes', 'lamp', 'chair'];
      const n = 1 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const t = room.tiles[Math.floor(rng() * room.tiles.length)];
        if (!room.decor.find((d) => d.tx === t.tx && d.ty === t.ty)) {
          room.decor.push({ tx: t.tx, ty: t.ty, kind: decorKinds[Math.floor(rng() * decorKinds.length)], rot: (rng() - 0.5) * 0.6 });
        }
      }
      // room "attractiveness" for AI picking: size + neighbouring doors
      room.size = w * h;
      rooms.push(room);
      x += w + 1;
    });
    maxX = Math.max(maxX, x);
  };
  addRow(L.top, true);
  addRow(L.bottom, false);
  const W = maxX; // column maxX-1 is the right outer wall
  // neighbour door distance score
  for (const r of rooms) {
    let s = 0;
    for (const o of rooms) {
      if (o === r) continue;
      for (const d of r.doors) for (const e of o.doors) {
        const dist = Math.hypot(d.fx - e.fx, d.fy - e.fy);
        if (dist < 6) s += (6 - dist);
      }
    }
    r.support = s;
  }
  return {
    name: L.name, W: W, H: MAP_H, rooms,
    lair: { x: 1, y: 1, w: 4, h: 15, sx: 2.5, sy: 8.5 },
    corridor: { x0: 1, x1: W - 1, y0: CORR_Y0, y1: CORR_Y1 },
  };
}

// Is tile (tx,ty) a wall? Used by the static renderer.
export function tileKind(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return 'void';
  if (ty >= CORR_Y0 && ty < CORR_Y1 && tx >= 1 && tx < map.W - 1) return 'corridor';
  if (tx >= 1 && tx <= 4 && ty >= 1 && ty <= 15) return 'lair';
  for (const r of map.rooms) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return 'room';
    for (const d of r.doors) if (d.tx === tx && d.ty === ty) return 'door';
  }
  return 'wall';
}

export function roomAt(map, x, y) {
  for (const r of map.rooms) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    for (const d of r.doors) if (Math.floor(x) === d.tx && Math.floor(y) === d.ty) return r;
  }
  return null;
}
