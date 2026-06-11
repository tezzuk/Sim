import { fastForwardSols } from '../sim/coarse/fastForward';
import { TICK_MS, TICKS_PER_SOL, TICKS_PER_YEAR, TIER_A_MAX_TICKS } from '../sim/constants';
import type { Sim } from '../sim/sim';
import type { ChronicleEntry } from '../sim/state';

export interface AwayReport {
  sols: number;
  years: number;
  popBefore: number;
  popAfter: number;
  births: number;
  deaths: number;
  playerChanged: boolean;
  entries: ChronicleEntry[];
}

/**
 * Advance the sim by however long the game was closed (uncapped).
 * Tier A (≤5 min): exact tick replay. Tier B: coarse per-sol statistical sim.
 * Returns a "while you were away" report when the gap is worth reporting.
 */
export function catchUp(sim: Sim): AwayReport | null {
  const s = sim.state;
  const now = Date.now();
  const gapMs = Math.max(0, now - s.lastSimWallClock);
  s.lastSimWallClock = now;
  if (s.speed === 0 || s.succession) return null; // pause persists offline
  const gapTicks = Math.floor(gapMs / TICK_MS);
  if (gapTicks < 600) return null; // under a minute: not worth simulating

  const startTick = s.tick;
  const popBefore = s.colonists.filter((c) => c.alive).length;
  const playerBefore = s.player.colonistId;
  const birthsBefore = s.stats.totalBirths;
  const deathsBefore = s.stats.totalDeaths;

  if (gapTicks <= TIER_A_MAX_TICKS) {
    for (let i = 0; i < gapTicks; i++) sim.tick();
  } else {
    const sols = Math.floor(gapTicks / TICKS_PER_SOL);
    if (sols > 0) fastForwardSols(sim, sols);
    const rem = Math.min(gapTicks - sols * TICKS_PER_SOL, TIER_A_MAX_TICKS);
    for (let i = 0; i < rem; i++) sim.tick();
  }

  const ticksPassed = s.tick - startTick;
  if (gapMs < 30 * 60_000) return null; // short break: resume silently

  const entries = s.chronicle
    .filter((e) => e.tick > startTick)
    .sort((a, b) => b.severity - a.severity || b.tick - a.tick)
    .slice(0, 14)
    .sort((a, b) => a.tick - b.tick);

  return {
    sols: Math.round(ticksPassed / TICKS_PER_SOL),
    years: Math.round((ticksPassed / TICKS_PER_YEAR) * 10) / 10,
    popBefore,
    popAfter: s.colonists.filter((c) => c.alive).length,
    births: s.stats.totalBirths - birthsBefore,
    deaths: s.stats.totalDeaths - deathsBefore,
    playerChanged: s.player.colonistId !== playerBefore,
    entries,
  };
}
