import type { JobId, ResourceId } from '../sim/state';

export interface BuildingDef {
  name: string;
  short: string; // map label
  color: string;
  w: number;
  h: number;
  jobs: Partial<Record<JobId, number>>; // role → slots
  powerIn: number; // per hour while active
  waterIn: number;
  /** Produced per hour per arrived worker (scaled by skill/genes/morale). */
  outPerWorker: Partial<Record<ResourceId, number>>;
  /** Produced per hour regardless of workers. */
  outFlat: Partial<Record<ResourceId, number>>;
  caps: Partial<Record<ResourceId, number>>;
  beds: number;
  eatery: boolean;
  school: boolean;
  heal: boolean;
  daylightOnly: boolean; // solar
  terraformPerWorkerSol: number;
  cost: { materials: number; influence: number };
  work: number; // construction effort (builder-hours)
  requiresResearch: string | null;
  desc: string;
}

const base: Omit<
  BuildingDef,
  'name' | 'short' | 'color' | 'w' | 'h' | 'desc'
> = {
  jobs: {},
  powerIn: 0,
  waterIn: 0,
  outPerWorker: {},
  outFlat: {},
  caps: {},
  beds: 0,
  eatery: false,
  school: false,
  heal: false,
  daylightOnly: false,
  terraformPerWorkerSol: 0,
  cost: { materials: 40, influence: 10 },
  work: 60,
  requiresResearch: null,
};

export const BUILDINGS: Record<string, BuildingDef> = {
  habitat: {
    ...base,
    name: 'Habitat',
    short: 'HAB',
    color: '#5b6c9e',
    w: 4,
    h: 3,
    beds: 8,
    cost: { materials: 50, influence: 8 },
    desc: 'Sleeping quarters for eight colonists. Total beds cap the population.',
  },
  solar: {
    ...base,
    name: 'Solar Array',
    short: 'SOL',
    color: '#3d6fb8',
    w: 3,
    h: 2,
    outFlat: { power: 10 },
    daylightOnly: true,
    cost: { materials: 35, influence: 6 },
    desc: 'Generates power while the sun is up (06:00–18:00).',
  },
  waterReclaimer: {
    ...base,
    name: 'Water Reclaimer',
    short: 'H2O',
    color: '#3aa7c9',
    w: 2,
    h: 2,
    jobs: { engineer: 1 },
    powerIn: 1,
    outPerWorker: { water: 6 },
    cost: { materials: 40, influence: 8 },
    desc: 'Recycles and extracts water. Needs an engineer and power.',
  },
  electrolyzer: {
    ...base,
    name: 'Electrolyzer',
    short: 'O2',
    color: '#7fc7e8',
    w: 2,
    h: 2,
    jobs: { engineer: 1 },
    powerIn: 2,
    waterIn: 0.8,
    outPerWorker: { oxygen: 9 },
    cost: { materials: 45, influence: 8 },
    desc: 'Splits water into breathable oxygen. Power-hungry.',
  },
  greenhouse: {
    ...base,
    name: 'Greenhouse',
    short: 'GRN',
    color: '#3f9e58',
    w: 4,
    h: 3,
    jobs: { botanist: 2 },
    powerIn: 0.5,
    waterIn: 1,
    outPerWorker: { biomass: 1.6 },
    cost: { materials: 45, influence: 10 },
    desc: 'Grows food. One good botanist feeds roughly eight colonists.',
  },
  canteen: {
    ...base,
    name: 'Canteen',
    short: 'EAT',
    color: '#c98a3a',
    w: 3,
    h: 3,
    jobs: { steward: 1 },
    eatery: true,
    cost: { materials: 35, influence: 6 },
    desc: 'Where everyone eats and gossips.',
  },
  medbay: {
    ...base,
    name: 'Med Bay',
    short: 'MED',
    color: '#d4596e',
    w: 3,
    h: 2,
    jobs: { medic: 1 },
    powerIn: 0.5,
    heal: true,
    cost: { materials: 45, influence: 10 },
    desc: 'Treats illness and injury; staffed care lowers mortality.',
  },
  lab: {
    ...base,
    name: 'Laboratory',
    short: 'LAB',
    color: '#4f7fd9',
    w: 3,
    h: 3,
    jobs: { scientist: 2 },
    powerIn: 1,
    outPerWorker: { science: 1.2 },
    cost: { materials: 50, influence: 12 },
    desc: 'Produces science toward the current research.',
  },
  fabricator: {
    ...base,
    name: 'Fabricator',
    short: 'FAB',
    color: '#b8a23d',
    w: 3,
    h: 2,
    jobs: { fabricator: 2 },
    powerIn: 1.5,
    outPerWorker: { materials: 1.1 },
    cost: { materials: 50, influence: 10 },
    desc: 'Turns regolith feedstock into building materials.',
  },
  storage: {
    ...base,
    name: 'Storage Depot',
    short: 'STO',
    color: '#7a8499',
    w: 2,
    h: 2,
    jobs: { steward: 1 },
    caps: { power: 60, water: 200, oxygen: 250, biomass: 250, materials: 200 },
    cost: { materials: 30, influence: 5 },
    desc: 'Raises storage caps for every resource.',
  },
  school: {
    ...base,
    name: 'School',
    short: 'SCH',
    color: '#9a6fd0',
    w: 3,
    h: 2,
    jobs: { teacher: 1 },
    school: true,
    cost: { materials: 35, influence: 8 },
    desc: 'Students learn faster here, boosted by the teacher.',
  },
  regolithRefinery: {
    ...base,
    name: 'Regolith Refinery',
    short: 'REF',
    color: '#a8683c',
    w: 3,
    h: 3,
    jobs: { engineer: 2 },
    powerIn: 2,
    outPerWorker: { materials: 1.8 },
    cost: { materials: 70, influence: 16 },
    requiresResearch: 'pressurizedAnnex',
    desc: 'Bulk materials production for the annex ring.',
  },
  fusionPlant: {
    ...base,
    name: 'Fusion Plant',
    short: 'FUS',
    color: '#d96fb0',
    w: 3,
    h: 3,
    jobs: { engineer: 1 },
    outFlat: { power: 35 },
    cost: { materials: 120, influence: 30 },
    work: 160,
    requiresResearch: 'fusionPlant',
    desc: 'Steady abundant power, day and night.',
  },
  atmoProcessor: {
    ...base,
    name: 'Atmosphere Processor',
    short: 'ATM',
    color: '#5fd0a4',
    w: 4,
    h: 4,
    jobs: { engineer: 2 },
    powerIn: 4,
    terraformPerWorkerSol: 0.02,
    cost: { materials: 140, influence: 40 },
    work: 200,
    requiresResearch: 'atmosphericProcessing',
    desc: 'Slowly thickens the planet’s atmosphere. The long game.',
  },
};

export const STARTING_BUILDINGS = [
  'habitat',
  'habitat',
  'canteen',
  'greenhouse',
  'solar',
  'solar',
  'waterReclaimer',
  'electrolyzer',
  'lab',
  'medbay',
  'storage',
] as const;
