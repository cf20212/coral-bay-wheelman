// The law: a witness-based wanted system (heat only rises when someone sees the crime,
// and only fades when nobody can see you), interceptor cars that hunt the player, and
// officers who get out and give chase on foot.

import { HEAT_PER_STAR, MAX_STARS, POLICE_TYPE, AVENUES, STREETS } from './config.js';
import { clamp, angleDelta } from './random.js';
import { Vehicle } from './vehicles.js';

export class Wanted {
  constructor() {
    this.heat = 0;
    this.unseenTimer = 0;
    this.everWanted = false;
  }

  get stars() {
    if (this.heat <= 0) return 0;
    return Math.min(MAX_STARS, Math.ceil(this.heat / HEAT_PER_STAR));
  }

  /** A crime is reported. Unwitnessed crimes raise far less heat. */
  report(amount, witnessed) {
    this.heat = clamp(this.heat + amount * (witnessed ? 1 : 0.3), 0, HEAT_PER_STAR * MAX_STARS);
    if (this.heat > 0) this.everWanted = true;
  }

  setStars(stars) {
    this.heat = Math.max(this.heat, stars * HEAT_PER_STAR - 10);
  }

  clear() {
    this.heat = 0;
  }

  noteSeen() {
    this.unseenTimer = 0;
  }

  update(dt) {
    this.unseenTimer += dt;
    if (this.unseenTimer > 5 && this.heat > 0) {
      const rate = this.stars >= 4 ? 4.5 : this.stars === 3 ? 6 : 9;
      this.heat = Math.max(0, this.heat - rate * dt);
    }
  }
}

export class Officer {
  constructor(x, y, car) {
    this.x = x;
    this.y = y;
    this.car = car;
    this.angle = 0;
    this.health = 50;
    this.radius = 10;
    this.speed = 208;
    this.cooldown = 1 + Math.random() * 0.8;
    this.dead = false;
    this.deadTimer = 0;
    this.stepPhase = Math.random() * 6;
  }

  damage(amount) {
    if (this.dead) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.dead = true;
      this.deadTimer = 20;
      return true;
    }
    return false;
  }
}

const DESIRED_UNITS = [0, 1, 2, 3, 4, 5];

export class PoliceSystem {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.units = []; // {car, officer, leaving, stuckTimer, reverseTimer}
    this.bust = 0; // 0..1 bust meter
  }

  get officers() {
    return this.units.filter((u) => u.officer).map((u) => u.officer);
  }

  get cars() {
    return this.units.map((u) => u.car);
  }

  spawnUnit(player) {
    const p = this.city.randomRoadPoint(this.rng, player.x, player.y, 580, 780);
    const car = new Vehicle(POLICE_TYPE, p.x, p.y, this.rng() * Math.PI * 2, '#1d2733');
    car.driver = 'police';
    this.units.push({ car, officer: null, leaving: false, stuckTimer: 0, reverseTimer: 0 });
    return car;
  }

  update(dt, game) {
    const { player, wanted } = game;
    const stars = wanted.stars;
    const desired = DESIRED_UNITS[stars];
    const active = this.units.filter((u) => !u.leaving);
    if (stars > 0 && active.length < desired) {
      this.spawnTimer = (this.spawnTimer ?? 0) - dt;
      if (this.spawnTimer <= 0) {
        this.spawnUnit(player);
        this.spawnTimer = 1.6;
      }
    }
    if (stars === 0) {
      for (const u of this.units) u.leaving = true;
    }

    let bustPressure = false;
    for (const unit of this.units) {
      const car = unit.car;
      const distToPlayer = Math.hypot(player.x - car.x, player.y - car.y);
      if (unit.leaving) {
        car.drive(dt, 0.55, 0, false);
        continue;
      }
      // An officer bails out when the car is close and slow, stuck, or wrecked.
      if (!unit.officer && (car.wrecked || (distToPlayer < 120 && car.speed < 70) || (distToPlayer < 185 && car.speed < 32))) {
        unit.officer = new Officer(car.x + 14, car.y, car);
        game.onOfficerOut(unit.officer);
      }
      if (unit.officer && !unit.officer.dead) {
        bustPressure = this.updateOfficer(dt, game, unit.officer) || bustPressure;
      } else if (!car.wrecked) {
        this.drivePursuit(dt, game, unit);
      }
    }
    // Recycle units that are leaving and far away, or hopelessly lost.
    this.units = this.units.filter((u) => {
      const d = Math.hypot(player.x - u.car.x, player.y - u.car.y);
      if (u.leaving && d > 700) return false;
      if (d > 1600) return false;
      return true;
    });

    // The bust meter: an officer on top of a slow or foot-bound player fills it.
    if (bustPressure) this.bust = clamp(this.bust + dt / 2.3, 0, 1);
    else this.bust = clamp(this.bust - dt / 1.4, 0, 1);
  }

  drivePursuit(dt, game, unit) {
    const { player, city } = game;
    const car = unit.car;
    const lead = player.vehicle ? 0.35 : 0.1;
    let tx = player.x + (player.vehicle ? player.vehicle.vx * lead : 0);
    let ty = player.y + (player.vehicle ? player.vehicle.vy * lead : 0);
    const dist = Math.hypot(player.x - car.x, player.y - car.y);
    // No line of sight across a block: route by road to the junction nearest the
    // player instead of grinding against the buildings in between.
    if (dist > 150 && !city.lineOfSight(car.x, car.y, player.x, player.y)) {
      const jx = AVENUES.reduce((a, b) => (Math.abs(b - player.x) < Math.abs(a - player.x) ? b : a));
      const jy = STREETS.reduce((a, b) => (Math.abs(b - player.y) < Math.abs(a - player.y) ? b : a));
      const nearStreetY = STREETS.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
      const nearAvenueX = AVENUES.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      if (Math.abs(car.x - jx) < 55 && Math.abs(car.y - jy) < 55) {
        // At the junction already: come straight in.
      } else if (Math.abs(car.y - nearStreetY) < 58) {
        tx = jx;
        ty = nearStreetY;
        if (Math.abs(car.x - jx) < 55) {
          tx = jx;
          ty = jy;
        }
      } else if (Math.abs(car.x - nearAvenueX) < 58) {
        tx = nearAvenueX;
        ty = jy;
        if (Math.abs(car.y - jy) < 55) {
          tx = jx;
          ty = jy;
        }
      } else {
        tx = nearAvenueX;
        ty = nearStreetY;
      }
    }
    const desired = Math.atan2(ty - car.y, tx - car.x);
    const steer = clamp(angleDelta(car.angle, desired) / 0.4, -1, 1);
    let throttle = 0.98;
    if (dist < 60) throttle = 0.25; // don't overshoot a foot-bound player
    if (unit.reverseTimer > 0) {
      unit.reverseTimer -= dt;
      car.drive(dt, -0.8, -steer, false);
      return;
    }
    car.drive(dt, throttle, steer, false);
    if (car.speed < 12 && dist > 90) {
      unit.stuckTimer += dt;
      if (unit.stuckTimer > 2.2) {
        unit.reverseTimer = 0.85;
        unit.stuckTimer = 0;
      }
    } else {
      unit.stuckTimer = 0;
    }
  }

  /** Returns true while this officer is close enough to be filling the bust meter. */
  updateOfficer(dt, game, officer) {
    const { player, city } = game;
    const dx = player.x - officer.x;
    const dy = player.y - officer.y;
    const dist = Math.hypot(dx, dy) || 1;
    officer.angle = Math.atan2(dy, dx);
    const playerSlow = !player.vehicle || player.vehicle.speed < 30;
    if (dist > 16) {
      const speed = playerSlow ? officer.speed : officer.speed * 0.92;
      officer.x += (dx / dist) * speed * dt;
      officer.y += (dy / dist) * speed * dt;
      officer.stepPhase += dt * 11;
    }
    const resolved = city.collideCircle(officer.x, officer.y, officer.radius);
    officer.x = resolved.x;
    officer.y = resolved.y;
    // Shooting: only at three stars or more, with a clear line and some range.
    officer.cooldown -= dt;
    if (game.wanted.stars >= 3 && dist < 275 && dist > 30 && officer.cooldown <= 0) {
      if (city.lineOfSight(officer.x, officer.y, player.x, player.y)) {
        officer.cooldown = 1.05 + Math.random() * 0.6;
        game.onPoliceShot(officer);
      } else {
        officer.cooldown = 0.3;
      }
    }
    return dist < 40 && playerSlow;
  }
}
