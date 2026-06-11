import { BUILDINGS } from '../content-bridge';
import { moraleFactor } from './economy';
import {
  type Building,
  type ColonyState,
  chronicle,
  playerColonist,
} from '../state';

/** Per tick: pawns standing on a construction site add progress smoothly. */
export function constructionTick(s: ColonyState): void {
  if (s.projects.length === 0) return;
  for (const c of s.colonists) {
    if (!c.alive || c.ai.state !== 'constructing') continue;
    for (const p of s.projects) {
      const room = s.map.rooms.find((r) => r.id === p.roomId);
      if (
        room &&
        c.x >= room.x &&
        c.x < room.x + room.w &&
        c.y >= room.y &&
        c.y < room.y + room.h
      ) {
        p.progress += moraleFactor(c) / 60; // ≈1 builder-hour per hour on site
        break;
      }
    }
  }
}

/** Hourly: finish completed projects; engineers patch up damage. */
export function constructionHourly(s: ColonyState): void {
  // slow repair when any engineer is employed
  if (s.colonists.some((c) => c.alive && c.job?.role === 'engineer')) {
    for (const b of s.buildings) {
      if (b.condition < 100) b.condition = Math.min(100, b.condition + 0.15);
    }
  }

  if (s.projects.length === 0) return;
  const done = s.projects.filter((p) => p.progress >= p.workTotal).map((p) => p.id);

  for (const id of done) {
    const p = s.projects.find((pp) => pp.id === id)!;
    const room = s.map.rooms.find((r) => r.id === p.roomId)!;
    const def = BUILDINGS[p.defId];
    const b: Building = {
      id: s.nextId++,
      defId: p.defId,
      roomId: room.id,
      x: room.x + 1 + Math.floor((room.w - 2 - def.w) / 2),
      y: room.y + 1 + Math.floor((room.h - 2 - def.h) / 2),
      w: def.w,
      h: def.h,
      workers: [],
      condition: 100,
      offlineUntilTick: 0,
      builtAtTick: s.tick,
    };
    room.buildingId = b.id;
    s.buildings.push(b);
    s.projects = s.projects.filter((pp) => pp.id !== id);
    chronicle(s, 'construction', `Construction complete: the colony's new ${def.name} comes online.`, 1);
    const player = playerColonist(s);
    if (player?.aspiration && !player.aspiration.done && player.aspiration.id === 'builder') {
      player.aspiration.progress++;
    }
  }
}
