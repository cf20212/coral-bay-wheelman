// Coral Bay: Wheelman — the game itself. This module owns the world state and the
// frame loop: the player on foot and behind the wheel, traffic, crowds, police,
// gunfire, missions, money, saving, and every screen the player can be on.

import { WORLD, VIEW, PLAYER, PISTOL, VEHICLE_TYPES, BOAT_TYPE } from './config.js';
import { makeRng, randRange, pick, clamp } from './random.js';
import { City, districtAt } from './city.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { Vehicle, TrafficBrain, randomTrafficType } from './vehicles.js';
import { Crowd, Pedestrian } from './pedestrians.js';
import { Wanted, PoliceSystem } from './police.js';
import { Fx, Guard, raycastShot, shotTarget } from './combat.js';
import { Missions } from './missions.js';
import { drawWorld, drawVehicle, drawPerson, drawMarker, drawStash, drawNightTint } from './render.js';
import { drawHUD, drawBanner } from './hud.js';
import { drawTitle, drawHowTo, drawPause, drawEndCard, drawButtons, buttonRect } from './screens.js';
import { hasSave, writeSave, readSave } from './savegame.js';

const HERO_LOOK = { shirt: '#28418c', pants: '#2c2f36', skin: '#c98d5f' };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.rng = makeRng(7 * 7919 + 13);
    this.city = new City(7);
    this.fx = new Fx();
    this.state = 'title';
    this.time = 0;
    this.clockMinutes = 10 * 60;
    this.camX = 0;
    this.camY = 0;
    this.attractT = 0;
    this.toasts = [];
    this.bannerState = null;
    this.promptText = '';
    this.objectiveCache = null;
    this.hurtFlash = 0;
    this.endTimer = 0;
    this.lastFee = 0;
    this.endKind = null;
    this.shotMode = null;
    this.resetWorld();
    this.bindUi();
  }

  resetWorld() {
    const safe = this.city.landmark('safehouse');
    this.player = {
      x: safe.doorX, y: safe.doorY + 26, angle: Math.PI / 2,
      health: PLAYER.maxHealth, vehicle: null, lastHurt: -99, stepPhase: 0, moving: false,
    };
    this.cash = 120;
    this.ammoInMag = PISTOL.magazine;
    this.ammoReserve = PISTOL.reserveStart;
    this.reloading = false;
    this.reloadTimer = 0;
    this.fireCooldown = 0;
    this.lastShotAt = -99;
    this.wanted = new Wanted();
    this.police = new PoliceSystem(this.city, this.rng);
    this.guards = [];
    this.vehicles = [];
    this.brains = new Map();
    this.crowd = new Crowd(this.rng, this.city);
    this.missions = new Missions(this);
    this.missionCar = null;
    this.boat = null;
    this.spawnParkedCars();
    this.ensureBoat();
    for (let i = 0; i < 10; i += 1) this.spawnTraffic(true);
  }

  bindUi() {
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    this.canvas.addEventListener('mousedown', () => {
      if (this.state === 'title') this.clickMenu(this.titleButtons());
      else if (this.state === 'pause') this.clickMenu(this.pauseButtons());
      else if (this.state === 'howto') this.state = this.howToReturn ?? 'title';
    });
  }

  titleButtons() {
    const labels = ['New Game'];
    if (hasSave()) labels.push('Continue');
    labels.push('How to Play');
    return labels;
  }

  pauseButtons() {
    return ['Resume', 'Save Game', 'How to Play', this.sound.muted ? 'Unmute (M)' : 'Mute (M)', 'Quit to Title'];
  }

  clickMenu(labels) {
    const { mouseX, mouseY } = this.input;
    labels.forEach((label, i) => {
      const r = buttonRect(i, labels.length);
      if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) {
        this.menuAction(label);
      }
    });
  }

  menuAction(label) {
    this.sound.unlock();
    if (label === 'New Game') this.newGame();
    else if (label === 'Continue') this.continueGame();
    else if (label === 'How to Play') {
      this.howToReturn = this.state;
      this.state = 'howto';
    } else if (label === 'Resume') this.state = 'play';
    else if (label === 'Save Game') {
      if (writeSave(this)) this.toast('Game saved');
      else this.toast('Saving is unavailable in this browser');
    } else if (label === 'Quit to Title') this.state = 'title';
    else if (label.startsWith('Mute') || label.startsWith('Unmute')) {
      this.sound.setMuted(!this.sound.muted);
    }
  }

  newGame() {
    this.resetWorld();
    this.clockMinutes = 10 * 60;
    this.state = 'play';
    this.banner('CORAL BAY', `${'Marco Reyes'} is back in town. Delia Voss has work — see her at Voss Auto Works.`, 5.5);
    this.toast('Follow the gold marker');
  }

  continueGame() {
    const save = readSave();
    if (!save) {
      this.newGame();
      return;
    }
    this.resetWorld();
    this.cash = save.cash;
    this.missions.index = save.missionIndex;
    this.player.x = save.x;
    this.player.y = save.y;
    this.player.health = save.health;
    this.clockMinutes = save.clock;
    this.ammoReserve = save.ammoReserve;
    this.state = 'play';
    this.toast('Welcome back, Marco');
  }

  saveGame(auto = false) {
    if (writeSave(this) && !auto) this.toast('Game saved');
  }

  addCash(amount) {
    this.cash += amount;
  }

  toast(text) {
    this.toasts.push({ text, t: 3.4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  banner(title, sub, dur = 4.5) {
    this.bannerState = { title, sub, t: 0, total: dur };
  }

  get darkness() {
    const h = (this.clockMinutes % 1440) / 60;
    if (h < 4.8) return 0.92;
    if (h < 7) return 0.92 - ((h - 4.8) / 2.2) * 0.92;
    if (h < 18.4) return 0;
    if (h < 20.4) return ((h - 18.4) / 2) * 0.92;
    return 0.92;
  }

  get districtName() {
    return districtAt(this.player.x, this.player.y);
  }

  // ---- world population -------------------------------------------------

  spawnParkedCars() {
    const spots = [...this.city.parkingSpots];
    for (let i = spots.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.rng() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const count = Math.min(46, spots.length);
    for (let i = 0; i < count; i += 1) {
      const spot = spots[i];
      if (this.city.collideCircle(spot.x, spot.y, 20).hit) continue;
      const type = randomTrafficType(this.rng);
      const car = new Vehicle(type, spot.x, spot.y, spot.angle + randRange(this.rng, -0.05, 0.05), pick(this.rng, type.colours));
      car.parked = true;
      this.vehicles.push(car);
    }
  }

  spawnTraffic(anywhere = false) {
    const p = this.player;
    const spot = anywhere
      ? this.city.randomRoadPoint(this.rng, p.x, p.y, 0, 1000)
      : this.city.randomRoadPoint(this.rng, p.x, p.y, 640, 980);
    if (!anywhere && spot === null) return;
    const type = randomTrafficType(this.rng);
    const car = new Vehicle(type, spot.x, spot.y, 0, pick(this.rng, type.colours));
    car.driver = 'traffic';
    this.brains.set(car, new TrafficBrain(this.rng, car, this.city));
    car.angle = this.brains.get(car).axis === 'v' ? (this.brains.get(car).dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (this.brains.get(car).dir > 0 ? 0 : Math.PI);
    this.vehicles.push(car);
  }

  spawnMissionCar() {
    const cafe = this.city.landmark('cafe');
    let best = null;
    let bestDist = 1e9;
    for (const spot of this.city.parkingSpots) {
      const d = Math.hypot(spot.x - cafe.x, spot.y - cafe.y);
      if (d < bestDist) {
        bestDist = d;
        best = spot;
      }
    }
    const gt = VEHICLE_TYPES.find((t) => t.id === 'gt');
    const car = new Vehicle(gt, best.x, best.y, best.angle, '#e8b71c');
    car.parked = true;
    car.missionMark = true;
    this.vehicles.push(car);
    this.missionCar = car;
    return car;
  }

  ensureBoat() {
    if (this.boat && !this.boat.wrecked) return this.boat;
    const boat = new Vehicle(BOAT_TYPE, this.city.boatSpawn.x, this.city.boatSpawn.y, 0, '#e8e4da');
    boat.parked = true;
    this.vehicles.push(boat);
    this.boat = boat;
    return boat;
  }

  spawnShipyardGuards() {
    this.clearGuards();
    const posts = [
      [2260, 1960], [2420, 1960], [2330, 2080], [2220, 2140], [2460, 2160],
    ];
    for (const [x, y] of posts) this.guards.push(new Guard(x, y));
  }

  clearGuards() {
    this.guards = [];
  }

  allVehicles() {
    return [...this.vehicles, ...this.police.cars];
  }

  // ---- crime and consequences ------------------------------------------

  witnessesAt(x, y, radius = 320) {
    for (const ped of this.crowd.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - x, ped.y - y) < radius && this.city.lineOfSight(x, y, ped.x, ped.y)) return true;
    }
    for (const car of this.police.cars) {
      if (Math.hypot(car.x - x, car.y - y) < radius + 120) return true;
    }
    return false;
  }

  commitCrime(amount, x, y) {
    const witnessed = this.witnessesAt(x, y);
    this.wanted.report(amount, witnessed);
    if (witnessed) this.crowd.scareAll(x, y, 190, 0.8);
  }

  hurtPlayer(amount) {
    const p = this.player;
    if (this.state !== 'play') return;
    p.health -= amount;
    p.lastHurt = this.time;
    this.hurtFlash = 1;
    if (p.health <= 0) {
      p.health = 0;
      this.die('wasted');
    }
  }

  die(kind) {
    if (this.state !== 'play') return;
    this.endKind = kind;
    this.endTimer = 0;
    this.state = kind;
    const stars = this.wanted.stars;
    this.lastFee = kind === 'busted' ? Math.min(this.cash, 60 + stars * 45) : Math.min(this.cash, 130);
    this.cash -= this.lastFee;
    if (this.missions.active) this.missions.failMission(kind === 'busted' ? 'The law closed the job down.' : 'The job died with you — Delia will offer it again.');
    if (this.player.vehicle) {
      this.player.vehicle.driver = null;
      this.player.vehicle = null;
    }
    this.sound.failSting();
    this.sound.siren(false);
  }

  respawn() {
    const at = this.endKind === 'busted' ? this.city.landmark('police') : this.city.landmark('hospital');
    this.player.x = at.doorX;
    this.player.y = at.doorY + 14;
    this.player.health = PLAYER.maxHealth;
    this.wanted.clear();
    this.police.units = [];
    this.police.bust = 0;
    this.state = 'play';
    this.endKind = null;
  }

  onOfficerOut() {
    // A foot chase is a moment to notice the player.
    this.wanted.noteSeen();
  }

  onPoliceShot(officer) {
    const p = this.player;
    const dist = Math.hypot(p.x - officer.x, p.y - officer.y);
    this.sound.enemyShot();
    const targetX = p.x + randRange(Math.random, -8, 8);
    const targetY = p.y + randRange(Math.random, -8, 8);
    this.fx.tracer(officer.x, officer.y, targetX, targetY, '#ffb0a0');
    let hitChance = 0.52 - dist / 900;
    if (p.vehicle) hitChance -= Math.abs(p.vehicle.forwardSpeed()) / 1600;
    else if (p.moving) hitChance -= 0.12;
    if (Math.random() > Math.max(0.08, hitChance)) {
      this.fx.spark(targetX, targetY, '#d8d8d8', 3);
      return;
    }
    if (p.vehicle && Math.random() < 0.68) {
      p.vehicle.damage(6);
      this.fx.spark(p.x, p.y, '#ffca6a', 5);
      this.sound.crash(0.3);
    } else {
      this.fx.spark(p.x, p.y, '#ff7a59', 4);
      this.hurtPlayer(randRange(Math.random, 4, 8));
    }
  }

  // ---- player actions ----------------------------------------------------

  nearestVehicle(maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const v of this.allVehicles()) {
      if (v.wrecked) continue;
      const d = Math.hypot(v.x - this.player.x, v.y - this.player.y);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  enterVehicle(v) {
    const p = this.player;
    this.sound.doorSlam();
    if (v.driver === 'traffic') {
      // The driver bails out and runs.
      const driver = new Pedestrian(this.rng, v.x + 16, v.y + 10, this.crowd.peds[0]?.block ?? this.city.blocks[0]);
      driver.shirt = '#666';
      driver.scare(v.x, v.y, 1.6);
      this.crowd.peds.push(driver);
      this.brains.delete(v);
      this.commitCrime(65, v.x, v.y);
      this.toast('Driver bails — the car is yours');
    } else if (v.parked) {
      this.commitCrime(42, v.x, v.y);
    }
    v.driver = 'player';
    v.parked = false;
    p.vehicle = v;
    if (v.missionMark) v.missionMark = false;
  }

  exitVehicle() {
    const p = this.player;
    const v = p.vehicle;
    if (!v) return;
    if (v.boat) {
      const pier = this.city.pier;
      // Docking means anywhere within a short swim of the pier decking.
      const nearX = clamp(p.x, pier.x, pier.x + pier.w);
      const nearY = clamp(p.y, pier.y, pier.y + pier.h);
      if (Math.hypot(p.x - nearX, p.y - nearY) > 64) {
        this.toast('Too deep to swim — dock at the pier');
        return;
      }
      p.x = clamp(p.x, pier.x + 8, pier.x + pier.w - 8);
      p.y = pier.y + pier.h / 2;
    } else {
      const side = v.angle + Math.PI / 2;
      p.x = v.x + Math.cos(side) * 27;
      p.y = v.y + Math.sin(side) * 27;
      const resolved = this.city.collideCircle(p.x, p.y, p.radius ?? PLAYER.radius);
      p.x = resolved.x;
      p.y = resolved.y;
    }
    v.driver = null;
    if (v.speed < 4) v.parked = true;
    p.vehicle = null;
    this.sound.doorSlam();
  }

  firePistol() {
    const p = this.player;
    if (this.reloading) return;
    if (this.ammoInMag <= 0) {
      this.sound.dryFire();
      this.fireCooldown = 0.3;
      this.startReload();
      return;
    }
    this.ammoInMag -= 1;
    this.fireCooldown = PISTOL.cooldown;
    this.lastShotAt = this.time;
    this.sound.shot();
    const aim = Math.atan2(this.input.mouseY + this.camY - p.y, this.input.mouseX + this.camX - p.x);
    const angle = aim + randRange(Math.random, -PISTOL.spread, PISTOL.spread);
    const ray = raycastShot(this.city, p.x, p.y, angle, PISTOL.range);
    const targets = [];
    for (const g of this.guards) if (g.alive) targets.push({ x: g.x, y: g.y, radius: 11, kind: 'guard', ref: g });
    for (const o of this.police.officers) if (!o.dead) targets.push({ x: o.x, y: o.y, radius: 11, kind: 'officer', ref: o });
    for (const ped of this.crowd.peds) if (ped.state !== 'down') targets.push({ x: ped.x, y: ped.y, radius: 10, kind: 'ped', ref: ped });
    for (const v of this.allVehicles()) targets.push({ x: v.x, y: v.y, radius: v.radius * 0.9, kind: 'vehicle', ref: v });
    const hit = shotTarget(p.x, p.y, angle, ray.dist, targets);
    const endX = hit ? p.x + Math.cos(angle) * hit.dist : ray.x;
    const endY = hit ? p.y + Math.sin(angle) * hit.dist : ray.y;
    this.fx.tracer(p.x + Math.cos(angle) * 14, p.y + Math.sin(angle) * 14, endX, endY);
    this.commitCrime(50, p.x, p.y);
    if (!hit) {
      if (ray.blocked) this.fx.spark(ray.x, ray.y, '#d8c9a0', 4);
      return;
    }
    const t = hit.target;
    if (t.kind === 'guard') {
      const died = t.ref.damage(PISTOL.damage);
      this.fx.spark(t.ref.x, t.ref.y, '#ff7a59', 6);
      for (const g of this.guards) g.alert();
      if (died) this.toast('Guard down');
    } else if (t.kind === 'officer') {
      const died = t.ref.damage(PISTOL.damage);
      this.fx.spark(t.ref.x, t.ref.y, '#ff7a59', 6);
      this.commitCrime(160, p.x, p.y);
      if (died) this.toast('Officer down — they will not forget this');
    } else if (t.kind === 'ped') {
      t.ref.knockDown();
      this.fx.spark(t.ref.x, t.ref.y, '#ff7a59', 5);
      this.commitCrime(150, p.x, p.y);
      this.toast('A bystander is down!');
    } else if (t.kind === 'vehicle') {
      t.ref.damage(11);
      this.fx.spark(endX, endY, '#ffca6a', 6);
      if (t.ref.driver === 'police') this.commitCrime(120, p.x, p.y);
      else this.commitCrime(35, p.x, p.y);
      if (t.ref.driver === 'traffic' && t.ref.health < t.ref.maxHealth * 0.5) {
        const driver = new Pedestrian(this.rng, t.ref.x + 16, t.ref.y, this.crowd.peds[0]?.block ?? this.city.blocks[0]);
        driver.scare(t.ref.x, t.ref.y, 1.4);
        this.crowd.peds.push(driver);
        this.brains.delete(t.ref);
        t.ref.driver = null;
        t.ref.parked = true;
      }
    }
  }

  startReload() {
    if (this.reloading || this.ammoReserve <= 0 || this.ammoInMag === PISTOL.magazine) return;
    this.reloading = true;
    this.reloadTimer = PISTOL.reloadTime;
    this.sound.reload();
  }

  // ---- frame update ------------------------------------------------------

  update(dt) {
    this.time += dt;
    for (const toast of this.toasts) toast.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.bannerState) {
      this.bannerState.t += dt;
      if (this.bannerState.t > this.bannerState.total) this.bannerState = null;
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);
    this.fx.update(dt);
    this.sound.update(dt);

    if (this.state === 'title') {
      this.attractT += dt;
      this.updateAmbient(dt);
      const cx = 1650 + Math.cos(this.attractT * 0.07) * 620;
      const cy = 1250 + Math.sin(this.attractT * 0.05) * 430;
      this.camX = clamp(cx - VIEW.width / 2, 0, WORLD.width - VIEW.width + 260);
      this.camY = clamp(cy - VIEW.height / 2, 0, WORLD.height - VIEW.height);
      if (this.input.hit('Enter')) this.newGame();
      return;
    }
    if (this.state === 'howto') return;
    if (this.state === 'pause') {
      if (this.input.hit('Escape', 'KeyP')) this.state = 'play';
      return;
    }
    if (this.state === 'busted' || this.state === 'wasted') {
      this.endTimer += dt;
      this.updateAmbient(dt);
      if (this.endTimer > 1.4 && this.input.hit('Enter')) this.respawn();
      return;
    }
    // state === 'play'
    this.clockMinutes += dt; // one game minute per real second
    if (this.input.hit('Escape', 'KeyP')) {
      this.state = 'pause';
      return;
    }
    if (this.input.hit('KeyM')) this.sound.setMuted(!this.sound.muted);
    this.updatePlayer(dt);
    this.updateTraffic(dt);
    this.crowd.update(dt, this.player.x, this.player.y);
    this.police.update(dt, this);
    for (const car of this.police.cars) this.resolveVehicleCollision(car);
    this.updateGuards(dt);
    this.collideVehicles(dt);
    this.witnessCheck(dt);
    this.wanted.update(dt);
    this.missions.update(dt);
    if (this.missions.active && this.missions.index === 0 && this.missionCar && this.missionCar.wrecked) {
      this.missions.failMission('The GT is wrecked. Delia is furious — she will source another.');
      this.missionCar = null;
    }
    this.objectiveCache = this.missions.objective();
    this.updateCamera(dt);
    // Siren follows the nearest active unit.
    const nearest = this.police.units.some((u) => !u.leaving && Math.hypot(u.car.x - this.player.x, u.car.y - this.player.y) < 560);
    this.sound.siren(this.wanted.stars > 0 && nearest && !!this.sound.ctx);
    if (this.police.bust >= 1) this.die('busted');
  }

  /** Traffic and crowds keep living behind menus and outcome cards. */
  updateAmbient(dt) {
    const focusX = this.camX + VIEW.width / 2;
    const focusY = this.camY + VIEW.height / 2;
    for (const v of this.vehicles) {
      const brain = this.brains.get(v);
      if (brain) brain.update(dt, this.vehicles);
      if (v.driver === 'traffic') this.resolveVehicleCollision(v);
    }
    this.crowd.update(dt, focusX, focusY);
  }

  updateCamera(dt) {
    const p = this.player;
    const look = p.vehicle ? clamp(p.vehicle.speed / 900, 0, 0.3) : 0;
    const tx = p.x + (p.vehicle ? p.vehicle.vx * look : 0) - VIEW.width / 2;
    const ty = p.y + (p.vehicle ? p.vehicle.vy * look : 0) - VIEW.height / 2;
    const k = 1 - Math.pow(0.0015, dt);
    this.camX += (clamp(tx, -40, WORLD.width - VIEW.width + 300) - this.camX) * k;
    this.camY += (clamp(ty, -40, WORLD.height - VIEW.height + 40) - this.camY) * k;
  }

  updatePlayer(dt) {
    const p = this.player;
    const input = this.input;
    this.fireCooldown -= dt;
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const take = Math.min(PISTOL.magazine - this.ammoInMag, this.ammoReserve);
        this.ammoInMag += take;
        this.ammoReserve -= take;
        this.reloading = false;
      }
    }
    if (p.vehicle) {
      const v = p.vehicle;
      this.promptText = '';
      const throttle = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
      const steer = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      const handbrake = input.down('Space', 'ShiftLeft', 'ShiftRight');
      const before = v.speed;
      v.drive(dt, throttle, steer, handbrake);
      this.sound.engine(clamp(Math.abs(v.forwardSpeed()) / v.type.topSpeed, 0, 1), dt);
      if (v.skidding) {
        this.fx.skid(v.x - Math.cos(v.angle) * 10, v.y - Math.sin(v.angle) * 10);
        if (Math.random() < 0.3) this.sound.skid();
      }
      if (v.health < v.maxHealth * 0.4 && Math.random() < dt * 6) {
        this.fx.puff(v.x + Math.cos(v.angle) * 14, v.y + Math.sin(v.angle) * 14, v.health < v.maxHealth * 0.18);
      }
      this.resolveVehicleCollision(v, before);
      p.x = v.x;
      p.y = v.y;
      p.angle = v.angle;
      p.moving = v.speed > 12;
      if (input.hit('KeyE')) this.exitVehicle();
      if (v.wrecked) {
        this.toast('Wrecked — get out and find another ride');
        this.exitVehicleForced();
      }
      return;
    }
    // On foot
    const ax = input.axisX();
    const ay = input.axisY();
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    p.moving = ax !== 0 || ay !== 0;
    if (p.moving) {
      const len = Math.hypot(ax, ay);
      p.x += (ax / len) * speed * dt;
      p.y += (ay / len) * speed * dt;
      p.stepPhase += dt * (sprint ? 13 : 10);
    }
    // Face the mouse while armed; face travel otherwise.
    const aim = Math.atan2(input.mouseY + this.camY - p.y, input.mouseX + this.camX - p.x);
    p.angle = aim;
    const resolved = this.city.collideCircle(p.x, p.y, PLAYER.radius);
    p.x = resolved.x;
    p.y = resolved.y;
    if (!this.city.isWater(p.x, p.y)) {
      const clamped = this.city.clampLand(p.x, p.y, PLAYER.radius);
      // The pier is walkable decking over the water.
      const pier = this.city.pier;
      const onPier = p.x > pier.x && p.x < pier.x + pier.w && p.y > pier.y - 4 && p.y < pier.y + pier.h + 4;
      if (!onPier) {
        p.x = clamped.x;
        p.y = clamped.y;
      }
    } else {
      const clamped = this.city.clampLand(p.x, p.y, PLAYER.radius);
      p.x = clamped.x;
      p.y = clamped.y;
    }
    // Health regen
    if (this.time - p.lastHurt > PLAYER.regenDelay && p.health > 0) {
      p.health = Math.min(PLAYER.maxHealth, p.health + PLAYER.regenRate * dt);
    }
    // Shooting
    if (input.mouseDown && this.fireCooldown <= 0) this.firePistol();
    if (input.hit('KeyR')) this.startReload();
    // Interactions
    this.promptText = this.computePrompt();
    if (input.hit('KeyE')) this.runInteraction();
  }

  exitVehicleForced() {
    const p = this.player;
    if (!p.vehicle) return;
    const v = p.vehicle;
    const side = v.angle + Math.PI / 2;
    p.x = v.x + Math.cos(side) * 27;
    p.y = v.y + Math.sin(side) * 27;
    v.driver = null;
    v.parked = true;
    p.vehicle = null;
  }

  computePrompt() {
    const p = this.player;
    if (p.vehicle) return '';
    const v = this.nearestVehicle(52);
    if (v) return v.driver === 'traffic' ? `E — Steal the ${v.type.name}` : `E — Drive the ${v.type.name}`;
    for (const stand of this.city.foodStands) {
      if (Math.hypot(p.x - stand.x, p.y - stand.y) < 44) {
        return p.health < PLAYER.maxHealth ? `E — Eat at ${stand.name} ($25, full health)` : `${stand.name} — you are full`;
      }
    }
    if (!this.missions.active && !this.missions.chainDone) {
      const g = this.city.landmark('garage');
      if (Math.hypot(p.x - g.doorX, p.y - g.doorY) < 52) return `E — Talk to Delia (job ${this.missions.index + 1}: ${['Hot Wheels', 'The Case', 'Cool Off', 'Shipyard Dogs', 'By Boat'][this.missions.index]})`;
    }
    return '';
  }

  runInteraction() {
    const p = this.player;
    const v = this.nearestVehicle(52);
    if (v) {
      this.enterVehicle(v);
      return;
    }
    for (const stand of this.city.foodStands) {
      if (Math.hypot(p.x - stand.x, p.y - stand.y) < 44) {
        if (p.health >= PLAYER.maxHealth) return;
        if (this.cash < 25) {
          this.toast('Not enough cash for a meal');
          return;
        }
        this.cash -= 25;
        p.health = PLAYER.maxHealth;
        this.sound.cash();
        this.toast('Fed and patched up');
        return;
      }
    }
    if (!this.missions.active && !this.missions.chainDone) {
      const g = this.city.landmark('garage');
      if (Math.hypot(p.x - g.doorX, p.y - g.doorY) < 52) {
        this.missions.startMission();
      }
    }
  }

  /** Building and water collision for one vehicle; applies impact damage. */
  resolveVehicleCollision(v, speedBefore = null) {
    const before = speedBefore ?? v.speed;
    if (v.boat) {
      // Boats stay on the water; the shore and the pier ends stop them.
      if (!this.city.isWater(v.x, v.y)) {
        v.x -= v.vx * 0.016;
        v.y -= v.vy * 0.016;
        v.vx *= 0.4;
        v.vy *= 0.4;
        if (before > 120) {
          v.damage(4);
          this.sound.splash();
        }
      }
      v.x = clamp(v.x, 30, WORLD.width - 20);
      v.y = clamp(v.y, 24, WORLD.height - 24);
      return;
    }
    const resolved = this.city.collideCircle(v.x, v.y, v.radius * 0.82);
    if (resolved.hit) {
      v.x = resolved.x;
      v.y = resolved.y;
      const impact = before;
      v.vx *= -0.18;
      v.vy *= -0.18;
      if (impact > 130) {
        const dmg = (impact - 120) * 0.06;
        const wasWrecked = v.wrecked;
        v.damage(dmg);
        this.fx.spark(v.x, v.y, '#ffca6a', 7);
        this.sound.crash(clamp(impact / 380, 0.3, 1));
        if (v.driver === 'player') {
          this.hurtPlayer((impact - 120) * 0.02);
          this.commitCrime(22, v.x, v.y);
          if (!wasWrecked && v.wrecked) this.toast('Wrecked!');
        }
      }
    }
    if (this.city.isWater(v.x, v.y)) {
      // Land cars stop at the shore.
      v.x -= v.vx * 0.016;
      v.y -= v.vy * 0.016;
      v.vx *= 0.25;
      v.vy *= 0.25;
      if (before > 150) this.sound.splash();
    }
    v.x = clamp(v.x, 20, WORLD.width - 20);
    v.y = clamp(v.y, 20, WORLD.height - 20);
  }

  updateTraffic(dt) {
    const p = this.player;
    const obstacles = this.allVehicles();
    for (const v of this.vehicles) {
      const brain = this.brains.get(v);
      if (brain && v.driver === 'traffic') {
        brain.update(dt, obstacles);
        this.resolveVehicleCollision(v);
      }
    }
    // Despawn the far, spawn the near.
    this.vehicles = this.vehicles.filter((v) => {
      if (v.driver !== 'traffic') return true;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d > 1300) {
        this.brains.delete(v);
        return false;
      }
      return true;
    });
    const trafficCount = this.vehicles.filter((v) => v.driver === 'traffic').length;
    if (trafficCount < 13 && Math.random() < dt * 2.2) this.spawnTraffic(false);
  }

  updateGuards(dt) {
    const p = this.player;
    for (const guard of this.guards) {
      if (!guard.alive) continue;
      const dist = Math.hypot(p.x - guard.x, p.y - guard.y);
      if (guard.state === 'idle' && (dist < 190 || this.time - this.lastShotAt < 2)) {
        if (dist < 260) guard.alert();
      }
      if (guard.state !== 'combat') continue;
      guard.angle = Math.atan2(p.y - guard.y, p.x - guard.x);
      if (dist > 165) {
        guard.x += Math.cos(guard.angle) * 92 * dt;
        guard.y += Math.sin(guard.angle) * 92 * dt;
        const resolved = this.city.collideCircle(guard.x, guard.y, guard.radius);
        guard.x = resolved.x;
        guard.y = resolved.y;
      }
      guard.cooldown -= dt;
      if (guard.cooldown <= 0 && dist < 285 && this.city.lineOfSight(guard.x, guard.y, p.x, p.y)) {
        guard.cooldown = 0.95 + Math.random() * 0.7;
        this.sound.enemyShot();
        const tx = p.x + randRange(Math.random, -9, 9);
        const ty = p.y + randRange(Math.random, -9, 9);
        this.fx.tracer(guard.x, guard.y, tx, ty, '#ffb0a0');
        const hitChance = 0.44 - dist / 1100 - (p.vehicle ? Math.abs(p.vehicle.forwardSpeed()) / 1800 : p.moving ? 0.1 : 0);
        if (Math.random() < Math.max(0.06, hitChance)) {
          if (p.vehicle && Math.random() < 0.65) {
            p.vehicle.damage(5);
            this.fx.spark(p.x, p.y, '#ffca6a', 4);
          } else {
            this.fx.spark(p.x, p.y, '#ff7a59', 4);
            this.hurtPlayer(randRange(Math.random, 4, 9));
          }
        }
      }
      // A guard who sees a crime keeps the law informed.
      if (dist < 300) this.wanted.noteSeen();
    }
  }

  collideVehicles(dt) {
    const all = this.allVehicles();
    for (let i = 0; i < all.length; i += 1) {
      const a = all[i];
      for (let j = i + 1; j < all.length; j += 1) {
        const b = all[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius * 0.8 + b.radius * 0.8;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          const aParked = a.parked || a.driver === null;
          const bParked = b.parked || b.driver === null;
          if (!aParked) {
            a.x -= nx * push;
            a.y -= ny * push;
          }
          if (!bParked) {
            b.x += nx * push;
            b.y += ny * push;
          }
          const closing = Math.abs((a.vx - b.vx) * nx + (a.vy - b.vy) * ny);
          if (closing > 95) {
            a.damage((closing - 80) * 0.05);
            b.damage((closing - 80) * 0.05);
            this.fx.spark((a.x + b.x) / 2, (a.y + b.y) / 2, '#ffca6a', 6);
            this.sound.crash(clamp(closing / 380, 0.3, 1));
            if (a.driver === 'player' || b.driver === 'player') {
              this.commitCrime(28, this.player.x, this.player.y);
              this.hurtPlayer((closing - 80) * 0.015);
            }
          }
          // Exchange a little velocity so shunts feel physical.
          const avn = a.vx * nx + a.vy * ny;
          const bvn = b.vx * nx + b.vy * ny;
          a.vx += (bvn - avn) * 0.6 * nx;
          a.vy += (bvn - avn) * 0.6 * ny;
          b.vx += (avn - bvn) * 0.6 * nx;
          b.vy += (avn - bvn) * 0.6 * ny;
        }
      }
    }
    // Cars versus people.
    for (const v of all) {
      if (v.speed < 55) continue;
      for (const ped of this.crowd.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - v.x, ped.y - v.y) < v.radius + 8) {
          if (ped.knockDown()) {
            this.fx.spark(ped.x, ped.y, '#ff7a59', 5);
            this.sound.crash(0.4);
            if (v.driver === 'player') {
              this.commitCrime(95, ped.x, ped.y);
              this.toast('You hit a pedestrian!');
            }
          }
        }
      }
      // A moving car versus the player on foot: one hit per knockdown, not per frame.
      const p = this.player;
      if (!p.vehicle && v.driver !== 'player' && Math.hypot(p.x - v.x, p.y - v.y) < v.radius + 10) {
        const push = Math.atan2(p.y - v.y, p.x - v.x);
        p.x += Math.cos(push) * 20;
        p.y += Math.sin(push) * 20;
        if (this.time - (this.lastCarHitAt ?? -9) > 0.8) {
          this.lastCarHitAt = this.time;
          this.hurtPlayer(9);
          this.sound.crash(0.5);
        }
      }
    }
  }

  witnessCheck() {
    const p = this.player;
    if (this.wanted.stars === 0) return;
    for (const car of this.police.cars) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < 430 && this.city.lineOfSight(car.x, car.y, p.x, p.y)) {
        this.wanted.noteSeen();
        return;
      }
    }
    for (const ped of this.crowd.peds) {
      if (ped.state !== 'down' && Math.hypot(ped.x - p.x, ped.y - p.y) < 240 && this.city.lineOfSight(ped.x, ped.y, p.x, p.y)) {
        this.wanted.noteSeen();
        return;
      }
    }
  }

  // ---- rendering ----------------------------------------------------------

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#101319';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));
    drawWorld(ctx, this);
    // Stashes and markers sit on the ground under the actors.
    for (const s of this.missions.stashes) {
      if (!s.taken) drawStash(ctx, s.x, s.y, this.time);
    }
    const obj = this.objectiveCache;
    if ((this.state === 'play' || this.state === 'pause') && obj && obj.x !== null && obj.x !== undefined) {
      drawMarker(ctx, obj.x, obj.y, this.time, '#ffd76a');
    }
    if (this.missions.courierOffer) {
      drawMarker(ctx, this.missions.courierOffer.x, this.missions.courierOffer.y, this.time, '#7fe08a', '$');
    }
    if (this.missionCar && this.missions.active && this.missions.index === 0 && this.missions.active.stage === 0) {
      drawMarker(ctx, this.missionCar.x, this.missionCar.y - 6, this.time, '#ffd76a', 'GT');
    }
    for (const ped of this.crowd.peds) {
      drawPerson(ctx, ped.x, ped.y, ped.angle, { shirt: ped.shirt, pants: ped.pants, skin: ped.skin, down: ped.state === 'down' }, ped.state !== 'down', ped.stepPhase);
    }
    for (const guard of this.guards) {
      if (!guard.alive) {
        drawPerson(ctx, guard.x, guard.y, guard.angle, { shirt: guard.shirt, pants: '#222', skin: '#c98d5f', down: true }, false, 0);
      } else {
        drawPerson(ctx, guard.x, guard.y, guard.angle, { shirt: guard.shirt, pants: '#22252a', skin: '#c98d5f', gun: guard.state === 'combat' }, guard.state === 'combat', this.time * 8);
      }
    }
    for (const unit of this.police.units) {
      drawVehicle(ctx, unit.car, this.time);
      if (unit.officer) {
        const o = unit.officer;
        drawPerson(ctx, o.x, o.y, o.angle, { shirt: '#274b73', pants: '#1d2733', skin: '#e8b98f', gun: true, down: o.dead }, !o.dead, o.stepPhase);
      }
    }
    for (const v of this.vehicles) drawVehicle(ctx, v, this.time);
    const p = this.player;
    if (!p.vehicle && this.state !== 'title') {
      const showGun = this.input.mouseDown || this.time - this.lastShotAt < 1.4;
      drawPerson(ctx, p.x, p.y, p.angle, { ...HERO_LOOK, gun: showGun }, p.moving, p.stepPhase);
    }
    this.fx.drawOver(ctx);
    drawNightTint(ctx, this);
    ctx.restore();

    if (this.state === 'title') {
      drawTitle(ctx, this);
      drawButtons(ctx, this.titleButtons(), this.input.mouseX, this.input.mouseY);
    } else if (this.state === 'howto') {
      drawHowTo(ctx);
    } else if (this.state === 'pause') {
      drawHUD(ctx, this);
      drawPause(ctx, this);
      drawButtons(ctx, this.pauseButtons(), this.input.mouseX, this.input.mouseY);
    } else if (this.state === 'busted' || this.state === 'wasted') {
      drawHUD(ctx, this);
      drawEndCard(ctx, this, this.state);
    } else {
      drawHUD(ctx, this);
      drawBanner(ctx, this);
    }
    const status = document.getElementById('status');
    if (status) status.textContent = `Coral Bay: Wheelman — cash ${this.cash}, wanted ${this.wanted.stars} stars, state ${this.state}`;
  }
}

// Boot: build the game, honour ?shot= scenes for the screenshot harness.
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__game = game;

const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  import('./shots.js').then(({ stageShot }) => {
    stageShot(game, params.get('shot'), Number(params.get('seed') ?? 1));
    game.render();
    window.__CB_SHOT_READY = true;
  });
} else {
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    game.input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
