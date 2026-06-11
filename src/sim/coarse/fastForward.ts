// Tier B offline catch-up: statistical per-sol simulation with adaptive
// quanta (1 → 10 → 100 sols per step), reusing the live sim's formulas and
// content tables so the two stay honest with each other.
import { EVENTS } from '../../content/events';
import { RESEARCH, researchMult } from '../../content/research';
import { BUILDINGS, JOBS } from '../content-bridge';
import {
  BIRTH_CHANCE_PER_SOL,
  EVENT_CHANCE_PER_SOL,
  FERTILE_MAX_AGE,
  FERTILE_MIN_AGE,
  SOLS_PER_YEAR,
  TICKS_PER_SOL,
  XP_PER_SCHOOL_HOUR,
  XP_PER_WORK_HOUR,
} from '../constants';
import { phenoMult, traitMod } from '../genetics';
import { applySuccession } from '../heir';
import type { Sim } from '../sim';
import {
  type ColonyState,
  type Colonist,
  type ResourceId,
  ageYears,
  buildingById,
  chronicle,
  playerColonist,
} from '../state';
import { levelFromXp, stageForAge } from '../worldgen';
import {
  assignJobs,
  recalcCaps,
  workerMult,
} from '../systems/economy';
import {
  deathHazardPerSol,
  giveBirth,
  illnessChance,
  kill,
  updatePlayerAspiration,
} from '../systems/lifecycle';

const WORK_HOURS = 8;
const SCHOOL_HOURS = 7;

/** P(at least once) over q sols given a per-sol probability. */
const aggregate = (p: number, q: number): number => 1 - Math.pow(1 - Math.min(1, p), q);

export function fastForwardSols(sim: Sim, sols: number): void {
  let remaining = sols;
  while (remaining > 0) {
    const q = remaining > 20000 ? 100 : remaining > 2000 ? 10 : 1;
    const step = Math.min(q, remaining);
    coarseStep(sim, step);
    remaining -= step;
    // a dead lineage with no heir stops the world from churning further
    if (sim.state.succession && sim.state.succession.options.length === 0) break;
  }
  reseat(sim.state);
}

function coarseStep(sim: Sim, q: number): void {
  const s = sim.state;
  const rng = sim.rngOffline;
  s.tick += q * TICKS_PER_SOL;

  const byId = new Map(s.colonists.map((c) => [c.id, c]));
  recalcCaps(s);
  assignJobs(s, byId);
  const alive = () => s.colonists.filter((c) => c.alive);
  const done = s.research.completed;

  // ---- economy: per-sol aggregate rates, applied ×q with the cascade ----
  const res = s.resources;
  let powerProd = 0;
  let powerNeed = 0;
  const produceSol: Partial<Record<ResourceId, number>> = {};
  let waterIn = 0;
  for (const b of s.buildings) {
    if (s.tick < b.offlineUntilTick || b.condition <= 20) continue;
    const def = BUILDINGS[b.defId];
    if (def.outFlat.power) {
      powerProd += def.outFlat.power * (def.daylightOnly ? 12 * researchMult(done, 'solarOut') : 24);
    }
    const workers = b.workers.map((id) => byId.get(id)!).filter((c) => c?.alive);
    if (def.powerIn && workers.length > 0) powerNeed += def.powerIn * WORK_HOURS;
    if (def.waterIn && workers.length > 0) waterIn += def.waterIn * WORK_HOURS;
    for (const w of workers) {
      for (const [r, rate] of Object.entries(def.outPerWorker) as [ResourceId, number][]) {
        produceSol[r] = (produceSol[r] ?? 0) + rate * workerMult(s, w, w.job!.role) * WORK_HOURS;
      }
    }
  }
  const pop = alive().length;
  const powerRatio =
    powerNeed > 0 ? Math.min(1, (res.power.amount / q + powerProd) / powerNeed) : 1;
  res.power.amount = Math.max(
    0,
    Math.min(res.power.cap, res.power.amount + (powerProd - powerNeed * powerRatio) * q),
  );

  res.water.amount = Math.min(
    res.water.cap,
    res.water.amount + (produceSol.water ?? 0) * powerRatio * q,
  );
  const waterNeed = (pop * 0.3 * 24 * researchMult(done, 'waterUse') + waterIn) * q;
  const waterRatio = waterNeed > 0 ? Math.min(1, res.water.amount / waterNeed) : 1;
  res.water.amount = Math.max(0, res.water.amount - waterNeed * waterRatio);

  res.oxygen.amount = Math.min(
    res.oxygen.cap,
    res.oxygen.amount + (produceSol.oxygen ?? 0) * powerRatio * waterRatio * q,
  );
  const o2Need = pop * 0.45 * 24 * researchMult(done, 'o2Use') * q;
  const o2Short = res.oxygen.amount < o2Need;
  res.oxygen.amount = Math.max(0, res.oxygen.amount - o2Need);
  s.shortages.oxygen = o2Short;
  s.shortages.water = waterRatio < 0.98;
  s.shortages.power = powerRatio < 0.98;

  res.biomass.amount = Math.min(
    res.biomass.cap,
    res.biomass.amount + (produceSol.biomass ?? 0) * powerRatio * waterRatio * q,
  );
  const meals = pop * 2.5 * researchMult(done, 'mealUse') * q;
  const famine = res.biomass.amount < meals;
  res.biomass.amount = Math.max(0, res.biomass.amount - meals);
  s.shortages.biomass = famine;

  res.materials.amount = Math.min(
    res.materials.cap,
    res.materials.amount + (produceSol.materials ?? 0) * powerRatio * q,
  );
  const relay = s.legacy.owned.includes('orbitalRelay') ? 1.1 : 1;
  res.science.amount = Math.min(
    res.science.cap,
    res.science.amount + (produceSol.science ?? 0) * powerRatio * relay * q,
  );

  // research progress
  const cur = s.research.current;
  if (cur) {
    const def = RESEARCH[cur.id];
    if (def) {
      const take = Math.min(res.science.amount, def.cost - cur.progress);
      res.science.amount -= take;
      cur.progress += take;
      if (cur.progress >= def.cost) {
        s.research.completed.push(cur.id);
        s.research.current = null;
        chronicle(s, 'research', `Breakthrough: ${def.name}.`, 1);
        if (def.gatesEra && def.gatesEra !== s.era) {
          s.era = def.gatesEra;
          if (def.gatesEra === 'expansion') s.annexUnlocked = true;
          chronicle(s, 'era', `A new era for the colony: ${def.gatesEra.toUpperCase()}.`, 2);
        }
      }
    }
  }

  // construction: jobless full-time + employed crews rotating ~35% of hours
  const adults = alive().filter((c) => c.stage === 'adult' || c.stage === 'elder');
  const jobless = adults.filter((c) => !c.job).length;
  const builderHours = (jobless + (adults.length - jobless) * 0.35) * WORK_HOURS;
  if (s.projects.length > 0 && builderHours > 0) {
    const perProject = (builderHours * q) / s.projects.length;
    for (const p of [...s.projects]) {
      p.progress += perProject;
      if (p.progress >= p.workTotal) {
        const room = s.map.rooms.find((r) => r.id === p.roomId)!;
        const def = BUILDINGS[p.defId];
        const b = {
          id: s.nextId++,
          defId: p.defId,
          roomId: room.id,
          x: room.x + 1 + Math.floor((room.w - 2 - def.w) / 2),
          y: room.y + 1 + Math.floor((room.h - 2 - def.h) / 2),
          w: def.w,
          h: def.h,
          workers: [],
          condition: 100,
          offlineUntilTick: 0,
          builtAtTick: s.tick,
        };
        room.buildingId = b.id;
        s.buildings.push(b);
        s.projects = s.projects.filter((pp) => pp.id !== p.id);
        chronicle(s, 'construction', `Construction complete: ${def.name}.`, 1);
      }
    }
  }

  // terraforming
  for (const b of s.buildings) {
    const def = BUILDINGS[b.defId];
    if (def.terraformPerWorkerSol > 0) {
      s.stats.terraforming = Math.min(
        100,
        s.stats.terraforming +
          def.terraformPerWorkerSol * b.workers.length * researchMult(done, 'terraform') * q,
      );
    }
  }

  // ---- colonists: aging, xp, illness, mortality, births ----
  const hazardBump = (o2Short ? 0.08 : 0) + (famine ? 0.04 : 0);
  const school = s.buildings.find((b) => BUILDINGS[b.defId].school);
  let teacherLvl = 0;
  if (school) {
    for (const id of school.workers) {
      const t = byId.get(id);
      if (t?.alive) teacherLvl = Math.max(teacherLvl, t.skills.leadership.level);
    }
  }
  const bedTotal = s.buildings.reduce((a, b) => a + BUILDINGS[b.defId].beds, 0);
  const newborns: Colonist[] = [];

  for (const c of [...s.colonists]) {
    if (!c.alive) continue;
    c.stage = stageForAge(ageYears(s, c));
    c.needs.energy = 70;
    c.needs.food = famine ? 25 : 70;
    c.needs.social = 55;
    c.needs.morale = famine || o2Short ? 40 : 62;
    if (famine || o2Short) c.needs.health = Math.max(5, c.needs.health - 10 * q);
    else c.needs.health = Math.min(100 * traitMod(c.traits, 'healthMax'), c.needs.health + 2 * q);

    // xp
    if (c.job && (c.stage === 'adult' || c.stage === 'elder')) {
      const skill = JOBS[c.job.role].skill;
      c.skills[skill].xp +=
        XP_PER_WORK_HOUR *
        WORK_HOURS *
        q *
        phenoMult(c.genome, 'intellect') *
        traitMod(c.traits, 'xpGain');
      c.skills[skill].level = levelFromXp(c.skills[skill].xp);
    } else if (c.stage === 'student') {
      const focus = c.educationFocus ?? 'science';
      c.skills[focus].xp +=
        XP_PER_SCHOOL_HOUR *
        SCHOOL_HOURS *
        q *
        (1 + 0.06 * teacherLvl) *
        researchMult(done, 'studentXp') *
        phenoMult(c.genome, 'intellect') *
        traitMod(c.traits, 'xpGain');
      c.skills[focus].level = levelFromXp(c.skills[focus].xp);
    }

    // mentorship
    if (
      (s.player.mentorId === c.id || s.player.designatedHeirId === c.id) &&
      (c.stage === 'student' || c.stage === 'adult')
    ) {
      c.mentoredYears += q / SOLS_PER_YEAR;
    }

    // illness
    if (!c.ill && rng.chance(aggregate(illnessChance(s, c), q))) c.ill = true;
    else if (c.ill && rng.chance(aggregate(0.2, q))) c.ill = false;

    // mortality (aggregated hazard)
    const h = deathHazardPerSol(s, c) + hazardBump;
    if (rng.chance(aggregate(h, q))) {
      const cause = o2Short
        ? 'asphyxiation'
        : famine
          ? 'starvation'
          : ageYears(s, c) >= 55
            ? 'old age'
            : c.ill
              ? 'illness'
              : 'an accident';
      kill(s, c, cause, rng);
      // succession resolves itself while you're away
      if (s.succession) {
        const first = s.succession.options[0];
        if (first) {
          applySuccession(s, first.id);
        }
      }
      continue;
    }

    // births (skip the pregnancy timer offline)
    if (
      c.sex === 'F' &&
      c.partnerId !== null &&
      ageYears(s, c) >= FERTILE_MIN_AGE &&
      ageYears(s, c) <= FERTILE_MAX_AGE &&
      alive().length + newborns.length < bedTotal
    ) {
      const dad = byId.get(c.partnerId);
      if (dad?.alive) {
        const p =
          BIRTH_CHANCE_PER_SOL *
          phenoMult(c.genome, 'fertility') *
          phenoMult(dad.genome, 'fertility') *
          researchMult(done, 'birthRate');
        if (rng.chance(aggregate(p, q))) {
          newborns.push(giveBirth(s, c, dad, sim.rngGenetics));
        }
      }
    }
  }
  s.colonists.push(...newborns);

  // player influence accrues while working
  const player = playerColonist(s);
  if (player?.alive && player.job) {
    s.player.influence +=
      q *
      (1 + 0.05 * player.skills.leadership.level) *
      traitMod(player.traits, 'influence') *
      researchMult(done, 'influence');
  }
  updatePlayerAspiration(s);

  // instant events only (timed ones don't make sense compressed)
  if (rng.chance(aggregate(EVENT_CHANCE_PER_SOL, Math.min(q, 12)))) {
    const instant = Object.entries(EVENTS).filter(([, d]) => !d.durationSols && !d.decision);
    const [, def] = instant[rng.int(instant.length)];
    chronicle(s, 'event', def.apply(s, rng), 1);
  }
}

/** Put pawns somewhere sensible so the live scene is coherent on return. */
function reseat(s: ColonyState): void {
  for (const c of s.colonists) {
    if (!c.alive) continue;
    const home = buildingById(s, c.homeId);
    if (home) {
      c.x = home.x + (c.id % home.w);
      c.y = home.y + (c.id % home.h);
    }
    c.px = c.x;
    c.py = c.y;
    c.ai.state = 'idle';
    c.ai.pending = 'idle';
    c.ai.path = [];
    c.ai.wantsPath = false;
    c.ai.movedAtTick = s.tick;
    c.ai.tx = c.x;
    c.ai.ty = c.y;
  }
}
