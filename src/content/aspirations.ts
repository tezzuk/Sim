import type { ColonyState, Colonist } from '../sim/state';
import { ageYears } from '../sim/state';

export interface AspirationDef {
  name: string;
  desc: string;
  target: number;
  /** Recomputed progress for stat-based aspirations; counter-based ones return null. */
  measure: ((s: ColonyState, c: Colonist) => number) | null;
  rewardInfluence: number;
  rewardLegacy: number;
}

export const ASPIRATIONS: Record<string, AspirationDef> = {
  chiefScientist: {
    name: 'Chief Scientist',
    desc: 'Reach Science level 7.',
    target: 7,
    measure: (_s, c) => c.skills.science.level,
    rewardInfluence: 40,
    rewardLegacy: 3,
  },
  masterEngineer: {
    name: 'Master Engineer',
    desc: 'Reach Engineering level 7.',
    target: 7,
    measure: (_s, c) => c.skills.engineering.level,
    rewardInfluence: 40,
    rewardLegacy: 3,
  },
  healer: {
    name: 'Healer',
    desc: 'Reach Medicine level 6.',
    target: 6,
    measure: (_s, c) => c.skills.medicine.level,
    rewardInfluence: 35,
    rewardLegacy: 2,
  },
  threeChildren: {
    name: 'A Full House',
    desc: 'Raise three children.',
    target: 3,
    measure: (_s, c) => c.childrenIds.length,
    rewardInfluence: 30,
    rewardLegacy: 3,
  },
  outlive70: {
    name: 'Endure',
    desc: 'Live to age 70.',
    target: 70,
    measure: (s, c) => Math.floor(ageYears(s, c)),
    rewardInfluence: 30,
    rewardLegacy: 4,
  },
  beloved: {
    name: 'Beloved',
    desc: 'Hold four close relationships (60+).',
    target: 4,
    measure: (_s, c) => c.relationships.filter((r) => r.value >= 60).length,
    rewardInfluence: 30,
    rewardLegacy: 2,
  },
  builder: {
    name: 'Colony Builder',
    desc: 'See two colony projects completed in your lifetime.',
    target: 2,
    measure: null, // counter: bumped on project completion
    rewardInfluence: 35,
    rewardLegacy: 3,
  },
  devotedMentor: {
    name: 'Devoted Mentor',
    desc: 'Mentor your protégé for six years.',
    target: 6,
    measure: (s, c) => {
      const protege = s.colonists.find((p) => p.id === s.player.mentorId);
      return protege && s.player.colonistId === c.id ? Math.floor(protege.mentoredYears) : 0;
    },
    rewardInfluence: 35,
    rewardLegacy: 4,
  },
  researchPatron: {
    name: 'Patron of Science',
    desc: 'See three research breakthroughs in your lifetime.',
    target: 3,
    measure: null, // counter: bumped on research completion
    rewardInfluence: 35,
    rewardLegacy: 3,
  },
  influential: {
    name: 'Voice of the Colony',
    desc: 'Hold 100 Influence at once.',
    target: 100,
    measure: (s, c) =>
      s.player.colonistId === c.id ? Math.floor(s.player.influence) : 0,
    rewardInfluence: 0,
    rewardLegacy: 4,
  },
};
