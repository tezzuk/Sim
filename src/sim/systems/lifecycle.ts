import { ASPIRATIONS } from '../../content/aspirations';
import { researchAgeShift, researchMult } from '../../content/research';
import { GIVEN_F, GIVEN_M } from '../../content/names';
import {
  BIRTH_CHANCE_PER_SOL,
  FERTILE_MAX_AGE,
  FERTILE_MIN_AGE,
  MORT_A,
  MORT_B,
  PREGNANCY_SOLS,
  SOLS_PER_YEAR,
  TICKS_PER_SOL,
} from '../constants';
import { expressTraits, inheritGenome, phenoMult, traitMod } from '../genetics';
import { BUILDINGS } from '../content-bridge';
import type { Rng } from '../rng';
import {
  type ColonyState,
  type Colonist,
  ageYears,
  buildingById,
  chronicle,
  colonistById,
  playerColonist,
} from '../state';
import { makeColonist, stageForAge } from '../worldgen';
import { buildSuccession } from '../heir';

/** Centralized death: clears links, logs, and triggers succession for the player. */
export function kill(s: ColonyState, c: Colonist, cause: string, rng: Rng): void {
  if (!c.alive) return;
  c.alive = false;
  c.deathTick = s.tick;
  c.deathCause = cause;
  c.ai.path = [];
  c.ai.wantsPath = false;
  if (c.job) {
    const b = buildingById(s, c.job.buildingId);
    if (b) b.workers = b.workers.filter((id) => id !== c.id);
    c.job = null;
  }
  const partner = colonistById(s, c.partnerId ?? null);
  if (partner) partner.partnerId = null;
  if (s.player.mentorId === c.id) s.player.mentorId = null;
  if (s.player.designatedHeirId === c.id) s.player.designatedHeirId = null;
  s.stats.totalDeaths++;

  const isPlayer = c.id === s.player.colonistId;
  const age = Math.floor(ageYears(s, c));
  chronicle(
    s,
    'death',
    `${c.name} ${c.family} dies of ${cause}, aged ${age}.`,
    isPlayer ? 2 : 1,
  );
  if (isPlayer) buildSuccession(s, c, rng);
}

function illnessChance(s: ColonyState, c: Colonist): number {
  let p = 0.004 * (2 - phenoMult(c.genome, 'resilience'));
  if (s.shortages.oxygen || s.shortages.water || c.needs.food < 20) p *= 2.5;
  if (s.events.active.some((e) => e.defId === 'outbreak')) p *= 6;
  return p;
}

function deathHazardPerSol(s: ColonyState, c: Colonist): number {
  const effAge = Math.max(
    0,
    ageYears(s, c) - researchAgeShift(s.research.completed),
  );
  let h = MORT_A * Math.exp(MORT_B * effAge);
  h /= traitMod(c.traits, 'lifespan'); // frail (0.85) → higher hazard
  h *= 2 - phenoMult(c.genome, 'vitality');
  h *= 1 + ((100 - c.needs.health) / 100) * 1.5;
  if (c.ill) h *= 1.6;
  if (c.stage === 'adult' || c.stage === 'elder') h += 2e-5; // accidents
  return h;
}

function rollPlayerAspirations(s: ColonyState, rng: Rng): void {
  const ids = Object.keys(ASPIRATIONS);
  const picks: string[] = [];
  while (picks.length < 3 && picks.length < ids.length) {
    const id = rng.pick(ids);
    if (!picks.includes(id)) picks.push(id);
  }
  s.player.aspirationChoices = picks;
}

function updatePlayerAspiration(s: ColonyState): void {
  const p = playerColonist(s);
  if (!p?.aspiration || p.aspiration.done) return;
  const def = ASPIRATIONS[p.aspiration.id];
  if (!def) return;
  if (def.measure) p.aspiration.progress = def.measure(s, p);
  if (p.aspiration.progress >= def.target) {
    p.aspiration.done = true;
    s.player.influence += def.rewardInfluence;
    s.legacy.points += def.rewardLegacy;
    chronicle(
      s,
      'aspiration',
      `${p.name} ${p.family} fulfills a life's aspiration: ${def.name}.`,
      2,
    );
  }
}

/** Per sol: aging, stage transitions, illness, mortality, pregnancy, births. */
export function lifecycleSol(s: ColonyState, rng: Rng, rngGen: Rng): void {
  const byId = new Map(s.colonists.map((c) => [c.id, c]));
  const aliveCount = s.colonists.filter((c) => c.alive).length;
  const bedTotal = s.buildings.reduce((a, b) => a + BUILDINGS[b.defId].beds, 0);
  const medStaffed = s.buildings.some(
    (b) => BUILDINGS[b.defId].heal && b.workers.length > 0,
  );
  const newborns: Colonist[] = [];

  for (const c of s.colonists) {
    if (!c.alive) continue;
    const age = ageYears(s, c);

    // stage transitions
    const newStage = stageForAge(age);
    if (newStage !== c.stage) {
      c.stage = newStage;
      const isPlayer = c.id === s.player.colonistId;
      if (newStage === 'student') {
        if (!c.educationFocus) {
          c.educationFocus = rng.pick([
            'engineering',
            'botany',
            'medicine',
            'science',
            'fabrication',
            'leadership',
          ] as const);
        }
        if (isPlayer || c.parents?.includes(s.player.colonistId)) {
          chronicle(s, 'stage', `${c.name} ${c.family} starts school.`, 1);
        }
      } else if (newStage === 'adult') {
        if (isPlayer) {
          chronicle(s, 'stage', `${c.name} ${c.family} comes of age. Choose an aspiration.`, 2);
        }
      } else if (newStage === 'elder' && isPlayer) {
        chronicle(s, 'stage', `${c.name} ${c.family} enters their elder years.`, 1);
      }
    }

    // mentorship accrual
    if (
      (s.player.mentorId === c.id || s.player.designatedHeirId === c.id) &&
      (c.stage === 'student' || c.stage === 'adult')
    ) {
      c.mentoredYears += 1 / SOLS_PER_YEAR;
    }

    // illness
    if (!c.ill && rng.chance(illnessChance(s, c))) {
      c.ill = true;
      if (c.id === s.player.colonistId) {
        chronicle(s, 'illness', `${c.name} ${c.family} falls ill.`, 1);
      }
    } else if (c.ill) {
      const recover =
        0.12 *
        (medStaffed ? 2 : 1) *
        phenoMult(c.genome, 'resilience') *
        researchMult(s.research.completed, 'healChance');
      if (rng.chance(Math.min(0.9, recover))) c.ill = false;
    }

    // mortality
    if (rng.chance(Math.min(0.5, deathHazardPerSol(s, c)))) {
      const cause = age >= 55 ? 'old age' : c.ill ? 'illness' : 'an accident';
      kill(s, c, cause, rng);
      continue;
    }

    // pregnancy / birth
    if (
      c.sex === 'F' &&
      c.partnerId !== null &&
      c.pregnantUntilTick === null &&
      age >= FERTILE_MIN_AGE &&
      age <= FERTILE_MAX_AGE &&
      aliveCount + newborns.length < bedTotal
    ) {
      const dad = byId.get(c.partnerId);
      if (dad?.alive) {
        const p =
          BIRTH_CHANCE_PER_SOL *
          phenoMult(c.genome, 'fertility') *
          phenoMult(dad.genome, 'fertility') *
          researchMult(s.research.completed, 'birthRate');
        if (rng.chance(p)) c.pregnantUntilTick = s.tick + PREGNANCY_SOLS * TICKS_PER_SOL;
      }
    }
    if (c.pregnantUntilTick !== null && s.tick >= c.pregnantUntilTick) {
      c.pregnantUntilTick = null;
      const dad = byId.get(c.partnerId ?? -1);
      if (dad) {
        const sex = rngGen.chance(0.5) ? 'F' : 'M';
        const genome = inheritGenome(rngGen, c.genome, dad.genome);
        let traits = expressTraits(rngGen, genome, [...c.traits, ...dad.traits]);
        if (researchMult(s.research.completed, 'mutationShield') < 1) {
          // gene screening halves the chance harmful traits stick
          traits = traits.filter(
            (t) => !(rngGen.chance(0.5) && isNegativeTrait(t)),
          );
        }
        const home = buildingById(s, c.homeId);
        const baby = makeColonist({
          id: s.nextId++,
          name: sex === 'F' ? rngGen.pick(GIVEN_F) : rngGen.pick(GIVEN_M),
          family: dad.family ?? c.family,
          sex,
          bornTick: s.tick,
          genome,
          traits,
          x: home?.x ?? c.x,
          y: home?.y ?? c.y,
          parents: [c.id, dad.id],
        });
        baby.stage = 'infant';
        baby.homeId = c.homeId;
        baby.relationships.push({ otherId: c.id, kind: 'family', value: 70 });
        baby.relationships.push({ otherId: dad.id, kind: 'family', value: 70 });
        c.childrenIds.push(baby.id);
        dad.childrenIds.push(baby.id);
        newborns.push(baby);
        s.stats.totalBirths++;
        const playerFamily =
          c.id === s.player.colonistId ||
          dad.id === s.player.colonistId ||
          c.parents?.includes(s.player.colonistId) ||
          dad.parents?.includes(s.player.colonistId);
        chronicle(
          s,
          'birth',
          `${baby.name} ${baby.family} is born to ${c.name} and ${dad.name}.`,
          playerFamily ? 1 : 0,
        );
      }
    }
  }
  s.colonists.push(...newborns);

  // player aspiration: roll choices on adulthood, track progress
  const p = playerColonist(s);
  if (
    p?.alive &&
    (p.stage === 'adult' || p.stage === 'elder') &&
    !p.aspiration &&
    !s.player.aspirationChoices
  ) {
    rollPlayerAspirations(s, rng);
  }
  updatePlayerAspiration(s);
}

function isNegativeTrait(id: string): boolean {
  return ['sickly', 'frail', 'anxious', 'glutton', 'loner'].includes(id);
}
