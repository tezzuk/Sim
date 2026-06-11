import { TICKS_PER_HOUR, TICKS_PER_SOL } from './constants';
import type { Sim } from './sim';
import { behaviorHourly } from './systems/behavior';
import { workEconomyHourly } from './systems/economy';
import { lifecycleSol } from './systems/lifecycle';
import { movementSystem } from './systems/movement';
import { needsHourly } from './systems/needs';
import { relationshipsSol } from './systems/relationships';
import { researchSol } from './systems/research';

/**
 * One sim tick = one colony-minute. Heavy systems are staggered: hourly
 * (every 60 ticks) and per-sol (every 1440) — per-tick work is just
 * movement and arrivals.
 */
export function runTick(sim: Sim): void {
  const s = sim.state;
  s.tick++;

  if (s.tick % TICKS_PER_HOUR === 0) {
    behaviorHourly(s, sim.rngSim);
    workEconomyHourly(s, sim.rngSim);
    needsHourly(s, sim.rngSim);
  }

  if (s.tick % TICKS_PER_SOL === 0) {
    lifecycleSol(s, sim.rngSim, sim.rngGenetics);
    relationshipsSol(s, sim.rngSim);
    researchSol(s);
  }

  movementSystem(s);
}
