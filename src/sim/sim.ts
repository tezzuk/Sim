import { Rng } from './rng';
import type { ColonyState } from './state';
import { runTick } from './tick';

/** Owns the state plus hydrated RNG streams; the only object the app drives. */
export class Sim {
  state: ColonyState;
  rngSim: Rng;
  rngEvents: Rng;
  rngGenetics: Rng;
  rngOffline: Rng;
  tickMsAvg = 0;

  constructor(state: ColonyState) {
    this.state = state;
    this.rngSim = new Rng(state.rng.sim);
    this.rngEvents = new Rng(state.rng.events);
    this.rngGenetics = new Rng(state.rng.genetics);
    this.rngOffline = new Rng(state.rng.offline);
  }

  tick(): void {
    const t0 = performance.now();
    runTick(this);
    this.tickMsAvg = this.tickMsAvg * 0.98 + (performance.now() - t0) * 0.02;
  }

  /** Copy live RNG states back into the serializable state (before saving). */
  syncRng(): void {
    this.state.rng = {
      sim: this.rngSim.state,
      events: this.rngEvents.state,
      genetics: this.rngGenetics.state,
      offline: this.rngOffline.state,
    };
  }
}
