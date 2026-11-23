// Vehicles: arcade driving physics shared by the player, traffic and the police, plus
// the traffic brain that keeps Coral Bay's roads moving with right-hand traffic.

import { VEHICLE_TYPES, LANE, AVENUES, STREETS, WORLD } from './config.js';
import { randRange, pick, clamp, angleDelta } from './random.js';

let nextVehicleId = 1;

export class Vehicle {
  constructor(type, x, y, angle, colour) {
    this.id = nextVehicleId++;
    this.type = type;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.colour = colour ?? pick(Math.random, type.colours);
    this.maxHealth = type.health;
    this.health = type.health;
    this.parked = false;
    this.driver = null; // null | 'player' | 'traffic' | 'police'
    this.boat = type.id === 'boat';
    this.smokeTimer = 0;
    this.skidTimer = 0;
    this.brakeLights = false;
  }

  get radius() {
    return this.type.w / 2;
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  get wrecked() {
    return this.health <= 0;
  }

  forwardSpeed() {
    return this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
  }

  /**
   * Arcade drive step. throttle -1..1, steer -1..1 (left..right), handbrake bool.
   * Lateral velocity is eaten by grip each step, less of it with the handbrake up,
   * which is what makes the car drift.
   */
  drive(dt, throttle, steer, handbrake) {
    if (this.wrecked) throttle = 0;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    let fwd = this.vx * cos + this.vy * sin;
    let lat = -this.vx * sin + this.vy * cos;
    if (throttle > 0) fwd += throttle * this.type.accel * dt;
    else if (throttle < 0) fwd += throttle * this.type.accel * 0.55 * dt;
    const drag = this.boat ? 0.5 : 0.42;
    fwd -= fwd * drag * dt;
    const maxF = this.type.topSpeed;
    const maxR = -maxF * 0.32;
    fwd = clamp(fwd, maxR, maxF);
    const grip = handbrake ? this.type.grip * 0.22 : this.type.grip;
    lat *= Math.max(0, 1 - grip * dt);
    const turnRate = (this.boat ? 1.5 : 2.5) * (handbrake ? 1.5 : 1);
    const steerAuthority = clamp(Math.abs(fwd) / 120, 0, 1);
    this.angle += steer * turnRate * steerAuthority * dt * (fwd < 0 ? -1 : 1);
    const ncos = Math.cos(this.angle);
    const nsin = Math.sin(this.angle);
    this.vx = ncos * fwd - nsin * lat;
    this.vy = nsin * fwd + ncos * lat;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.brakeLights = throttle < -0.05 || (throttle === 0 && Math.abs(fwd) > 30);
    this.skidding = handbrake && Math.abs(fwd) > 90 && Math.abs(lat) > 26;
    return { fwd, lat };
  }

  damage(amount) {
    if (this.wrecked) return false;
    this.health = Math.max(0, this.health - amount);
    return this.wrecked;
  }
}

export function randomTrafficType(rng) {
  const weights = [26, 12, 3, 12, 10, 9, 7, 21];
  let total = 0;
  for (const w of weights) total += w;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return VEHICLE_TYPES[i];
  }
  return VEHICLE_TYPES[0];
}

/** Brain for one traffic car: follow its lane to the next junction, then choose a way on. */
export class TrafficBrain {
  constructor(rng, vehicle, city) {
    this.rng = rng;
    this.vehicle = vehicle;
    this.city = city;
    this.axis = rng() < 0.5 ? 'v' : 'h';
    this.dir = rng() < 0.5 ? 1 : -1;
    this.line = this.axis === 'v' ? pick(rng, AVENUES) : pick(rng, STREETS);
    this.cruise = randRange(rng, 0.55, 0.85);
    this.stuckTimer = 0;
    this.retarget(vehicle.x, vehicle.y);
  }

  /** Lane-centre point for travelling along `line` in direction `dir`. */
  lanePoint(along) {
    if (this.axis === 'v') {
      // Heading south (dir +1): right side is west. Heading north: right side is east.
      return { x: this.line + (this.dir > 0 ? -LANE : LANE), y: along };
    }
    // Heading east (dir +1): right side is south. Heading west: right side is north.
    return { x: along, y: this.line + (this.dir > 0 ? LANE : -LANE) };
  }

  retarget(fromX, fromY) {
    const lines = this.axis === 'v' ? STREETS : AVENUES;
    const along = this.axis === 'v' ? fromY : fromX;
    const ahead = lines.filter((l) => (this.dir > 0 ? l > along + 30 : l < along - 30));
    let next;
    if (ahead.length === 0) {
      next = this.dir > 0 ? lines[lines.length - 1] : lines[0];
      this.mustTurn = true;
    } else {
      next = this.dir > 0 ? Math.min(...ahead) : Math.max(...ahead);
      this.mustTurn = false;
    }
    this.targetLine = next;
    const p = this.lanePoint(next);
    this.targetX = p.x;
    this.targetY = p.y;
  }

  chooseTurn() {
    const v = this.vehicle;
    const crossLines = this.axis === 'v' ? AVENUES : STREETS;
    const cross = this.targetLine;
    const options = [];
    if (!this.mustTurn) options.push('straight', 'straight');
    // Turning swaps the axis; the new line is the road we are crossing.
    const along = this.axis === 'v' ? v.x : v.y;
    for (const d of [1, -1]) {
      const ahead = crossLines.some((l) => (d > 0 ? l > along + 30 : l < along - 30));
      if (ahead || this.mustTurn) options.push(d);
    }
    const choice = pick(this.rng, options.length ? options : ['straight']);
    if (choice !== 'straight') {
      this.axis = this.axis === 'v' ? 'h' : 'v';
      this.dir = choice;
      this.line = cross;
    }
    this.retarget(v.x, v.y);
  }

  update(dt, obstacles) {
    const v = this.vehicle;
    if (v.driver !== 'traffic') return;
    const dx = this.targetX - v.x;
    const dy = this.targetY - v.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 42) {
      this.chooseTurn();
      return;
    }
    const desired = Math.atan2(dy, dx);
    const steer = clamp(angleDelta(v.angle, desired) / 0.45, -1, 1);
    // Brake for anything slow or stopped ahead.
    let throttle = this.cruise;
    const fx = Math.cos(v.angle);
    const fy = Math.sin(v.angle);
    for (const o of obstacles) {
      if (o === v) continue;
      const ox = o.x - v.x;
      const oy = o.y - v.y;
      const ahead = ox * fx + oy * fy;
      const side = Math.abs(-ox * fy + oy * fx);
      if (ahead > 0 && ahead < 74 && side < 24) {
        const oSpeed = o.speed ?? Math.hypot(o.vx || 0, o.vy || 0);
        if (oSpeed < v.speed - 12 || (o.parked && ahead < 60)) throttle = -0.7;
        else if (ahead < 52) throttle = Math.min(throttle, 0.05);
      }
    }
    const before = v.speed;
    v.drive(dt, throttle, steer, false);
    if (before < 14 && throttle > 0) this.stuckTimer += dt;
    else this.stuckTimer = 0;
    if (this.stuckTimer > 4) {
      // Gridlocked: swing a U-turn and head back the other way.
      this.dir = -this.dir;
      this.stuckTimer = 0;
      this.retarget(v.x, v.y);
    }
    // Keep the car inside the world; turn around at the shore and the edges.
    if (v.x > WORLD.waterX - 30 && this.axis === 'h' && this.dir > 0) {
      this.dir = -1;
      this.retarget(v.x, v.y);
    }
    if (v.y < 90 && this.axis === 'v' && this.dir < 0) {
      this.dir = 1;
      this.retarget(v.x, v.y);
    }
    if (v.y > WORLD.height - 90 && this.axis === 'v' && this.dir > 0) {
      this.dir = -1;
      this.retarget(v.x, v.y);
    }
    if (v.x < 90 && this.axis === 'h' && this.dir < 0) {
      this.dir = 1;
      this.retarget(v.x, v.y);
    }
  }
}
