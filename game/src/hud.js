// The HUD: cash and clock, wanted stars, the objective banner with its edge arrow,
// health and ammo, toasts and mission banners — and the minimap, which paints the
// whole city plan once and then tracks every blip that matters.

import { WORLD, AVENUES, STREETS, VIEW } from './config.js';
import { clamp } from './random.js';

let minimapBase = null;

function buildMinimapBase(city) {
  const c = document.createElement('canvas');
  c.width = 232;
  c.height = 182;
  const g = c.getContext('2d');
  const sx = c.width / WORLD.width;
  const sy = c.height / WORLD.height;
  g.fillStyle = '#4e7d43';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#175d80';
  g.fillRect(WORLD.waterX * sx, 0, c.width - WORLD.waterX * sx, c.height);
  g.fillStyle = '#e3cf9e';
  g.fillRect(WORLD.beachX * sx, 0, (WORLD.waterX - WORLD.beachX) * sx, c.height);
  g.fillStyle = '#9aa0a3';
  for (const b of city.blocks) g.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
  g.fillStyle = '#3c4046';
  for (const ax of AVENUES) g.fillRect(ax * sx - 2, 0, 4, c.height);
  for (const sy2 of STREETS) g.fillRect(0, sy2 * sy - 2, c.width, 4);
  minimapBase = c;
  return c;
}

function drawMinimap(ctx, game, x, y) {
  const w = 232;
  const h = 182;
  const base = minimapBase ?? buildMinimapBase(game.city);
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, w + 12, h + 12, 10);
  ctx.fill();
  ctx.drawImage(base, x, y);
  const sx = w / WORLD.width;
  const sy = h / WORLD.height;
  const dot = (wx, wy, colour, r = 3.4) => {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const unit of game.police.units) {
    if (!unit.leaving) dot(unit.car.x, unit.car.y, '#5db4ff', 3);
    if (unit.officer && !unit.officer.dead) dot(unit.officer.x, unit.officer.y, '#bfe0ff', 2.4);
  }
  for (const guard of game.guards) if (guard.alive) dot(guard.x, guard.y, '#ff5040', 2.6);
  const offer = game.missions.courierOffer;
  if (offer) dot(offer.x, offer.y, '#7fe08a', 4);
  const obj = game.objectiveCache;
  if (obj && obj.x !== null && obj.x !== undefined) {
    const pulse = 3.6 + Math.sin(game.time * 5) * 1.1;
    dot(obj.x, obj.y, '#ffd76a', pulse);
  }
  // Player arrow
  const p = game.player;
  const px = x + p.x * sx;
  const py = y + p.y * sy;
  const ang = p.vehicle ? p.vehicle.angle : p.angle;
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6.4, 0);
  ctx.lineTo(-4.4, -4);
  ctx.lineTo(-4.4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, colour, back = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, Math.max(0, (w - 3) * clamp(frac, 0, 1)), h - 3, (h - 3) / 2);
    ctx.fill();
  }
}

function formatClock(minutes) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function drawHUD(ctx, game) {
  const p = game.player;
  ctx.save();
  ctx.textAlign = 'left';
  // Cash and district, top left.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.beginPath();
  ctx.roundRect(14, 12, 218, 58, 9);
  ctx.fill();
  ctx.fillStyle = '#7fe08a';
  ctx.font = 'bold 25px "Segoe UI", sans-serif';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 26, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.fillText(game.districtName, 26, 63);
  // Clock and stars, top right.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.beginPath();
  ctx.roundRect(VIEW.width - 196, 12, 182, 58, 9);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 19px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatClock(game.clockMinutes), VIEW.width - 26, 38);
  const stars = game.wanted.stars;
  ctx.font = '19px sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd76a' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', VIEW.width - 30 - (4 - i) * 24, 63);
  }
  ctx.textAlign = 'left';
  // Bust meter under the stars.
  if (game.police.bust > 0.01) {
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('BUSTED?', VIEW.width - 128, 92);
    ctx.textAlign = 'left';
    bar(ctx, VIEW.width - 196, 80, 108, 11, game.police.bust, '#ff5040');
  }
  // Objective banner, top centre.
  const obj = game.objectiveCache;
  if (obj) {
    ctx.font = '15px "Segoe UI", sans-serif';
    const dist = obj.x !== null && obj.x !== undefined ? Math.hypot(p.x - obj.x, p.y - obj.y) : null;
    const label = dist !== null ? `${obj.text}  ·  ${Math.round(dist / 10)}m` : obj.text;
    const tw = ctx.measureText(label).width + 30;
    ctx.fillStyle = 'rgba(10,14,20,0.62)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - tw / 2, 14, tw, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW.width / 2, 36);
    ctx.textAlign = 'left';
    // Edge arrow when the objective is off screen.
    if (dist !== null && dist > 60) {
      const sx = obj.x - game.camX;
      const sy = obj.y - game.camY;
      if (sx < 0 || sx > VIEW.width || sy < 0 || sy > VIEW.height) {
        const cx = clamp(sx, 44, VIEW.width - 44);
        const cy = clamp(sy, 70, VIEW.height - 44);
        const a = Math.atan2(obj.y - p.y, obj.x - p.x);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd76a';
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-9, -9);
        ctx.lineTo(-9, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // Minimap and vitals, bottom left.
  const mapY = VIEW.height - 196;
  drawMinimap(ctx, game, 20, mapY);
  bar(ctx, 20, mapY - 34, 150, 13, p.health / 100, p.health > 30 ? '#5dd35d' : '#ff5040');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.fillText('MARCO', 24, mapY - 23.5);
  if (p.vehicle) {
    bar(ctx, 178, mapY - 34, 74, 13, p.vehicle.health / p.vehicle.maxHealth, '#5db4ff');
    ctx.fillStyle = '#fff';
    ctx.fillText('CAR', 182, mapY - 23.5);
  }
  // Speed and ammo, bottom right.
  if (p.vehicle) {
    const mph = Math.round(Math.abs(p.vehicle.forwardSpeed()) * 0.24);
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width - 150, VIEW.height - 86, 136, 72, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(mph), VIEW.width - 42, VIEW.height - 40);
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('MPH', VIEW.width - 42, VIEW.height - 22);
    ctx.font = '13px "Segoe UI", sans-serif';
    ctx.fillText(p.vehicle.type.name, VIEW.width - 100, VIEW.height - 58);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = 'rgba(10,14,20,0.55)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width - 150, VIEW.height - 62, 136, 48, 10);
    ctx.fill();
    ctx.fillStyle = game.reloading ? '#ff9a3d' : '#fff';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(game.reloading ? '···' : `${game.ammoInMag} / ${game.ammoReserve}`, VIEW.width - 28, VIEW.height - 28);
    ctx.textAlign = 'left';
  }
  // Interaction prompt, bottom centre.
  if (game.promptText) {
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    const tw = ctx.measureText(game.promptText).width + 34;
    ctx.fillStyle = 'rgba(10,14,20,0.7)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - tw / 2, VIEW.height - 64, tw, 36, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(game.promptText, VIEW.width / 2, VIEW.height - 41);
    ctx.textAlign = 'left';
  }
  // Toasts.
  ctx.textAlign = 'center';
  let toastY = VIEW.height - 118;
  for (const toast of game.toasts) {
    ctx.globalAlpha = clamp(toast.t / 0.5, 0, 1);
    ctx.font = 'bold 17px "Segoe UI", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 4;
    ctx.strokeText(toast.text, VIEW.width / 2, toastY);
    ctx.fillText(toast.text, VIEW.width / 2, toastY);
    toastY -= 26;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  // Hurt vignette.
  if (game.hurtFlash > 0) {
    const grad = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.32, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.72);
    grad.addColorStop(0, 'rgba(200,30,20,0)');
    grad.addColorStop(1, `rgba(200,30,20,${(game.hurtFlash * 0.5).toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
  // Crosshair while on foot.
  if (!p.vehicle && game.state === 'play') {
    const { mouseX, mouseY } = game.input;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mouseX - 14, mouseY);
    ctx.lineTo(mouseX - 5, mouseY);
    ctx.moveTo(mouseX + 5, mouseY);
    ctx.lineTo(mouseX + 14, mouseY);
    ctx.moveTo(mouseX, mouseY - 14);
    ctx.lineTo(mouseX, mouseY - 5);
    ctx.moveTo(mouseX, mouseY + 5);
    ctx.lineTo(mouseX, mouseY + 14);
    ctx.stroke();
  }
  ctx.restore();
}

/** The big centre banner used for mission starts, completions and phone calls. */
export function drawBanner(ctx, game) {
  const b = game.bannerState;
  if (!b) return;
  const alpha = clamp(Math.min(b.t / 0.4, (b.total - b.t + 0.4) / 0.4), 0, 1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,10,16,0.66)';
  const tw = Math.max(ctx.measureText(b.title).width, 420) + 90;
  ctx.beginPath();
  ctx.roundRect(VIEW.width / 2 - tw / 2, 108, tw, b.sub ? 96 : 64, 12);
  ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 27px "Segoe UI", sans-serif';
  ctx.fillText(b.title, VIEW.width / 2, 146);
  if (b.sub) {
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '15px "Segoe UI", sans-serif';
    wrapText(ctx, b.sub, VIEW.width / 2, 172, tw - 60, 19);
  }
  ctx.restore();
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = trial;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}
