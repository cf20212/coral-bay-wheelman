// Screenshot scenes behind ?shot=cover|driving|chase|mission. Each one builds a real
// moment of the game — the title screen over the living city, a drive through traffic,
// a three-star pursuit, and the first mission's steal — by placing the actors and
// running the game's own update steps, so the frame is the game and nothing else.

import { VEHICLE_TYPES } from './config.js';

const STEP = 1 / 30;

function runSteps(game, steps, keys = []) {
  game.input.keys.clear();
  for (const k of keys) game.input.keys.add(k);
  for (let i = 0; i < steps; i += 1) game.update(STEP);
  game.input.keys.clear();
}

function putPlayerInCar(game, typeId, x, y, angle) {
  const type = VEHICLE_TYPES.find((t) => t.id === typeId) ?? VEHICLE_TYPES[1];
  const car = game.vehicles.find((v) => v.parked && v.type.id === typeId);
  const vehicle = car ?? null;
  if (vehicle) {
    vehicle.x = x;
    vehicle.y = y;
    vehicle.angle = angle;
    game.enterVehicle(vehicle);
    return vehicle;
  }
  return null;
}

export function stageShot(game, name, seed) {
  game.input.enabled = false;
  const city = game.city;
  if (name === 'driving') {
    game.state = 'play';
    // Marco in a Vireo Coupe on the downtown avenue, mid-morning, traffic around him.
    const car = putPlayerInCar(game, 'coupe', 1640 + 23, 1500, Math.PI / 2);
    game.clockMinutes = 10 * 60 + 24;
    for (let i = 0; i < 6; i += 1) game.spawnTraffic(true);
    if (car) {
      car.vy = 150;
      runSteps(game, 46, ['KeyW']);
      // The staged drive bumps traffic; the photograph should not keep the bruises.
      game.hurtFlash = 0;
      game.wanted.clear();
      game.player.health = 100;
    }
    game.updateCamera(1);
    return;
  }
  if (name === 'chase') {
    game.state = 'play';
    const car = putPlayerInCar(game, 'muscle', 1180 + 23, 1250, Math.PI / 2);
    game.clockMinutes = 17 * 60 + 40;
    if (car) {
      car.colour = '#6e1f3c';
      car.vy = 235;
      game.wanted.heat = 295; // three stars
      for (let i = 0; i < 3; i += 1) {
        game.police.spawnUnit(game.player);
        const unit = game.police.units[game.police.units.length - 1];
        unit.car.x = car.x - 60 - i * 90;
        unit.car.y = car.y + 130 + i * 120;
        unit.car.angle = Math.PI / 2;
        unit.car.vy = 225;
      }
      runSteps(game, 30, ['KeyW']);
      // Guarantee pursuers in frame for the frozen moment.
      const spots = [
        { dx: -95, dy: 130 },
        { dx: 80, dy: 205 },
      ];
      game.police.units.forEach((unit, i) => {
        const s = spots[i % spots.length];
        unit.car.x = game.player.x + s.dx;
        unit.car.y = game.player.y + s.dy;
        unit.car.angle = Math.PI / 2 - 0.18;
        unit.car.vx = 30;
        unit.car.vy = 205;
        game.resolveVehicleCollision(unit.car);
      });
      game.hurtFlash = 0;
      game.objectiveCache = game.missions.objective();
    }
    game.updateCamera(1);
    return;
  }
  if (name === 'mission') {
    game.state = 'play';
    game.clockMinutes = 11 * 60 + 5;
    game.missions.startMission(); // Hot Wheels: the GT waits outside Café Brisa
    const car = game.missionCar;
    if (car) {
      // Clear the neighbouring bays so the GT is the car Marco is here for.
      game.vehicles = game.vehicles.filter((v) => v === car || Math.hypot(v.x - car.x, v.y - car.y) > 110);
      game.player.x = car.x - 74;
      game.player.y = car.y + 42;
      game.player.vehicle = null;
      game.input.mouseX = 760;
      game.input.mouseY = 330;
      runSteps(game, 12, []);
      game.player.angle = Math.atan2(car.y - game.player.y, car.x - game.player.x);
      game.objectiveCache = game.missions.objective();
    }
    game.updateCamera(1);
    return;
  }
  // Cover: the title screen over the living city, looking across downtown to the bay.
  game.state = 'title';
  game.clockMinutes = 16 * 60 + 30;
  for (let i = 0; i < 40; i += 1) game.updateAmbient(STEP);
  game.camX = 1180;
  game.camY = 620;
}
