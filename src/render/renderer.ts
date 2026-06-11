import { DOME_RADIUS, MAP_TILES, TILE_PX, WORLD_PX } from '../sim/constants';
import { type ColonyState, type Colonist } from '../sim/state';
import type { Camera } from './camera';
import { MapLayer } from './mapLayer';
import { drawPawns, pawnWorldPos } from './pawnLayer';
import { hourOfSol } from '../sim/systems/behavior';

export type Selection = { kind: 'colonist' | 'building' | 'plot'; id: number } | null;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  mapLayer = new MapLayer();
  dpr = 1;
  fps = 0;
  private frames = 0;
  private fpsAt = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private camera: Camera,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  frame(s: ColonyState, alpha: number, selection: Selection): void {
    const ctx = this.ctx;
    if (this.mapLayer.dirty) this.mapLayer.redraw(s);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120e1c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.camera.apply(ctx, this.dpr);

    ctx.imageSmoothingEnabled = this.camera.zoom < 1;
    ctx.drawImage(this.mapLayer.canvas, 0, 0);

    // selected building/plot highlight
    if (selection && selection.kind !== 'colonist') {
      const room =
        selection.kind === 'plot'
          ? s.map.rooms.find((r) => r.id === selection.id)
          : (() => {
              const b = s.buildings.find((bb) => bb.id === selection.id);
              return b ? s.map.rooms.find((r) => r.id === b.roomId) : undefined;
            })();
      if (room) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(
          room.x * TILE_PX + 1,
          room.y * TILE_PX + 1,
          room.w * TILE_PX - 2,
          room.h * TILE_PX - 2,
        );
        ctx.setLineDash([]);
      }
    }

    drawPawns(ctx, s, alpha, this.camera.zoom, selection?.kind === 'colonist' ? selection.id : null);

    // night shroud over the dome
    const hour = hourOfSol(s.tick);
    if (hour < 6 || hour >= 18) {
      ctx.fillStyle = 'rgba(6,8,28,0.30)';
      ctx.beginPath();
      ctx.arc(WORLD_PX / 2, WORLD_PX / 2, DOME_RADIUS * TILE_PX, 0, Math.PI * 2);
      ctx.fill();
    }
    // dust storm tint
    if (s.events.active.some((e) => e.defId === 'dustStorm')) {
      ctx.fillStyle = 'rgba(190,120,50,0.12)';
      ctx.fillRect(0, 0, WORLD_PX, WORLD_PX);
    }

    this.frames++;
    const now = performance.now();
    if (now - this.fpsAt > 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.fpsAt = now;
    }
  }

  /** Tap → what's under the finger. Pawns first (generous radius), then rooms. */
  hitTest(s: ColonyState, wx: number, wy: number, alpha: number): Selection {
    const radius = Math.max(7, 12 / this.camera.zoom);
    let best: Colonist | null = null;
    let bestD = radius;
    for (const c of s.colonists) {
      if (!c.alive) continue;
      const p = pawnWorldPos(s, c, alpha);
      const d = Math.hypot(p.x - wx, p.y - wy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best) return { kind: 'colonist', id: best.id };

    const tx = Math.floor(wx / TILE_PX);
    const ty = Math.floor(wy / TILE_PX);
    if (tx < 0 || ty < 0 || tx >= MAP_TILES || ty >= MAP_TILES) return null;
    for (const room of s.map.rooms) {
      if (tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h) {
        if (room.buildingId !== null) return { kind: 'building', id: room.buildingId };
        return { kind: 'plot', id: room.id };
      }
    }
    return null;
  }
}
