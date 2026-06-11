import type { EraId } from '../sim/state';

// `mods` multiply sim quantities; `capAdd` adds storage; `ageShift` delays the
// mortality curve by N years; `gatesEra` advances the colony era when completed.
export interface ResearchDef {
  name: string;
  cost: number; // science
  era: EraId; // earliest era it appears in
  requires: string[];
  mods: Record<string, number>;
  capAdd?: Partial<Record<string, number>>;
  ageShift?: number;
  gatesEra?: EraId;
  unlocksBuilding?: string;
  desc: string;
}

export const RESEARCH: Record<string, ResearchDef> = {
  hydroponics1: {
    name: 'Hydroponics I',
    cost: 80,
    era: 'landing',
    requires: [],
    mods: { botany: 1.25 },
    desc: '+25% greenhouse output.',
  },
  batteryBanks: {
    name: 'Battery Banks',
    cost: 90,
    era: 'landing',
    requires: [],
    mods: {},
    capAdd: { power: 80 },
    desc: 'Store far more power for the night shift.',
  },
  spectrometry: {
    name: 'Spectrometry',
    cost: 110,
    era: 'landing',
    requires: [],
    mods: { science: 1.25 },
    desc: '+25% lab output.',
  },
  nutrientPrinting: {
    name: 'Nutrient Printing',
    cost: 120,
    era: 'landing',
    requires: ['hydroponics1'],
    mods: { mealUse: 0.85 },
    desc: 'Meals consume 15% less biomass.',
  },
  colonyCharter: {
    name: 'Colony Charter',
    cost: 160,
    era: 'landing',
    requires: ['batteryBanks'],
    mods: { influence: 1.2 },
    gatesEra: 'establishment',
    desc: 'Formal self-governance. Advances the colony to the Establishment era.',
  },

  medicine1: {
    name: 'Medicine I',
    cost: 240,
    era: 'establishment',
    requires: ['colonyCharter'],
    mods: { healChance: 1.4 },
    ageShift: 4,
    desc: 'Mean lifespan +4 years; illness recovers faster.',
  },
  educationReform: {
    name: 'Education Reform',
    cost: 220,
    era: 'establishment',
    requires: ['colonyCharter'],
    mods: { studentXp: 1.3 },
    desc: 'Students learn 30% faster.',
  },
  perovskiteFilms: {
    name: 'Perovskite Films',
    cost: 260,
    era: 'establishment',
    requires: ['batteryBanks'],
    mods: { solarOut: 1.3 },
    desc: '+30% solar output.',
  },
  crecheProgram: {
    name: 'Crèche Program',
    cost: 240,
    era: 'establishment',
    requires: ['medicine1'],
    mods: { birthRate: 1.25 },
    desc: 'Safer pregnancies, more of them.',
  },
  advFabrication: {
    name: 'Advanced Fabrication',
    cost: 300,
    era: 'establishment',
    requires: ['colonyCharter'],
    mods: { fabrication: 1.3 },
    desc: '+30% fabricator output.',
  },
  pressurizedAnnex: {
    name: 'Pressurized Annex',
    cost: 420,
    era: 'establishment',
    requires: ['advFabrication'],
    mods: {},
    gatesEra: 'expansion',
    desc: 'Unlocks the outer ring plots. Advances to the Expansion era.',
  },

  medicine2: {
    name: 'Medicine II',
    cost: 600,
    era: 'expansion',
    requires: ['medicine1'],
    mods: { healChance: 1.4 },
    ageShift: 6,
    desc: 'Mean lifespan +6 more years.',
  },
  closedLoop: {
    name: 'Closed-Loop Recycling',
    cost: 550,
    era: 'expansion',
    requires: ['pressurizedAnnex'],
    mods: { waterUse: 0.8, o2Use: 0.8 },
    desc: 'Colonists consume 20% less water and oxygen.',
  },
  geneScreening: {
    name: 'Gene Screening',
    cost: 620,
    era: 'expansion',
    requires: ['medicine1'],
    mods: { mutationShield: 0.5 },
    desc: 'Halves the chance of harmful trait expression in newborns.',
  },
  fusionPlant: {
    name: 'Fusion Power',
    cost: 800,
    era: 'expansion',
    requires: ['pressurizedAnnex'],
    mods: {},
    unlocksBuilding: 'fusionPlant',
    desc: 'Unlocks the Fusion Plant: abundant power, day and night.',
  },
  deepDrilling: {
    name: 'Deep Drilling',
    cost: 700,
    era: 'expansion',
    requires: ['pressurizedAnnex'],
    mods: { engineering: 1.25 },
    desc: '+25% refinery and reclaimer output.',
  },
  atmosphericProcessing: {
    name: 'Atmospheric Processing',
    cost: 950,
    era: 'expansion',
    requires: ['fusionPlant'],
    mods: {},
    gatesEra: 'terraforming',
    unlocksBuilding: 'atmoProcessor',
    desc: 'The terraforming age begins.',
  },

  foundingCaravan: {
    name: 'Founding Caravan',
    cost: 1400,
    era: 'terraforming',
    requires: ['atmosphericProcessing'],
    mods: {},
    desc: 'Prepare a daughter colony — enables Ascension.',
  },
  terraformOptimization: {
    name: 'Terraform Optimization',
    cost: 1600,
    era: 'terraforming',
    requires: ['atmosphericProcessing'],
    mods: { terraform: 1.5 },
    desc: 'Atmosphere processors work 50% faster.',
  },
};

const ERA_ORDER: EraId[] = ['landing', 'establishment', 'expansion', 'terraforming'];

export function eraIndex(era: EraId): number {
  return ERA_ORDER.indexOf(era);
}

/** Product of a mod key over all completed research. */
export function researchMult(completed: string[], key: string): number {
  let m = 1;
  for (const id of completed) {
    const def = RESEARCH[id];
    if (def?.mods[key] !== undefined) m *= def.mods[key];
  }
  return m;
}

export function researchAgeShift(completed: string[]): number {
  let y = 0;
  for (const id of completed) y += RESEARCH[id]?.ageShift ?? 0;
  return y;
}
