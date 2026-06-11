import { BUILDINGS } from '../sim/content-bridge';
import { DOME_RADIUS, MAP_TILES, TILE_PX, WORLD_PX } from '../sim/constants';
import {
  type ColonyState,
  T_DOOR,
  T_FLOOR,
  T_GROUND,
  T_ROOM,
  T_VOID,
  T_WALL,
} from '../sim/state';

const TILE_COLORS: Record<number, string> = {
  [T_GROUND]: '#1d2440',
  [T_FLOOR]: '#3a4670',
  [T_WALL]: '#55699a',
  [T_DOOR]: '#7d92c4',
  [T_ROOM]: '#2c3858',
};

/** Static world rendered once to an offscreen canvas; re-rendered on construction. */
export class MapLayer {
  canvas: HTMLCanvasElement;
  dirty = true;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = WORLD_PX;
    this.canvas.height = WORLD_PX;
  }

  redraw(s: ColonyState): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, WORLD_PX, WORLD_PX);

    // planet surface
    ctx.fillStyle = '#241a2c';
    ctx.fillRect(0, 0, WORLD_PX, WORLD_PX);
    ctx.fillStyle = '#2d2136';
    for (let i = 0; i < 900; i++) {
      const x = (i * 919) % WORLD_PX;
      const y = (i * 547) % WORLD_PX;
      ctx.fillRect(x, y, 3, 2);
    }

    // tiles
    const tiles = s.map.tiles;
    for (let y = 0; y < MAP_TILES; y++) {
      for (let x = 0; x < MAP_TILES; x++) {
        const t = tiles[y * MAP_TILES + x];
        if (t === T_VOID) continue;
        ctx.fillStyle = TILE_COLORS[t] ?? '#000';
        ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
      }
    }

    // subtle ground grid inside the dome
    ctx.strokeStyle = 'rgba(120,140,200,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= MAP_TILES; i++) {
      ctx.moveTo(i * TILE_PX, 0);
      ctx.lineTo(i * TILE_PX, WORLD_PX);
      ctx.moveTo(0, i * TILE_PX);
      ctx.lineTo(WORLD_PX, i * TILE_PX);
    }
    ctx.stroke();

    // free plots: dashed outline + status
    for (const room of s.map.rooms) {
      if (room.buildingId !== null) continue;
      const locked = room.outer && !s.annexUnlocked;
      ctx.save();
      ctx.strokeStyle = locked ? 'rgba(150,150,170,0.25)' : 'rgba(140,170,255,0.45)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        room.x * TILE_PX + 3,
        room.y * TILE_PX + 3,
        room.w * TILE_PX - 6,
        room.h * TILE_PX - 6,
      );
      ctx.setLineDash([]);
      ctx.fillStyle = locked ? 'rgba(160,160,180,0.4)' : 'rgba(150,180,255,0.6)';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        locked ? 'LOCKED' : 'PLOT',
        (room.x + room.w / 2) * TILE_PX,
        (room.y + room.h / 2) * TILE_PX + 3,
      );
      ctx.restore();
    }

    // buildings
    for (const b of s.buildings) {
      const def = BUILDINGS[b.defId];
      const x = b.x * TILE_PX;
      const y = b.y * TILE_PX;
      const w = b.w * TILE_PX;
      const h = b.h * TILE_PX;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x + 1, y + 1, w - 2, h - 2, 4);
      else ctx.rect(x + 1, y + 1, w - 2, h - 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(def.short, x + w / 2, y + h / 2 + 3);
      if (s.tick < b.offlineUntilTick || b.condition <= 20) {
        ctx.fillStyle = 'rgba(255,80,80,0.85)';
        ctx.font = 'bold 9px system-ui';
        ctx.fillText('!', x + w - 6, y + 9);
      }
    }

    // dome shell accent
    const c = WORLD_PX / 2;
    ctx.beginPath();
    ctx.arc(c, c, DOME_RADIUS * TILE_PX - TILE_PX / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(109,179,255,0.8)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, DOME_RADIUS * TILE_PX + 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(109,179,255,0.25)';
    ctx.lineWidth = 8;
    ctx.stroke();

    this.dirty = false;
  }
}
