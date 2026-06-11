import { RESEARCH } from '../content/research';
import { Sim } from './sim';
import { type ColonyState, type EraId, ageYears, colonistById } from './state';
import { newColony, type AscensionCarry } from './worldgen';

const ERA_BONUS: Record<EraId, number> = {
  landing: 0,
  establishment: 5,
  expansion: 15,
  terraforming: 40,
};

export function legacyPointsFor(s: ColonyState): number {
  const pop = s.colonists.filter((c) => c.alive).length;
  return (
    Math.floor(
      2 * s.stats.terraforming +
        pop / 10 +
        1.5 * s.research.completed.length +
        3 * s.stats.generations,
    ) + ERA_BONUS[s.era]
  );
}

export function canAscend(s: ColonyState): boolean {
  return s.research.completed.includes('foundingCaravan');
}

/**
 * Found a daughter colony: bank Legacy, carry 12 descendants' genomes
 * (player's kin first), and start fresh on a new seed.
 */
export function ascend(sim: Sim): Sim {
  const s = sim.state;
  const earned = legacyPointsFor(s);

  // choose the caravan: player first, then their children, then the youngest
  const player = colonistById(s, s.player.colonistId);
  const picked: number[] = [];
  const take = (id: number | undefined | null): void => {
    if (id != null && !picked.includes(id) && colonistById(s, id)?.alive) picked.push(id);
  };
  take(player?.id);
  for (const id of player?.childrenIds ?? []) take(id);
  const young = s.colonists
    .filter((c) => c.alive && c.stage !== 'infant')
    .sort((a, b) => ageYears(s, a) - ageYears(s, b));
  for (const c of young) {
    if (picked.length >= 12) break;
    take(c.id);
  }
  const caravan = picked.map((id) => colonistById(s, id)!);

  const keepResearch: string[] = [];
  if (s.legacy.owned.includes('foundersMemory')) {
    const keepCount = Math.floor(s.research.completed.length / 10);
    const sorted = [...s.research.completed].sort(
      (a, b) => (RESEARCH[a]?.cost ?? 0) - (RESEARCH[b]?.cost ?? 0),
    );
    keepResearch.push(...sorted.slice(0, keepCount));
  }

  const carry: AscensionCarry = {
    genomes: caravan.map((c) => c.genome),
    families: caravan.map((c) => c.family),
    generations: s.stats.generations,
    lifeNumber: s.player.lifeNumber,
    keepResearch,
    colonyNumber: (s.stats.colonyNumber ?? 1) + 1,
  };

  const next = newColony(
    (s.seed ^ ((Date.now() & 0xffffffff) >>> 0) ^ 0x9e3779b9) >>> 0,
    { points: s.legacy.points + earned, owned: [...s.legacy.owned] },
    carry,
  );
  next.chronicle.unshift({
    tick: next.tick,
    kind: 'ascension',
    text: `ASCENSION — colony #${carry.colonyNumber} founded by a caravan of ${caravan.length}, carrying ${earned} Legacy from the old dome.`,
    severity: 2,
  });
  return new Sim(next);
}
