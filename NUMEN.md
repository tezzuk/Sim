# NUMEN — a number wants to grow

A minimal-surface incremental game: one giant number on a black screen, and nothing else —
until the systems underneath start surfacing. Single dependency-free HTML file
(`public/numen/index.html`), playable at **https://tezzuk.github.io/Sim/numen/**,
works on phone and desktop, saves locally, counts while you're away.

The design goal: **minimal UI, intricate machine.** Everything below is hidden at first
and revealed by play, one toast at a time.

## The surface

- The number. Tap anywhere to feed it. Floating `+N` numbers pop where you tap.
- A 3-pixel heat line at the top of the screen.
- Up to four small dock icons (◬ echoes, ✦ flux, ⌬ glyphs, ☰ ledger) that fade in
  as each system unlocks. Alert dots pull you toward whatever is affordable.
- That's all.

## The machine underneath

Eight interlocking systems, each feeding the others:

1. **Tap engine** — taps innately carry 5% of your passive rate (so clicking never goes
   obsolete), times heat, times combo, with 5% crits at ×8. Crits shake the screen.
2. **Combo** — taps within a 1.5 s window stack up to ×2. The click pitch rises with the
   combo. Stop, and it breaks.
3. **Heat / Overdrive** — every tap adds heat; full heat triggers a 6-second ×5 OVERDRIVE,
   followed by a forced cooldown. Risk/reward rhythm for active play.
4. **The echo cascade** — 8 generator tiers (Whisper → Apotheosis); each tier produces the
   tier below, only Whispers produce points. Milestones (`25·k^(4/3)` bought) multiply a
   tier's output ×2. Global multipliers deliberately apply to points only — through an
   8-deep cascade a global ×G would compound to ×G⁸ and the curve diverges (verified by
   simulation; it did).
5. **Resonance** — the number you are *holding* multiplies its own growth
   (`×(1+0.02·log₁₀(points))`). Spending points on echoes momentarily weakens you:
   a real hold-vs-spend tension on every purchase.
6. **Flux (prestige 1)** — reset the run for flux: `(total/1e10)^0.5` with a logarithmic
   tail. Every flux *earned* permanently amplifies everything — spending it on glyphs
   costs you nothing, which makes buying glyphs pure joy instead of a dilemma.
7. **Glyphs** — 16 permanent synergies with prerequisites (crit chains, combo persistence,
   tap→Whisper feedback loop, auto-buyers…). Each one rewires how the systems above
   interact.
8. **Singularity (prestige 2)** — at 1e50 lifetime, collapse *everything* (flux and glyphs
   included) for cores: permanent production **exponents** (+0.04 each), flux-gain boosts,
   and automation tiers. Qualitatively different growth, classic second-layer reset.

Plus 23 hidden achievement "marks" (each ×1.04 to everything), offline progress (12 h cap),
ambient number-pops while idling, save export/import, and a win screen at 1e300 with an
endless mode after.

## Balance methodology

The economy was tuned against two headless Node harnesses that drive the *shipped file*
through a stubbed DOM:

- a 36-check functional suite (clicks, crits, overdrive, prestige resets, offline
  catch-up, save round-trips, formatting), and
- a long-horizon pacing simulation of a semi-active optimal player.

Final pacing marks from the simulation (optimal play — humans should expect ~2-3× longer,
plus offline stretches): first flux ≈ 14 min, all 16 glyphs ≈ 1 h, first collapse ≈ 1.4 h,
1e100 ≈ 6 h, win ≈ 10 h.

Three explosions were found and fixed this way: global multipliers compounding ^8 through
the cascade, flux gain outrunning its polynomial softcap across 300 orders of magnitude
(now a logarithmic tail), and core exponents diverging to literal `Infinity` (cores now
follow a sublinear curve saturating at log₁₀ ≈ 308, and all totals clamp at 1.79e308).

## Development

No build step. Open `public/numen/index.html` in a browser, or run the repo's
`npm run dev` and visit `/Sim/numen/index.html`. The file deploys verbatim with the
Vite build (`public/` is copied as-is) via the existing GitHub Pages workflow.
