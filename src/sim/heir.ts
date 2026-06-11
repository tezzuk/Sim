import {
  INHERIT_BASE,
  INHERIT_BROKEN_LINEAGE,
  INHERIT_CAP,
  INHERIT_PER_MENTOR_YEAR,
  INFLUENCE_HEIR_CARRYOVER,
} from './constants';
import type { Rng } from './rng';
import {
  type ColonyState,
  type Colonist,
  SKILLS,
  type SkillId,
  ageYears,
  chronicle,
  colonistById,
} from './state';
import { ASPIRATIONS } from '../content/aspirations';
import { levelFromXp } from './worldgen';

function inheritFraction(s: ColonyState, heir: Colonist): number {
  let cap = INHERIT_CAP;
  if (s.legacy.owned.includes('mentorshipProtocols')) cap += 0.1;
  return Math.min(cap, INHERIT_BASE + INHERIT_PER_MENTOR_YEAR * heir.mentoredYears);
}

/** Called when the player's colonist dies: assemble heir options, pause the game. */
export function buildSuccession(s: ColonyState, deceased: Colonist, rng: Rng): void {
  const options: { id: number; fraction: number; reason: string }[] = [];

  for (const id of deceased.childrenIds) {
    const child = colonistById(s, id);
    if (child?.alive && child.stage !== 'infant') {
      options.push({ id, fraction: inheritFraction(s, child), reason: 'Child' });
    }
  }
  const protege = colonistById(s, s.player.mentorId);
  if (protege?.alive && !options.some((o) => o.id === protege.id)) {
    options.push({
      id: protege.id,
      fraction: inheritFraction(s, protege),
      reason: 'Protégé',
    });
  }
  if (options.length === 0) {
    // lineage broken: the most attached young colonist carries a sliver onward
    const young = s.colonists
      .filter((c) => c.alive && c.id !== deceased.id && ageYears(s, c) < 35 && c.stage !== 'infant')
      .sort((a, b) => {
        const ra = a.relationships.find((r) => r.otherId === deceased.id)?.value ?? 0;
        const rb = b.relationships.find((r) => r.otherId === deceased.id)?.value ?? 0;
        return rb - ra || a.id - b.id;
      });
    for (const c of young.slice(0, 3)) {
      options.push({ id: c.id, fraction: INHERIT_BROKEN_LINEAGE, reason: 'Lineage broken' });
    }
  }
  // designated heir floats to the top
  options.sort((a, b) => {
    const da = a.id === s.player.designatedHeirId ? 1 : 0;
    const db = b.id === s.player.designatedHeirId ? 1 : 0;
    return db - da || b.fraction - a.fraction;
  });

  const skills: Partial<Record<SkillId, number>> = {};
  for (const k of SKILLS) skills[k] = deceased.skills[k].xp;
  const aspDef = deceased.aspiration ? ASPIRATIONS[deceased.aspiration.id] : null;

  s.succession = {
    deceasedName: `${deceased.name} ${deceased.family}`,
    deceasedCause: deceased.deathCause ?? 'unknown causes',
    deceasedAgeYears: Math.floor(ageYears(s, deceased)),
    lifeSummary: {
      skills,
      influence: s.player.influence,
      children: deceased.childrenIds.length,
      aspiration: aspDef?.name ?? null,
      aspirationDone: deceased.aspiration?.done ?? false,
    },
    options,
  };
  s.speed = 0; // pause for the succession choice
  void rng;
}

/** The player picks an heir: transfer skills/influence and continue the line. */
export function applySuccession(s: ColonyState, heirId: number): boolean {
  const succ = s.succession;
  if (!succ) return false;
  const opt = succ.options.find((o) => o.id === heirId);
  const heir = colonistById(s, heirId);
  if (!opt || !heir?.alive) return false;

  for (const k of SKILLS) {
    heir.skills[k].xp += opt.fraction * (succ.lifeSummary.skills[k] ?? 0);
    heir.skills[k].level = levelFromXp(heir.skills[k].xp);
  }
  s.player.influence = succ.lifeSummary.influence * INFLUENCE_HEIR_CARRYOVER;
  s.player.colonistId = heir.id;
  s.player.lifeNumber++;
  s.player.designatedHeirId = null;
  s.player.mentorId = null;
  s.player.aspirationChoices = null; // rolled fresh when (if) adult
  heir.mentoredYears = 0;
  s.stats.generations++;
  s.succession = null;
  s.speed = 1;
  chronicle(
    s,
    'succession',
    `The torch passes: ${heir.name} ${heir.family} (${opt.reason.toLowerCase()}) inherits ${Math.round(
      opt.fraction * 100,
    )}% of ${succ.deceasedName}'s lifework. Life ${s.player.lifeNumber} begins.`,
    2,
  );
  return true;
}
