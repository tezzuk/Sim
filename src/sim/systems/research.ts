import { RESEARCH } from '../../content/research';
import { playerColonist, type ColonyState, chronicle } from '../state';

/** Per sol: pour stored science into the current node; apply era gates. */
export function researchSol(s: ColonyState): void {
  const cur = s.research.current;
  if (!cur) return;
  const def = RESEARCH[cur.id];
  if (!def) {
    s.research.current = null;
    return;
  }
  const take = Math.min(s.resources.science.amount, def.cost - cur.progress);
  s.resources.science.amount -= take;
  cur.progress += take;
  if (cur.progress >= def.cost) {
    s.research.completed.push(cur.id);
    s.research.current = null;
    chronicle(s, 'research', `Breakthrough: ${def.name}. ${def.desc}`, 1);
    if (def.gatesEra && def.gatesEra !== s.era) {
      s.era = def.gatesEra;
      if (def.gatesEra === 'expansion') s.annexUnlocked = true;
      chronicle(s, 'era', `A new era for the colony: ${def.gatesEra.toUpperCase()}.`, 2);
    }
    // aspiration counter: research patron
    const p = playerColonist(s);
    if (p?.aspiration && !p.aspiration.done && p.aspiration.id === 'researchPatron') {
      p.aspiration.progress++;
    }
  }
}
