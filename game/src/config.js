// Coral Bay: Wheelman — tuning constants, vehicle catalogue and palette.
// Everything in this file is original to this game: names, numbers and colours.

export const WORLD = {
  width: 3200,
  height: 2500,
  waterX: 2920, // the bay begins here; east of it is open water
  beachX: 2790, // sand strip between the last avenue and the water
};

export const VIEW = { width: 1280, height: 800 };

// The road grid. Avenues run north-south, streets east-west; blocks sit between them.
export const AVENUES = [260, 720, 1180, 1640, 2100, 2560];
export const STREETS = [240, 640, 1040, 1440, 1840, 2240];
export const ROAD_HALF = 46; // half the road width in px
export const LANE = 23; // lane offset from the road centre line

export const PLAYER = {
  radius: 11,
  walkSpeed: 152,
  sprintSpeed: 236,
  maxHealth: 100,
  regenDelay: 5,
  regenRate: 9,
};

export const PISTOL = {
  magazine: 12,
  reserveStart: 48,
  damage: 34,
  range: 460,
  cooldown: 0.21,
  reloadTime: 1.1,
  spread: 0.035,
};

// Eight original vehicle types. topSpeed in px/s, accel in px/s^2.
export const VEHICLE_TYPES = [
  { id: 'sedan', name: 'Meridian Sedan', w: 38, h: 19, topSpeed: 305, accel: 210, grip: 6.2, health: 120, colours: ['#b8bec9', '#7d8794', '#4c5866', '#93513f', '#51683f'] },
  { id: 'coupe', name: 'Vireo Coupe', w: 40, h: 19, topSpeed: 380, accel: 300, grip: 7.0, health: 105, colours: ['#c33d2e', '#e08a1e', '#27548f', '#20242c'] },
  { id: 'gt', name: 'Vireo GT Stradale', w: 42, h: 20, topSpeed: 455, accel: 380, grip: 7.6, health: 110, colours: ['#e8b71c', '#b02020', '#123a6e'] },
  { id: 'pickup', name: 'Hauler Pickup', w: 44, h: 21, topSpeed: 285, accel: 195, grip: 5.6, health: 170, colours: ['#8a8f7a', '#5d6a72', '#74553a'] },
  { id: 'van', name: 'Cargo Van', w: 46, h: 22, topSpeed: 262, accel: 175, grip: 5.2, health: 190, colours: ['#d8d8d2', '#9aa5ad', '#3f6180'] },
  { id: 'taxi', name: 'Coral Cab', w: 38, h: 19, topSpeed: 315, accel: 225, grip: 6.4, health: 120, colours: ['#f2b01e'] },
  { id: 'muscle', name: 'Bronto Muscle', w: 42, h: 20, topSpeed: 395, accel: 330, grip: 6.0, health: 140, colours: ['#3a3f45', '#6e1f3c', '#274d2d'] },
  { id: 'compact', name: 'Pip Compact', w: 34, h: 17, topSpeed: 272, accel: 205, grip: 6.8, health: 95, colours: ['#7fb3c8', '#c8b47f', '#a3c48f', '#c48fb1'] },
];

export const BOAT_TYPE = { id: 'boat', name: 'Skiff Runner', w: 44, h: 18, topSpeed: 300, accel: 190, grip: 3.4, health: 130, colours: ['#e8e4da', '#2e7f9e'] };

export const POLICE_TYPE = { id: 'interceptor', name: 'CBPD Interceptor', w: 40, h: 20, topSpeed: 430, accel: 330, grip: 7.4, health: 170, colours: ['#1d2733'] };

export const HEAT_PER_STAR = 100;
export const MAX_STARS = 5;

export const DISTRICTS = ['Downtown', 'Suburbs', 'Harbour', 'Industrial', 'Beachfront', 'The Park', 'Civic Quarter'];

export const PALETTE = {
  grass: '#5d8f4e',
  parkGrass: '#4e7d43',
  sand: '#e3cf9e',
  water: '#1d6f96',
  waterDeep: '#175d80',
  road: '#3c4046',
  roadEdge: '#54585e',
  sidewalk: '#9aa0a3',
  laneMark: '#d8d8ce',
  plaza: '#b0a696',
  roofA: ['#b56a4a', '#a85f43', '#c07a54'],
  roofB: ['#7d8894', '#6d7885', '#8d97a1'],
  roofC: ['#4a6b7d', '#3d5a6b', '#587b8f'],
  roofD: ['#8f8578', '#7d7466', '#a1988a'],
};

export const SAVE_KEY = 'coral-bay-wheelman-save-v1';

export const NAMES = {
  hero: 'Marco Reyes',
  fixer: 'Delia Voss',
  city: 'Coral Bay',
};
