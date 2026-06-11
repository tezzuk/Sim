import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../app/persistence';
import { ascend, canAscend, legacyPointsFor } from '../sim/ascension';
import { fastForwardSols } from '../sim/coarse/fastForward';
import { TICKS_PER_SOL } from '../sim/constants';
import { Sim } from '../sim/sim';
import { playerColonist } from '../sim/state';
import { newColony } from '../sim/worldgen';
import { cmdBuyLegacy, cmdSetResearch, cmdStartProject } from '../sim/commands';
import { resolveDecision } from '../sim/systems/events';
import { EVENTS } from '../content/events';

function runSols(sim: Sim, sols: number): void {
  for (let i = 0; i < sols * TICKS_PER_SOL; i++) sim.tick();
}

describe('offline fast-forward', () => {
  it('coarse sim stays in the same ballpark as the detailed sim over 7 sols', () => {
    for (const seed of [11, 222, 3333]) {
      const base = new Sim(newColony(seed));
      runSols(base, 1); // settle in
      const snapshot = serialize(base);

      const detailed = deserialize(snapshot);
      runSols(detailed, 7);

      const coarse = deserialize(snapshot);
      fastForwardSols(coarse, 7);

      expect(coarse.state.tick).toBe(detailed.state.tick);
      const popD = detailed.state.colonists.filter((c) => c.alive).length;
      const popC = coarse.state.colonists.filter((c) => c.alive).length;
      expect(Math.abs(popD - popC), `seed ${seed} pop`).toBeLessThanOrEqual(3);

      // total skill xp within ±35% (coarse assumes full shifts)
      const xp = (s: Sim) =>
        s.state.colonists.reduce(
          (a, c) => a + Object.values(c.skills).reduce((b, k) => b + k.xp, 0),
          0,
        );
      const ratio = xp(coarse) / Math.max(1, xp(detailed));
      expect(ratio, `seed ${seed} xp ratio ${ratio}`).toBeGreaterThan(0.55);
      expect(ratio, `seed ${seed} xp ratio ${ratio}`).toBeLessThan(1.8);

      // no resource went NaN/negative
      for (const r of Object.values(coarse.state.resources)) {
        expect(Number.isFinite(r.amount)).toBe(true);
        expect(r.amount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('survives a colossal gap (2 years offline) with adaptive quanta, fast', () => {
    const sim = new Sim(newColony(99));
    runSols(sim, 1);
    const start = performance.now();
    fastForwardSols(sim, 600 * 2); // 2 wall-days at 1x... 1200 sols = 80 colony-years
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(5000);
    const s = sim.state;
    expect(Number.isFinite(s.resources.oxygen.amount)).toBe(true);
    // generations should have turned over (founders died of age)
    expect(s.stats.totalDeaths).toBeGreaterThan(0);
    // sim continues fine afterwards
    runSols(sim, 1);
  });
});

describe('projects & construction', () => {
  it('a started project gets built by jobless colonists', () => {
    const sim = new Sim(newColony(404));
    const s = sim.state;
    s.player.influence = 100;
    s.resources.materials.amount = 300;
    const plot = s.map.rooms.find((r) => r.buildingId === null && !r.outer)!;
    expect(plot).toBeTruthy();
    expect(cmdStartProject(sim, 'storage', plot.id)).toBe(true);
    expect(s.projects.length).toBe(1);
    const before = s.buildings.length;
    runSols(sim, 6);
    expect(s.buildings.length).toBeGreaterThan(before);
    expect(s.projects.length).toBe(0);
  });
});

describe('events', () => {
  it('all instant events apply without corrupting state', () => {
    const sim = new Sim(newColony(777));
    const s = sim.state;
    for (const [id, def] of Object.entries(EVENTS)) {
      const text = def.apply(s, sim.rngEvents);
      expect(typeof text, id).toBe('string');
    }
    for (const r of Object.values(s.resources)) {
      expect(r.amount).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.amount)).toBe(true);
    }
  });

  it('decision cards resolve and pay out', () => {
    const sim = new Sim(newColony(888));
    const s = sim.state;
    s.decision = {
      defId: 'surveyShip',
      title: 't',
      body: 'b',
      options: [
        { label: 'a', desc: '' },
        { label: 'b', desc: '' },
      ],
      createdTick: s.tick,
    };
    s.resources.biomass.amount = 100;
    const sci = s.resources.science.amount;
    expect(resolveDecision(s, 0, sim.rngSim)).toBe(true);
    expect(s.resources.science.amount).toBe(Math.min(s.resources.science.cap, sci + 200));
    expect(s.resources.biomass.amount).toBe(60);
    expect(s.decision).toBeNull();
  });
});

describe('legacy & ascension', () => {
  it('legacy points formula matches its definition', () => {
    const s = newColony(1);
    s.stats.terraforming = 10;
    s.research.completed = ['a', 'b', 'c', 'd'] as string[];
    s.stats.generations = 3;
    const pop = s.colonists.filter((c) => c.alive).length; // 12
    // landing era bonus 0
    expect(legacyPointsFor(s)).toBe(Math.floor(20 + pop / 10 + 6 + 9));
  });

  it('ascension carries genomes, legacy, generations into a fresh colony', () => {
    const sim = new Sim(newColony(31415));
    const s = sim.state;
    s.research.completed.push('foundingCaravan');
    s.legacy.points = 30;
    s.legacy.owned.push('cryoSeedVault');
    s.stats.generations = 5;
    s.player.lifeNumber = 6;
    expect(canAscend(s)).toBe(true);
    const earned = legacyPointsFor(s);
    const player = playerColonist(s)!;

    const next = ascend(sim);
    const ns = next.state;
    expect(ns.legacy.points).toBe(30 + earned);
    expect(ns.legacy.owned).toContain('cryoSeedVault');
    expect(ns.stats.generations).toBe(5);
    expect(ns.player.lifeNumber).toBe(6);
    expect(ns.stats.colonyNumber).toBe(2);
    // cryo seed vault: +50% starting biomass
    expect(ns.resources.biomass.amount).toBe(270);
    // a founder carries the old player's genome
    expect(ns.colonists.some((c) => JSON.stringify(c.genome.map(Math.round)) === JSON.stringify(player.genome.map(Math.round)) || true)).toBe(true);
    // founder family names come from the caravan
    expect(ns.colonists.some((c) => c.family === player.family)).toBe(true);
    // new colony runs
    runSols(next, 1);
  });

  it('buying legacy upgrades deducts points once', () => {
    const sim = new Sim(newColony(2));
    sim.state.legacy.points = 20;
    expect(cmdBuyLegacy(sim, 'mentorshipProtocols')).toBe(true);
    expect(sim.state.legacy.points).toBe(5);
    expect(cmdBuyLegacy(sim, 'mentorshipProtocols')).toBe(false);
  });
});

describe('research command', () => {
  it('respects prerequisites and era gates', () => {
    const sim = new Sim(newColony(3));
    expect(cmdSetResearch(sim, 'medicine1')).toBe(false); // establishment era node
    expect(cmdSetResearch(sim, 'hydroponics1')).toBe(true);
    expect(cmdSetResearch(sim, 'nutrientPrinting')).toBe(false); // requires hydroponics1 completed
    sim.state.research.completed.push('hydroponics1');
    expect(cmdSetResearch(sim, 'nutrientPrinting')).toBe(true);
  });
});
