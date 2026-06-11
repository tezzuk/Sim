import { CHILD_COLOR, JOBLESS_COLOR, JOBS } from '../content/jobs';
import { LABEL_ZOOM, TILE_PX } from '../sim/constants';
import type { ColonyState, Colonist } from '../sim/state';

function pawnColor(c: Colonist): string {
  if (c.stage === 'infant' || c.stage === 'child' || c.stage === 'student') return CHILD_COLOR;
  return c.job ? JOBS[c.job.role].color : JOBLESS_COLOR;
}

function drawShape(ctx: CanvasRenderingContext2D, c: Colonist, x: number, y: number): void {
  ctx.beginPath();
  switch (c.stage) {
    case 'infant':
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      break;
    case 'child':
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      break;
    case 'student': {
      const r = 4.5;
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.9, y + r * 0.7);
      ctx.lineTo(x - r * 0.9, y + r * 0.7);
      ctx.closePath();
      break;
    }
    case 'adult': {
      const r = 4;
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x - r, y - r, r * 2, r * 2, 2);
      else ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    }
    case 'elder': {
      const r = 4.5;
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
}

/** World-space pawn position with movement interpolation. */
export function pawnWorldPos(
  s: ColonyState,
  c: Colonist,
  alpha: number,
): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, s.tick - c.ai.movedAtTick + alpha));
  return {
    x: (c.px + (c.x - c.px) * t) * TILE_PX + TILE_PX / 2,
    y: (c.py + (c.y - c.py) * t) * TILE_PX + TILE_PX / 2,
  };
}

export function drawPawns(
  ctx: CanvasRenderingContext2D,
  s: ColonyState,
  alpha: number,
  zoom: number,
  selectedId: number | null,
): void {
  const playerId = s.player.colonistId;
  for (const c of s.colonists) {
    if (!c.alive) continue;
    const { x, y } = pawnWorldPos(s, c, alpha);

    const sleeping = c.ai.state === 'sleeping';
    ctx.globalAlpha = sleeping ? 0.55 : 1;

    if (c.id === playerId) {
      ctx.beginPath();
      ctx.arc(x, y, 7.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (c.id === selectedId) {
      ctx.beginPath();
      ctx.arc(x, y, 9.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.fillStyle = pawnColor(c);
    drawShape(ctx, c, x, y);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    if (c.ill) {
      ctx.fillStyle = '#ff5d5d';
      ctx.fillRect(x - 1, y - 9, 2, 4);
      ctx.fillRect(x - 2, y - 8, 4, 2);
    }

    if (zoom >= LABEL_ZOOM || c.id === selectedId || c.id === playerId) {
      ctx.font = '7px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(c.name, x + 0.5, y - 10.5);
      ctx.fillStyle = c.id === playerId ? '#ffd166' : '#dfe7ff';
      ctx.fillText(c.name, x, y - 11);
    }
    ctx.globalAlpha = 1;
  }
}
