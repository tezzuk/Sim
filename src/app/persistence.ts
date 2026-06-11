import { BACKUP_KEY, SAVE_KEY, SAVE_VERSION } from '../sim/constants';
import { Sim } from '../sim/sim';
import type { ColonyState } from '../sim/state';
import { rebuildMap } from '../sim/worldgen';

// Saves are versioned JSON. The map (tiles/rooms) is NOT stored — it is
// deterministic from the seed and rebuilt on load.

interface SaveFile {
  v: number;
  savedAt: number;
  state: Omit<ColonyState, 'map'> & { map: null };
}

const migrations: Record<number, (s: unknown) => unknown> = {
  // 1 → 2 would go here, with a frozen fixture save in src/tests/fixtures
};

export function serialize(sim: Sim): string {
  sim.syncRng();
  sim.state.lastSimWallClock = Date.now();
  const file: SaveFile = {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    state: { ...sim.state, map: null },
  };
  return JSON.stringify(file);
}

export function deserialize(json: string): Sim {
  const file = JSON.parse(json) as SaveFile;
  if (typeof file?.v !== 'number' || !file.state) throw new Error('Not a Lineage save');
  if (file.v > SAVE_VERSION) throw new Error('Save was made by a newer version');
  let raw: unknown = file.state;
  for (let v = file.v; v < SAVE_VERSION; v++) raw = migrations[v]?.(raw) ?? raw;
  const state = raw as ColonyState;
  state.map = { tiles: new Uint8Array(0), rooms: [] };
  rebuildMap(state);
  return new Sim(state);
}

export function saveLocal(sim: Sim): boolean {
  try {
    const json = serialize(sim);
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch (e) {
    console.warn('autosave failed', e);
    return false;
  }
}

export function loadLocal(): Sim | null {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    const json = localStorage.getItem(key);
    if (!json) continue;
    try {
      return deserialize(json);
    } catch (e) {
      console.warn(`save in ${key} unreadable`, e);
    }
  }
  return null;
}

export function clearSaves(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(BACKUP_KEY);
}

/** Portable save string (move between iPhone and Windows via copy/paste). */
export function exportString(sim: Sim): string {
  const bytes = new TextEncoder().encode(serialize(sim));
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return 'LNG1.' + btoa(bin);
}

export function importString(str: string): Sim {
  const t = str.trim();
  if (!t.startsWith('LNG1.')) throw new Error('Not a Lineage save string');
  const bin = atob(t.slice(5));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return deserialize(new TextDecoder().decode(bytes));
}
