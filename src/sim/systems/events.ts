import { EVENTS } from '../../content/events';
import { EVENT_CHANCE_PER_SOL, TICKS_PER_SOL } from '../constants';
import type { Rng } from '../rng';
import { type ColonyState, chronicle, playerColonist } from '../state';
import { levelFromXp } from '../worldgen';

/** Per sol: expire timed events, roll the deck, surface decision cards. */
export function eventsSol(s: ColonyState, rng: Rng): void {
  s.events.active = s.events.active.filter((e) => s.tick < e.untilTick);

  // pending decision goes stale after a sol → auto-resolve the safe option
  if (s.decision && s.tick - s.decision.createdTick >= TICKS_PER_SOL) {
    resolveDecision(s, 1, rng);
  }

  if (!rng.chance(EVENT_CHANCE_PER_SOL)) return;

  const entries = Object.entries(EVENTS);
  const weights = entries.map(([, def]) => def.weight[s.era] ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  let picked = entries[0];
  for (let i = 0; i < entries.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      picked = entries[i];
      break;
    }
  }
  const [defId, def] = picked;

  // don't stack the same timed event
  if (def.durationSols && s.events.active.some((e) => e.defId === defId)) return;

  const text = def.apply(s, rng);
  if (def.durationSols) {
    const sols = def.durationSols[0] + rng.int(def.durationSols[1] - def.durationSols[0] + 1);
    s.events.active.push({ defId, untilTick: s.tick + sols * TICKS_PER_SOL });
  }
  chronicle(s, 'event', text, 1);

  const player = playerColonist(s);
  if (def.decision && player?.alive && !s.decision && !s.succession) {
    s.decision = {
      defId,
      title: def.decision.title,
      body: def.decision.body,
      options: def.decision.options,
      createdTick: s.tick,
    };
  }
}

/** Apply the chosen option of the pending decision card. */
export function resolveDecision(s: ColonyState, choice: number, rng: Rng): boolean {
  const d = s.decision;
  if (!d) return false;
  s.decision = null;
  const p = playerColonist(s);
  if (!p?.alive) return true;

  const gain = (skill: 'medicine' | 'engineering', xp: number): void => {
    p.skills[skill].xp += xp;
    p.skills[skill].level = levelFromXp(p.skills[skill].xp);
  };

  switch (d.defId) {
    case 'outbreak':
      if (choice === 0) {
        gain('medicine', 250);
        if (rng.chance(0.3)) {
          p.ill = true;
          chronicle(s, 'decision', `${p.name} volunteers in the med bay — and catches the pathogen.`, 1);
        } else {
          chronicle(s, 'decision', `${p.name} volunteers in the med bay and earns the colony's gratitude.`, 1);
        }
      }
      break;
    case 'meteorStrike':
      if (choice === 0) {
        gain('engineering', 250);
        s.player.influence += 8;
        for (const b of s.buildings) {
          if (b.offlineUntilTick > s.tick) {
            b.offlineUntilTick = Math.max(s.tick, b.offlineUntilTick - TICKS_PER_SOL);
          }
        }
        chronicle(s, 'decision', `${p.name} leads the repair crew through the night.`, 1);
      }
      break;
    case 'festival':
      if (choice === 0 && s.resources.biomass.amount >= 10) {
        s.resources.biomass.amount -= 10;
        s.player.influence += 12;
        chronicle(s, 'decision', `${p.name} hosts a feast the colony will remember.`, 1);
      } else {
        s.player.influence += 4;
      }
      break;
    case 'surveyShip':
      if (choice === 0 && s.resources.biomass.amount >= 40) {
        s.resources.biomass.amount -= 40;
        s.resources.science.amount = Math.min(
          s.resources.science.cap,
          s.resources.science.amount + 200,
        );
        chronicle(s, 'decision', 'Fresh produce for planetary scans — a fine trade.', 1);
      } else {
        s.resources.science.amount = Math.min(
          s.resources.science.cap,
          s.resources.science.amount + 100,
        );
      }
      break;
  }
  return true;
}
