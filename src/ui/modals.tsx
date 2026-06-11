import { ASPIRATIONS } from '../content/aspirations';
import { TICKS_PER_SOL } from '../sim/constants';
import { cmdApplySuccession, cmdChooseAspiration, cmdDecide } from '../sim/commands';
import { SKILLS, type ColonyState, colonistById, ageYears } from '../sim/state';
import { levelFromXp } from '../sim/worldgen';
import { aspirationDeferred, awayReport, refreshUi, simRef } from './store';

export function WelcomeBackModal() {
  const r = awayReport.value!;
  return (
    <div class="modal-veil">
      <div class="modal">
        <h2>While you were away…</h2>
        <p class="sub">
          {r.sols} sols passed ({r.years} years). Population {r.popBefore} → {r.popAfter} ·{' '}
          {r.births} born · {r.deaths} died.
        </p>
        {r.playerChanged && (
          <div class="life-summary">
            <b>Your colonist died while you were gone.</b> The line continued through the
            designated heir — see the chronicle for the succession.
          </div>
        )}
        <div class="chronicle">
          {r.entries.map((e, i) => (
            <div key={i} class={`entry sev${e.severity}`}>
              <small>Sol {Math.floor(e.tick / TICKS_PER_SOL) + 1}</small> {e.text}
            </div>
          ))}
        </div>
        <button class="btn" onClick={() => (awayReport.value = null)}>
          Continue
        </button>
      </div>
    </div>
  );
}

export function DecisionModal({ s }: { s: ColonyState }) {
  const sim = simRef.current!;
  const d = s.decision!;
  return (
    <div class="modal-veil">
      <div class="modal">
        <h2>{d.title}</h2>
        <p class="sub">{d.body}</p>
        {d.options.map((o, i) => (
          <button
            key={i}
            class="option"
            onClick={() => {
              cmdDecide(sim, i);
              refreshUi();
            }}
          >
            <b>{o.label}</b>
            <small>{o.desc}</small>
          </button>
        ))}
        <p class="sub">Undecided choices resolve themselves after a sol.</p>
      </div>
    </div>
  );
}

export function AspirationModal({ s }: { s: ColonyState }) {
  const sim = simRef.current!;
  const choices = s.player.aspirationChoices ?? [];
  return (
    <div class="modal-veil">
      <div class="modal">
        <h2>Choose your life's aspiration</h2>
        <p class="sub">Fulfilling it grants Influence and Legacy.</p>
        {choices.map((id) => {
          const def = ASPIRATIONS[id];
          if (!def) return null;
          return (
            <button
              key={id}
              class="option"
              onClick={() => {
                cmdChooseAspiration(sim, id);
                refreshUi();
              }}
            >
              <b>★ {def.name}</b>
              <small>{def.desc}</small>
              <small class="reward">
                Reward: {def.rewardInfluence > 0 ? `◆${def.rewardInfluence} ` : ''}✦{def.rewardLegacy}
              </small>
            </button>
          );
        })}
        <button class="btn ghost" onClick={() => (aspirationDeferred.value = true)}>
          Decide later
        </button>
      </div>
    </div>
  );
}

export function HeirModal({ s }: { s: ColonyState }) {
  const sim = simRef.current!;
  const succ = s.succession!;
  const sum = succ.lifeSummary;
  const skills = SKILLS.filter((k) => (sum.skills[k] ?? 0) >= 100)
    .sort((a, b) => (sum.skills[b] ?? 0) - (sum.skills[a] ?? 0))
    .slice(0, 3)
    .map((k) => `${k} ${levelFromXp(sum.skills[k] ?? 0)}`)
    .join(', ');

  return (
    <div class="modal-veil">
      <div class="modal">
        <h2>{succ.deceasedName} has died</h2>
        <p class="sub">
          {succ.deceasedCause}, aged {succ.deceasedAgeYears}.
        </p>
        <div class="life-summary">
          <div>Life {s.player.lifeNumber} comes to an end.</div>
          {skills && <div>Mastery: {skills}</div>}
          <div>
            Influence held: {Math.floor(sum.influence)} · Children: {sum.children}
          </div>
          {sum.aspiration && (
            <div>
              Aspiration “{sum.aspiration}”: {sum.aspirationDone ? 'fulfilled ✓' : 'unfulfilled ✗'}
            </div>
          )}
        </div>
        <p class="sub">
          <b>Choose who carries the line forward.</b> They inherit a share of skills and 30% of influence.
        </p>
        {succ.options.length === 0 && (
          <p class="sub">No one remains to carry the line. Open Settings to found a new colony.</p>
        )}
        {succ.options.map((o) => {
          const c = colonistById(s, o.id);
          if (!c?.alive) return null;
          return (
            <button
              key={o.id}
              class="option"
              onClick={() => {
                cmdApplySuccession(sim, o.id);
                refreshUi();
              }}
            >
              <b>
                {c.name} {c.family}
              </b>
              <small>
                {o.reason} · {Math.floor(ageYears(s, c))}y · {c.stage} · inherits {Math.round(o.fraction * 100)}%
                {s.player.designatedHeirId === o.id ? ' · designated' : ''}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
