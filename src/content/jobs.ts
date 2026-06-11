import type { JobId, SkillId } from '../sim/state';

export interface JobDef {
  name: string;
  color: string; // pawn body color
  skill: SkillId;
}

export const JOBS: Record<JobId, JobDef> = {
  engineer: { name: 'Engineer', color: '#f08c2e', skill: 'engineering' },
  botanist: { name: 'Botanist', color: '#4cbf6b', skill: 'botany' },
  medic: { name: 'Medic', color: '#e8536a', skill: 'medicine' },
  scientist: { name: 'Scientist', color: '#4f9cf0', skill: 'science' },
  fabricator: { name: 'Fabricator', color: '#e3c94f', skill: 'fabrication' },
  teacher: { name: 'Teacher', color: '#b07de8', skill: 'leadership' },
  steward: { name: 'Steward', color: '#46c4b7', skill: 'leadership' },
};

export const JOBLESS_COLOR = '#9aa7c0';
export const CHILD_COLOR = '#cdd6ea';
