// Trait definitions. `mods` are multipliers applied via genetics.traitMod:
//   o2Use, foodUse, xpGain, influence, healthMax, lifespan, walkDelay,
//   socialDecay, botany, medicine, fabrication, science, engineering, moraleHit
export interface TraitDef {
  name: string;
  desc: string;
  good: -1 | 0 | 1;
  quirk?: boolean;
  mods: Record<string, number>;
}

export const TRAITS: Record<string, TraitDef> = {
  ironLungs: { name: 'Iron Lungs', desc: 'Breathes 20% less oxygen.', good: 1, mods: { o2Use: 0.8 } },
  greenThumb: { name: 'Green Thumb', desc: '+25% botany output.', good: 1, mods: { botany: 1.25 } },
  brilliant: { name: 'Brilliant', desc: '+20% skill XP gain.', good: 1, mods: { xpGain: 1.2 } },
  charismatic: { name: 'Charismatic', desc: '+20% influence gain.', good: 1, mods: { influence: 1.2 } },
  steadyHands: {
    name: 'Steady Hands',
    desc: '+15% fabrication and medicine output.',
    good: 1,
    mods: { fabrication: 1.15, medicine: 1.15 },
  },
  hardy: { name: 'Hardy', desc: '+15% max health.', good: 1, mods: { healthMax: 1.15 } },
  quick: { name: 'Quick', desc: 'Walks 25% faster.', good: 1, mods: { walkDelay: 0.75 } },
  empath: { name: 'Empath', desc: 'Social need decays 30% slower.', good: 1, mods: { socialDecay: 0.7 } },

  sickly: { name: 'Sickly', desc: '-15% max health.', good: -1, mods: { healthMax: 0.85 } },
  frail: { name: 'Frail', desc: 'Shorter expected lifespan.', good: -1, mods: { lifespan: 0.85 } },
  anxious: { name: 'Anxious', desc: 'Suffers more morale damage from events.', good: -1, mods: { moraleHit: 1.5 } },
  glutton: { name: 'Glutton', desc: 'Eats 50% more food.', good: -1, mods: { foodUse: 1.5 } },
  loner: { name: 'Loner', desc: 'Social need decays 50% faster.', good: -1, mods: { socialDecay: 1.5 } },

  nightOwl: { name: 'Night Owl', desc: 'Keeps odd hours.', good: 0, quirk: true, mods: {} },
  wanderer: { name: 'Wanderer', desc: 'Roams the dome when idle.', good: 0, quirk: true, mods: {} },
  sweetTooth: { name: 'Sweet Tooth', desc: 'Lingers in the canteen.', good: 0, quirk: true, mods: {} },
};

/** Positive/negative trait expressed when a locus phenotype is extreme. */
export const TRAIT_BY_LOCUS: Record<string, { high?: string; low?: string }> = {
  vitality: { high: 'hardy', low: 'sickly' },
  intellect: { high: 'brilliant', low: undefined },
  dexterity: { high: 'steadyHands', low: 'frail' },
  empathy: { high: 'empath', low: 'loner' },
  resilience: { high: 'ironLungs', low: 'anxious' },
  fertility: {},
  metabolism: { high: undefined, low: 'glutton' },
  curiosity: { high: 'charismatic', low: undefined },
};
