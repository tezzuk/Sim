import { signal } from '@preact/signals';
import type { AwayReport } from '../app/offline';
import type { Sim } from '../sim/sim';
import type { Selection } from '../render/renderer';

/** The live sim — set once by main.ts at boot. */
export const simRef: { current: Sim | null } = { current: null };

/** Bumped a few times per second; components read it to re-render from sim state. */
export const uiTick = signal(0);
export const refreshUi = (): void => {
  uiTick.value++;
};

export const selection = signal<Selection>(null);
export type SheetId = 'none' | 'chronicle' | 'research' | 'settings' | 'legend' | 'legacy';
export const activeSheet = signal<SheetId>('none');
export const aspirationDeferred = signal(false);
export const awayReport = signal<AwayReport | null>(null);

/** Set by main.ts: centers the camera on the player's colonist. */
export const centerOnPlayer: { current: () => void } = { current: () => {} };
