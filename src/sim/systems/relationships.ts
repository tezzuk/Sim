import { traitMod } from '../genetics';
import type { Rng } from '../rng';
import { type ColonyState, type Colonist, ageYears, chronicle } from '../state';

const MAX_RELS = 8;

function rel(c: Colonist, otherId: number) {
  return c.relationships.find((r) => r.otherId === otherId);
}

function bump(c: Colonist, otherId: number, kind: 'friend' | 'rival', delta: number): void {
  const existing = rel(c, otherId);
  if (existing) {
    existing.value = Math.max(-100, Math.min(100, existing.value + delta));
  } else if (c.relationships.length < MAX_RELS) {
    c.relationships.push({ otherId, kind, value: delta });
  }
}

/** Per sol: light-touch social fabric — partnering, friendships, drift. */
export function relationshipsSol(s: ColonyState, rng: Rng): void {
  const alive = s.colonists.filter((c) => c.alive);
  const byId = new Map(alive.map((c) => [c.id, c]));

  // partner matching among single adults
  const singles = alive.filter(
    (c) =>
      c.partnerId === null &&
      (c.stage === 'adult' || c.stage === 'elder') &&
      ageYears(s, c) >= 18 &&
      ageYears(s, c) <= 48,
  );
  for (const c of singles) {
    if (c.partnerId !== null || !rng.chance(0.035)) continue;
    const candidates = singles.filter(
      (o) =>
        o.id !== c.id &&
        o.partnerId === null &&
        o.sex !== c.sex &&
        !c.parents?.includes(o.id) &&
        !o.parents?.includes(c.id) &&
        !(c.parents && o.parents && c.parents[0] === o.parents[0]),
    );
    if (candidates.length === 0) continue;
    candidates.sort(
      (a, b) =>
        (rel(c, b.id)?.value ?? 0) - (rel(c, a.id)?.value ?? 0) || a.id - b.id,
    );
    const partner = candidates[0];
    c.partnerId = partner.id;
    partner.partnerId = c.id;
    const v = 50;
    const exC = rel(c, partner.id);
    if (exC) {
      exC.kind = 'partner';
      exC.value = Math.max(exC.value, v);
    } else c.relationships.push({ otherId: partner.id, kind: 'partner', value: v });
    const exP = rel(partner, c.id);
    if (exP) {
      exP.kind = 'partner';
      exP.value = Math.max(exP.value, v);
    } else partner.relationships.push({ otherId: c.id, kind: 'partner', value: v });
    const playerInvolved =
      c.id === s.player.colonistId || partner.id === s.player.colonistId;
    chronicle(
      s,
      'partner',
      `${c.name} ${c.family} and ${partner.name} ${partner.family} become partners.`,
      playerInvolved ? 2 : 0,
    );
  }

  // coworker/classmate bonds: a few random co-located pairs warm up
  const groups = new Map<string, Colonist[]>();
  for (const c of alive) {
    if (c.stage === 'infant') continue;
    const key =
      c.ai.state === 'working' && c.job
        ? `b${c.job.buildingId}`
        : c.ai.state === 'learning'
          ? 'school'
          : c.ai.state === 'social'
            ? `s${Math.round(c.x / 6)}:${Math.round(c.y / 6)}`
            : '';
    if (!key) continue;
    const g = groups.get(key) ?? [];
    g.push(c);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (let i = 0; i < Math.min(3, g.length); i++) {
      const a = g[rng.int(g.length)];
      const b = g[rng.int(g.length)];
      if (a.id === b.id) continue;
      const warmth = 2 * traitMod(a.traits, 'empathy') * (rng.chance(0.06) ? -3 : 1);
      bump(a, b.id, warmth < 0 ? 'rival' : 'friend', warmth);
      bump(b, a.id, warmth < 0 ? 'rival' : 'friend', warmth);
    }
  }

  // drift toward zero; prune cold acquaintances
  for (const c of alive) {
    for (const r of c.relationships) {
      if (r.kind === 'friend' || r.kind === 'rival') {
        r.value -= Math.sign(r.value) * 0.4;
      }
      // dead references decay fast
      if (!byId.has(r.otherId)) r.value -= 2;
    }
    c.relationships = c.relationships.filter(
      (r) => !((r.kind === 'friend' || r.kind === 'rival') && Math.abs(r.value) < 4),
    );
  }
}
