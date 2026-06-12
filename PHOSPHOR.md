# PHOSPHOR — night shift at the installation

An oscilloscope roguelike, sibling to [NUMEN](NUMEN.md): one dependency-free HTML file
(`public/phosphor/index.html`), live at **https://tezzuk.github.io/Sim/phosphor/**, phone and
desktop. Green phosphor CRT, a dashed reference wave, your bright trace — and a plant that
keeps punching the reference out of alignment.

## The loop (snap-fix design)

- **Faults hit ONE parameter at a time** — amplitude, frequency or phase — telegraphed exactly
  one beat ahead (`⚠ PHASE`), landing on the beat grid (80 → 150 BPM).
- **The whole screen is the knob.** When a fault is open, drag anywhere (or arrow keys); the
  game routes your gesture to the broken parameter — big arrows show the way. Get close and
  the wave **SNAPS** into lock: shake, burst, chime. No multitasking, no fiddly sliders —
  reaction and one clean flick.
- **Fix speed is the score.** Rated against the beat: **INSTANT ×4 · QUICK ×2 · CLEAN ×1 ·
  SLOW ×0.4** (slow breaks your streak). Instant/quick fixes stack a streak multiplier up to
  ×4 on top, with milestone callouts every 5. Joules pop off the trace on every fix and
  trickle in on every clean bar.
- **Integrity is the clock**: open faults drain it (stacking if you let them queue), clean
  signal recharges it. Zero = **SIGNAL LOST**, permadeath, instant restart.
- **Roguelike spine**: clear a signal (8 bars, clean board required) → the spares crate offers
  1-of-3 components — Wideband Trigger (snap zone +40%), Servo Assist, Trigger Hold (time
  crawls after a fault), Surge Protector (survive one blackout)… and cursed parts: Overclock
  (joules ×2, faults 50% bigger), Burn-In, Hot Gain Stage, Cracked CRT. Every signal raises
  BPM, fault size, fault rate, and drain.
- Stage 1 throws only amplitude faults; frequency arrives at SIG 02, phase at SIG 03.
- **Tune by ear**: the traces are live oscillators — an open frequency fault audibly *beats*
  (wow-wow-wow) until you pull it back into consonance. Fully playable silent too.

## Accessibility

No precision taps anywhere. Whole-screen drag with direction arrows (brightness/labels, not
color alone), full keyboard play (arrows fix, shift = fine, 1/2/3 drafts), every fault
telegraphed a beat early, `prefers-reduced-motion` removes shake/flash, and the audio layer
is redundant with visuals in both directions.

## Why blackout is guaranteed

Any player has a reaction floor and a finite drag speed, so every fault buys the plant some
open time — and fault size, fault rate, and the integrity drain all grow without bound
(drain goes exponential past SIG 05) while charge and the snap zone are fixed. Components
only scale clamped constants. The harness probes the bound with a beyond-human "cyborg"
controller (30 ms reaction, 8.0/s slew): it dies at SIG 17, every seed.

## Balance methodology

The game core is pure and DOM-free (seeded mulberry32, no clocks), so two headless Node
harnesses drive the *shipped file* through a stubbed DOM:

- **30 functional checks** — fault scheduling/grid/gaps, telegraph timing, snap routing and
  exactness, all four speed tiers and combo rules, reward arithmetic, drain stacking,
  fuse single-use, clean-board stage clears, every component effect, rail bounces,
  determinism, snapshot round-trips (reloads replay identically — no scumming), NaN sweeps.
- **Pacing sim** — reaction-and-slew bots (reaction τ, aim noise σ, drag speed S) across
  6 tiers × 60 seeded runs:

| controller | τ / σ / slew | death SIG p10/med/p90 | joules med |
|---|---|---|---|
| shaky | .50s / 5% / 0.6 | 7/7/8 | 72K |
| decent | .28s / 3% / 1.2 | 9/10/11 | 456K |
| skilled | .15s / 1.5% / 2.2 | 12/13/13 | 1.5M |
| expert | .08s / 0.8% / 3.5 | 14/15/15 | 4.5M |
| cyborg (beyond human) | .03s / 0.2% / 8.0 | 17/17/17 | 20M |
| skilled, never drafts | — | 8/9/9 | 273K |

A ×60 joule ceiling from shaky to expert, drafting visibly matters (skilled with drafts:
SIG 13 / 1.5M vs without: SIG 9 / 273K), and a decent shift runs ~3–5 minutes.

Meta is knowledge only: 15 marks, the component schematic (a part must be offered once
before its label is legible), records. No power carries between shifts.

## Development

No build step: open `public/phosphor/index.html`, or `npm run dev` → `/Sim/phosphor/`.
Deploys verbatim via the existing Pages workflow. All tuning lives in the `TUNE` object —
if you touch it, re-run both harnesses against the shipped file.
