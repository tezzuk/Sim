// All UI → sim mutations go through these typed commands.
import { ASPIRATIONS } from '../content/aspirations';
import { RESEARCH, eraIndex } from '../content/research';
import { BUILDINGS, JOBS } from './content-bridge';
import { applySuccession } from './heir';
import type { Sim } from './sim';
import {
  type JobId,
  type SkillId,
  ageYears,
  buildingById,
  chronicle,
  colonistById,
  playerColonist,
} from './state';

export function cmdSetSpeed(sim: Sim, speed: 0 | 1 | 3 | 10): void {
  if (sim.state.succession) return; // succession modal owns the pause
  sim.state.speed = speed;
}

export function cmdChooseAspiration(sim: Sim, id: string): boolean {
  const s = sim.state;
  const p = playerColonist(s);
  if (!p?.alive || !s.player.aspirationChoices?.includes(id) || !ASPIRATIONS[id]) return false;
  p.aspiration = { id, progress: 0, done: false };
  s.player.aspirationChoices = null;
  chronicle(s, 'aspiration', `${p.name} ${p.family} sets a life's aspiration: ${ASPIRATIONS[id].name}.`, 1);
  return true;
}

export function cmdSetEducationFocus(sim: Sim, focus: SkillId): boolean {
  const p = playerColonist(sim.state);
  if (!p?.alive || (p.stage !== 'student' && p.stage !== 'child')) return false;
  p.educationFocus = focus;
  return true;
}

/** The player takes a job, displacing the weakest current holder if full. */
export function cmdTakeJob(sim: Sim, buildingId: number, role: JobId): boolean {
  const s = sim.state;
  const p = playerColonist(s);
  const b = buildingById(s, buildingId);
  if (!p?.alive || !b || (p.stage !== 'adult' && p.stage !== 'elder')) return false;
  const def = BUILDINGS[b.defId];
  const slots = def.jobs[role];
  if (!slots) return false;

  // leave the old post
  if (p.job) {
    const old = buildingById(s, p.job.buildingId);
    if (old) old.workers = old.workers.filter((id) => id !== p.id);
    p.job = null;
  }

  const holders = b.workers
    .map((id) => colonistById(s, id)!)
    .filter((c) => c?.job?.role === role);
  if (holders.length >= slots) {
    const skill = JOBS[role].skill;
    holders.sort((a, c) => a.skills[skill].xp - c.skills[skill].xp);
    const displaced = holders[0];
    displaced.job = null;
    b.workers = b.workers.filter((id) => id !== displaced.id);
  }
  p.job = { buildingId: b.id, role, sinceTick: s.tick };
  b.workers.push(p.id);
  chronicle(s, 'job', `${p.name} ${p.family} takes up work as ${JOBS[role].name} at the ${def.name}.`, 1);
  return true;
}

export function cmdQuitJob(sim: Sim): void {
  const s = sim.state;
  const p = playerColonist(s);
  if (!p?.job) return;
  const b = buildingById(s, p.job.buildingId);
  if (b) b.workers = b.workers.filter((id) => id !== p.id);
  p.job = null;
}

export function cmdSetMentor(sim: Sim, colonistId: number | null): boolean {
  const s = sim.state;
  if (colonistId === null) {
    s.player.mentorId = null;
    return true;
  }
  const c = colonistById(s, colonistId);
  if (!c?.alive || c.id === s.player.colonistId) return false;
  if (ageYears(s, c) > 30) return false;
  s.player.mentorId = c.id;
  const p = playerColonist(s);
  chronicle(s, 'mentor', `${p?.name ?? 'The player'} takes ${c.name} ${c.family} as protégé.`, 1);
  return true;
}

export function cmdDesignateHeir(sim: Sim, colonistId: number | null): boolean {
  const s = sim.state;
  if (colonistId === null) {
    s.player.designatedHeirId = null;
    return true;
  }
  const c = colonistById(s, colonistId);
  if (!c?.alive || c.id === s.player.colonistId) return false;
  s.player.designatedHeirId = c.id;
  return true;
}

export function cmdApplySuccession(sim: Sim, heirId: number): boolean {
  return applySuccession(sim.state, heirId);
}

export function cmdSetResearch(sim: Sim, id: string): boolean {
  const s = sim.state;
  const def = RESEARCH[id];
  if (!def || s.research.completed.includes(id)) return false;
  if (eraIndex(def.era) > eraIndex(s.era)) return false;
  if (!def.requires.every((r) => s.research.completed.includes(r))) return false;
  s.research.current = { id, progress: s.research.current?.id === id ? s.research.current.progress : 0 };
  return true;
}
