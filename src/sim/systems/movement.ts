import { PATH_BUDGET_PER_TICK } from '../constants';
import { traitMod } from '../genetics';
import { findPath } from '../path/astar';
import { ix, iy } from '../path/grid';
import type { ColonyState } from '../state';
import { onArrive } from './behavior';

/** Per tick: serve queued path requests (budgeted) and step pawns along paths. */
export function movementSystem(s: ColonyState): void {
  let solved = 0;
  for (const c of s.colonists) {
    if (!c.alive) continue;

    if (c.ai.wantsPath && solved < PATH_BUDGET_PER_TICK) {
      solved++;
      c.ai.wantsPath = false;
      const path = findPath(s.map.tiles, c.x, c.y, c.ai.tx, c.ai.ty);
      if (path && path.length > 0) {
        c.ai.path = path;
      } else {
        // unreachable or already there → do the activity where we stand
        c.ai.path = [];
        c.ai.state = c.ai.pending;
        onArrive(s, c);
      }
    }

    if (c.ai.path.length > 0) {
      // 1 tile/tick base; the 'quick' trait shaves the occasional extra tick
      const delay = Math.max(1, Math.round(1.25 * traitMod(c.traits, 'walkDelay')));
      if (s.tick - c.ai.movedAtTick >= delay) {
        c.px = c.x;
        c.py = c.y;
        const n = c.ai.path.pop()!;
        c.x = ix(n);
        c.y = iy(n);
        c.ai.movedAtTick = s.tick;
        if (c.ai.path.length === 0) {
          c.ai.state = c.ai.pending;
          onArrive(s, c);
        }
      }
    } else if (c.ai.state === 'seeking' && !c.ai.wantsPath) {
      c.ai.state = c.ai.pending;
      onArrive(s, c);
    }
  }
}
