import { WORLD_PX, ZOOM_MAX, ZOOM_MIN } from '../sim/constants';

/** Pan/zoom view over the world. x/y is the world point at the viewport center. */
export class Camera {
  x = WORLD_PX / 2;
  y = WORLD_PX / 2;
  zoom = 1;
  viewW = 1; // css px
  viewH = 1;

  resize(viewW: number, viewH: number): void {
    this.viewW = viewW;
    this.viewH = viewH;
    this.clamp();
  }

  /** Zoom that fits the whole dome on screen. */
  fit(): void {
    this.zoom = Math.min(this.viewW, this.viewH) / WORLD_PX;
    this.zoom = Math.max(ZOOM_MIN * 0.5, this.zoom);
    this.x = WORLD_PX / 2;
    this.y = WORLD_PX / 2;
  }

  /** Drag by css-pixel deltas (world moves with the finger). */
  pan(dxCss: number, dyCss: number): void {
    this.x -= dxCss / this.zoom;
    this.y -= dyCss / this.zoom;
    this.clamp();
  }

  /** Multiply zoom, keeping the css-pixel point (cx, cy) fixed in world space. */
  zoomBy(factor: number, cx: number, cy: number): void {
    const before = this.screenToWorld(cx, cy);
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN * 0.5, this.zoom * factor));
    const after = this.screenToWorld(cx, cy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  screenToWorld(cxCss: number, cyCss: number): { x: number; y: number } {
    return {
      x: this.x + (cxCss - this.viewW / 2) / this.zoom,
      y: this.y + (cyCss - this.viewH / 2) / this.zoom,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.zoom + this.viewW / 2,
      y: (wy - this.y) * this.zoom + this.viewH / 2,
    };
  }

  /** Set the canvas transform so drawing happens in world coordinates. */
  apply(ctx: CanvasRenderingContext2D, dpr: number): void {
    ctx.setTransform(
      this.zoom * dpr,
      0,
      0,
      this.zoom * dpr,
      (this.viewW / 2 - this.x * this.zoom) * dpr,
      (this.viewH / 2 - this.y * this.zoom) * dpr,
    );
  }

  private clamp(): void {
    const margin = 120 / this.zoom;
    this.x = Math.min(WORLD_PX + margin, Math.max(-margin, this.x));
    this.y = Math.min(WORLD_PX + margin, Math.max(-margin, this.y));
  }
}
