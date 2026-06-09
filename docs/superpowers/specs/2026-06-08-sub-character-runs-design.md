# Sub-character runs: status display + run engine

**Date:** 2026-06-08
**Status:** Approved (design)

## Problem

Sub-characters can be unlocked and created, but the feature is half-wired:

- The `SubCharactersScene` card shows name/path/runs/ash and an `[AUTO ON/OFF]`
  toggle that does nothing functional. There is no indication of whether a sub is
  running, and no way to start or claim a run.
- `START_SUBCHARACTER_RUN` and `CLAIM_SUBCHARACTER_DEATH` exist in the reducer, but
  nothing advances a sub's run. A started sub would sit `alive` forever — it never
  ages, delves, or dies.

The player creates a sub and "they don't start running," with no UI feedback.

## Goal

1. Surface each sub's run state clearly (Idle / Running / Fallen).
2. Give the player controls: start a run, claim a fallen run.
3. Build the engine so a running sub actually ages, auto-delves its unlocked
   dungeons, and eventually dies — both live and offline.

Out of scope: changing the unlock requirement (already correct), per-dungeon
rotation UI, naming/customizing subs beyond the existing default name.

## Unlock requirement (no change)

Subs unlock when the **final dungeon** (`the_wound`, the deepest `depthIndex`) is
cleared by the first character — `reducer.ts` `COMPLETE_DUNGEON`, via
`FINAL_DUNGEON`. The locked screen already explains this. Left as-is.

## Run states

Derived from `sub.currentRun`:

| State    | Condition                          | Meaning                          |
|----------|------------------------------------|----------------------------------|
| Idle     | `currentRun === null`              | Not running; awaiting start      |
| Running  | `currentRun.alive === true`        | Aging + auto-delving             |
| Fallen   | `currentRun && !currentRun.alive`  | Dead; ash awaiting claim         |

No new persisted state is required — state is a function of `currentRun`.

## Engine: `sim/subRunner.ts`

The sim layer already auto-plays a complete life:

- `advanceRun(save, start, durationSec, stepSec, policy)` (sim/step.ts) ticks aging
  and completes dungeons.
- `BaselinePolicy` (sim/policies.ts) decides actions: assign best job, unlock,
  equip, talent, start best affordable dungeon.

A `SubCharacter` carries its own `meta` (independent legacy progression) and
`currentRun`. So a sub is advanced by running the same machinery on a per-sub
**view** of the save file.

```ts
export function advanceSubCharacters(save: SaveFile, nowUnixSec: number): SaveFile
```

For each sub, in order:

1. **Running** (`currentRun?.alive`): build
   `view = { ...save, meta: sub.meta, currentRun: sub.currentRun }`, then
   `advanced = advanceRun(view, sub.currentRun.lastTickUnixSec, elapsed, stepSec, policy)`
   where `elapsed = nowUnixSec - lastTickUnixSec`. Copy **only** `advanced.meta`
   and `advanced.currentRun` back into the sub. Global `achievements`,
   `subCharactersUnlocked`, and the top-level run are untouched by the advance.
2. **Just Fallen + AUTO on**: `reduceGame(save, CLAIM_SUBCHARACTER_DEATH)` then
   `reduceGame(save, START_SUBCHARACTER_RUN)` → continuous parallel life. Claim
   already banks ash and credits global achievement milestones (existing logic).
3. **Idle + AUTO on**: `reduceGame(save, START_SUBCHARACTER_RUN)`.
4. **AUTO off**: a Fallen sub stays Fallen until the player clicks Claim; an Idle
   sub stays Idle until the player clicks Start.

`stepSec`: small (1s) live, coarser (e.g. 10s) offline for performance. Dungeon
completion is step-size independent (`stepRun` checks `completesAt <= now`); only
passive trait-reveal/momentum granularity is mildly affected, which is acceptable.

**Module placement:** `sim/subRunner.ts` lives in `sim/`, which already imports
`core/reducer`. The reducer must not import sim (would create a cycle), so the
orchestration lives in the sim/app layer, not as a reducer action.

### Isolation notes

- `advanceSubCharacters` is a pure `(SaveFile, number) -> SaveFile`. No I/O, no
  Phaser. Fully unit-testable.
- Writing back only `meta` + `currentRun` is the well-defined boundary that keeps a
  sub's simulated life from leaking into global state. Claim is the single,
  intentional path by which a sub contributes to global achievements + its own ash.

## Driving the engine

- **Live:** `HudScene.onTick` already runs every second for the main character.
  Extend it to also advance subs through a new `GameController` method
  (`advanceSubs(now)`) that calls `advanceSubCharacters` and persists — mirroring
  how `dispatch` persists. The controller (app layer) may import sim.
- **Offline:** in `GameController` construction, after the existing
  `reconcileOffline(existing, now)`, advance subs up to `now`, capped by
  `BALANCE.maxOfflineSec` like the main run.

The player-facing reducer actions (`START_SUBCHARACTER_RUN`,
`CLAIM_SUBCHARACTER_DEATH`) are unchanged and still dispatched from the UI.

## UI: `SubCharactersScene`

Each occupied card gains a **Status** line and a context-appropriate button:

```
Character 1
Path: —  |  3 runs  |  42 ash
Status: Idle — not running               [ Start Run ]
```
```
Character 2
Path: Abyss  |  5 runs  |  88 ash
Status: Running · age 4m · prime · delving Grave Hollow
Vitality ████████░░ 78%                   [AUTO ON]
```
```
Character 3
Status: Fallen · reached Sunken Archive   [ Claim 14 ash ]
```

- **Idle** → `[ Start Run ]` dispatches `START_SUBCHARACTER_RUN`.
- **Fallen** → `[ Claim N ash ]` dispatches `CLAIM_SUBCHARACTER_DEATH` (N from
  `computeLegacyAshBreakdown(run).total`).
- **`[AUTO ON/OFF]`** stays; now means "auto-restart this sub's life on death"
  (and auto-start when idle).
- Card height grows to fit the status + vitality rows; the existing
  `CONTENT_BOTTOM` overflow guard and `N / 5` footer remain.

Manual `[ Start Run ]` is available even with AUTO off (hand-run a single life).

## Decisions

- AUTO governs only auto-restart/auto-start, not a per-dungeon rotation. The policy
  already picks the best affordable unlocked dungeon, so the unused
  `automationConfig.dungeonIds` rotation is dropped rather than given UI.
- Sub run advancement writes back only `meta` + `currentRun`; global achievement
  credit happens once, at claim, via existing `CLAIM_SUBCHARACTER_DEATH` logic.

## Testing

**Unit (`tests/unit`, `advanceSubCharacters`):**
- Idle sub with AUTO on starts a run after one advance.
- Running sub ages over simulated time and eventually dies (becomes Fallen).
- Fallen sub with AUTO on auto-claims (ash increases, `totalRunsCompleted`
  increments) and restarts (new alive `currentRun`).
- Fallen sub with AUTO off stays Fallen; manual `CLAIM_SUBCHARACTER_DEATH` banks
  ash and returns it to Idle.
- Offline catch-up: a single advance over a large elapsed span progresses the sub
  (capped by `maxOfflineSec`), and does not mutate the main run or global
  achievements except through claim.
- Determinism: same inputs → same outputs (seeded), consistent with existing
  determinism tests.

**E2e (`tests/e2e`):**
- Unlock subs (debug), create a sub, `[ Start Run ]` → status shows Running.
- Advance time → status reaches Fallen → `[ Claim ]` increments ash and returns to
  Idle.
- No browser errors.

## Risks

- **Performance on long offline spans** with many subs: bounded by `maxOfflineSec`
  and coarse offline `stepSec`. Acceptable; revisit only if profiling shows cost.
- **Save migration:** no schema change (no new persisted fields), so existing saves
  load unchanged. Dropping `dungeonIds` usage does not require removing the field
  from existing saves.
