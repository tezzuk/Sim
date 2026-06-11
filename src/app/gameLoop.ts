import { MAX_TICKS_PER_FRAME, TICK_MS } from '../sim/constants';

/**
 * requestAnimationFrame driver with a fixed-timestep accumulator.
 * Render interpolation factor = leftover accumulator fraction.
 */
export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  /** Set by the app: invoked when a frame can't catch up (hands off to offline path). */
  onOverflow: ((pendingTicks: number) => void) | null = null;

  constructor(
    private tickFn: () => void,
    private renderFn: (alpha: number) => void,
    private speedFn: () => number,
  ) {}

  start(): void {
    this.last = performance.now();
    const loop = (now: number): void => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(1000, now - this.last);
      this.last = now;
      this.acc += dt * this.speedFn();
      let n = 0;
      while (this.acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
        this.tickFn();
        this.acc -= TICK_MS;
        n++;
      }
      if (this.acc >= TICK_MS) {
        const pending = Math.floor(this.acc / TICK_MS);
        this.acc = 0;
        this.onOverflow?.(pending);
      }
      this.renderFn(Math.min(1, this.acc / TICK_MS));
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
