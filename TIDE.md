# TIDE — the sea gives, the sea takes

A hardcore-roguelike incremental, sibling to [NUMEN](NUMEN.md): single dependency-free HTML
file (`public/tide/index.html`), playable at **https://tezzuk.github.io/Sim/tide/**, works on
phone and desktop. Where NUMEN grows forever, TIDE is **rhythm and permadeath**: every run
ends in drowning — the only question is how deep you ride and how many pearls you bank on
the way down.

## The loop

- **The surf value IS your life.** Waves wash tappable flotsam ashore; what you collect
  compounds in the surf. Every ebb the sea demands a rising **toll** from it. Can't pay →
  drowned. Run over. No continues.
- **Banking = scoring, not survival.** In the slack between waves, taps convert 30% of the
  surf into **pearls** — your score and the only thing that persists. Banked value never
  helps you pay a toll: every pearl is compounding power you gave up. The dilemma fires on
  every single wave (the simulation proves it: a perfect banker dies at wave ~38 with ~340
  pearls; a hoarder who never banks survives to ~39 — and scores zero).
- **Skill is real**: flotsam sinks if you're slow (sinking breaks your combo); banking inside
  the brief **perfect window** (marked tick, 60 ms grace, judged on input timestamps) pays
  0% tax vs 30%; jellyfish punish indiscriminate tapping; and 1-of-3 **relic drafts** at
  waves 3/6/9/12 are genuine tradeoffs.
- **The god build.** Relics stack multiplicatively — Maelstrom Heart uncaps the combo,
  Breaker's Bounty cascades driftwood into splinters, Echo Conch feeds every collect back
  into the surf. A converged build goes **SPRING SURGE**: gold rain, trillions on screen
  (validated max ≈ 2e12 for perfect play). And then the sea takes it anyway.
- **Death is mathematically inevitable.** Two invariants enforce it: per-wave carry
  (compound × feedback) is clamped at 1.38 < the toll's 1.40 growth base, and no relic
  touches the exponent bases (income 1.30, toll 1.40, moon hunger ×1.9). Finite relics =
  finite constant edge = always eaten by the exponential gap. A fuzz bot holding all 24
  relics with infinite tap speed drowns at wave 68–69, every seed.
- **Permadeath, zero power meta.** Between runs you keep only knowledge: 19 marks, a relic
  codex (a relic must be *offered* once before its text is revealed), best scores, and six
  unlockable **moons** — run modifiers, not buffs (Blood: tolls ×2 / flotsam ×2.5 · Mirror:
  bank *before* the wave, on faith · Black: the toll is hidden, listen for your heartbeat…).

## Surface

A breathing waterline (3 canvas sine layers + foam), one big surf number, the toll line under
it ("THE EBB DEMANDS 4.5K" — red + heartbeat when you're short), bobbing flotsam glyphs,
numbers popping off every tap, and a 4-icon dock. All sound is synthesized WebAudio: pentatonic
plinks climbing with combo, brown-noise wave swells, a 55 Hz toll thoom, paired heartbeats when
death looms — and total silence degrades gracefully (audio failures never block input; learned
that the hard way in NUMEN).

## Balance methodology

Same discipline as NUMEN, deeper: two headless Node harnesses drive the *shipped file* through
a stubbed DOM (`vm.createContext`), possible because the entire game core is pure — no DOM, no
clocks, all randomness through a per-run seeded mulberry32 (which is also what makes reloads
scum-proof: the run snapshot replays identically, so quitting never escapes a bad ebb).

- **34 functional checks**: exact ebb arithmetic (toll then undertow), perfect-window edges
  incl. coyote grace, pearl split-invariance (cumulative-log scoring makes micro-banking
  pointless), relic clamps/floors under full stacks, witchbone/old-debt lifecycles, moon-phase
  rule application, seeded determinism, snapshot round-trips, and a god-stack
  finiteness/death check.
- **Pacing simulation**, 120 seeded runs × 6 skill tiers (tap rate / accuracy / slack timing /
  banking threshold / draft policy) + a 30-seed all-relic god fuzz — the standing regression
  net for any future relic: if it lets the fuzz survive past wave 85, it broke the game.

| bot | death wave p10/med/p90 | pearls med | max surf |
|---|---|---|---|
| flailing | 2/5/7 | 11 | 1.2e5 |
| baseline (no relics) | 7/9/10 | 25 | 1.6e4 |
| decent | 14/21/24 | 99 | 1.3e8 |
| skilled | 23/26/34 | 167 | 4.1e9 |
| perfect banker | 28/38/49 | 338 | 1.9e12 |
| hoarder (never banks) | 28/39/51 | **0** | 2.3e12 |
| god fuzz (impossible) | 68–69 | — | 6.3e13 |

Moon 1 = ~5 minutes of play for a decent player. Instant restart. The tide returns.

## Development

No build step. Open `public/tide/index.html` in a browser, or `npm run dev` and visit
`/Sim/tide/`. Deploys verbatim with the Vite build (`public/` is copied as-is) via the
existing GitHub Pages workflow. Tuning lives in the single `TUNE` object; if you touch the
economy, re-run both harnesses against the shipped file.
