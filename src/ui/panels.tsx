import { BUILDINGS } from '../content/buildings';
import { JOBS } from '../content/jobs';
import { RESEARCH, eraIndex } from '../content/research';
import { TRAITS } from '../content/traits';
import {
  cmdDesignateHeir,
  cmdQuitJob,
  cmdSetEducationFocus,
  cmdSetMentor,
  cmdSetResearch,
  cmdTakeJob,
} from '../sim/commands';
import { TICKS_PER_SOL } from '../sim/constants';
import { LOCI, phenotype } from '../sim/genetics';
import { exportString, importString, saveLocal, clearSaves } from '../app/persistence';
import { newColony } from '../sim/worldgen';
import { Sim } from '../sim/sim';
import {
  type Building,
  type ColonyState,
  type Colonist,
  type JobId,
  SKILLS,
  ageYears,
  buildingById,
  colonistById,
} from '../sim/state';
import { activeSheet, refreshUi, selection, simRef } from './store';
import { useState } from 'preact/hooks';

function Bar({ v, max = 100, cls = '' }: { v: number; max?: number; cls?: string }) {
  return (
    <div class={`bar ${cls}`}>
      <div class="fill" style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%` }} />
    </div>
  );
}

function ColonistView({ s, c }: { s: ColonyState; c: Colonist }) {
  const sim = simRef.current!;
  const [showJobs, setShowJobs] = useState(false);
  const isPlayer = c.id === s.player.colonistId;
  const age = Math.floor(ageYears(s, c));
  const young = ageYears(s, c) <= 30 && c.stage !== 'infant';

  return (
    <div class="panel-body">
      <div class="head">
        <b>
          {c.name} {c.family}
        </b>
        <span class="tags">
          {isPlayer && <span class="tag gold">YOU</span>}
          {s.player.mentorId === c.id && <span class="tag">protégé</span>}
          {s.player.designatedHeirId === c.id && <span class="tag">heir</span>}
          {c.ill && <span class="tag red">ill</span>}
          {c.pregnantUntilTick !== null && <span class="tag">expecting</span>}
        </span>
      </div>
      <div class="sub">
        {c.sex === 'F' ? '♀' : '♂'} {age}y · {c.stage}
        {c.job ? ` · ${JOBS[c.job.role].name} @ ${BUILDINGS[buildingById(s, c.job.buildingId)?.defId ?? 'habitat']?.name ?? ''}` : ''}
        {!c.alive && c.deathCause ? ` · died of ${c.deathCause}` : ''}
      </div>

      <div class="needs">
        {(
          [
            ['energy', '😴'],
            ['food', '🍽'],
            ['social', '💬'],
            ['health', '❤️'],
            ['morale', '☀️'],
          ] as const
        ).map(([k, icon]) => (
          <div key={k} class="need">
            <span>{icon}</span>
            <Bar v={c.needs[k]} cls={c.needs[k] < 25 ? 'low' : ''} />
          </div>
        ))}
      </div>

      {c.traits.length > 0 && (
        <div class="chips">
          {c.traits.map((t) => (
            <span key={t} class={`tag ${TRAITS[t]?.good === 1 ? 'green' : TRAITS[t]?.good === -1 ? 'red' : ''}`} title={TRAITS[t]?.desc}>
              {TRAITS[t]?.name ?? t}
            </span>
          ))}
        </div>
      )}

      <div class="skills">
        {SKILLS.map((k) => (
          <div key={k} class="skill">
            <span class="name">{k.slice(0, 3).toUpperCase()}</span>
            <b>{c.skills[k].level}</b>
            <Bar v={c.skills[k].xp - c.skills[k].level ** 2 * 100} max={((c.skills[k].level + 1) ** 2 - c.skills[k].level ** 2) * 100} />
          </div>
        ))}
      </div>

      <div class="genome" title="Genome (phenotype per locus)">
        {LOCI.map((l) => (
          <span key={l} class="locus" title={l}>
            {l.slice(0, 2).toUpperCase()}
            <b>{Math.round(phenotype(c.genome, l))}</b>
          </span>
        ))}
      </div>

      {c.relationships.length > 0 && (
        <div class="rels">
          {c.relationships
            .slice()
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
            .slice(0, 4)
            .map((r) => {
              const o = colonistById(s, r.otherId);
              if (!o) return null;
              return (
                <button
                  key={r.otherId}
                  class="rel"
                  onClick={() => (selection.value = { kind: 'colonist', id: r.otherId })}
                >
                  {o.name} <small>({r.kind} {Math.round(r.value)})</small>
                </button>
              );
            })}
        </div>
      )}

      {isPlayer && (c.stage === 'student' || c.stage === 'child') && (
        <div class="actions">
          <div class="label">Study focus:</div>
          <div class="chips">
            {SKILLS.map((k) => (
              <button
                key={k}
                class={`tag ${c.educationFocus === k ? 'gold' : ''}`}
                onClick={() => {
                  cmdSetEducationFocus(sim, k);
                  refreshUi();
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      )}

      {isPlayer && (c.stage === 'adult' || c.stage === 'elder') && (
        <div class="actions">
          <button class="btn" onClick={() => setShowJobs(!showJobs)}>
            {c.job ? 'Change job' : 'Take a job'}
          </button>
          {c.job && (
            <button
              class="btn ghost"
              onClick={() => {
                cmdQuitJob(sim);
                refreshUi();
              }}
            >
              Quit job
            </button>
          )}
          {showJobs && <JobPicker s={s} onPicked={() => setShowJobs(false)} />}
        </div>
      )}

      {!isPlayer && young && c.alive && (
        <div class="actions">
          <button
            class="btn"
            onClick={() => {
              cmdSetMentor(sim, s.player.mentorId === c.id ? null : c.id);
              refreshUi();
            }}
          >
            {s.player.mentorId === c.id ? 'Stop mentoring' : 'Mentor (raises inheritance)'}
          </button>
          <button
            class="btn ghost"
            onClick={() => {
              cmdDesignateHeir(sim, s.player.designatedHeirId === c.id ? null : c.id);
              refreshUi();
            }}
          >
            {s.player.designatedHeirId === c.id ? 'Clear heir' : 'Designate heir'}
          </button>
        </div>
      )}
    </div>
  );
}

function JobPicker({ s, onPicked }: { s: ColonyState; onPicked: () => void }) {
  const sim = simRef.current!;
  const rows: { b: Building; role: JobId; held: number; slots: number }[] = [];
  for (const b of s.buildings) {
    const def = BUILDINGS[b.defId];
    for (const [role, slots] of Object.entries(def.jobs) as [JobId, number][]) {
      const held = b.workers.filter((id) => colonistById(s, id)?.job?.role === role).length;
      rows.push({ b, role, held, slots });
    }
  }
  return (
    <div class="job-list">
      {rows.map(({ b, role, held, slots }) => (
        <button
          key={`${b.id}:${role}`}
          class="job-row"
          onClick={() => {
            cmdTakeJob(sim, b.id, role);
            onPicked();
            refreshUi();
          }}
        >
          <b>{JOBS[role].name}</b> @ {BUILDINGS[b.defId].name}
          <small>
            {held}/{slots}
            {held >= slots ? ' (displaces weakest)' : ''}
          </small>
        </button>
      ))}
    </div>
  );
}

function BuildingView({ s, b }: { s: ColonyState; b: Building }) {
  const def = BUILDINGS[b.defId];
  const workers = b.workers.map((id) => colonistById(s, id)).filter(Boolean) as Colonist[];
  return (
    <div class="panel-body">
      <div class="head">
        <b>{def.name}</b>
        {s.tick < b.offlineUntilTick && <span class="tag red">offline</span>}
      </div>
      <div class="sub">{def.desc}</div>
      {Object.keys(def.jobs).length > 0 && (
        <div class="workers">
          <div class="label">
            Crew ({workers.length}/{Object.values(def.jobs).reduce((a, v) => a + (v ?? 0), 0)}):
          </div>
          {workers.map((w) => (
            <button key={w.id} class="rel" onClick={() => (selection.value = { kind: 'colonist', id: w.id })}>
              {w.name} <small>L{w.job ? w.skills[JOBS[w.job.role].skill].level : 0}</small>
            </button>
          ))}
        </div>
      )}
      <div class="sub">Condition: {Math.round(b.condition)}%</div>
    </div>
  );
}

function PlotView({ s, roomId }: { s: ColonyState; roomId: number }) {
  const room = s.map.rooms.find((r) => r.id === roomId);
  const locked = room?.outer && !s.annexUnlocked;
  return (
    <div class="panel-body">
      <div class="head">
        <b>{locked ? 'Locked plot' : 'Empty plot'}</b>
      </div>
      <div class="sub">
        {locked
          ? 'Beyond the pressurized zone. Research the Pressurized Annex to unlock the outer ring.'
          : 'A free building plot. Colony projects will be available here soon.'}
      </div>
    </div>
  );
}

export function InspectorSheet({ s }: { s: ColonyState }) {
  const sel = selection.value;
  if (!sel) return null;
  let body = null;
  if (sel.kind === 'colonist') {
    const c = colonistById(s, sel.id);
    if (c) body = <ColonistView s={s} c={c} />;
  } else if (sel.kind === 'building') {
    const b = buildingById(s, sel.id);
    if (b) body = <BuildingView s={s} b={b} />;
  } else {
    body = <PlotView s={s} roomId={sel.id} />;
  }
  if (!body) return null;
  return (
    <div class="sheet">
      <button class="close" onClick={() => (selection.value = null)}>
        ✕
      </button>
      {body}
    </div>
  );
}

function ChronicleSheet({ s }: { s: ColonyState }) {
  const entries = s.chronicle.slice(-120).reverse();
  return (
    <div class="panel-body">
      <div class="head">
        <b>Colony Chronicle</b>
      </div>
      <div class="chronicle">
        {entries.map((e, i) => (
          <div key={i} class={`entry sev${e.severity}`}>
            <small>Sol {Math.floor(e.tick / TICKS_PER_SOL) + 1}</small> {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResearchSheet({ s }: { s: ColonyState }) {
  const sim = simRef.current!;
  const cur = s.research.current;
  const available = Object.entries(RESEARCH).filter(
    ([id, def]) =>
      !s.research.completed.includes(id) &&
      eraIndex(def.era) <= eraIndex(s.era) &&
      def.requires.every((r) => s.research.completed.includes(r)),
  );
  return (
    <div class="panel-body">
      <div class="head">
        <b>Research</b>
        <span class="tags">
          <span class="tag">🧪 {Math.floor(s.resources.science.amount)}</span>
        </span>
      </div>
      {cur ? (
        <div class="research-cur">
          <b>{RESEARCH[cur.id]?.name}</b>
          <Bar v={cur.progress} max={RESEARCH[cur.id]?.cost ?? 1} />
          <small>
            {Math.floor(cur.progress)}/{RESEARCH[cur.id]?.cost}
          </small>
        </div>
      ) : (
        <div class="sub">No active research — pick one below. Labs feed science into it each sol.</div>
      )}
      <div class="research-list">
        {available.map(([id, def]) => (
          <div key={id} class="research-row">
            <div>
              <b>{def.name}</b> <small>({def.cost} 🧪)</small>
              <div class="sub">{def.desc}</div>
            </div>
            <button
              class="btn"
              disabled={cur?.id === id}
              onClick={() => {
                cmdSetResearch(sim, id);
                refreshUi();
              }}
            >
              {cur?.id === id ? 'Active' : 'Start'}
            </button>
          </div>
        ))}
        {available.length === 0 && <div class="sub">Nothing available this era.</div>}
      </div>
      {s.research.completed.length > 0 && (
        <div class="sub">Completed: {s.research.completed.map((id) => RESEARCH[id]?.name).join(', ')}</div>
      )}
    </div>
  );
}

function SettingsSheet() {
  const sim = simRef.current!;
  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div class="panel-body">
      <div class="head">
        <b>Settings & Saves</b>
      </div>
      <div class="actions">
        <button
          class="btn"
          onClick={() => {
            saveLocal(sim);
            setMsg('Saved.');
          }}
        >
          Save now
        </button>
        <button
          class="btn"
          onClick={() => {
            const str = exportString(sim);
            setExported(str);
            navigator.clipboard?.writeText(str).then(
              () => setMsg('Save string copied to clipboard.'),
              () => setMsg('Copy the string below.'),
            );
          }}
        >
          Export save
        </button>
      </div>
      {exported && <textarea class="save-io" readOnly value={exported} onClick={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />}
      <div class="label">Import a save string:</div>
      <textarea
        class="save-io"
        placeholder="LNG1.…"
        value={importText}
        onInput={(e) => setImportText((e.currentTarget as HTMLTextAreaElement).value)}
      />
      <div class="actions">
        <button
          class="btn"
          onClick={() => {
            try {
              const next = importString(importText);
              simRef.current = next;
              saveLocal(next);
              setMsg('Imported.');
              refreshUi();
            } catch (err) {
              setMsg(String((err as Error).message ?? err));
            }
          }}
        >
          Load import
        </button>
        <button
          class="btn danger"
          onClick={() => {
            if (confirm('Abandon this colony and start a new one? (Legacy is kept)')) {
              const legacy = sim.state.legacy;
              clearSaves();
              simRef.current = new Sim(newColony((Math.random() * 2 ** 32) >>> 0, legacy));
              saveLocal(simRef.current);
              refreshUi();
            }
          }}
        >
          New colony
        </button>
      </div>
      {msg && <div class="sub">{msg}</div>}
      <div class="sub">
        Seed {sim.state.seed} · Life {sim.state.player.lifeNumber} · Generation {sim.state.stats.generations} ·{' '}
        {sim.state.stats.totalBirths} births · {sim.state.stats.totalDeaths} deaths
      </div>
      <div class="sub">Tip: on iPhone/iPad, Share → Add to Home Screen installs the game.</div>
    </div>
  );
}

function LegendSheet() {
  return (
    <div class="panel-body">
      <div class="head">
        <b>Legend</b>
      </div>
      <div class="legend">
        <div>
          <b>Shape = age</b>
        </div>
        <div>• infant — tiny dot</div>
        <div>● child — circle</div>
        <div>▲ student — triangle</div>
        <div>■ adult — square</div>
        <div>◆ elder — diamond</div>
        <div style={{ marginTop: '8px' }}>
          <b>Color = job</b>
        </div>
        {Object.entries(JOBS).map(([id, j]) => (
          <div key={id}>
            <span class="swatch" style={{ background: j.color }} /> {j.name}
          </div>
        ))}
        <div>
          <span class="swatch" style={{ background: '#9aa7c0' }} /> Unemployed
        </div>
        <div>
          <span class="swatch" style={{ background: '#cdd6ea' }} /> Children
        </div>
        <div style={{ marginTop: '8px' }}>
          <span style={{ color: '#ffd166' }}>◯ gold ring — your colonist</span>
        </div>
      </div>
    </div>
  );
}

export function SideSheet({ s }: { s: ColonyState }) {
  const id = activeSheet.value;
  return (
    <div class="sheet">
      <button class="close" onClick={() => (activeSheet.value = 'none')}>
        ✕
      </button>
      {id === 'chronicle' && <ChronicleSheet s={s} />}
      {id === 'research' && <ResearchSheet s={s} />}
      {id === 'settings' && <SettingsSheet />}
      {id === 'legend' && <LegendSheet />}
    </div>
  );
}
