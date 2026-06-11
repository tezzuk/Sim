export interface LegacyDef {
  name: string;
  cost: number;
  desc: string;
  /** True when the effect only applies to colonies founded after purchase. */
  nextColony: boolean;
}

export const LEGACY: Record<string, LegacyDef> = {
  geneArchive: {
    name: 'Gene Archive',
    cost: 10,
    desc: 'Founders of future colonies start with stronger genomes (+4 to every allele).',
    nextColony: true,
  },
  mentorshipProtocols: {
    name: 'Mentorship Protocols',
    cost: 15,
    desc: 'Heirs can inherit up to 70% (instead of 60%) of your lifework.',
    nextColony: false,
  },
  cryoSeedVault: {
    name: 'Cryo Seed Vault',
    cost: 10,
    desc: 'Future colonies start with +50% biomass stores.',
    nextColony: true,
  },
  fusionBlueprints: {
    name: 'Fusion Blueprints',
    cost: 25,
    desc: 'Future colonies start with Fusion Power already researched.',
    nextColony: true,
  },
  foundersMemory: {
    name: "Founders' Memory",
    cost: 20,
    desc: 'On Ascension, keep one completed research per ten finished.',
    nextColony: true,
  },
  resilientStock: {
    name: 'Resilient Stock',
    cost: 15,
    desc: 'Halves the chance of negative traits expressing in newborns.',
    nextColony: false,
  },
  veteranCrew: {
    name: 'Veteran Crew',
    cost: 12,
    desc: 'Founders of future colonies start with +2 levels in their primary skill.',
    nextColony: true,
  },
  orbitalRelay: {
    name: 'Orbital Relay',
    cost: 18,
    desc: '+10% science output, in this colony and all future ones.',
    nextColony: false,
  },
};
