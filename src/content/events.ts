import { TICKS_PER_SOL } from '../sim/constants';
import type { Rng } from '../sim/rng';
import type { ColonyState, EraId } from '../sim/state';

export interface EventDef {
  name: string;
  /** Relative roll weight per era (default 1). */
  weight: Partial<Record<EraId, number>>;
  /** Timed events stay in events.active for a rolled number of sols. */
  durationSols?: [number, number];
  /** Base effect at fire time. Returns the chronicle line. */
  apply: (s: ColonyState, rng: Rng) => string;
  /** Optional decision card shown to the player (online only). */
  decision?: {
    title: string;
    body: string;
    options: [{ label: string; desc: string }, { label: string; desc: string }];
  };
}

function randomBuilding(s: ColonyState, rng: Rng, staffedOnly = false) {
  const pool = s.buildings.filter((b) => !staffedOnly || b.workers.length > 0);
  return pool.length ? pool[rng.int(pool.length)] : undefined;
}

export const EVENTS: Record<string, EventDef> = {
  dustStorm: {
    name: 'Dust Storm',
    weight: { landing: 1.2, establishment: 1.2, expansion: 1, terraforming: 0.7 },
    durationSols: [3, 5],
    apply: () =>
      'A dust storm rolls over the dome. Solar output drops 40% until the sky clears.',
  },
  outbreak: {
    name: 'Pathogen Outbreak',
    weight: { landing: 0.6, establishment: 1, expansion: 1.2, terraforming: 1 },
    durationSols: [4, 4],
    apply: () => 'A pathogen spreads through the habitats. Illness is rampant.',
    decision: {
      title: 'Outbreak in the habitats',
      body: 'The med bay is overwhelmed and calling for volunteers.',
      options: [
        {
          label: 'Volunteer in the med bay',
          desc: '+250 Medicine XP, but a 30% chance of falling ill yourself.',
        },
        { label: 'Keep your distance', desc: 'Stay safe. The medics manage.' },
      ],
    },
  },
  meteorStrike: {
    name: 'Meteor Strike',
    weight: { landing: 1, establishment: 1, expansion: 1, terraforming: 1 },
    apply: (s, rng) => {
      const b = randomBuilding(s, rng);
      if (!b) return 'A meteor shatters on the plain outside. No damage.';
      b.condition = Math.max(10, b.condition - 50);
      b.offlineUntilTick = s.tick + 2 * TICKS_PER_SOL;
      return `A meteorite punches through the ${b.defId} — it goes offline for repairs.`;
    },
    decision: {
      title: 'Meteor strike!',
      body: 'Something hit the dome. The repair crew is assembling.',
      options: [
        {
          label: 'Lead the repair crew',
          desc: '+250 Engineering XP, +8 Influence, repairs finish a sol sooner.',
        },
        { label: 'Leave it to the engineers', desc: 'They know what they’re doing.' },
      ],
    },
  },
  supplyPod: {
    name: 'Supply Pod',
    weight: { landing: 1.4, establishment: 1, expansion: 0.7, terraforming: 0.4 },
    apply: (s) => {
      s.resources.materials.amount = Math.min(
        s.resources.materials.cap,
        s.resources.materials.amount + 60,
      );
      s.resources.biomass.amount = Math.min(
        s.resources.biomass.cap,
        s.resources.biomass.amount + 40,
      );
      return 'An automated supply pod lands outside the airlock: +60 materials, +40 biomass.';
    },
  },
  breakthrough: {
    name: 'Breakthrough',
    weight: { landing: 1, establishment: 1, expansion: 1, terraforming: 1 },
    apply: (s) => {
      if (s.research.current) {
        s.research.current.progress += 60;
        return 'A late-night insight pushes the current research forward.';
      }
      s.resources.science.amount = Math.min(
        s.resources.science.cap,
        s.resources.science.amount + 80,
      );
      return 'A late-night insight yields a trove of useful data (+80 science).';
    },
  },
  solarFlare: {
    name: 'Solar Flare',
    weight: { landing: 1, establishment: 1, expansion: 1, terraforming: 1 },
    apply: (s, rng) => {
      s.resources.power.amount *= 0.5;
      const solar = s.buildings.filter((b) => b.defId === 'solar');
      if (solar.length) {
        const b = solar[rng.int(solar.length)];
        b.offlineUntilTick = s.tick + TICKS_PER_SOL;
      }
      return 'A solar flare scrambles the grid: stored power halved, an array knocked offline.';
    },
  },
  equipmentFailure: {
    name: 'Equipment Failure',
    weight: { landing: 1.2, establishment: 1, expansion: 0.9, terraforming: 0.8 },
    apply: (s, rng) => {
      const b = randomBuilding(s, rng, true);
      if (!b) return 'A worrying rattle in the pipes turns out to be nothing.';
      b.offlineUntilTick = s.tick + Math.floor(1.5 * TICKS_PER_SOL);
      return `The ${b.defId} grinds to a halt — offline a sol and a half for repairs.`;
    },
  },
  birthSurge: {
    name: 'Baby Boom',
    weight: { landing: 0.8, establishment: 1.2, expansion: 1, terraforming: 1 },
    durationSols: [5, 5],
    apply: () => 'Optimism sweeps the colony. Couples are starting families.',
  },
  festival: {
    name: 'Founding Festival',
    weight: { landing: 1, establishment: 1.2, expansion: 1, terraforming: 1 },
    durationSols: [2, 2],
    apply: () => 'The colony declares a festival. Morale soars for two sols.',
    decision: {
      title: 'Founding Festival',
      body: 'The stewards ask if you will host this year’s festival.',
      options: [
        { label: 'Host the festival', desc: 'Spend 10 biomass on the feast: +12 Influence.' },
        { label: 'Just attend', desc: 'Enjoy the evening. +4 Influence.' },
      ],
    },
  },
  waterLeak: {
    name: 'Water Leak',
    weight: { landing: 1.2, establishment: 1, expansion: 0.8, terraforming: 0.6 },
    apply: (s) => {
      s.resources.water.amount *= 0.7;
      return 'A reclaimer seal fails overnight — 30% of stored water lost.';
    },
  },
  surveyShip: {
    name: 'Survey Ship',
    weight: { landing: 0.5, establishment: 1, expansion: 1.2, terraforming: 1.2 },
    apply: () => 'An unscheduled survey ship enters orbit and hails the colony.',
    decision: {
      title: 'Survey ship in orbit',
      body: 'The crew offers their planetary scans — for fresh produce.',
      options: [
        { label: 'Trade 40 biomass', desc: '+200 science.' },
        { label: 'Decline politely', desc: 'They share a courtesy packet anyway: +100 science.' },
      ],
    },
  },
  quake: {
    name: 'Seismic Tremor',
    weight: { landing: 1, establishment: 1, expansion: 1, terraforming: 1.2 },
    apply: (s, rng) => {
      for (let i = 0; i < 2; i++) {
        const b = randomBuilding(s, rng);
        if (b) b.condition = Math.max(15, b.condition - 25);
      }
      const b = randomBuilding(s, rng);
      if (b) b.offlineUntilTick = s.tick + TICKS_PER_SOL;
      return 'The ground shudders. Cracked panels and rattled nerves across the dome.';
    },
  },
};
