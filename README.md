# Idle Dungeon Life

> Every character lives once.

An idle RPG where you send an adventurer into ancient dungeons. They age in real
time, collect traits, and push deeper until their lifespan runs out. Death is
progress: **legacy ash** persists across lives to fund permanent unlocks, chosen
paths, and a world that remembers every run.

Built with [Phaser 3](https://phaser.io/), TypeScript and Vite, and packaged for
mobile with [Capacitor](https://capacitorjs.com/).

## Gameplay at a glance

- **Lifespan, not health.** Your adventurer ages through life stages and dies
  when vitality is spent. A run is one lifetime.
- **Traits & evolution.** Hidden aspects surface as the character ages or as
  alignment shifts; some evolve mid-run and permanently reshape the build.
- **16 dungeons** from the Abandoned Chapel down to **The Wound**, each harder,
  richer, and more lethal than the last.
- **Legacy paths.** Holy, Abyss, or Knowledge — each opens a talent tree and a
  perk line that span multiple lives.
- **Sub-characters.** After your first character clears the final dungeon, you
  unlock up to five parallel lives with their own legacy and automation.
- **Offline progression.** Time keeps passing while you're away (capped), with a
  welcome-back summary on return.

## Tech stack

| Concern        | Choice                                  |
| -------------- | --------------------------------------- |
| Rendering      | Phaser 3                                |
| Language/build | TypeScript + Vite                       |
| Mobile         | Capacitor (Android / iOS)               |
| Unit tests     | Vitest                                  |
| E2E tests      | Playwright                              |
| Lint/format    | ESLint + Prettier                       |

## Getting started

```bash
npm install
npm run dev          # Vite dev server on http://127.0.0.1:5174
```

The managed dev-server scripts (`dev:start`, `dev:status`, `dev:stop`,
`dev:restart`) run Vite in the background and are what the Playwright suite uses.

### Test, lint, build

```bash
npm run test:unit    # Vitest unit suite
npm run test:e2e     # Playwright end-to-end suite (boots the dev server)
npm run lint         # ESLint over src
npm run format       # Prettier write
npm run build        # tsc + production Vite build into dist/
```

### Mobile (Capacitor)

```bash
npm run build              # produce dist/
npm run cap:sync           # build + copy web assets into the native projects
npm run cap:add:android    # one-time: generate the Android project
npm run cap:open:android   # open in Android Studio
```

The web layer is the single source of truth — the canvas is laid out inside the
device safe area (notch / home indicator) via `env(safe-area-inset-*)` so the HUD
and tab bar stay fully visible and tappable. Re-run `cap:sync` after any web
change before testing on device.

## Architecture

Game logic is a **pure, event-sourced reducer** kept entirely separate from the
Phaser presentation layer. Scenes dispatch events; the reducer returns a new
immutable `SaveFile`; scenes re-render from it.

```
src/
  app/        Bootstrap, Phaser game controller, dev/debug hooks
  core/       Pure game logic — no Phaser imports
    reducer.ts    Single reducer: (SaveFile, GameEvent) -> SaveFile
    events.ts     The GameEvent union (the only way to change state)
    types.ts      SaveFile and domain types
    save.ts       Persistence, versioned save migration, offline reconcile
    rng.ts        Deterministic seeded RNG
    stats.ts / modifiers.ts / lifespan.ts / scoring.ts / analytics.ts
  content/    Authored data: dungeons, jobs, items, traits, talents, balance…
  ui/         Phaser scenes, components, and procedural avatar generation
    scenes/       One scene per tab + HUD overlay + death screen
  sim/        Headless balance-simulation harness (see BALANCING.md)
  assets/     Static assets
```

Key properties:

- **Determinism.** Same seed + same events ⇒ same outcome. This is what makes the
  offline catch-up and the balance simulator trustworthy, and it's covered by
  tests.
- **Immutability.** The reducer never mutates its input; tests assert prior state
  is unchanged.
- **Versioned saves.** `migrateSave` upgrades older saves field-by-field so
  existing players never lose progress.

## Balance simulation

`src/sim/` runs the real reducer headlessly across many seeds and strategies to
measure depth, survival, discoveries, and ash, and emits an interactive HTML
report. See **[BALANCING.md](BALANCING.md)** for profiles, policies, and CLI
usage.

## Dev tools

In a dev build, the browser console exposes:

- `window.__game` — the live Phaser game / save state
- `window.__test` — dispatch events, switch scenes, advance time, reset
- `window.__debug` — grant resources, unlock content, kill the run, etc.

Debug keys (hold Ctrl/Alt): `G` +gold, `E` +essence, `K` kill run, `S` toggle
sub-character unlock, `1/2/3` advance +60s/+1h/+8h, `R` reset save.

## Project docs

- **[BALANCING.md](BALANCING.md)** — the balance-simulation harness.
- **[progress.md](progress.md)** / **[checklist.md](checklist.md)** — development
  journal and working notes.
