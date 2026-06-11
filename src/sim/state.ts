// The single root state object. Everything in here must survive
// JSON.stringify → JSON.parse round-trips (the map is rebuilt from seed +
// buildings on load, see worldgen.rebuildMap).

export type ResourceId = 'power' | 'water' | 'oxygen' | 'biomass' | 'materials' | 'science';
export type SkillId =
  | 'engineering'
  | 'botany'
  | 'medicine'
  | 'science'
  | 'fabrication'
  | 'leadership';
export type JobId =
  | 'engineer'
  | 'botanist'
  | 'medic'
  | 'scientist'
  | 'fabricator'
  | 'teacher'
  | 'steward';
export type Stage = 'infant' | 'child' | 'student' | 'adult' | 'elder';
export type EraId = 'landing' | 'establishment' | 'expansion' | 'terraforming';
export type BehaviorState =
  | 'sleeping'
  | 'eating'
  | 'working'
  | 'learning'
  | 'social'
  | 'constructing'
  | 'seeking'
  | 'idle';

export const RESOURCES: ResourceId[] = ['power', 'water', 'oxygen', 'biomass', 'materials', 'science'];
export const SKILLS: SkillId[] = ['engineering', 'botany', 'medicine', 'science', 'fabrication', 'leadership'];

// Tile codes in GameMap.tiles
export const T_VOID = 0; // outside the dome — impassable
export const T_GROUND = 1; // undeveloped dome interior — walkable
export const T_FLOOR = 2; // plaza + corridors
export const T_WALL = 3; // room wall — impassable
export const T_DOOR = 4;
export const T_ROOM = 5; // room interior

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  doorX: number;
  doorY: number;
  buildingId: number | null; // null → free plot
  outer: boolean; // outer ring: locked until the annex is unlocked
}

export interface GameMap {
  tiles: Uint8Array; // MAP_TILES² — NOT serialized; rebuilt from seed + buildings
  rooms: Room[];
}

export interface SkillState {
  xp: number;
  level: number;
}

export interface Relationship {
  otherId: number;
  kind: 'family' | 'friend' | 'rival' | 'partner';
  value: number; // -100..100
}

export interface ColonistAI {
  state: BehaviorState;
  pending: BehaviorState; // activity to start when the target tile is reached
  targetBuildingId: number | null;
  tx: number;
  ty: number;
  path: number[]; // packed tile indices, walked back-to-front
  wantsPath: boolean;
  movedAtTick: number;
}

export interface Colonist {
  id: number;
  name: string;
  family: string;
  sex: 'F' | 'M';
  bornTick: number;
  stage: Stage;
  genome: number[]; // 8 loci × 2 alleles, flattened
  traits: string[];
  skills: Record<SkillId, SkillState>;
  needs: { energy: number; food: number; social: number; health: number; morale: number };
  job: { buildingId: number; role: JobId; sinceTick: number } | null;
  educationFocus: SkillId | null;
  relationships: Relationship[];
  partnerId: number | null;
  parents: [number, number] | null;
  childrenIds: number[];
  pregnantUntilTick: number | null;
  ill: boolean;
  homeId: number | null; // habitat building id
  mentoredYears: number; // years spent as the player's protégé/heir while mentored
  aspiration: { id: string; progress: number; done: boolean } | null;
  ai: ColonistAI;
  x: number; // tile coords
  y: number;
  px: number; // previous tile (render interpolation)
  py: number;
  alive: boolean;
  deathTick?: number;
  deathCause?: string;
}

export interface Building {
  id: number;
  defId: string;
  roomId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  workers: number[];
  condition: number; // 0..100
  offlineUntilTick: number; // equipment failure / damage
  builtAtTick: number;
}

export interface Project {
  id: number;
  defId: string;
  roomId: number;
  progress: number; // 0..workTotal
  workTotal: number;
}

export interface ActiveEvent {
  defId: string;
  untilTick: number;
  data?: Record<string, number>;
}

export interface ChronicleEntry {
  tick: number;
  text: string;
  severity: 0 | 1 | 2; // 0 minor, 1 notable, 2 major (pinned)
  kind: string;
}

export interface ColonyState {
  version: number;
  seed: number;
  rng: { sim: number; events: number; genetics: number; offline: number };
  tick: number;
  era: EraId;
  speed: 0 | 1 | 3 | 10;
  lastSimWallClock: number;
  annexUnlocked: boolean;
  resources: Record<ResourceId, { amount: number; cap: number }>;
  shortages: { power: boolean; water: boolean; oxygen: boolean; biomass: boolean };
  colonists: Colonist[];
  buildings: Building[];
  projects: Project[];
  research: { completed: string[]; current: { id: string; progress: number } | null };
  events: { active: ActiveEvent[] };
  map: GameMap;
  player: {
    colonistId: number;
    influence: number;
    designatedHeirId: number | null;
    mentorId: number | null; // the protégé the player mentors
    lifeNumber: number;
    aspirationChoices: string[] | null; // 3 rolled options awaiting a pick
  };
  legacy: { points: number; owned: string[] };
  /** A pending event decision card for the player (auto-resolves after a sol). */
  decision: {
    defId: string;
    title: string;
    body: string;
    options: { label: string; desc: string }[];
    createdTick: number;
  } | null;
  /** Set when the player's colonist dies; the heir panel resolves it. */
  succession: {
    deceasedName: string;
    deceasedCause: string;
    deceasedAgeYears: number;
    lifeSummary: { skills: Partial<Record<SkillId, number>>; influence: number; children: number; aspiration: string | null; aspirationDone: boolean };
    options: { id: number; fraction: number; reason: string }[];
  } | null;
  stats: {
    terraforming: number; // 0..100 (%)
    generations: number;
    totalBirths: number;
    totalDeaths: number;
    founded: number; // wall-clock ms when colony founded
    colonyNumber: number; // increments with each Ascension
  };
  chronicle: ChronicleEntry[];
  nextId: number; // shared id counter (colonists/buildings/projects)
}

export function colonistById(s: ColonyState, id: number | null): Colonist | undefined {
  if (id == null) return undefined;
  return s.colonists.find((c) => c.id === id);
}

export function buildingById(s: ColonyState, id: number | null): Building | undefined {
  if (id == null) return undefined;
  return s.buildings.find((b) => b.id === id);
}

export function playerColonist(s: ColonyState): Colonist | undefined {
  return colonistById(s, s.player.colonistId);
}

export function ageYears(s: ColonyState, c: Colonist): number {
  return (s.tick - c.bornTick) / (1440 * 15);
}

export function chronicle(
  s: ColonyState,
  kind: string,
  text: string,
  severity: 0 | 1 | 2 = 0,
): void {
  s.chronicle.push({ tick: s.tick, kind, text, severity });
  // ring buffer: keep majors, trim the rest
  if (s.chronicle.length > 500) {
    const majors = s.chronicle.filter((e) => e.severity === 2);
    const rest = s.chronicle.filter((e) => e.severity !== 2).slice(-400);
    s.chronicle = [...majors.slice(-80), ...rest].sort((a, b) => a.tick - b.tick);
  }
}
