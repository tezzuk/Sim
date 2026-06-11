import { ASPIRATIONS } from '../content/aspirations';
import { JOBS } from '../content/jobs';
import { cmdSetSpeed } from '../sim/commands';
import { SPEEDS, TICKS_PER_SOL, SOLS_PER_YEAR, TICKS_PER_HOUR } from '../sim/constants';
import type { ColonyState, ResourceId } from '../sim/state';
import { ageYears, playerColonist } from '../sim/state';
import { AspirationModal, HeirModal } from './modals';
import { InspectorSheet, SideSheet } from './panels';
import {
  activeSheet,
  aspirationDeferred,
  centerOnPlayer,
  refreshUi,
  selection,
  simRef,
  uiTick,
} from './store';

export function clockText(tick: number): string {
  const sol = Math.floor(tick / TICKS_PER_SOL);
  const year = Math.floor(sol / SOLS_PER_YEAR) + 1;
  const solOfYear = (sol % SOLS_PER_YEAR) + 1;
  const hour = Math.floor((tick % TICKS_PER_SOL) / TICKS_PER_HOUR);
  return `Y${year} · Sol ${solOfYear} · ${String(hour).padStart(2, '0')}:00`;
}

const ERA_NAMES: Record<string, string> = {
  landing: 'Landing',
  establishment: 'Establishment',
  expansion: 'Expansion',
  terraforming: 'Terraforming',
};

const RES_META: { id: ResourceId; label: string; cls: string }[] = [
  { id: 'power', label: '⚡', cls: 'power' },
  { id: 'water', label: '💧', cls: 'water' },
  { id: 'oxygen', label: 'O₂', cls: 'oxygen' },
  { id: 'biomass', label: '🌿', cls: 'biomass' },
  { id: 'materials', label: '⛏', cls: 'materials' },
  { id: 'science', label: '🧪', cls: 'science' },
];

function TopBar({ s }: { s: ColonyState }) {
  const sim = simRef.current!;
  return (
    <div class="hud-top">
      <div class="clock">
        <b>{clockText(s.tick)}</b>
        <span class="era">{ERA_NAMES[s.era]}</span>
      </div>
      <div class="speeds">
        {SPEEDS.map((v) => (
          <button
            key={v}
            class={`speed ${s.speed === v ? 'active' : ''}`}
            onClick={() => {
              cmdSetSpeed(sim, v);
              refreshUi();
            }}
          >
            {v === 0 ? '⏸' : `${v}×`}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResourceBar({ s }: { s: ColonyState }) {
  const pop = s.colonists.filter((c) => c.alive).length;
  return (
    <div class="res-bar">
      <span class="chip pop" title="Population">
        ⬤ {pop}
      </span>
      {RES_META.map((m) => {
        const r = s.resources[m.id];
        const short =
          (m.id === 'power' && s.shortages.power) ||
          (m.id === 'water' && s.shortages.water) ||
          (m.id === 'oxygen' && s.shortages.oxygen) ||
          (m.id === 'biomass' && s.shortages.biomass);
        return (
          <span key={m.id} class={`chip ${m.cls} ${short ? 'short' : ''}`}>
            {m.label} {Math.floor(r.amount)}
          </span>
        );
      })}
      <span class="chip influence" title="Influence — spend on projects">
        ◆ {Math.floor(s.player.influence)}
      </span>
      {s.legacy.points > 0 && (
        <span class="chip legacy" title="Legacy">
          ✦ {s.legacy.points}
        </span>
      )}
    </div>
  );
}

function PlayerChip({ s }: { s: ColonyState }) {
  const p = playerColonist(s);
  if (!p?.alive) return null;
  const asp = p.aspiration ? ASPIRATIONS[p.aspiration.id] : null;
  return (
    <button
      class="player-chip"
      onClick={() => {
        selection.value = { kind: 'colonist', id: p.id };
        centerOnPlayer.current();
      }}
    >
      <span class="ring">◯</span>
      <span class="who">
        <b>
          {p.name} {p.family}
        </b>
        <small>
          {Math.floor(ageYears(s, p))}y · {p.job ? JOBS[p.job.role].name : p.stage}
          {asp ? ` · ★ ${asp.name}${p.aspiration!.done ? ' ✓' : ''}` : ''}
        </small>
      </span>
    </button>
  );
}

function SideButtons({ s }: { s: ColonyState }) {
  const toggle = (id: typeof activeSheet.value) => {
    activeSheet.value = activeSheet.value === id ? 'none' : id;
    if (activeSheet.value !== 'none') selection.value = null;
  };
  const aspPending = s.player.aspirationChoices && aspirationDeferred.value;
  return (
    <div class="side-buttons">
      <button onClick={() => toggle('chronicle')} title="Chronicle">
        📜
      </button>
      <button onClick={() => toggle('research')} title="Research">
        🔬
      </button>
      <button onClick={() => toggle('legend')} title="Legend">
        ❓
      </button>
      <button onClick={() => toggle('settings')} title="Settings">
        ⚙️
      </button>
      {aspPending && (
        <button class="attention" title="Choose an aspiration" onClick={() => (aspirationDeferred.value = false)}>
          ★
        </button>
      )}
    </div>
  );
}

export function App() {
  uiTick.value; // subscribe to the refresh pulse
  const sim = simRef.current;
  if (!sim) return null;
  const s = sim.state;
  const player = playerColonist(s);

  return (
    <>
      <TopBar s={s} />
      <ResourceBar s={s} />
      <PlayerChip s={s} />
      <SideButtons s={s} />
      {activeSheet.value !== 'none' && <SideSheet s={s} />}
      {selection.value && activeSheet.value === 'none' && <InspectorSheet s={s} />}
      {s.player.aspirationChoices && player?.alive && !aspirationDeferred.value && !s.succession && (
        <AspirationModal s={s} />
      )}
      {s.succession && <HeirModal s={s} />}
    </>
  );
}
