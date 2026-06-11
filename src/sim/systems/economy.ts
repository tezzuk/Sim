import { RESEARCH, researchMult } from '../../content/research';
import {
  INFLUENCE_LEADERSHIP_BONUS,
  INFLUENCE_PER_SOL_WORKED,
  INFLUENCE_SENIORITY_BONUS,
  TICKS_PER_YEAR,
  XP_PER_SCHOOL_HOUR,
  XP_PER_WORK_HOUR,
} from '../constants';
import { phenoMult, traitMod } from '../genetics';
import { BUILDINGS, JOBS } from '../content-bridge';
import type { Rng } from '../rng';
import {
  type Building,
  type ColonyState,
  type Colonist,
  type JobId,
  type ResourceId,
  type SkillId,
} from '../state';
import { hourOfSol } from './behavior';
import { levelFromXp } from '../worldgen';

const BASE_CAPS: Record<ResourceId, number> = {
  power: 100,
  water: 300,
  oxygen: 400,
  biomass: 300,
  materials: 300,
  science: 2000,
};

export function recalcCaps(s: ColonyState): void {
  const caps = { ...BASE_CAPS };
  for (const b of s.buildings) {
    const def = BUILDINGS[b.defId];
    for (const [r, v] of Object.entries(def.caps)) caps[r as ResourceId] += v!;
  }
  for (const id of s.research.completed) {
    // capAdd from research (battery banks etc.)
    const def = (RESEARCH_CAPS as Record<string, Partial<Record<ResourceId, number>>>)[id];
    if (def) for (const [r, v] of Object.entries(def)) caps[r as ResourceId] += v!;
  }
  for (const r of Object.keys(caps) as ResourceId[]) {
    s.resources[r].cap = caps[r];
    s.resources[r].amount = Math.min(s.resources[r].amount, caps[r]);
  }
}

// research capAdd lookup built once
const RESEARCH_CAPS: Record<string, Partial<Record<ResourceId, number>>> = {};
for (const [id, def] of Object.entries(RESEARCH)) {
  if (def.capAdd) RESEARCH_CAPS[id] = def.capAdd as Partial<Record<ResourceId, number>>;
}

export function moraleFactor(c: Colonist): number {
  return 0.8 + (c.needs.morale / 100) * 0.4;
}

/** Output multiplier for one worker doing a role. */
export function workerMult(s: ColonyState, c: Colonist, role: JobId): number {
  const skill: SkillId = JOBS[role].skill;
  return (
    (1 + 0.08 * c.skills[skill].level) *
    phenoMult(c.genome, 'dexterity') *
    traitMod(c.traits, skill) *
    moraleFactor(c) *
    researchMult(s.research.completed, skill)
  );
}

function isOffline(s: ColonyState, b: Building): boolean {
  return s.tick < b.offlineUntilTick || b.condition <= 20;
}

/** Keep job slots filled with the best available unemployed adults. */
export function assignJobs(s: ColonyState, byId: Map<number, Colonist>): void {
  for (const b of s.buildings) {
    b.workers = b.workers.filter((id) => {
      const c = byId.get(id);
      return c?.alive && c.job?.buildingId === b.id;
    });
  }
  const unemployed = s.colonists
    .filter((c) => c.alive && !c.job && (c.stage === 'adult' || c.stage === 'elder'))
    .sort((a, b) => a.id - b.id);
  for (const b of s.buildings) {
    if (isOffline(s, b)) continue;
    const def = BUILDINGS[b.defId];
    for (const [role, slots] of Object.entries(def.jobs) as [JobId, number][]) {
      let assigned = b.workers.filter((id) => byId.get(id)?.job?.role === role).length;
      while (assigned < slots && unemployed.length > 0) {
        const skill = JOBS[role].skill;
        unemployed.sort(
          (a, c) => c.skills[skill].xp - a.skills[skill].xp || a.id - c.id,
        );
        const pick = unemployed.shift()!;
        pick.job = { buildingId: b.id, role, sinceTick: s.tick };
        b.workers.push(pick.id);
        assigned++;
      }
    }
  }
}

function gainXp(s: ColonyState, c: Colonist, skill: SkillId, amount: number): void {
  const st = c.skills[skill];
  st.xp += amount * phenoMult(c.genome, 'intellect') * traitMod(c.traits, 'xpGain');
  st.level = levelFromXp(st.xp);
}

/** Hourly production/consumption with the power→water→oxygen→food cascade. */
export function workEconomyHourly(s: ColonyState, _rng: Rng): void {
  const byId = new Map(s.colonists.map((c) => [c.id, c]));
  recalcCaps(s);
  assignJobs(s, byId);

  const res = s.resources;
  const hour = hourOfSol(s.tick);
  const daylight = hour >= 6 && hour < 18;
  const dust = s.events.active.some((e) => e.defId === 'dustStorm');
  const alive = s.colonists.filter((c) => c.alive);
  const done = s.research.completed;

  const arrived = (b: Building): Colonist[] =>
    b.workers
      .map((id) => byId.get(id)!)
      .filter((c) => c?.alive && c.ai.state === 'working' && c.job?.buildingId === b.id);

  // --- power ---
  let powerProd = 0;
  let powerNeed = 0;
  const staffRatio = new Map<number, number>();
  for (const b of s.buildings) {
    if (isOffline(s, b)) {
      staffRatio.set(b.id, 0);
      continue;
    }
    const def = BUILDINGS[b.defId];
    if (def.outFlat.power) {
      let p = def.outFlat.power;
      if (def.daylightOnly) {
        if (!daylight) p = 0;
        else {
          if (dust) p *= 0.6;
          p *= researchMult(done, 'solarOut');
        }
      }
      powerProd += p;
    }
    const slots = Object.values(def.jobs).reduce((a, v) => a + (v ?? 0), 0);
    const ratio = slots > 0 ? arrived(b).length / slots : 1;
    staffRatio.set(b.id, ratio);
    if (def.powerIn) powerNeed += def.powerIn * ratio;
  }
  let avail = res.power.amount + powerProd;
  const powerRatio = powerNeed > 0 ? Math.min(1, avail / powerNeed) : 1;
  avail -= powerNeed * powerRatio;
  res.power.amount = Math.min(res.power.cap, Math.max(0, avail));
  s.shortages.power = powerRatio < 0.98;

  const productionOf = (resource: ResourceId, extraRatio = 1): number => {
    let total = 0;
    for (const b of s.buildings) {
      if (isOffline(s, b)) continue;
      const def = BUILDINGS[b.defId];
      const rate = def.outPerWorker[resource];
      if (!rate) continue;
      const gate = (def.powerIn > 0 ? powerRatio : 1) * extraRatio;
      for (const w of arrived(b)) total += rate * workerMult(s, w, w.job!.role) * gate;
    }
    return total;
  };

  // --- water ---
  res.water.amount = Math.min(res.water.cap, res.water.amount + productionOf('water'));
  let waterNeed = alive.length * 0.3 * researchMult(done, 'waterUse');
  for (const b of s.buildings) {
    if (isOffline(s, b)) continue;
    const def = BUILDINGS[b.defId];
    if (def.waterIn) waterNeed += def.waterIn * (staffRatio.get(b.id) ?? 0) * powerRatio;
  }
  const waterRatio = waterNeed > 0 ? Math.min(1, res.water.amount / waterNeed) : 1;
  res.water.amount = Math.max(0, res.water.amount - waterNeed * waterRatio);
  s.shortages.water = waterRatio < 0.98;

  // --- oxygen ---
  res.oxygen.amount = Math.min(
    res.oxygen.cap,
    res.oxygen.amount + productionOf('oxygen', waterRatio),
  );
  let o2Need = 0;
  for (const c of alive) {
    const base = c.stage === 'infant' ? 0.25 : 0.5;
    o2Need += base * traitMod(c.traits, 'o2Use') * researchMult(done, 'o2Use');
  }
  if (res.oxygen.amount >= o2Need) {
    res.oxygen.amount -= o2Need;
    s.shortages.oxygen = false;
  } else {
    res.oxygen.amount = 0;
    s.shortages.oxygen = true;
  }

  // --- biomass / materials / science ---
  res.biomass.amount = Math.min(
    res.biomass.cap,
    res.biomass.amount + productionOf('biomass', waterRatio),
  );
  s.shortages.biomass = res.biomass.amount < alive.length * 2;
  res.materials.amount = Math.min(
    res.materials.cap,
    res.materials.amount + productionOf('materials'),
  );
  const relay = s.legacy.owned.includes('orbitalRelay') ? 1.1 : 1;
  res.science.amount = Math.min(
    res.science.cap,
    res.science.amount + productionOf('science') * relay,
  );

  // --- XP, influence, learning ---
  const player = byId.get(s.player.colonistId);
  for (const c of alive) {
    if (c.ai.state === 'working' && c.job) {
      gainXp(s, c, JOBS[c.job.role].skill, XP_PER_WORK_HOUR);
      if (c === player) {
        const seniority = (s.tick - c.job.sinceTick) / TICKS_PER_YEAR;
        s.player.influence +=
          (INFLUENCE_PER_SOL_WORKED / 8) *
          (1 + INFLUENCE_LEADERSHIP_BONUS * c.skills.leadership.level) *
          (1 + INFLUENCE_SENIORITY_BONUS * seniority) *
          traitMod(c.traits, 'influence') *
          researchMult(done, 'influence');
      }
    } else if (c.ai.state === 'learning') {
      const school = s.buildings.find((b) => BUILDINGS[b.defId].school);
      let teacherLvl = 0;
      if (school) {
        for (const w of arrived(school)) {
          teacherLvl = Math.max(teacherLvl, w.skills.leadership.level);
        }
      }
      const focus = c.educationFocus ?? 'science';
      gainXp(
        s,
        c,
        focus,
        XP_PER_SCHOOL_HOUR * (1 + 0.06 * teacherLvl) * researchMult(done, 'studentXp'),
      );
    }
  }
}
