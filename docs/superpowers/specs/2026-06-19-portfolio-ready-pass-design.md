# Portfolio-Ready Pass — Design

**Date:** 2026-06-19
**Status:** Approved (pending spec review)

## Goal

Finish Idle Dungeon Life as a portfolio piece. A visitor should be able to
**open it, play it, watch a short demo, and see screenshots** of different
stages and levels. The repo and the existing Vercel deployment should present
well with zero setup.

## Scope

Four deliverables, one cohesive pass:

- **A.** First-run welcome overlay (onboarding).
- **B.** In-app auto-play demo mode.
- **C.** Automated screenshot capture committed to the repo.
- **D.** Hosting verification + README/about-page polish.

Out of scope: in-context tab tooltips, new gameplay systems, mobile/Capacitor
work, recorded video/GIF.

## Key constraints (from the existing codebase)

- Boot goes straight into `MainScene` and auto-starts a run
  (`src/app/bootstrap.ts`). There is no title/welcome screen today.
- `window.__test` / `window.__debug` hooks are **dev-only** (`if (IS_DEV)`).
  The shipped demo must NOT depend on them. The screenshot script may use them
  because it runs against the dev server (like the e2e suite, port 5174).
- Single localStorage save key `idledungeonlife_save` (`src/core/save.ts`).
  The demo must never overwrite a visitor's real save.
- `preserveDrawingBuffer: true` is already set, so canvas screenshots work.
- Game logic is a pure reducer; scenes render from `GameController.saveFile`.
  The demo reuses the real reducer — it is the actual game running, not a fake.

## A. Welcome overlay (`IntroScene`)

A new Phaser scene shown on first load **only when there is no existing save**
(fresh visitor). Returning players boot straight into `MainScene` as today.

Content:
- Pitch line: "Every character lives once."
- 2–3 sentences explaining what the visitor is looking at.
- Two buttons: **Play** (dismiss → start normal game) and **Watch demo**
  (start `DemoRunner`).

A small "?" affordance in `HudScene` reopens the overlay on demand.

`bootstrap.ts` changes: detect fresh vs. existing save before auto-starting a
run; when fresh, start `IntroScene` instead of immediately starting the run +
`MainScene`. Pressing **Play** performs the current first-launch behavior
(`START_NEW_RUN` if no run, start `MainScene` + `HudScene`).

## B. Auto-play demo (`src/app/demo/`)

**Architecture: sandboxed real-reducer demo.**

- `scenario.ts` — an ordered list of declarative **beats**. Each beat is one of:
  - `dispatch` a real `GameEvent`
  - `advanceTime` (ms) via the same path used by `__test.advanceTime`
    (`advanceRun` + `advanceSubCharacters`)
  - `switchScene` (scene key)
  - `caption` (banner text) + `hold` (ms)

  The scenario describes one compelling lifetime: birth in the Abandoned
  Chapel → take a job → dive dungeons (fast-forwarded) → traits surface → push
  deep → death → legacy/ash screen.

- `DemoRunner.ts` — plays the beats on a timer against a **sandboxed save**:
  1. Snapshot the current `GameController.saveFile`.
  2. Set `GameController.demoActive = true`; while set, `saveToDisk` is a no-op
     (guarded inside the controller) so the demo never touches localStorage.
  3. Replace `saveFile` with a fresh in-memory save and play beats, restarting
     content scenes between beats to re-render.
  4. Show a caption banner + a **Skip demo** button.
  5. On finish or skip: clear `demoActive`, restore the snapshot, and return to
     `IntroScene` (or `MainScene` if launched from the HUD).

- Production-safe: depends only on real reducer + scene APIs, not dev hooks.

The persistence guard is the single behavioral change to `GameController`:
`dispatch` and `_persistLoop` skip `saveToDisk` while `demoActive` is true.

## C. Automated screenshots (`tests/e2e/screenshots.spec.ts`)

A Playwright spec, run via a new `npm run screenshots` script, that boots the
dev server and, for each **canonical state**, uses `__test` / `__debug` to set
it up, waits for a stable render, and saves a PNG.

Canonical set:
1. Welcome overlay (intro)
2. Early life — Abandoned Chapel
3. A mid-game dungeon dive
4. A deep / late dungeon
5. Death + legacy/ash screen
6. Codex
7. Talents tree
8. Sub-characters

Where practical the states are reached by replaying `scenario.ts` beats so the
screenshots and the demo never drift.

**Output:** PNGs are written to `artifacts/screenshots/` and **committed to the
repo** so they render on GitHub and can be reused on the external portfolio.

## D. Hosting + portfolio polish

- Verify the production build serves the new intro/demo:
  `npm run build && npm run preview`, confirm fresh-load shows the overlay and
  the demo runs and restores state.
- README: add a "Play it" link to the Vercel deployment, describe the demo, and
  embed/link the committed screenshots.
- `public/about.html`: add a screenshots section linking the committed PNGs.

## Testing

- E2E: fresh save shows `IntroScene`; **Watch demo** starts the demo and
  **Skip** restores state. Assert the real save key `idledungeonlife_save` is
  untouched by a demo run (no demo save persisted).
- Unit: the scenario beat-runner correctly threads events/time through the
  reducer (deterministic), and the persistence guard suppresses `saveToDisk`
  while `demoActive`.
- Regression: existing unit + e2e suites (167 green) stay green.

## Risks

- Scene restart timing during demo beats could flicker; mitigate with a
  brief hold and a single restart per beat.
- `IntroScene` must layer correctly with `HudScene` (bring-to-top ordering).
- Screenshot stability across machines — wait on render hooks, fixed canvas
  size (`LAYOUT.width/height`), and `roundPixels` already set.
