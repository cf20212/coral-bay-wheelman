// Menu and outcome screens, drawn over the live city: the title screen with its
// attract-mode camera, how to play, the pause menu, and the BUSTED / WASTED cards.

import { VIEW, NAMES } from './config.js';
import { clamp } from './random.js';

export function buttonRect(index, total) {
  const w = 300;
  const h = 52;
  const x = VIEW.width / 2 - w / 2;
  const y = 356 + index * 66;
  return { x, y, w, h };
}

export function drawButtons(ctx, labels, mouseX, mouseY) {
  labels.forEach((label, i) => {
    const r = buttonRect(i, labels.length);
    const hover = mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h;
    ctx.fillStyle = hover ? 'rgba(255,215,106,0.92)' : 'rgba(12,16,24,0.78)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,106,0.65)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = hover ? '#14100a' : '#f5f2ea';
    ctx.font = 'bold 20px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW.width / 2, r.y + 34);
  });
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, game) {
  const grad = ctx.createLinearGradient(0, VIEW.height * 0.34, 0, VIEW.height);
  grad.addColorStop(0, 'rgba(8,10,18,0)');
  grad.addColorStop(0.55, 'rgba(8,10,18,0.55)');
  grad.addColorStop(1, 'rgba(8,10,18,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 30px "Segoe UI", sans-serif';
  ctx.fillText('M A K E   F U N   P R E S E N T S', VIEW.width / 2, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 96px "Segoe UI", sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 5;
  ctx.fillText('CORAL BAY', VIEW.width / 2, 218);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ff7a59';
  ctx.font = 'bold 40px "Segoe UI", sans-serif';
  ctx.fillText('— W H E E L M A N —', VIEW.width / 2, 272);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '17px "Segoe UI", sans-serif';
  ctx.fillText(`${NAMES.hero} owes the Bay a favour. ${NAMES.fixer} is collecting — one job at a time.`, VIEW.width / 2, 312);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASD drive & walk · E enter cars · Mouse aim, click to shoot · Esc pause · M mute', VIEW.width / 2, VIEW.height - 18);
  ctx.textAlign = 'left';
}

const HELP_LINES = [
  ['Move / drive', 'W A S D or arrow keys'],
  ['Sprint on foot', 'Hold Shift'],
  ['Enter / exit a car or boat', 'E near the door'],
  ['Handbrake & drift', 'Hold Space while driving'],
  ['Aim & shoot', 'Mouse to aim, left click to fire (on foot)'],
  ['Reload', 'R'],
  ['Eat & heal', 'E at a food stand — $25'],
  ['Pause / save', 'Esc or P — saving also happens after every mission'],
  ['Mute', 'M'],
  ['', ''],
  ['Work', 'See Delia at Voss Auto Works for the story jobs.'],
  ['', 'Courier $ markers and green cash stashes pay any time.'],
  ['Heat', 'Crimes only count when someone sees them.'],
  ['', 'Break line of sight and the stars fade. At 3 stars the police shoot.'],
  ['', 'Cornered and slow with an officer on you fills the BUSTED meter.'],
];

export function drawHowTo(ctx) {
  ctx.fillStyle = 'rgba(6,8,14,0.82)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 40px "Segoe UI", sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW.width / 2, 92);
  ctx.font = '16px "Segoe UI", sans-serif';
  let y = 142;
  for (const [key, desc] of HELP_LINES) {
    if (!key && !desc) {
      y += 12;
      continue;
    }
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'right';
    ctx.font = 'bold 16px "Segoe UI", sans-serif';
    ctx.fillText(key, VIEW.width / 2 - 18, y);
    ctx.fillStyle = '#f2f2f2';
    ctx.textAlign = 'left';
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillText(desc, VIEW.width / 2 + 18, y);
    y += 27;
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '15px "Segoe UI", sans-serif';
  ctx.fillText('Click anywhere or press Esc to go back', VIEW.width / 2, y + 26);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(6,8,14,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px "Segoe UI", sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 150);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '17px "Segoe UI", sans-serif';
  ctx.fillText(`Cash $${game.cash.toLocaleString('en-US')} · Story jobs done: ${game.missions.index} of 5 · District: ${game.districtName}`, VIEW.width / 2, 192);
  ctx.textAlign = 'left';
}

export function drawEndCard(ctx, game, kind) {
  const alpha = clamp(game.endTimer / 1.2, 0, 1);
  ctx.fillStyle = kind === 'busted' ? `rgba(16,26,54,${0.78 * alpha})` : `rgba(40,6,6,${0.78 * alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.fillStyle = kind === 'busted' ? '#7db4ff' : '#ff5040';
  ctx.font = '900 92px "Segoe UI", sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', VIEW.width / 2, VIEW.height / 2 - 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '19px "Segoe UI", sans-serif';
  const line = kind === 'busted'
    ? `The CBPD impound your pride and $${game.lastFee}. You walk out of CBPD Central.`
    : `St. Marina patches you up for $${game.lastFee}. The Bay keeps spinning.`;
  ctx.fillText(line, VIEW.width / 2, VIEW.height / 2 + 16);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '16px "Segoe UI", sans-serif';
  ctx.fillText('Press Enter to get back out there', VIEW.width / 2, VIEW.height / 2 + 52);
  ctx.restore();
  ctx.textAlign = 'left';
}
