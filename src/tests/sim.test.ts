import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../app/persistence';
import { Rng } from '../sim/rng';
import { Sim } from '../sim/sim';
import { ageYears, playerColonist } from '../sim/state';
import { generateMap, newColony } from '../sim/worldgen';
import { findPath } from '../sim/path/astar';
import { isWalkable } from '../sim/path/grid';
import { inheritGenome, newGenome, phenotype, LOCI } from '../sim/genetics';
import { TICKS_PER_SOL, TICKS_PER_YEAR } from '../sim/constants';
import { applySuccession, buildSuccession } from '../sim/heir';

function runSols(sim: Sim, sols: number): void {
  for (let i = 0; i < sols * TICKS_PER_SOL; i++) sim.tick();
}

describe('worldgen', () => {
  it('same seed → identical map and founders', () => {
    const a = newColony(1234);
    const b = newColony(1234);
    expect(Array.from(a.map.tiles)).toEqual(Array.from(b.map.tiles));
    expect(a.map.rooms).toEqual(b.map.rooms);
    expect(a.colonists.map((c) => [c.name, c.genome, c.bornTick])).toEqual(
      b.colonists.map((c) => [c.name, c.genome, c.bornTick]),
    );
  });

  it('different seeds → different layouts', () => {
    const a = newColony(1);
    const b = newColony(2);
    expect(Array.from(a.map.tiles)).not.toEqual(Array.from(b.map.tiles));
  });

  it('places all starting buildings and leaves free plots', () => {
    const s = newColony(99);
    expect(s.buildings.length).toBeGreaterThanOrEqual(10);
    const plots = s.map.rooms.filter((r) => r.buildingId === null);
    expect(plots.length).toBeGreaterThanOrEqual(6);
    expect(s.map.rooms.some((r) => r.outer)).toBe(true);
  });

  it('every room door is reachable from the plaza, for many seeds', () => {
    for (const seed of [7, 42, 1000, 2024, 555, 31337]) {
      const map = generateMap(seed);
      expect(map.rooms.filter((r) => !r.outer).length, `seed ${seed}`).toBeGreaterThanOrEqual(12);
      for (const room of map.rooms) {
        const path = findPath(map.tiles, 40, 40, room.doorX, room.doorY);
        expect(path, `seed ${seed} room ${room.id}`).not.toBeNull();
      }
    }
  });
});

describe('astar', () => {
  it('finds a straight path and respects walls', () => {
    const s = newColony(5);
    // path between two walkable points near plaza
    const p = findPath(s.map.tiles, 38, 40, 44, 40);
    expect(p).not.toBeNull();
    expect(p!.length).toBeGreaterThanOrEqual(6);
    // unreachable: outside the dome
    expect(isWalkable(s.map.tiles, 1, 1)).toBe(false);
    expect(findPath(s.map.tiles, 40, 40, 1, 1)).toBeNull();
  });
});

describe('genetics', () => {
  it('children draw alleles from parents (within mutation range)', () => {
    const rng = new Rng(7);
    const mom = newGenome(rng);
    const dad = newGenome(rng);
    for (let i = 0; i < 200; i++) {
      const child = inheritGenome(rng, mom, dad);
      expect(child).toHaveLength(16);
      for (const a of child) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(100);
      }
    }
  });

  it('phenotype is the allele mean', () => {
    const g = Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 40 : 60));
    for (const l of LOCI) expect(phenotype(g, l)).toBe(50);
  });
});

describe('simulation', () => {
  it('runs 3 sols without errors; resources stay non-negative; pawns behave', () => {
    const sim = new Sim(newColony(2024));
    runSols(sim, 3);
    const s = sim.state;
    for (const r of Object.values(s.resources)) {
      expect(r.amount).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.amount)).toBe(true);
    }
    const alive = s.colonists.filter((c) => c.alive);
    expect(alive.length).toBeGreaterThanOrEqual(10);
    // someone has a job and worked (xp gained)
    expect(alive.some((c) => c.job !== null)).toBe(true);
    // production actually happened at some point (science only comes from labs)
    expect(s.resources.science.amount).toBeGreaterThan(0);
  });

  it('is deterministic: snapshot at sol 1, replay to sol 3 twice → identical', () => {
    const sim = new Sim(newColony(777));
    runSols(sim, 1);
    const snapshot = serialize(sim);

    const a = deserialize(snapshot);
    const b = deserialize(snapshot);
    runSols(a, 2);
    runSols(b, 2);
    a.syncRng();
    b.syncRng();
    const stripA = JSON.stringify({ ...a.state, map: null, lastSimWallClock: 0 });
    const stripB = JSON.stringify({ ...b.state, map: null, lastSimWallClock: 0 });
    expect(stripA).toBe(stripB);
  });

  it('save → load round-trips state', () => {
    const sim = new Sim(newColony(31337));
    runSols(sim, 2);
    const json = serialize(sim);
    const loaded = deserialize(json);
    expect(loaded.state.tick).toBe(sim.state.tick);
    expect(loaded.state.colonists.length).toBe(sim.state.colonists.length);
    expect(Array.from(loaded.state.map.tiles)).toEqual(Array.from(sim.state.map.tiles));
    expect(loaded.state.map.rooms.filter((r) => r.buildingId !== null).length).toBe(
      sim.state.buildings.length,
    );
  });

  it('aging: mean death age lands in a plausible band (Monte Carlo)', () => {
    // Simulate the hazard directly over many virtual colonists
    const rng = new Rng(11);
    const MORT_A = 9e-7;
    const MORT_B = 0.155;
    let total = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      let age = 0;
      for (;;) {
        age += 1 / 15; // one sol
        const h = MORT_A * Math.exp(MORT_B * age);
        if (rng.chance(Math.min(0.5, h)) || age > 120) break;
      }
      total += age;
    }
    const mean = total / N;
    expect(mean).toBeGreaterThan(55);
    expect(mean).toBeLessThan(70);
  });
});

describe('heir succession', () => {
  it('player death pauses the game and offers options; inheritance math applies', () => {
    const sim = new Sim(newColony(555));
    const s = sim.state;
    const player = playerColonist(s)!;
    player.skills.engineering.xp = 1600; // level 4
    s.player.influence = 50;

    // make sure there is a young candidate: mentor a child
    const child = s.colonists.find((c) => c.alive && c.id !== player.id && ageYears(s, c) < 12)!;
    expect(child).toBeTruthy();
    s.player.mentorId = child.id;
    child.mentoredYears = 5; // 0.25 + 0.02*5 = 0.35

    buildSuccession(s, player, sim.rngSim);
    expect(s.succession).not.toBeNull();
    expect(s.speed).toBe(0);
    const opt = s.succession!.options.find((o) => o.id === child.id)!;
    expect(opt.fraction).toBeCloseTo(0.35, 5);

    const beforeXp = child.skills.engineering.xp;
    expect(applySuccession(s, child.id)).toBe(true);
    expect(s.player.colonistId).toBe(child.id);
    expect(child.skills.engineering.xp).toBeCloseTo(beforeXp + 0.35 * 1600, 3);
    expect(s.player.influence).toBeCloseTo(15, 5);
    expect(s.player.lifeNumber).toBe(2);
    expect(s.speed).toBe(1);
  });

  it('lineage continues across generated deaths in a long run', () => {
    const sim = new Sim(newColony(4242));
    const s = sim.state;
    // age the player to elderhood to force a natural death soon
    const p = playerColonist(s)!;
    p.bornTick = s.tick - 80 * TICKS_PER_YEAR;
    let successions = 0;
    for (let sol = 0; sol < 200 && successions === 0; sol++) {
      runSols(sim, 1);
      if (s.succession) {
        const first = s.succession.options[0];
        if (first) {
          applySuccession(s, first.id);
          successions++;
        } else {
          break;
        }
      }
    }
    expect(successions).toBe(1);
    expect(playerColonist(s)?.alive).toBe(true);
  });
});
