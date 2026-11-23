// Combat: hitscan raycasts against the city, tracer and spark effects, and the armed
// guards who watch the shipyard. The player and the police fire through the same code.

import { clamp } from './random.js';

/** The end point of a shot: the first building face it meets, or its full range. */
export function raycastShot(city, x, y, angle, range) {
  const step = 9;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let travelled = 0;
  let px = x;
  let py = y;
  while (travelled < range) {
    px += dx * step;
    py += dy * step;
    travelled += step;
    for (const b of city.buildings) {
      if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) {
        return { x: px, y: py, dist: travelled, blocked: true };
      }
    }
  }
  return { x: px, y: py, dist: range, blocked: false };
}

/**
 * Find the closest circular target a shot passes through before `maxDist`.
 * targets: array of {x, y, radius}. Returns {target, dist} or null.
 */
export function shotTarget(x, y, angle, maxDist, targets) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = null;
  let bestDist = maxDist;
  for (const t of targets) {
    const rx = t.x - x;
    const ry = t.y - y;
    const along = rx * dx + ry * dy;
    if (along < 0 || along > bestDist) continue;
    const perp = Math.abs(-rx * dy + ry * dx);
    if (perp <= (t.radius ?? 10) + 2) {
      best = t;
      bestDist = along;
    }
  }
  return best ? { target: best, dist: bestDist } : null;
}

/** Short-lived visual effects: tracers, impact sparks, smoke puffs, skid marks. */
export class Fx {
  constructor() {
    this.tracers = [];
    this.sparks = [];
    this.puffs = [];
    this.skids = [];
    this.rings = [];
  }

  tracer(x1, y1, x2, y2, colour = '#ffd76a') {
    this.tracers.push({ x1, y1, x2, y2, t: 0.07, colour });
  }

  spark(x, y, colour = '#ffca6a', n = 6) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 130;
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.28, colour });
    }
  }

  puff(x, y, big = false) {
    this.puffs.push({ x, y, t: big ? 0.9 : 0.5, r: big ? 16 : 8, dark: big });
  }

  skid(x, y) {
    this.skids.push({ x, y, t: 3.2 });
    if (this.skids.length > 420) this.skids.splice(0, this.skids.length - 420);
  }

  ring(x, y, colour = '#ffd76a') {
    this.rings.push({ x, y, t: 0.6, colour });
  }

  update(dt) {
    this.tracers = this.tracers.filter((t) => (t.t -= dt) > 0);
    this.sparks = this.sparks.filter((s) => {
      s.t -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      return s.t > 0;
    });
    this.puffs = this.puffs.filter((p) => (p.t -= dt) > 0);
    this.skids = this.skids.filter((s) => (s.t -= dt) > 0);
    this.rings = this.rings.filter((r) => (r.t -= dt) > 0);
  }

  drawUnder(ctx) {
    ctx.fillStyle = 'rgba(20,20,22,0.35)';
    for (const s of this.skids) {
      ctx.globalAlpha = clamp(s.t / 3.2, 0, 1) * 0.5;
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;
  }

  drawOver(ctx) {
    for (const r of this.rings) {
      ctx.strokeStyle = r.colour;
      ctx.globalAlpha = clamp(r.t / 0.6, 0, 1);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 14 + (0.6 - r.t) * 46, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    for (const t of this.tracers) {
      ctx.strokeStyle = t.colour;
      ctx.globalAlpha = clamp(t.t / 0.07, 0, 1);
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const s of this.sparks) {
      ctx.fillStyle = s.colour;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    for (const p of this.puffs) {
      ctx.fillStyle = p.dark ? 'rgba(40,40,44,0.4)' : 'rgba(200,200,200,0.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + (0.5 - Math.min(p.t, 0.5)) * 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A shipyard guard: holds a post, opens fire when the player comes armed or close. */
export class Guard {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.postX = x;
    this.postY = y;
    this.angle = -Math.PI / 2;
    this.health = 70;
    this.radius = 10;
    this.state = 'idle'; // idle | combat | dead
    this.cooldown = Math.random() * 0.8;
    this.burst = 0;
    this.deadTimer = 0;
    this.shirt = '#3d4a35';
  }

  get alive() {
    return this.state !== 'dead';
  }

  damage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    this.state = 'combat';
    if (this.health <= 0) {
      this.state = 'dead';
      this.deadTimer = 20;
      return true;
    }
    return false;
  }

  alert() {
    if (this.alive) this.state = 'combat';
  }
}
