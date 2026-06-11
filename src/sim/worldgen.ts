import { BUILDINGS, STARTING_BUILDINGS } from '../content/buildings';
import { FAMILY, GIVEN_F, GIVEN_M } from '../content/names';
import {
  DOME_RADIUS,
  MAP_TILES,
  SAVE_VERSION,
  TICKS_PER_YEAR,
} from './constants';
import { expressTraits, newGenome } from './genetics';
import { Rng } from './rng';
import {
  type Building,
  type ColonyState,
  type Colonist,
  type GameMap,
  type Room,
  SKILLS,
  type SkillId,
  type SkillState,
  T_DOOR,
  T_FLOOR,
  T_GROUND,
  T_ROOM,
  T_VOID,
  T_WALL,
} from './state';

const C = MAP_TILES / 2; // dome center

interface Band {
  rad: number;
  size: number;
  outer: boolean;
  /** Fractional offset of rooms within their slot — staggers bands so square
   *  rooms on neighboring rings don't collide along diagonals. */
  bias: number;
}
const BANDS: Band[] = [
  { rad: 11, size: 6, outer: false, bias: 0.5 },
  { rad: 20.5, size: 6, outer: false, bias: 0.1 },
  { rad: 29.5, size: 6, outer: true, bias: 0.9 },
];
const CORRIDORS = 4;

/** Deterministic dome layout from the seed: tiles + rooms (no buildings). */
export function generateMap(seed: number): GameMap {
  const rng = Rng.stream(seed, 'worldgen');
  const tiles = new Uint8Array(MAP_TILES * MAP_TILES).fill(T_VOID);
  const dist = (x: number, y: number) => Math.hypot(x - C, y - C);

  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      const d = dist(x, y);
      if (d <= DOME_RADIUS - 1) tiles[y * MAP_TILES + x] = T_GROUND;
      else if (d <= DOME_RADIUS + 0.5) tiles[y * MAP_TILES + x] = T_WALL;
    }
  }

  // central plaza
  for (let y = 0; y < MAP_TILES; y++) {
    for (let x = 0; x < MAP_TILES; x++) {
      if (dist(x, y) <= 4) tiles[y * MAP_TILES + x] = T_FLOOR;
    }
  }

  // radial corridors, width ~2
  const baseAngle = rng.range(0, (Math.PI * 2) / CORRIDORS);
  const corridorAngles: number[] = [];
  for (let i = 0; i < CORRIDORS; i++) {
    corridorAngles.push(baseAngle + (i * Math.PI * 2) / CORRIDORS + rng.range(-0.08, 0.08));
  }
  for (const a of corridorAngles) {
    for (let t = 3; t <= DOME_RADIUS - 2.2; t += 0.4) {
      const fx = C + Math.cos(a) * t;
      const fy = C + Math.sin(a) * t;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const x = Math.floor(fx) + ox;
        const y = Math.floor(fy) + oy;
        if (x >= 0 && y >= 0 && x < MAP_TILES && y < MAP_TILES) {
          const j = y * MAP_TILES + x;
          if (tiles[j] === T_GROUND) tiles[j] = T_FLOOR;
        }
      }
    }
  }

  // ring-band rooms placed in the angular gaps BETWEEN corridors, so the
  // layout is dense regardless of seed
  const rooms: Room[] = [];
  let roomId = 0;
  const sorted = [...corridorAngles].sort((a, b) => a - b);
  for (const band of BANDS) {
    const chord = (band.size + 1.4) / band.rad; // angular width one room needs
    const clearance = (2.8 / band.rad) * 2; // keep off the corridors
    for (let g = 0; g < sorted.length; g++) {
      const a1 = sorted[g];
      const a2 = g === sorted.length - 1 ? sorted[0] + Math.PI * 2 : sorted[g + 1];
      const usable = a2 - a1 - clearance;
      const count = Math.floor(usable / chord);
      if (count <= 0) continue;
      const slack = usable - count * chord;
      const start = a1 + clearance / 2 + slack * band.bias;
      for (let k = 0; k < count; k++) {
        const ang = start + chord * (k + 0.5);
        const cx = C + Math.cos(ang) * band.rad;
        const cy = C + Math.sin(ang) * band.rad;
        const x0 = Math.round(cx - band.size / 2);
        const y0 = Math.round(cy - band.size / 2);
        // safety validation: rect must be untouched ground inside the dome
        let ok = true;
        for (let y = y0; y < y0 + band.size && ok; y++) {
          for (let x = x0; x < x0 + band.size && ok; x++) {
            if (x < 0 || y < 0 || x >= MAP_TILES || y >= MAP_TILES) ok = false;
            else if (tiles[y * MAP_TILES + x] !== T_GROUND) ok = false;
            else if (dist(x, y) > DOME_RADIUS - 1.6) ok = false;
          }
        }
        if (!ok) continue;
        for (let y = y0; y < y0 + band.size; y++) {
          for (let x = x0; x < x0 + band.size; x++) {
            const edge =
              x === x0 || y === y0 || x === x0 + band.size - 1 || y === y0 + band.size - 1;
            tiles[y * MAP_TILES + x] = edge ? T_WALL : T_ROOM;
          }
        }
        rooms.push({
          id: roomId++,
          x: x0,
          y: y0,
          w: band.size,
          h: band.size,
          doorX: x0, // assigned by placeDoor below
          doorY: y0,
          buildingId: null,
          outer: band.outer,
        });
      }
    }
  }
  for (const room of rooms) placeDoor(tiles, room);
  return { tiles, rooms };
}

/** Put the door on a wall cell whose outside neighbor is walkable, preferring
 *  the side that faces the plaza. */
function placeDoor(tiles: Uint8Array, room: Room): void {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const dx = C - cx;
  const dy = C - cy;
  // sides ordered by how much they face the plaza: [side, outward normal]
  const sides: { cells: { x: number; y: number }[]; nx: number; ny: number; score: number }[] = [
    {
      cells: midOut(room.x + 1, room.x + room.w - 2).map((x) => ({ x, y: room.y })),
      nx: 0,
      ny: -1,
      score: -dy,
    },
    {
      cells: midOut(room.x + 1, room.x + room.w - 2).map((x) => ({ x, y: room.y + room.h - 1 })),
      nx: 0,
      ny: 1,
      score: dy,
    },
    {
      cells: midOut(room.y + 1, room.y + room.h - 2).map((y) => ({ x: room.x, y })),
      nx: -1,
      ny: 0,
      score: -dx,
    },
    {
      cells: midOut(room.y + 1, room.y + room.h - 2).map((y) => ({ x: room.x + room.w - 1, y })),
      nx: 1,
      ny: 0,
      score: dx,
    },
  ];
  sides.sort((a, b) => b.score - a.score);
  for (const side of sides) {
    for (const cell of side.cells) {
      const ox = cell.x + side.nx;
      const oy = cell.y + side.ny;
      if (ox < 0 || oy < 0 || ox >= MAP_TILES || oy >= MAP_TILES) continue;
      const t = tiles[oy * MAP_TILES + ox];
      if (t === T_GROUND || t === T_FLOOR || t === T_DOOR) {
        tiles[cell.y * MAP_TILES + cell.x] = T_DOOR;
        room.doorX = cell.x;
        room.doorY = cell.y;
        return;
      }
    }
  }
  // last resort: punch through toward the plaza
  const side = sides[0];
  const cell = side.cells[0];
  tiles[cell.y * MAP_TILES + cell.x] = T_DOOR;
  const ox = cell.x + side.nx;
  const oy = cell.y + side.ny;
  if (ox >= 0 && oy >= 0 && ox < MAP_TILES && oy < MAP_TILES) {
    tiles[oy * MAP_TILES + ox] = T_FLOOR;
  }
  room.doorX = cell.x;
  room.doorY = cell.y;
}

/** Indices from a..b ordered middle-outward. */
function midOut(a: number, b: number): number[] {
  const out: number[] = [];
  const mid = Math.floor((a + b) / 2);
  out.push(mid);
  for (let d = 1; mid - d >= a || mid + d <= b; d++) {
    if (mid + d <= b) out.push(mid + d);
    if (mid - d >= a) out.push(mid - d);
  }
  return out;
}

/** Recreate map tiles/rooms from the seed and relink built buildings (load path). */
export function rebuildMap(state: ColonyState): void {
  state.map = generateMap(state.seed);
  for (const b of state.buildings) {
    const room = state.map.rooms.find((r) => r.id === b.roomId);
    if (room) room.buildingId = b.id;
  }
}

function emptySkills(): Record<SkillId, SkillState> {
  const out = {} as Record<SkillId, SkillState>;
  for (const s of SKILLS) out[s] = { xp: 0, level: 0 };
  return out;
}

export function levelFromXp(xp: number): number {
  return Math.min(10, Math.floor(Math.sqrt(xp / 100)));
}

export interface NewColonistArgs {
  id: number;
  name: string;
  family: string;
  sex: 'F' | 'M';
  bornTick: number;
  genome: number[];
  traits: string[];
  x: number;
  y: number;
  parents?: [number, number] | null;
}

export function makeColonist(a: NewColonistArgs): Colonist {
  return {
    id: a.id,
    name: a.name,
    family: a.family,
    sex: a.sex,
    bornTick: a.bornTick,
    stage: 'adult', // corrected by lifecycle on first sol
    genome: a.genome,
    traits: a.traits,
    skills: emptySkills(),
    needs: { energy: 90, food: 85, social: 70, health: 100, morale: 65 },
    job: null,
    educationFocus: null,
    relationships: [],
    partnerId: null,
    parents: a.parents ?? null,
    childrenIds: [],
    pregnantUntilTick: null,
    ill: false,
    homeId: null,
    mentoredYears: 0,
    aspiration: null,
    ai: {
      state: 'idle',
      pending: 'idle',
      targetBuildingId: null,
      tx: a.x,
      ty: a.y,
      path: [],
      wantsPath: false,
      movedAtTick: 0,
    },
    x: a.x,
    y: a.y,
    px: a.x,
    py: a.y,
    alive: true,
  };
}

export function stageForAge(years: number): Colonist['stage'] {
  if (years < 3) return 'infant';
  if (years < 10) return 'child';
  if (years < 16) return 'student';
  if (years < 55) return 'adult';
  return 'elder';
}

/** A brand-new colony: map, founders, starting buildings, resources. */
export function newColony(seed: number, legacy?: ColonyState['legacy']): ColonyState {
  const map = generateMap(seed);
  const g = Rng.stream(seed, 'genesis');
  let nextId = 1;

  // starting buildings into the innermost free rooms
  const innerRooms = map.rooms.filter((r) => !r.outer);
  const byCloseness = [...innerRooms].sort(
    (a, b) =>
      Math.hypot(a.x + a.w / 2 - C, a.y + a.h / 2 - C) -
      Math.hypot(b.x + b.w / 2 - C, b.y + b.h / 2 - C),
  );
  const buildings: Building[] = [];
  STARTING_BUILDINGS.forEach((defId, i) => {
    const room = byCloseness[i];
    if (!room) return;
    const def = BUILDINGS[defId];
    const b: Building = {
      id: nextId++,
      defId,
      roomId: room.id,
      x: room.x + 1 + Math.floor((room.w - 2 - def.w) / 2),
      y: room.y + 1 + Math.floor((room.h - 2 - def.h) / 2),
      w: def.w,
      h: def.h,
      workers: [],
      condition: 100,
      offlineUntilTick: 0,
      builtAtTick: 0,
      };
    room.buildingId = b.id;
    buildings.push(b);
  });

  // founders: 4F + 4M adults, 4 children
  const colonists: Colonist[] = [];
  const usedGiven = new Set<string>();
  const pickName = (sex: 'F' | 'M'): string => {
    const pool = sex === 'F' ? GIVEN_F : GIVEN_M;
    for (let i = 0; i < 20; i++) {
      const n = g.pick(pool);
      if (!usedGiven.has(n)) {
        usedGiven.add(n);
        return n;
      }
    }
    return g.pick(pool);
  };
  const families = [...FAMILY];
  const pickFamily = (): string => families.splice(g.int(families.length), 1)[0] ?? g.pick(FAMILY);

  const plazaSpot = (): { x: number; y: number } => ({
    x: C + g.int(7) - 3,
    y: C + g.int(7) - 3,
  });

  const primaries: SkillId[] = [
    'engineering',
    'botany',
    'science',
    'medicine',
    'engineering',
    'fabrication',
    'leadership',
    'botany',
  ];
  const adults: Colonist[] = [];
  for (let i = 0; i < 8; i++) {
    const sex = i < 4 ? 'F' : 'M';
    const genome = newGenome(g);
    const spot = plazaSpot();
    const c = makeColonist({
      id: nextId++,
      name: pickName(sex),
      family: pickFamily(),
      sex,
      bornTick: -Math.round(g.range(21, 34) * TICKS_PER_YEAR),
      genome,
      traits: expressTraits(g, genome),
      x: spot.x,
      y: spot.y,
    });
    const lvl = 2 + g.int(3);
    c.skills[primaries[i]] = { xp: lvl * lvl * 100, level: lvl };
    const minor = g.pick(SKILLS);
    if (minor !== primaries[i]) c.skills[minor] = { xp: 100, level: 1 };
    adults.push(c);
    colonists.push(c);
  }

  // three founding couples (F0..2 × M0..2)
  for (let i = 0; i < 3; i++) {
    const f = adults[i];
    const m = adults[4 + i];
    f.partnerId = m.id;
    m.partnerId = f.id;
    f.relationships.push({ otherId: m.id, kind: 'partner', value: 70 });
    m.relationships.push({ otherId: f.id, kind: 'partner', value: 70 });
  }

  for (let i = 0; i < 4; i++) {
    const mom = adults[i % 3];
    const dad = adults[4 + (i % 3)];
    const sex = g.chance(0.5) ? 'F' : 'M';
    // inherit from the couple
    const genome: number[] = [];
    for (let l = 0; l < 8; l++) {
      genome.push(mom.genome[l * 2 + g.int(2)], dad.genome[l * 2 + g.int(2)]);
    }
    const spot = plazaSpot();
    const c = makeColonist({
      id: nextId++,
      name: pickName(sex),
      family: dad.family,
      sex,
      bornTick: -Math.round(g.range(2, 9) * TICKS_PER_YEAR),
      genome,
      traits: expressTraits(g, genome),
      x: spot.x,
      y: spot.y,
      parents: [mom.id, dad.id],
    });
    mom.childrenIds.push(c.id);
    dad.childrenIds.push(c.id);
    c.relationships.push({ otherId: mom.id, kind: 'family', value: 60 });
    c.relationships.push({ otherId: dad.id, kind: 'family', value: 60 });
    colonists.push(c);
  }

  // homes: split everyone across the two habitats
  const habitats = buildings.filter((b) => b.defId === 'habitat');
  colonists.forEach((c, i) => {
    c.homeId = habitats[i % habitats.length]?.id ?? null;
  });

  // fix stages from age
  for (const c of colonists) c.stage = stageForAge(-c.bornTick / TICKS_PER_YEAR);

  // the player: the youngest founding adult
  const player = adults.reduce((a, b) => (a.bornTick > b.bornTick ? a : b));

  const state: ColonyState = {
    version: SAVE_VERSION,
    seed,
    rng: {
      sim: Rng.stream(seed, 'sim').state,
      events: Rng.stream(seed, 'events').state,
      genetics: Rng.stream(seed, 'genetics').state,
      offline: Rng.stream(seed, 'offline').state,
    },
    tick: 7 * 60, // colonies land at 07:00 — the sim wakes up immediately
    era: 'landing',
    speed: 1,
    lastSimWallClock: Date.now(),
    annexUnlocked: false,
    resources: {
      power: { amount: 50, cap: 100 },
      water: { amount: 150, cap: 300 },
      oxygen: { amount: 250, cap: 400 },
      biomass: { amount: 180, cap: 300 },
      materials: { amount: 120, cap: 300 },
      science: { amount: 0, cap: 2000 },
    },
    shortages: { power: false, water: false, oxygen: false, biomass: false },
    colonists,
    buildings,
    projects: [],
    research: { completed: [], current: null },
    events: { active: [] },
    map,
    player: {
      colonistId: player.id,
      influence: 5,
      designatedHeirId: null,
      mentorId: null,
      lifeNumber: 1,
      aspirationChoices: null,
    },
    legacy: legacy ?? { points: 0, owned: [] },
    stats: {
      terraforming: 0,
      generations: 1,
      totalBirths: 0,
      totalDeaths: 0,
      founded: Date.now(),
    },
    chronicle: [],
    succession: null,
    nextId,
  };
  state.chronicle.push({
    tick: 0,
    kind: 'founding',
    text: `The lander touches down. ${colonists.length} colonists step onto the regolith — among them ${player.name} ${player.family}, whose line you will follow.`,
    severity: 2,
  });
  return state;
}
