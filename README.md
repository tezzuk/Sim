# Lineage

A generational colony simulator with roguelike and incremental features, playable in any
modern browser (Safari on iPhone/iPad, anything on Windows).

> This repo also ships **[NUMEN](NUMEN.md)**, a minimal-surface incremental game, at
> **https://tezzuk.github.io/Sim/numen/** — a single dependency-free HTML file in
> `public/numen/`, deployed alongside Lineage. See [NUMEN.md](NUMEN.md) for the design.

You are not the god-hand: **you are one colonist** in a domed science outpost on an
exoplanet. Around you, every colonist is simulated — born, schooled, employed, partnered,
aged, and eventually buried. When *your* colonist dies, you continue as their child or
protégé, inheriting a fraction of their skills and genes. Each life is a roguelike run;
inheritance is the prestige loop. The colony keeps living while the game is closed.

## Play

The game deploys to GitHub Pages on every push:
**https://tezzuk.github.io/Sim/**

> **One-time setup (repo owner):** GitHub → repo **Settings → Pages → Build and
> deployment → Source: GitHub Actions**. Without this the deploy workflow cannot publish.

On iPhone/iPad you can install it: open the URL in Safari → Share → **Add to Home Screen**.

### Controls

- Drag with one finger (or mouse) to pan, pinch or scroll-wheel to zoom.
- Tap a pawn or a building to inspect it. Your colonist wears a **gold ring**.
- Pawn **shape = age stage** (dot infant, circle child, triangle student, square adult,
  diamond elder), **color = job**.
- Speed controls: pause / 1x / 3x / 10x. The colony also progresses while the game is
  closed — pause first if you don't want that.

Saves live in your browser (autosaved every 30 s). Use **Settings → Export save** to move
a save between devices (e.g. iPhone → Windows).

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # sim unit tests (vitest)
npm run build    # typecheck + production build
node scripts/make-icons.mjs   # regenerate PWA icons
```

The sim is deterministic: all randomness flows through seeded, serializable RNG streams
(`src/sim/rng.ts`), which is what makes exact offline catch-up and save replay possible.
