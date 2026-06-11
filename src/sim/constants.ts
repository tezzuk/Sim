// Every time/pacing/balance number lives here — the single tuning surface.

// ---- Map ----
export const MAP_TILES = 64;
export const TILE_PX = 16;
export const WORLD_PX = MAP_TILES * TILE_PX;
export const DOME_RADIUS = 28; // tiles
export const INNER_RADIUS = 18; // tiles pressurized before the Annex Ring

// ---- Time ----
// 1 tick = 1 colony-minute. 10 ticks/sec at 1x speed.
export const TICK_MS = 100;
export const TICKS_PER_HOUR = 60;
export const HOURS_PER_SOL = 24;
export const TICKS_PER_SOL = TICKS_PER_HOUR * HOURS_PER_SOL; // 1440
export const SOLS_PER_YEAR = 15;
export const TICKS_PER_YEAR = TICKS_PER_SOL * SOLS_PER_YEAR;
export const SPEEDS = [0, 1, 3, 10] as const;
export type Speed = (typeof SPEEDS)[number];
// Beyond this many pending ticks the game loop hands off to offline catch-up.
export const MAX_TICKS_PER_FRAME = 300;
// Offline catch-up: gaps up to this many ticks replay exactly (Tier A).
export const TIER_A_MAX_TICKS = 3000;

// ---- Life stages (years) ----
export const STAGE_CHILD = 3;
export const STAGE_STUDENT = 10;
export const STAGE_ADULT = 16;
export const STAGE_ELDER = 55;
// Gompertz mortality: hazard(age) = MORT_A * exp(MORT_B * age), per sol.
// Tuned for mean death age ≈ 62 colony-years.
export const MORT_A = 9e-7;
export const MORT_B = 0.155;
export const HEALTH_MORT_FACTOR = 2.5; // multiplier at health 0, scales linearly to 1 at health 100

// ---- Population ----
export const POP_HARD_CAP = 150;
export const FOUNDER_ADULTS = 8;
export const FOUNDER_CHILDREN = 4;

// ---- Needs (0..100), decay per waking colony-hour ----
export const ENERGY_DECAY = 6.25;
export const FOOD_DECAY = 4;
export const SOCIAL_DECAY = 2;
export const ENERGY_RECOVER = 12.5; // per sleeping hour
export const SOCIAL_RECOVER = 12; // per socializing hour
export const MEAL_RESTORE = 55; // food restored per meal
export const MEAL_COST_BIOMASS = 1.0;

// ---- Resource consumption per colonist ----
export const O2_PER_HOUR = 0.5;
export const WATER_PER_HOUR = 0.3;

// ---- Skills ----
export const SKILL_LEVEL_OUTPUT_BONUS = 0.08; // +8% job output per level
export const XP_PER_WORK_HOUR = 6;
export const XP_PER_SCHOOL_HOUR = 8;

// ---- Influence ----
export const INFLUENCE_PER_SOL_WORKED = 1.0;
export const INFLUENCE_LEADERSHIP_BONUS = 0.05; // per Leadership level
export const INFLUENCE_SENIORITY_BONUS = 0.1; // per year in current role
export const INFLUENCE_HEIR_CARRYOVER = 0.3;

// ---- Genetics ----
export const GENE_LOCI = 8;
export const MUTATION_CHANCE = 0.1; // per allele at birth
export const MUTATION_SD = 8;
export const TRAIT_MUTATION_CHANCE = 0.03;
export const TRAIT_EXPRESS_HI = 85;
export const TRAIT_EXPRESS_LO = 15;
export const TRAIT_EXPRESS_CHANCE = 0.5;
export const PHENO_BONUS_PER_POINT = 0.006; // ±0.6% per point from 50

// ---- Heir / prestige ----
export const INHERIT_BASE = 0.25;
export const INHERIT_PER_MENTOR_YEAR = 0.02;
export const INHERIT_CAP = 0.6;
export const INHERIT_BROKEN_LINEAGE = 0.1;

// ---- Reproduction ----
export const FERTILE_MIN_AGE = 18;
export const FERTILE_MAX_AGE = 42;
export const BIRTH_CHANCE_PER_SOL = 0.012; // per fertile partnered couple
export const PREGNANCY_SOLS = 10;

// ---- Events ----
export const EVENT_CHANCE_PER_SOL = 0.08;

// ---- Persistence ----
export const SAVE_KEY = 'lineage:save';
export const BACKUP_KEY = 'lineage:backup';
export const AUTOSAVE_MS = 30_000;
export const SAVE_VERSION = 1;

// ---- Rendering ----
export const MAX_DPR = 2;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.0;
export const LABEL_ZOOM = 1.5;
export const PATH_BUDGET_PER_TICK = 20;
