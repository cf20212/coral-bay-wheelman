// Coral Bay itself: a seeded grid city of avenues and streets with seven districts, a
// beach and a bay to the east, eight named landmarks, props, parking and hiding spots.
// Generation is deterministic for a seed so every player (and every screenshot) sees
// the same city.

import { AVENUES, STREETS, ROAD_HALF, LANE, WORLD, PALETTE } from './config.js';
import { makeRng, randRange, randInt, pick, clamp } from './random.js';

const X_EDGES = [70, ...AVENUES, WORLD.beachX];
const Y_EDGES = [70, ...STREETS, 2430];

function blockRect(col, row) {
  const x0 = X_EDGES[col] + ROAD_HALF;
  const x1 = X_EDGES[col + 1] - ROAD_HALF;
  const y0 = Y_EDGES[row] + ROAD_HALF;
  const y1 = Y_EDGES[row + 1] - ROAD_HALF;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

export function districtAt(x, y) {
  if (x >= WORLD.beachX - 10) return 'Beachfront';
  if (x > 700 && x < 1750 && y > 560 && y < 1560) return 'Downtown';
  if (y > 1830 && x > 1560) return 'Harbour';
  if (y > 1830) return 'Industrial';
  if (x < 700 && y > 950) return 'Civic Quarter';
  if (x > 2050) return 'Beachfront';
  return 'Suburbs';
}

const LANDMARK_SPOTS = [
  { id: 'cafe', name: 'Café Brisa', col: 6, row: 1, kind: 'cafe' },
  { id: 'garage', name: 'Voss Auto Works', col: 2, row: 5, kind: 'garage' },
  { id: 'motel', name: 'Coral Sands Motel', col: 0, row: 1, kind: 'motel' },
  { id: 'police', name: 'CBPD Central', col: 1, row: 4, kind: 'police' },
  { id: 'hospital', name: 'St. Marina General', col: 3, row: 4, kind: 'hospital' },
  { id: 'safehouse', name: "Marco's Safehouse", col: 0, row: 0, kind: 'safehouse' },
];

export class City {
  constructor(seed = 7) {
    const rng = makeRng(seed * 1000 + 17);
    this.seed = seed;
    this.buildings = [];
    this.props = [];
    this.landmarks = [];
    this.parkingSpots = [];
    this.stashSpots = [];
    this.foodStands = [];
    this.blocks = [];
    this.buildBlocks(rng);
    this.buildLandmarks(rng);
    this.buildProps(rng);
    this.buildParking(rng);
    this.buildStashes(rng);
    // The marina pier reaches into the bay; the skiff is moored at its end.
    this.pier = { x: 2740, y: 1152, w: 230, h: 26 };
    this.boatSpawn = { x: 2988, y: 1165, angle: 0 };
    this.buoy = { x: 3120, y: 700 };
    this.shipyard = { x: 2146, y: 1886, w: 368, h: 308, gateX: 2330, gateY: 1886 };
    this.foodStands = [
      { x: 2700, y: 700, name: 'Taco Skiff' },
      { x: 1210, y: 1085, name: 'Noodle Cartel' },
    ];
  }

  buildBlocks(rng) {
    for (let col = 0; col < X_EDGES.length - 1; col += 1) {
      for (let row = 0; row < Y_EDGES.length - 1; row += 1) {
        const rect = blockRect(col, row);
        const district = districtAt(rect.cx, rect.cy);
        const isPark = col === 1 && row === 2;
        const isShipyard = col === 5 && row === 5;
        this.blocks.push({ ...rect, col, row, district, isPark, isShipyard });
        if (isPark || isShipyard) continue;
        this.fillBlock(rng, rect, district);
      }
    }
  }

  fillBlock(rng, rect, district) {
    const inset = 16;
    const inner = { x: rect.x + inset, y: rect.y + inset, w: rect.w - inset * 2, h: rect.h - inset * 2 };
    const cols = district === 'Downtown' ? 2 : rng() < 0.6 ? 2 : 1;
    const rows = district === 'Suburbs' ? 2 : rng() < 0.6 ? 2 : 1;
    const roofSet = district === 'Downtown' ? PALETTE.roofB : district === 'Harbour' || district === 'Industrial' ? PALETTE.roofC : district === 'Civic Quarter' ? PALETTE.roofD : PALETTE.roofA;
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const w = inner.w / cols;
        const h = inner.h / rows;
        const gap = district === 'Suburbs' ? 14 : 9;
        const floors = district === 'Downtown' ? randInt(rng, 6, 14) : district === 'Civic Quarter' ? randInt(rng, 3, 6) : randInt(rng, 1, 3);
        this.buildings.push({
          x: inner.x + i * w + gap / 2,
          y: inner.y + j * h + gap / 2,
          w: w - gap,
          h: h - gap,
          floors,
          colour: pick(rng, roofSet),
          district,
          sign: null,
        });
      }
    }
  }

  buildLandmarks(rng) {
    for (const spot of LANDMARK_SPOTS) {
      const rect = blockRect(spot.col, spot.row);
      // Clear whatever the filler put on the landmark's block corner and drop a signed building.
      const bx = rect.x + 20;
      const by = rect.y + 20;
      const bw = Math.min(150, rect.w - 40);
      const bh = Math.min(110, rect.h - 40);
      this.buildings = this.buildings.filter((b) => !(b.x > rect.x - 4 && b.x < rect.x + rect.w + 4 && b.y > rect.y - 4 && b.y < rect.y + rect.h + 4 && b.x < bx + bw + 30 && b.y < by + bh + 30));
      const building = { x: bx, y: by, w: bw, h: bh, floors: spot.kind === 'hospital' ? 7 : 2, colour: '#c9b189', district: districtAt(rect.cx, rect.cy), sign: spot.name };
      this.buildings.push(building);
      this.landmarks.push({ id: spot.id, name: spot.name, kind: spot.kind, x: bx + bw / 2, y: by + bh + 26, doorX: bx + bw / 2, doorY: by + bh + 16 });
    }
    this.landmarks.push({ id: 'shipyard', name: 'Coral Bay Shipyard', kind: 'shipyard', x: 2330, y: 1980, doorX: 2330, doorY: 1900 });
    this.landmarks.push({ id: 'marina', name: 'Marina Pier', kind: 'marina', x: 2850, y: 1165, doorX: 2800, doorY: 1165 });
  }

  landmark(id) {
    return this.landmarks.find((l) => l.id === id);
  }

  buildProps(rng) {
    // Palms along the beach and the beachfront avenue.
    for (let y = 160; y < 2380; y += randRange(rng, 90, 150)) {
      this.props.push({ kind: 'palm', x: WORLD.beachX + randRange(rng, 14, 60), y });
      if (rng() < 0.7) this.props.push({ kind: 'palm', x: 2680 + randRange(rng, -8, 8), y: y + 30 });
    }
    // Trees fill the park block and dot the suburbs.
    const park = this.blocks.find((b) => b.isPark);
    if (park) {
      for (let i = 0; i < 42; i += 1) {
        this.props.push({ kind: 'tree', x: randRange(rng, park.x + 24, park.x + park.w - 24), y: randRange(rng, park.y + 24, park.y + park.h - 24) });
      }
    }
    for (const block of this.blocks) {
      if (block.district === 'Suburbs') {
        for (let i = 0; i < 5; i += 1) {
          this.props.push({ kind: 'tree', x: randRange(rng, block.x + 10, block.x + block.w - 10), y: randRange(rng, block.y + 10, block.y + block.h - 10) });
        }
      }
      if (block.district === 'Harbour' || block.district === 'Industrial' || block.isShipyard) {
        const n = block.isShipyard ? 14 : 6;
        for (let i = 0; i < n; i += 1) {
          this.props.push({ kind: 'crate', x: randRange(rng, block.x + 16, block.x + block.w - 16), y: randRange(rng, block.y + 16, block.y + block.h - 16) });
        }
      }
    }
    // Street lamps near intersections.
    for (const ax of AVENUES) {
      for (const sy of STREETS) {
        this.props.push({ kind: 'lamp', x: ax - ROAD_HALF - 6, y: sy - ROAD_HALF - 6 });
        this.props.push({ kind: 'lamp', x: ax + ROAD_HALF + 6, y: sy + ROAD_HALF + 6 });
      }
    }
  }

  buildParking(rng) {
    for (const block of this.blocks) {
      if (block.isPark) continue;
      const alongTop = rng() < 0.75;
      const alongLeft = rng() < 0.55;
      if (alongTop) {
        for (let x = block.x + 30; x < block.x + block.w - 20; x += 54) {
          this.parkingSpots.push({ x, y: block.y - 12, angle: 0 });
        }
      }
      if (alongLeft) {
        for (let y = block.y + 30; y < block.y + block.h - 20; y += 54) {
          this.parkingSpots.push({ x: block.x - 12, y, angle: Math.PI / 2 });
        }
      }
    }
  }

  buildStashes(rng) {
    for (let i = 0; i < 16; i += 1) {
      const block = pick(rng, this.blocks);
      this.stashSpots.push({ x: randRange(rng, block.x + 8, block.x + block.w - 8), y: randRange(rng, block.y + 8, block.y + block.h - 8) });
    }
  }

  isWater(x, y) {
    if (x < WORLD.waterX) return false;
    // The pier is solid decking over the water.
    if (x > this.pier.x && x < this.pier.x + this.pier.w && y > this.pier.y - 6 && y < this.pier.y + this.pier.h + 6) return false;
    return true;
  }

  isRoad(x, y) {
    for (const ax of AVENUES) if (Math.abs(x - ax) <= ROAD_HALF) return true;
    for (const sy of STREETS) if (Math.abs(y - sy) <= ROAD_HALF) return true;
    return false;
  }

  /** Push a circle (centre + radius) out of every building and prop base it overlaps. */
  collideCircle(x, y, r) {
    let px = x;
    let py = y;
    for (const b of this.buildings) {
      const nx = clamp(px, b.x, b.x + b.w);
      const ny = clamp(py, b.y, b.y + b.h);
      const dx = px - nx;
      const dy = py - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px = nx + (dx / d) * r;
          py = ny + (dy / d) * r;
        } else {
          // Centre inside the rect: leave by the shortest side.
          const left = px - b.x;
          const right = b.x + b.w - px;
          const top = py - b.y;
          const bottom = b.y + b.h - py;
          const m = Math.min(left, right, top, bottom);
          if (m === left) px = b.x - r;
          else if (m === right) px = b.x + b.w + r;
          else if (m === top) py = b.y - r;
          else py = b.y + b.h + r;
        }
      }
    }
    return { x: px, y: py, hit: px !== x || py !== y };
  }

  /** Does a straight segment stay out of buildings? Used for line of sight. */
  lineOfSight(x1, y1, x2, y2) {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 26);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      for (const b of this.buildings) {
        if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
      }
    }
    return true;
  }

  /** A random point on a road, optionally near a centre. */
  randomRoadPoint(rng, nearX = null, nearY = null, minDist = 0, maxDist = 1e9) {
    for (let tries = 0; tries < 24; tries += 1) {
      let x;
      let y;
      if (rng() < 0.5) {
        x = pick(rng, AVENUES) + randRange(rng, -LANE, LANE);
        y = randRange(rng, 90, WORLD.height - 90);
      } else {
        x = randRange(rng, 90, WORLD.beachX - 60);
        y = pick(rng, STREETS) + randRange(rng, -LANE, LANE);
      }
      if (nearX === null) return { x, y };
      const d = Math.hypot(x - nearX, y - nearY);
      if (d >= minDist && d <= maxDist) return { x, y };
    }
    return { x: AVENUES[2], y: STREETS[2] };
  }

  /** Clamp a land position to the playable shore. */
  clampLand(x, y, r) {
    return {
      x: clamp(x, r + 8, WORLD.waterX - r),
      y: clamp(y, r + 8, WORLD.height - r - 8),
    };
  }
}
