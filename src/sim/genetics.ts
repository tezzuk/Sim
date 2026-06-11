import {
  GENE_LOCI,
  MUTATION_CHANCE,
  MUTATION_SD,
  PHENO_BONUS_PER_POINT,
  TRAIT_EXPRESS_CHANCE,
  TRAIT_EXPRESS_HI,
  TRAIT_EXPRESS_LO,
  TRAIT_MUTATION_CHANCE,
} from './constants';
import type { Rng } from './rng';
import { TRAITS, TRAIT_BY_LOCUS } from '../content/traits';

export type LocusId =
  | 'vitality'
  | 'intellect'
  | 'dexterity'
  | 'empathy'
  | 'resilience'
  | 'fertility'
  | 'metabolism'
  | 'curiosity';

export const LOCI: LocusId[] = [
  'vitality',
  'intellect',
  'dexterity',
  'empathy',
  'resilience',
  'fertility',
  'metabolism',
  'curiosity',
];

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Fresh genome around a quality midpoint (founders, relief crews). */
export function newGenome(rng: Rng, quality = 52): number[] {
  const g: number[] = [];
  for (let i = 0; i < GENE_LOCI * 2; i++) g.push(clamp(Math.round(rng.gauss(quality, 14))));
  return g;
}

/** Mean of the two alleles at a locus. */
export function phenotype(genome: number[], locus: LocusId): number {
  const i = LOCI.indexOf(locus) * 2;
  return (genome[i] + genome[i + 1]) / 2;
}

/** Multiplier centered at 1.0 for phenotype 50 (±0.6%/point). */
export function phenoMult(genome: number[], locus: LocusId): number {
  return 1 + (phenotype(genome, locus) - 50) * PHENO_BONUS_PER_POINT;
}

/** One allele per locus from each parent, with per-allele gaussian mutation. */
export function inheritGenome(rng: Rng, mom: number[], dad: number[]): number[] {
  const child: number[] = [];
  for (let l = 0; l < GENE_LOCI; l++) {
    const fromMom = mom[l * 2 + rng.int(2)];
    const fromDad = dad[l * 2 + rng.int(2)];
    for (let allele of [fromMom, fromDad]) {
      if (rng.chance(MUTATION_CHANCE)) allele = clamp(Math.round(allele + rng.gauss(0, MUTATION_SD)));
      child.push(allele);
    }
  }
  return child;
}

/** Roll expressed traits for a newborn (or founder) from genome + parent quirks. */
export function expressTraits(rng: Rng, genome: number[], parentTraits: string[] = []): string[] {
  const traits: string[] = [];
  for (const locus of LOCI) {
    const p = phenotype(genome, locus);
    const pair = TRAIT_BY_LOCUS[locus];
    if (!pair) continue;
    if (p >= TRAIT_EXPRESS_HI && pair.high && rng.chance(TRAIT_EXPRESS_CHANCE)) traits.push(pair.high);
    else if (p <= TRAIT_EXPRESS_LO && pair.low && rng.chance(TRAIT_EXPRESS_CHANCE)) traits.push(pair.low);
  }
  // heritable quirks pass through half the time
  for (const t of parentTraits) {
    if (TRAITS[t]?.quirk && rng.chance(0.5) && !traits.includes(t)) traits.push(t);
  }
  // spontaneous trait mutation
  if (rng.chance(TRAIT_MUTATION_CHANCE)) {
    const all = Object.keys(TRAITS);
    const t = rng.pick(all);
    if (!traits.includes(t)) traits.push(t);
  }
  return traits.slice(0, 3);
}

/** Product of a colonist's trait multipliers for a given modifier key. */
export function traitMod(traits: string[], key: string): number {
  let m = 1;
  for (const t of traits) {
    const def = TRAITS[t];
    if (def?.mods[key] !== undefined) m *= def.mods[key];
  }
  return m;
}
