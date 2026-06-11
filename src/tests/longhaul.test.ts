import { it, expect } from 'vitest';
import { Sim } from '../sim/sim';
import { newColony } from '../sim/worldgen';
import { TICKS_PER_SOL } from '../sim/constants';
import { applySuccession } from '../sim/heir';

it('long haul: 60 sols (4 years) of detailed sim stays healthy and fast', () => {
  const sim = new Sim(newColony(123456));
  const s = sim.state;
  const t0 = performance.now();
  for (let sol = 0; sol < 60; sol++) {
    for (let t = 0; t < TICKS_PER_SOL; t++) sim.tick();
    if (s.succession?.options.length) applySuccession(s, s.succession.options[0].id);
  }
  const wallMs = performance.now() - t0;
  const pop = s.colonists.filter((c) => c.alive).length;
  console.log(`60 sols in ${wallMs.toFixed(0)}ms (${(wallMs / (60 * TICKS_PER_SOL)).toFixed(3)}ms/tick), pop=${pop}, births=${s.stats.totalBirths}, deaths=${s.stats.totalDeaths}, science=${s.resources.science.amount.toFixed(0)}`);
  expect(pop).toBeGreaterThan(6);
  for (const r of Object.values(s.resources)) {
    expect(Number.isFinite(r.amount)).toBe(true);
    expect(r.amount).toBeGreaterThanOrEqual(0);
  }
  // avg tick budget for mobile: well under 0.5ms in node
  expect(wallMs / (60 * TICKS_PER_SOL)).toBeLessThan(0.5);
}, 60_000);
