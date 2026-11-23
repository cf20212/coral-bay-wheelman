// Everything the camera sees: the city ground, roads and buildings, props, cars,
// boats, people, markers and the light of the hour. Pure canvas, no images.

import { AVENUES, STREETS, ROAD_HALF, WORLD, PALETTE, VIEW } from './config.js';
import { clamp } from './random.js';

function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export function drawPerson(ctx, x, y, angle, look, moving, phase) {
  ctx.save();
  ctx.translate(x, y);
  if (look.down) {
    ctx.rotate(angle);
    ctx.fillStyle = look.shirt;
    ctx.fillRect(-11, -5, 22, 10);
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const step = moving ? Math.sin(phase) * 4 : 0;
  ctx.rotate(angle);
  ctx.fillStyle = look.pants;
  ctx.fillRect(-2, -6 + step * 0.4, 9, 4.4);
  ctx.fillRect(-2, 1.6 - step * 0.4, 9, 4.4);
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8.4, 0, Math.PI * 2);
  ctx.fill();
  if (look.gun) {
    ctx.strokeStyle = '#22252a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 3);
    ctx.lineTo(17, 3);
    ctx.stroke();
  }
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(1.5, 0, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawVehicle(ctx, v, time) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  const w = v.type.w;
  const h = v.type.h;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  // Wheels
  ctx.fillStyle = '#14161a';
  const ww = 8;
  const wh = 4.6;
  ctx.fillRect(-w / 2 + 4, -h / 2 - 2, ww, wh);
  ctx.fillRect(-w / 2 + 4, h / 2 - wh + 2, ww, wh);
  ctx.fillRect(w / 2 - ww - 4, -h / 2 - 2, ww, wh);
  ctx.fillRect(w / 2 - ww - 4, h / 2 - wh + 2, ww, wh);
  // Body
  ctx.fillStyle = v.wrecked ? '#2e2e30' : v.colour;
  if (v.boat) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2 - 8, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(w / 2 - 8, h / 2);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(-w / 2 + 6, -h / 2 + 3, w - 20, h - 6);
  } else {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 5);
    ctx.fill();
    // Cabin glass
    ctx.fillStyle = 'rgba(18,26,34,0.85)';
    ctx.beginPath();
    ctx.roundRect(-w * 0.08, -h / 2 + 3, w * 0.34, h - 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,180,205,0.5)';
    ctx.fillRect(w * 0.2, -h / 2 + 4, 3, h - 8);
    // Police livery and light bar
    if (v.type.id === 'interceptor') {
      ctx.fillStyle = '#e8ecf0';
      ctx.fillRect(-w * 0.05, -h / 2 + 2, w * 0.3, h - 4);
      const flash = Math.floor(time * 5) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82f6';
      ctx.fillRect(-4, -5, 8, 4.4);
      ctx.fillStyle = flash ? '#3b82f6' : '#ff3b30';
      ctx.fillRect(-4, 0.6, 8, 4.4);
    }
    if (v.type.id === 'taxi') {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(-3, -3.4, 7, 6.8);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0.5, 2);
    }
    if (v.type.id === 'van' || v.type.id === 'pickup') {
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 3, w * 0.4, h - 6);
    }
    // Headlights and brake lights
    ctx.fillStyle = '#ffeeb0';
    ctx.fillRect(w / 2 - 2, -h / 2 + 2.4, 2.4, 3.6);
    ctx.fillRect(w / 2 - 2, h / 2 - 6, 2.4, 3.6);
    ctx.fillStyle = v.brakeLights ? '#ff5040' : '#8c2f28';
    ctx.fillRect(-w / 2 - 0.6, -h / 2 + 2.4, 2.4, 3.6);
    ctx.fillRect(-w / 2 - 0.6, h / 2 - 6, 2.4, 3.6);
    // Damage shading
    if (v.health < v.maxHealth * 0.45 && !v.wrecked) {
      ctx.fillStyle = 'rgba(30,30,30,0.35)';
      ctx.fillRect(-w / 2, -h / 2, w * 0.3, h);
    }
  }
  ctx.restore();
}

function drawProp(ctx, prop, dark) {
  const { x, y, kind } = prop;
  if (kind === 'palm') {
    ctx.strokeStyle = '#7a5c38';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y - 4);
    ctx.stroke();
    ctx.strokeStyle = '#3f7d3a';
    ctx.lineWidth = 2.6;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + x * 0.01;
      ctx.beginPath();
      ctx.moveTo(x + 3, y - 4);
      ctx.quadraticCurveTo(x + 3 + Math.cos(a) * 9, y - 10, x + 3 + Math.cos(a) * 14, y - 3 + Math.sin(a) * 3);
      ctx.stroke();
    }
  } else if (kind === 'tree') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(x + 3, y + 4, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3c6e35';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4c8143';
    ctx.beginPath();
    ctx.arc(x - 4, y - 4, 8.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'lamp') {
    ctx.fillStyle = '#3a3f45';
    ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(x, y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    if (dark > 0.25) {
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 44);
      grad.addColorStop(0, `rgba(255,205,90,${0.34 * dark})`);
      grad.addColorStop(1, 'rgba(255,205,90,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 44, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'crate') {
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.strokeStyle = '#6e5638';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 9, y - 9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 9);
    ctx.lineTo(x + 9, y + 9);
    ctx.moveTo(x + 9, y - 9);
    ctx.lineTo(x - 9, y + 9);
    ctx.stroke();
  }
}

function drawBuilding(ctx, b, view) {
  if (b.x + b.w < view.x || b.y + b.h < view.y || b.x > view.x + view.w || b.y > view.y + view.h) return;
  const lift = Math.min(16, 3 + b.floors * 1.1);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(b.x + lift * 0.7, b.y + lift * 0.9, b.w, b.h);
  ctx.fillStyle = b.colour;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  // Window grid, lit in the evening. Barely half the cells are drawn, so the
  // facade reads as windows rather than a waffle.
  const cols = Math.max(2, Math.floor(b.w / 17));
  const rows = Math.max(2, Math.floor(b.h / 17));
  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < rows; j += 1) {
      const h = hash2(b.x + i * 13.7, b.y + j * 9.3);
      if (h < 0.42) continue;
      ctx.fillStyle = h > 0.78 ? 'rgba(255,225,150,0.5)' : 'rgba(20,30,40,0.28)';
      ctx.fillRect(b.x + 5 + i * ((b.w - 10) / cols), b.y + 5 + j * ((b.h - 10) / rows), 6.5, 4.6);
    }
  }
  if (b.sign) {
    ctx.fillStyle = 'rgba(16,20,26,0.82)';
    const label = b.sign;
    ctx.font = 'bold 12px sans-serif';
    const tw = ctx.measureText(label).width + 14;
    ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y + b.h + 4, tw, 17);
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h + 17);
  }
}

export function drawWorld(ctx, game) {
  const { city, camX, camY, time } = game;
  const view = { x: camX, y: camY, w: VIEW.width, h: VIEW.height };
  // Base ground
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // The bay
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(WORLD.waterX, view.y, view.x + view.w - WORLD.waterX, view.h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(WORLD.waterX, view.y, Math.max(0, view.x + view.w - WORLD.waterX), view.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(view.y / 90) * 90; y < view.y + view.h; y += 90) {
    ctx.beginPath();
    for (let x = WORLD.waterX + 12; x < view.x + view.w; x += 46) {
      const yy = y + Math.sin(time * 1.4 + x * 0.02 + y) * 3;
      if (x === WORLD.waterX + 12) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Beach
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(WORLD.beachX, view.y, WORLD.waterX - WORLD.beachX, view.h);
  // Blocks: sidewalks, park, shipyard gravel
  for (const block of city.blocks) {
    if (block.x + block.w < view.x || block.y + block.h < view.y || block.x > view.x + view.w || block.y > view.y + view.h) continue;
    ctx.fillStyle = block.isPark ? PALETTE.parkGrass : block.isShipyard ? '#8d8577' : PALETTE.sidewalk;
    ctx.fillRect(block.x, block.y, block.w, block.h);
    if (block.isPark) {
      ctx.strokeStyle = 'rgba(230,220,190,0.5)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(block.x, block.cy);
      ctx.lineTo(block.x + block.w, block.cy);
      ctx.moveTo(block.cx, block.y);
      ctx.lineTo(block.cx, block.y + block.h);
      ctx.stroke();
    }
  }
  // Roads
  ctx.fillStyle = PALETTE.road;
  for (const ax of AVENUES) ctx.fillRect(ax - ROAD_HALF, view.y, ROAD_HALF * 2, view.h);
  for (const sy of STREETS) ctx.fillRect(view.x, sy - ROAD_HALF, view.w, ROAD_HALF * 2);
  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = 2.4;
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(ax - ROAD_HALF, view.y);
    ctx.lineTo(ax - ROAD_HALF, view.y + view.h);
    ctx.moveTo(ax + ROAD_HALF, view.y);
    ctx.lineTo(ax + ROAD_HALF, view.y + view.h);
    ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath();
    ctx.moveTo(view.x, sy - ROAD_HALF);
    ctx.lineTo(view.x + view.w, sy - ROAD_HALF);
    ctx.moveTo(view.x, sy + ROAD_HALF);
    ctx.lineTo(view.x + view.w, sy + ROAD_HALF);
    ctx.stroke();
  }
  // Lane dashes
  ctx.strokeStyle = PALETTE.laneMark;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([16, 20]);
  for (const ax of AVENUES) {
    ctx.beginPath();
    ctx.moveTo(ax, view.y);
    ctx.lineTo(ax, view.y + view.h);
    ctx.stroke();
  }
  for (const sy of STREETS) {
    ctx.beginPath();
    ctx.moveTo(view.x, sy);
    ctx.lineTo(view.x + view.w, sy);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // The pier
  ctx.fillStyle = '#9a7d55';
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  ctx.strokeStyle = '#77592f';
  ctx.lineWidth = 2;
  for (let x = city.pier.x + 12; x < city.pier.x + city.pier.w; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, city.pier.y);
    ctx.lineTo(x, city.pier.y + city.pier.h);
    ctx.stroke();
  }
  // Mission 5 buoy
  ctx.fillStyle = '#e0473a';
  ctx.beginPath();
  ctx.arc(city.buoy.x, city.buoy.y + Math.sin(time * 2) * 3, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(city.buoy.x - 12, city.buoy.y - 3 + Math.sin(time * 2) * 3, 24, 6);

  game.fx.drawUnder(ctx);
  for (const prop of city.props) {
    if (prop.x < view.x - 30 || prop.x > view.x + view.w + 30 || prop.y < view.y - 30 || prop.y > view.y + view.h + 30) continue;
    drawProp(ctx, prop, game.darkness);
  }
  for (const b of city.buildings) drawBuilding(ctx, b, view);
  // Food stands
  for (const stand of city.foodStands) drawFoodStand(ctx, stand);
}

export function drawFoodStand(ctx, stand) {
  ctx.fillStyle = '#c9553e';
  ctx.fillRect(stand.x - 20, stand.y - 13, 40, 26);
  ctx.fillStyle = '#f2e3c2';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(stand.x - 20 + i * 10, stand.y - 13, 5, 26);
  ctx.fillStyle = 'rgba(16,20,26,0.85)';
  ctx.fillRect(stand.x - 24, stand.y + 16, 48, 14);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(stand.name.toUpperCase(), stand.x, stand.y + 26);
}

export function drawMarker(ctx, x, y, time, colour, label) {
  const bob = Math.sin(time * 3.2) * 5;
  ctx.fillStyle = colour;
  ctx.globalAlpha = 0.3 + 0.14 * Math.sin(time * 3.2);
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(x - 11, y - 34 + bob);
  ctx.lineTo(x + 11, y - 34 + bob);
  ctx.lineTo(x, y - 16 + bob);
  ctx.closePath();
  ctx.fill();
  if (label) {
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, x, y - 42 + bob);
    ctx.fillText(label, x, y - 42 + bob);
  }
}

export function drawStash(ctx, x, y, time) {
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#2e7d43';
  ctx.fillRect(-8, -6, 16, 12);
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(-8, -6, 16, 12);
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('$', 0, 4);
  ctx.restore();
}

export function drawNightTint(ctx, game) {
  if (game.darkness <= 0.01) return;
  ctx.fillStyle = `rgba(10,16,44,${(game.darkness * 0.42).toFixed(3)})`;
  ctx.fillRect(game.camX, game.camY, VIEW.width, VIEW.height);
}

export { clamp };
