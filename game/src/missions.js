// Story and work: Delia Voss's five-job chain for Marco Reyes, endless courier runs
// between the landmarks, and cash stashes that keep reappearing around Coral Bay.

import { randRange, pick } from './random.js';

export const MISSION_DEFS = [
  {
    title: 'Hot Wheels',
    pay: 600,
    intro: 'Delia: A Vireo GT is sitting pretty outside Café Brisa. Bring it to my garage. Unscratched pays full.',
    done: 'Delia: Clean work, Marco. The Bay is starting to hear your name.',
  },
  {
    title: 'The Case',
    pay: 800,
    intro: 'Delia: A guest at the Coral Sands left a case behind. Collect it, drop it at the marina. Expect company.',
    done: 'Delia: The case is where it belongs. So is the money.',
  },
  {
    title: 'Cool Off',
    pay: 700,
    intro: 'Delia: The whole force is looking for you — that is the point. Shake them. All of them.',
    done: 'Delia: Gone like sea mist. You are wasted on honest work.',
  },
  {
    title: 'Shipyard Dogs',
    pay: 1200,
    intro: 'Delia: The shipyard manifest names every crooked crew on the docks. Take it. The guards will object.',
    done: 'Delia: With this, half the harbour owes me. Which means it owes you.',
  },
  {
    title: 'By Boat',
    pay: 1500,
    intro: 'Delia: Last job. The Skiff Runner at the marina — take her out to the buoy. No roads, no sirens.',
    done: 'Delia: That is the set, Marco. Coral Bay is yours now. Keep the phone on.',
  },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.index = 0; // next mission to offer; == MISSION_DEFS.length when the chain is done
    this.active = null; // {def, stage, data}
    this.courier = null;
    this.courierOffer = null;
    this.offerTimer = 18;
    this.stashes = game.city.stashSpots.map((s) => ({ x: s.x, y: s.y, taken: false, timer: 0, value: Math.round(randRange(game.rng, 40, 140)) }));
  }

  get chainDone() {
    return this.index >= MISSION_DEFS.length;
  }

  /** The marker the player should head for, and what the HUD should say. */
  objective() {
    const g = this.game;
    if (this.active) {
      const a = this.active;
      switch (this.index) {
        case 0:
          if (a.stage === 0) return { text: 'Steal the Vireo GT outside Café Brisa', x: a.data.car.x, y: a.data.car.y };
          return { text: 'Deliver the GT to Voss Auto Works', x: g.city.landmark('garage').doorX, y: g.city.landmark('garage').doorY };
        case 1:
          if (a.stage === 0) return { text: 'Collect the case at the Coral Sands Motel', x: g.city.landmark('motel').doorX, y: g.city.landmark('motel').doorY };
          return { text: 'Drop the case at Marina Pier', x: g.city.landmark('marina').doorX, y: g.city.landmark('marina').doorY };
        case 2:
          return { text: 'Lose the heat — break line of sight and stay hidden', x: null, y: null };
        case 3:
          if (a.stage === 0) return { text: 'Enter the shipyard and take the manifest', x: 2330, y: 2050 };
          return { text: 'Escape to Marco\'s Safehouse', x: g.city.landmark('safehouse').doorX, y: g.city.landmark('safehouse').doorY };
        case 4:
          if (a.stage === 0) return { text: 'Take the Skiff Runner at Marina Pier', x: g.city.boatSpawn.x, y: g.city.boatSpawn.y };
          return { text: 'Reach the buoy in the bay', x: g.city.buoy.x, y: g.city.buoy.y };
        default:
          break;
      }
    }
    if (this.courier) {
      if (this.courier.stage === 0) return { text: 'Pick up the package', x: this.courier.pickup.x, y: this.courier.pickup.y };
      return { text: `Deliver the package — ${Math.max(0, Math.ceil(this.courier.timer))}s`, x: this.courier.drop.x, y: this.courier.drop.y };
    }
    if (this.courierOffer) {
      return { text: 'Courier job on offer — drive through the $ marker', x: this.courierOffer.x, y: this.courierOffer.y };
    }
    if (!this.chainDone) {
      const lm = g.city.landmark('garage');
      return { text: `See Delia at Voss Auto Works — job ${this.index + 1} of 5: ${MISSION_DEFS[this.index].title}`, x: lm.doorX, y: lm.doorY };
    }
    return { text: 'Free roam — courier markers and stashes pay cash', x: null, y: null };
  }

  nearObjective(radius) {
    const o = this.objective();
    if (!o || o.x === null) return false;
    const p = this.game.player;
    return Math.hypot(p.x - o.x, p.y - o.y) < radius;
  }

  startMission() {
    const g = this.game;
    const def = MISSION_DEFS[this.index];
    const data = {};
    if (this.index === 0) {
      data.car = g.spawnMissionCar();
    }
    if (this.index === 2) {
      g.wanted.setStars(3);
    }
    if (this.index === 3) {
      g.spawnShipyardGuards();
    }
    if (this.index === 4) {
      g.ensureBoat();
    }
    this.active = { def, stage: 0, data };
    g.banner(`MISSION — ${def.title}`, def.intro, 5.5);
    g.sound.phoneBuzz();
  }

  completeMission() {
    const g = this.game;
    const def = MISSION_DEFS[this.index];
    g.addCash(def.pay);
    g.banner(`MISSION COMPLETE — $${def.pay}`, def.done, 5);
    g.sound.jingle();
    this.active = null;
    this.index += 1;
    g.saveGame(true);
  }

  failMission(reason) {
    const g = this.game;
    if (!this.active) return;
    g.banner('MISSION FAILED', reason, 4);
    g.sound.failSting();
    if (this.index === 3) g.clearGuards();
    this.active = null;
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    // Stashes tick back into the world.
    for (const s of this.stashes) {
      if (s.taken) {
        s.timer -= dt;
        if (s.timer <= 0) {
          s.taken = false;
          s.value = Math.round(randRange(g.rng, 40, 140));
        }
      } else if (Math.hypot(p.x - s.x, p.y - s.y) < 24) {
        s.taken = true;
        s.timer = 50;
        g.addCash(s.value);
        g.toast(`Cash stash +$${s.value}`);
        g.sound.cash();
        g.fx.ring(s.x, s.y, '#7fe08a');
      }
    }
    // Courier offers appear while no job is running.
    if (!this.courier && !this.active) {
      this.offerTimer -= dt;
      if (this.offerTimer <= 0 && !this.courierOffer) {
        const lm = pick(g.rng, g.city.landmarks);
        this.courierOffer = { x: lm.doorX, y: lm.doorY, name: lm.name, timer: 45 };
        this.offerTimer = 55;
      }
    }
    if (this.courierOffer) {
      this.courierOffer.timer -= dt;
      if (this.courierOffer.timer <= 0) this.courierOffer = null;
      else if (Math.hypot(p.x - this.courierOffer.x, p.y - this.courierOffer.y) < 42) {
        const others = g.city.landmarks.filter((l) => l.id !== 'marina' && l.doorX !== this.courierOffer.x);
        const pickupLm = this.courierOffer;
        const dropLm = pick(g.rng, others);
        const dist = Math.hypot(dropLm.doorX - pickupLm.x, dropLm.doorY - pickupLm.y);
        this.courier = {
          stage: 1,
          pickup: pickupLm,
          drop: { x: dropLm.doorX, y: dropLm.doorY, name: dropLm.name },
          timer: Math.max(50, dist / 8.5),
          pay: Math.round(120 + dist * 0.12),
        };
        this.courierOffer = null;
        g.banner('COURIER RUN', `Package for ${dropLm.name}. $${this.courier.pay} if it lands in time.`, 4);
        g.sound.phoneBuzz();
      }
    }
    if (this.courier) {
      const c = this.courier;
      c.timer -= dt;
      if (c.timer <= 0) {
        this.courier = null;
        g.toast('Courier run expired — no pay');
        g.sound.failSting();
      } else if (Math.hypot(p.x - c.drop.x, p.y - c.drop.y) < 46) {
        g.addCash(c.pay);
        g.toast(`Delivered +$${c.pay}`);
        g.sound.jingle();
        this.courier = null;
      }
    }
    if (!this.active) return;
    const a = this.active;
    switch (this.index) {
      case 0:
        if (a.stage === 0 && p.vehicle === a.data.car) {
          a.stage = 1;
          g.toast('Got it — take her to Voss Auto Works');
        } else if (a.stage === 1) {
          if (p.vehicle !== a.data.car) {
            // Left the car somewhere: point back at it.
            if (Math.hypot(p.x - a.data.car.x, p.y - a.data.car.y) > 60 && !a.data.warned) {
              a.data.warned = true;
              g.toast('The GT, Marco. Delia wants that car, not another.');
            }
          } else if (this.nearObjective(70)) {
            this.completeMission();
          }
        }
        break;
      case 1:
        if (a.stage === 0 && this.nearObjective(40) && !p.vehicle) {
          a.stage = 1;
          g.wanted.setStars(2);
          g.toast('Case in hand — the Bay just got interested');
          g.sound.pickup();
        } else if (a.stage === 1 && this.nearObjective(48)) {
          this.completeMission();
        }
        break;
      case 2:
        if (g.wanted.stars === 0) this.completeMission();
        break;
      case 3:
        if (a.stage === 0 && Math.hypot(p.x - 2330, p.y - 2050) < 34) {
          a.stage = 1;
          g.wanted.report(120, true);
          g.toast('Manifest secured — run!');
          g.sound.pickup();
        } else if (a.stage === 1 && this.nearObjective(56)) {
          this.completeMission();
        }
        break;
      case 4:
        if (a.stage === 0 && p.vehicle && p.vehicle.boat) {
          a.stage = 1;
          g.toast('Out on the water — head for the buoy');
        } else if (a.stage === 1 && p.vehicle && Math.hypot(p.x - g.city.buoy.x, p.y - g.city.buoy.y) < 90) {
          this.completeMission();
        }
        break;
      default:
        break;
    }
  }
}
