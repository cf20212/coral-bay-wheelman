// Pedestrians: Coral Bay's crowds stroll the sidewalks block by block, and scatter
// when a car mounts the pavement or a shot rings out.

import { randRange, pick, clamp } from './random.js';

const SHIRTS = ['#c95d4e', '#4e7dc9', '#e0b64f', '#5da464', '#b45ec9', '#e8e4da', '#4ec9c0', '#c94e7d', '#7d8794', '#e07b39'];
const PANTS = ['#33404d', '#5d5347', '#2c3550', '#6e6e6e', '#413550'];

let nextPedId = 1;

export class Pedestrian {
  constructor(rng, x, y, block) {
    this.id = nextPedId++;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.block = block;
    this.corner = Math.floor(randRange(rng, 0, 4));
    this.state = 'walk';
    this.fleeTimer = 0;
    this.fleeX = 0;
    this.fleeY = 0;
    this.downTimer = 0;
    this.speed = randRange(rng, 42, 66);
    this.shirt = pick(rng, SHIRTS);
    this.pants = pick(rng, PANTS);
    this.skin = pick(rng, ['#e8b98f', '#c98d5f', '#8a5a34', '#f0cdb0', '#6e4525']);
    this.angle = randRange(rng, 0, Math.PI * 2);
    this.stepPhase = randRange(rng, 0, 6);
    this.radius = 9;
  }

  cornerPoint(index) {
    const b = this.block;
    const inset = 9;
    const pts = [
      { x: b.x + inset, y: b.y + inset },
      { x: b.x + b.w - inset, y: b.y + inset },
      { x: b.x + b.w - inset, y: b.y + b.h - inset },
      { x: b.x + inset, y: b.y + b.h - inset },
    ];
    return pts[((index % 4) + 4) % 4];
  }

  knockDown() {
    if (this.state === 'down') return false;
    this.state = 'down';
    this.downTimer = 7;
    this.vx = 0;
    this.vy = 0;
    return true;
  }

  scare(fromX, fromY, strength = 1) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeTimer = randRange(Math.random, 1.4, 2.6) * strength;
    this.fleeX = fromX;
    this.fleeY = fromY;
  }

  update(dt, rng) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      return this.downTimer > 0; // false once the ped should be recycled
    }
    let tx;
    let ty;
    let speed = this.speed;
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const dx = this.x - this.fleeX;
      const dy = this.y - this.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      tx = this.x + (dx / d) * 60;
      ty = this.y + (dy / d) * 60;
      speed = 178;
      if (this.fleeTimer <= 0) this.state = 'walk';
    } else {
      const target = this.cornerPoint(this.corner);
      tx = target.x;
      ty = target.y;
      if (Math.hypot(tx - this.x, ty - this.y) < 8) {
        this.corner += rng() < 0.5 ? 1 : 3; // mostly keep one way round the block
        return true;
      }
    }
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const vx = (dx / d) * speed;
    const vy = (dy / d) * speed;
    this.vx = vx;
    this.vy = vy;
    this.x += vx * dt;
    this.y += vy * dt;
    this.angle = Math.atan2(vy, vx);
    this.stepPhase += dt * speed * 0.09;
    return true;
  }
}

/** Keeps a crowd around the player: spawns on nearby sidewalks, recycles the far ones. */
export class Crowd {
  constructor(rng, city) {
    this.rng = rng;
    this.city = city;
    this.peds = [];
    this.target = 34;
  }

  spawnNear(focusX, focusY) {
    const blocks = this.city.blocks.filter((b) => Math.abs(b.cx - focusX) < 780 && Math.abs(b.cy - focusY) < 640);
    if (!blocks.length) return;
    const block = pick(this.rng, blocks);
    const ped = new Pedestrian(this.rng, 0, 0, block);
    const start = ped.cornerPoint(Math.floor(randRange(this.rng, 0, 4)));
    ped.x = start.x + randRange(this.rng, -6, 6);
    ped.y = start.y + randRange(this.rng, -6, 6);
    this.peds.push(ped);
  }

  update(dt, focusX, focusY) {
    while (this.peds.length < this.target) {
      const before = this.peds.length;
      this.spawnNear(focusX, focusY);
      if (this.peds.length === before) break;
    }
    this.peds = this.peds.filter((ped) => {
      const alive = ped.update(dt, this.rng);
      const far = Math.abs(ped.x - focusX) > 1150 || Math.abs(ped.y - focusY) > 950;
      if (!alive || (far && ped.state !== 'down')) return false;
      // Keep feet out of buildings and off the water.
      const resolved = this.city.collideCircle(ped.x, ped.y, ped.radius);
      ped.x = resolved.x;
      ped.y = resolved.y;
      const clamped = this.city.clampLand(ped.x, ped.y, ped.radius);
      ped.x = clamped.x;
      ped.y = clamped.y;
      return true;
    });
  }

  scareAll(x, y, radius, strength = 1) {
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - x, ped.y - y) < radius) ped.scare(x, y, strength);
    }
  }
}

export function pedColourSet(rng) {
  return { shirt: pick(rng, SHIRTS), pants: pick(rng, PANTS) };
}

export { clamp };
