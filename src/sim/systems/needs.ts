import {
  ENERGY_DECAY,
  ENERGY_RECOVER,
  FOOD_DECAY,
  SOCIAL_DECAY,
  SOCIAL_RECOVER,
} from '../constants';
import { traitMod } from '../genetics';
import type { Rng } from '../rng';
import type { ColonyState } from '../state';
import { BUILDINGS } from '../content-bridge';
import { kill } from './lifecycle';

const clamp = (v: number, max = 100) => Math.min(max, Math.max(0, v));

/** Hourly: need decay/recovery, health, morale — and deaths from collapse. */
export function needsHourly(s: ColonyState, rng: Rng): void {
  const medStaffed = s.buildings.some(
    (b) =>
      BUILDINGS[b.defId].heal &&
      b.workers.length > 0 &&
      s.tick >= b.offlineUntilTick,
  );

  for (const c of s.colonists) {
    if (!c.alive) continue;
    const n = c.needs;
    const sleeping = c.ai.state === 'sleeping';

    if (c.stage === 'infant') {
      n.food = clamp(n.food - 2);
      n.energy = 80;
      // fed by stewards/parents from stores
      if (s.resources.biomass.amount >= 0.3 && n.food < 50) {
        s.resources.biomass.amount -= 0.3;
        n.food = clamp(n.food + 30);
      }
    } else {
      n.energy = clamp(sleeping ? n.energy + ENERGY_RECOVER : n.energy - ENERGY_DECAY);
      n.food = clamp(n.food - FOOD_DECAY * traitMod(c.traits, 'foodUse'));
      n.social = clamp(
        c.ai.state === 'social'
          ? n.social + SOCIAL_RECOVER
          : n.social - SOCIAL_DECAY * traitMod(c.traits, 'socialDecay'),
      );
    }

    // health
    const healthMax = clamp(100 * traitMod(c.traits, 'healthMax'), 115);
    if (s.shortages.oxygen) n.health -= 5;
    if (n.food <= 0) n.health -= 3;
    if (c.ill) n.health -= medStaffed ? 1 : 3;
    else if (!s.shortages.oxygen && n.food > 30 && n.energy > 15) {
      n.health = Math.min(healthMax, n.health + 0.5);
    }
    n.health = Math.min(healthMax, n.health);

    // morale drifts toward a situational target
    let target = 60;
    if (n.food > 50) target += 8;
    else if (n.food < 20) target -= 15;
    if (n.social > 50) target += 8;
    else if (n.social < 15) target -= 10;
    if (n.energy < 15) target -= 8;
    if (n.health < 40) target -= 10;
    if (s.shortages.oxygen || s.shortages.water) target -= 12 * traitMod(c.traits, 'moraleHit');
    if (s.events.active.some((e) => e.defId === 'festival')) target += 15;
    n.morale = clamp(n.morale + (target - n.morale) * 0.2);

    if (n.health <= 0) {
      const cause = s.shortages.oxygen
        ? 'asphyxiation'
        : n.food <= 0
          ? 'starvation'
          : c.ill
            ? 'illness'
            : 'organ failure';
      kill(s, c, cause, rng);
    }
  }
}
