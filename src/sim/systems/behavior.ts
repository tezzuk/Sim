import {
  HOURS_PER_SOL,
  MAP_TILES,
  MEAL_COST_BIOMASS,
  TICKS_PER_HOUR,
  TICKS_PER_SOL,
} from '../constants';
import { traitMod } from '../genetics';
import type { Rng } from '../rng';
import {
  type BehaviorState,
  type Building,
  type ColonyState,
  type Colonist,
  buildingById,
} from '../state';
import { BUILDINGS } from '../content-bridge';
import { isWalkable } from '../path/grid';

export function hourOfSol(tick: number): number {
  return Math.floor((tick % TICKS_PER_SOL) / TICKS_PER_HOUR) % HOURS_PER_SOL;
}

type Activity = 'sleep' | 'eat' | 'work' | 'learn' | 'social' | 'idle';

function scheduledActivity(c: Colonist, hour: number): Activity {
  const h = c.traits.includes('nightOwl') ? (hour + 4) % 24 : hour;
  switch (c.stage) {
    case 'infant':
      return h >= 19 || h < 8 ? 'sleep' : 'idle';
    case 'child':
      if (h >= 20 || h < 7) return 'sleep';
      return h === 7 || h === 12 || h === 18 ? 'eat' : 'social';
    case 'student':
      if (h >= 21 || h < 7) return 'sleep';
      if (h === 7 || h === 18) return 'eat';
      return h >= 8 && h < 15 ? 'learn' : 'social';
    case 'adult':
      if (h >= 22 || h < 6) return 'sleep';
      if (h === 6 || h === 13) return 'eat';
      if (h < 18) return 'work';
      return h < 20 ? 'social' : 'idle';
    case 'elder':
      if (h >= 21 || h < 7) return 'sleep';
      if (h === 7 || h === 13) return 'eat';
      if (h >= 8 && h < 12) return 'work';
      return h < 19 ? 'social' : 'idle';
  }
}

const ACTIVITY_STATE: Record<Activity, BehaviorState> = {
  sleep: 'sleeping',
  eat: 'eating',
  work: 'working',
  learn: 'learning',
  social: 'social',
  idle: 'idle',
};

function interiorSpot(b: Building, rng: Rng): { x: number; y: number } {
  return { x: b.x + rng.int(b.w), y: b.y + rng.int(b.h) };
}

function nearestEatery(s: ColonyState, c: Colonist): Building | undefined {
  let best: Building | undefined;
  let bestD = Infinity;
  for (const b of s.buildings) {
    if (!BUILDINGS[b.defId].eatery) continue;
    const d = Math.abs(b.x - c.x) + Math.abs(b.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function setTarget(
  s: ColonyState,
  c: Colonist,
  pending: BehaviorState,
  building: Building | null,
  rng: Rng,
  spot?: { x: number; y: number },
): void {
  const t = spot ?? (building ? interiorSpot(building, rng) : { x: c.x, y: c.y });
  c.ai.pending = pending;
  c.ai.targetBuildingId = building?.id ?? null;
  c.ai.tx = t.x;
  c.ai.ty = t.y;
  if (c.x === t.x && c.y === t.y) {
    c.ai.state = pending;
    c.ai.path = [];
    c.ai.wantsPath = false;
    onArrive(s, c);
  } else {
    c.ai.state = 'seeking';
    c.ai.path = [];
    c.ai.wantsPath = true;
  }
}

function plazaSpot(s: ColonyState, rng: Rng): { x: number; y: number } {
  const cx = MAP_TILES / 2;
  for (let i = 0; i < 6; i++) {
    const x = cx + rng.int(9) - 4;
    const y = cx + rng.int(9) - 4;
    if (isWalkable(s.map.tiles, x, y)) return { x, y };
  }
  return { x: cx, y: cx };
}

/** Consume a meal etc. when an activity location is reached. */
export function onArrive(s: ColonyState, c: Colonist): void {
  if (c.ai.state === 'eating') {
    const cost = MEAL_COST_BIOMASS * traitMod(c.traits, 'foodUse');
    if (s.resources.biomass.amount >= cost) {
      s.resources.biomass.amount -= cost;
      c.needs.food = Math.min(100, c.needs.food + 55);
    }
  }
}

/** Hourly: re-evaluate every colonist's activity from schedule + need overrides. */
export function behaviorHourly(s: ColonyState, rng: Rng): void {
  const hour = hourOfSol(s.tick);
  for (const c of s.colonists) {
    if (!c.alive) continue;

    if (c.stage === 'infant') {
      // infants stay home
      const home = buildingById(s, c.homeId);
      if (home && (c.x < home.x || c.x >= home.x + home.w || c.y < home.y || c.y >= home.y + home.h)) {
        c.x = c.px = home.x;
        c.y = c.py = home.y;
      }
      c.ai.state = scheduledActivity(c, hour) === 'sleep' ? 'sleeping' : 'idle';
      c.ai.path = [];
      c.ai.wantsPath = false;
      continue;
    }

    let act = scheduledActivity(c, hour);
    // need overrides
    if (act !== 'sleep') {
      if (c.needs.food < 15) act = 'eat';
      else if (c.needs.energy < 8) act = 'sleep';
    }

    const pending = ACTIVITY_STATE[act];
    const doing = (st: typeof pending) =>
      c.ai.state === st || (c.ai.state === 'seeking' && c.ai.pending === st);
    // construction counts as work: crews on site stay committed
    if (act === 'work' && s.projects.length > 0 && doing('constructing')) continue;
    const sameActivity = doing(pending) && pending !== 'idle';
    if (sameActivity && pending !== 'eating' && !(pending === 'working' && s.projects.length > 0))
      continue; // keep doing it

    switch (act) {
      case 'sleep': {
        setTarget(s, c, 'sleeping', buildingById(s, c.homeId) ?? null, rng);
        break;
      }
      case 'eat': {
        if (c.ai.state === 'eating') break; // one meal per stretch
        setTarget(s, c, 'eating', nearestEatery(s, c) ?? null, rng);
        break;
      }
      case 'work': {
        // when something is being built, crews rotate to the site: the
        // jobless head there outright, settled workers peel off occasionally
        const settledAtJob = c.ai.state === 'working';
        if (s.projects.length > 0 && (!c.job || (settledAtJob && rng.chance(0.25)))) {
          const p = s.projects[rng.int(s.projects.length)];
          const room = s.map.rooms.find((r) => r.id === p.roomId);
          if (room) {
            setTarget(s, c, 'constructing', null, rng, {
              x: room.x + 1 + rng.int(room.w - 2),
              y: room.y + 1 + rng.int(room.h - 2),
            });
            break;
          }
        }
        if (settledAtJob) break; // already at the right post
        const b = c.job ? buildingById(s, c.job.buildingId) : undefined;
        if (b) setTarget(s, c, 'working', b, rng);
        else setTarget(s, c, 'idle', null, rng, plazaSpot(s, rng));
        break;
      }
      case 'learn': {
        const school = s.buildings.find((b) => BUILDINGS[b.defId].school);
        if (school) setTarget(s, c, 'learning', school, rng);
        else setTarget(s, c, 'social', null, rng, plazaSpot(s, rng));
        break;
      }
      case 'social': {
        const canteen = rng.chance(0.3) ? nearestEatery(s, c) : undefined;
        if (canteen) setTarget(s, c, 'social', canteen, rng);
        else setTarget(s, c, 'social', null, rng, plazaSpot(s, rng));
        break;
      }
      case 'idle': {
        const wander = c.traits.includes('wanderer') ? 0.75 : 0.4;
        if (rng.chance(wander)) {
          for (let i = 0; i < 6; i++) {
            const x = c.x + rng.int(13) - 6;
            const y = c.y + rng.int(13) - 6;
            if (isWalkable(s.map.tiles, x, y)) {
              setTarget(s, c, 'idle', null, rng, { x, y });
              break;
            }
          }
        } else {
          c.ai.state = 'idle';
          c.ai.path = [];
          c.ai.wantsPath = false;
        }
        break;
      }
    }
  }
}
