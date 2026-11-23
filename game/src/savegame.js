// Save games live in one localStorage slot: cash, story progress, where Marco is
// standing, his health and the time of day. Written automatically after every
// mission and by hand from the pause menu.

import { SAVE_KEY } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function writeSave(game) {
  const p = game.player;
  const data = {
    version: 1,
    cash: game.cash,
    missionIndex: game.missions.index,
    x: Math.round(p.x),
    y: Math.round(p.y),
    health: Math.round(p.health),
    clock: game.clockMinutes,
    ammoReserve: game.ammoReserve,
    seed: game.city.seed,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    /* private mode: nothing to clear */
  }
}
