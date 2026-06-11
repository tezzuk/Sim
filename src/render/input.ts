import type { Camera } from './camera';

const TAP_MAX_DIST = 6; // css px
const TAP_MAX_MS = 300;

interface PointerState {
  x: number;
  y: number;
}

/**
 * Touch + mouse controls: one-pointer drag pans, two-pointer pinch zooms,
 * wheel zooms at the cursor, and a short still press is a tap.
 */
export class InputController {
  private pointers = new Map<number, PointerState>();
  private tapStart: { id: number; x: number; y: number; t: number } | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private camera: Camera,
    private onTap: (worldX: number, worldY: number) => void,
  ) {
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.tapStart =
        this.pointers.size === 1
          ? { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }
          : null;
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 1) {
        this.camera.pan(e.clientX - p.x, e.clientY - p.y);
        if (
          this.tapStart &&
          Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y) > TAP_MAX_DIST
        ) {
          this.tapStart = null;
        }
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const prevDist = Math.hypot(a.x - b.x, a.y - b.y);
        const other = [...this.pointers.entries()].find(([id]) => id !== e.pointerId)![1];
        const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (prevDist > 0) {
          this.camera.zoomBy(
            newDist / prevDist,
            (e.clientX + other.x) / 2,
            (e.clientY + other.y) / 2,
          );
        }
        this.tapStart = null;
      }
      p.x = e.clientX;
      p.y = e.clientY;
    });

    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (
        this.tapStart &&
        this.tapStart.id === e.pointerId &&
        performance.now() - this.tapStart.t < TAP_MAX_MS
      ) {
        const w = this.camera.screenToWorld(e.clientX, e.clientY);
        this.onTap(w.x, w.y);
      }
      this.tapStart = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.camera.zoomBy(Math.exp(-e.deltaY * 0.0012), e.clientX, e.clientY);
      },
      { passive: false },
    );
  }
}
