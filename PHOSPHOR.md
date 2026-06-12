# PHOSPHOR — night shift at the installation

An oscilloscope roguelike, sibling to [NUMEN](NUMEN.md): one dependency-free HTML file
(`public/phosphor/index.html`), live at **https://tezzuk.github.io/Sim/phosphor/**, phone and
desktop. You are the engineer on the night shift; every subsystem sings a reference wave, and
your job is to make the bright phosphor trace **match the dashed reference and hold it** while
the plant drifts, glitches, and accelerates around you.

## The loop

- **Three knobs, no tapping.** Fat drag-lanes for **VOLTS/DIV · FREQUENCY · PHASE** (multi-touch:
  ride two at once), or keyboard (1/2/3 + arrows, shift for fine). The skill is continuous
  control — tracking, not twitch.
- **Lock = life.** When every error is inside the lock window the trigger reads `TRIG'D`:
  locked time banks **joules** (the score) and recharges **integrity** (the thin top bar).
  Unlocked time bleeds it. Integrity at zero = **SIGNAL LOST**. Permadeath, instant restart.
- **The reference fights back, on the beat.** Drift LFOs and random-walk steps land on a beat
  grid (78 BPM rising to 150), and **transients** — instant parameter jumps — are telegraphed
  exactly one beat ahead (`⚠ TRANSIENT — PHASE`). The game is rhythmic tracking: settle, ride,
  brace, recover.
- **Combo:** every beat held fully locked stacks the joule multiplier (up to ×3); one sloppy
  beat breaks it. Numbers pop off the trace on every locked beat.
- **Roguelike spine:** survive a signal (8 bars) → the **spares crate** offers 1-of-3
  components — PLL (phase snaps near lock), Crystal Oven (reference drifts less), Wideband
  Trigger (lock window +40%), Surge Protector (survive one blackout)… and cursed parts:
  Overclock (joules ×2, drift ×1.5), Burn-In, Hot Gain Stage, Cracked CRT. Each cleared signal
  raises BPM, drift, glitch rate, and drain.
- **Stage 1 teaches one axis** (amplitude only; the other knobs track automatically), stage 2
  adds frequency, stage 3 adds phase and transients. By SIG 05 the plant is genuinely hostile.
- **Tune by ear.** Your wave and the reference are real audio oscillators (110–330 Hz): when
  you're detuned you hear the classic beat-frequency wobble; when the hum settles, you're
  locked — and the reference fades into consonance. Fully playable silent, too (audio failures
  never block anything).

## Accessibility was a design pillar

No precision taps, no reaction-time tests without telegraphs. Continuous drag control with
fat lanes; `‹ ›` chevrons on every knob point the correction direction with brightness ∝
error; full keyboard play; audio tuning for eyes-free correction (and visual everything for
ears-free); `prefers-reduced-motion` kills shake/flash; the only timed event (transients) is
announced a full beat early.

## Why death is guaranteed

A controller with any positive reaction time or finite knob speed must spend time unlocked
after every walk step and transient — and walk steps, glitch sizes, and the integrity drain
all grow without bound (drain goes exponential past SIG 05), while charge and the lock window
are constant. Components only scale clamped constants. The pacing harness probes the bound
with a beyond-human "cyborg" controller (30 ms reaction, 0.2% observation noise, 6.0/s slew):
it dies at SIG 18, every seed.

## Balance methodology

Same discipline as NUMEN: the game core is pure and DOM-free (seeded mulberry32, no clocks),
so two headless Node harnesses drive the *shipped file* through a stubbed DOM:

- **30 functional checks** — error math incl. phase wrap, lock thresholds, charge/drain/
  blackout, fuse single-use, combo bookkeeping, glitch telegraph timing, draft flow, every
  component effect, determinism, snapshot round-trip (reloading never escapes a bad shift —
  seeded replay), difficulty monotonicity, NaN sweeps.
- **Pacing sim** — bounded-bandwidth PD-controller bots (reaction time τ, observation noise σ,
  slew rate S) across 6 tiers × 60 seeded runs:

| controller | τ / σ / slew | death SIG p10/med/p90 | joules med |
|---|---|---|---|
| shaky | .55s / 8.5% / 0.5 | 5/6/7 | 3.5K |
| decent | .30s / 4% / 0.9 | 8/9/11 | 12K |
| skilled | .16s / 2% / 1.6 | 11/13/16 | 85K |
| expert | .08s / 0.8% / 2.6 | 14/17/17 | 600K |
| cyborg (beyond human) | .03s / 0.2% / 6.0 | 18/18/18 | 2.2M |
| skilled, never drafts | — | 9/9/9 | 14K |

Joules span ×600 from shaky to expert — a real score ceiling to chase. A decent shift lasts
~4–5 minutes. Drafting matters (skilled with drafts: SIG 13 / 85K vs without: SIG 9 / 14K).

Meta is knowledge only: 14 marks, the component schematic (a part must be offered once before
its label is legible), records. No power carries between shifts.

## Development

No build step: open `public/phosphor/index.html`, or `npm run dev` → `/Sim/phosphor/`.
Deploys verbatim via the existing Pages workflow. All tuning lives in the `TUNE` object —
if you touch it, re-run both harnesses against the shipped file.
