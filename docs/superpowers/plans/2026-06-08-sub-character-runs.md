# Sub-character Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sub-characters actually run — surface Idle/Running/Fallen status with Start/Claim controls, and add an engine that ages, auto-delves, and kills each sub's life both live and offline.

**Architecture:** Reuse the existing sim machinery. `advanceRun` (sim/step.ts) + `BaselinePolicy` (sim/policies.ts) already auto-play a full life on a `SaveFile`. A `SubCharacter` carries its own `meta` + `currentRun`, so a new pure function `advanceSubCharacters(save, now)` advances each sub by running that machinery on a per-sub "view" and writing back only `meta` + `currentRun`. It is driven live from `HudScene.onTick`, offline from the `GameController` constructor, and in tests from `__test.advanceTime`.

**Tech Stack:** TypeScript, Phaser 3, Vitest (unit), Playwright (e2e).

---

## File Structure

- **Create** `src/sim/subRunner.ts` — `advanceSubCharacters(save, now, stepSec?)`. Pure, no Phaser/I/O.
- **Create** `tests/unit/sub-runner.test.ts` — unit tests for the engine.
- **Create** `tests/e2e/sub-characters-run.spec.ts` — end-to-end flow.
- **Modify** `src/app/game.ts` — add `advanceSubs(now)`; advance subs after offline reconcile.
- **Modify** `src/app/bootstrap.ts` — `__test.advanceTime` also advances subs.
- **Modify** `src/ui/scenes/HudScene.ts` — drive sub ticking + refresh `SubCharactersScene`.
- **Modify** `src/ui/scenes/SubCharactersScene.ts` — status line, vitality bar, Start/Claim buttons.

### Reference signatures (already in the codebase)

- `advanceRun(state: SaveFile, startUnixSec: number, durationSec: number, stepSec: number, policy?: Policy): SaveFile` — `src/sim/step.ts`
- `class BaselinePolicy implements Policy` — `src/sim/policies.ts`
- `reduceGame(state: SaveFile, event: GameEvent): SaveFile` — `src/core/reducer.ts`
- `computeLegacyAshBreakdown(run: RunState): { total: number; ... }` — `src/core/scoring.ts`
- `BALANCE.maxOfflineSec` = `86400` — `src/content/balance.ts`
- Events: `{ type: "START_SUBCHARACTER_RUN"; subCharId: string; nowUnixSec: number }`, `{ type: "CLAIM_SUBCHARACTER_DEATH"; subCharId: string; nowUnixSec: number }`, `{ type: "CREATE_SUBCHARACTER"; name: string; nowUnixSec: number }`, `{ type: "DEBUG_SET_SUBCHARACTERS_UNLOCKED"; unlocked: boolean }` — `src/core/events.ts`
- Reducer rules: `START_SUBCHARACTER_RUN` no-ops if the sub already has a `currentRun`; `CLAIM_SUBCHARACTER_DEATH` no-ops unless `currentRun` exists and is dead.

---

## Task 1: The engine — `advanceSubCharacters`

**Files:**
- Create: `src/sim/subRunner.ts`
- Test: `tests/unit/sub-runner.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sub-runner.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { freshSave } from "../../src/core/save";
import { reduceGame } from "../../src/core/reducer";
import { advanceSubCharacters } from "../../src/sim/subRunner";
import type { SaveFile } from "../../src/core/types";

const NOW = 1000;

// A save with sub-characters unlocked and one created sub (id "sub_0").
function withOneSub(): SaveFile {
  let save = freshSave(NOW);
  save = reduceGame(save, { type: "DEBUG_SET_SUBCHARACTERS_UNLOCKED", unlocked: true });
  save = reduceGame(save, { type: "CREATE_SUBCHARACTER", name: "Probe", nowUnixSec: NOW });
  return save;
}

function setAuto(save: SaveFile, enabled: boolean): SaveFile {
  return reduceGame(save, {
    type: "TOGGLE_SUBCHARACTER_AUTOMATION",
    subCharId: "sub_0",
    enabled,
    nowUnixSec: NOW,
  });
}

describe("advanceSubCharacters", () => {
  it("does nothing when there are no sub-characters", () => {
    const save = freshSave(NOW);
    expect(advanceSubCharacters(save, NOW + 10)).toBe(save);
  });

  it("leaves an idle sub idle when automation is off", () => {
    const save = withOneSub();
    const next = advanceSubCharacters(save, NOW + 60);
    expect(next.subCharacters[0].currentRun).toBeNull();
  });

  it("auto-starts an idle sub when automation is on", () => {
    const save = setAuto(withOneSub(), true);
    const next = advanceSubCharacters(save, NOW + 1);
    expect(next.subCharacters[0].currentRun?.alive).toBe(true);
  });

  it("ages a running sub to death over a long span (automation off => Fallen)", () => {
    let save = withOneSub();
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });
    expect(save.subCharacters[0].currentRun?.alive).toBe(true);

    const next = advanceSubCharacters(save, NOW + 86400, 30);
    const run = next.subCharacters[0].currentRun;
    expect(run).not.toBeNull();
    expect(run!.alive).toBe(false); // Fallen, awaiting manual claim
  });

  it("auto-claims and restarts a fallen run when automation is on", () => {
    let save = setAuto(withOneSub(), true);
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });

    const next = advanceSubCharacters(save, NOW + 86400, 30);
    const sub = next.subCharacters[0];
    expect(sub.stats.totalRunsCompleted).toBeGreaterThanOrEqual(1); // a life was claimed
    expect(sub.meta.legacyAsh).toBeGreaterThan(0); // ash banked
    expect(sub.currentRun?.alive).toBe(true); // a fresh life started
  });

  it("does not mutate the main run or global achievements while advancing a sub", () => {
    let save = setAuto(withOneSub(), true);
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });
    const mainBefore = JSON.stringify(save.currentRun);

    const next = advanceSubCharacters(save, NOW + 3600, 30);
    expect(JSON.stringify(next.currentRun)).toBe(mainBefore);
  });

  it("is deterministic for identical inputs", () => {
    let save = withOneSub();
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });
    const a = advanceSubCharacters(save, NOW + 3600, 30);
    const b = advanceSubCharacters(save, NOW + 3600, 30);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/unit/sub-runner.test.ts`
Expected: FAIL — `Cannot find module '../../src/sim/subRunner'`.

- [ ] **Step 3: Implement `advanceSubCharacters`**

Create `src/sim/subRunner.ts`:

```ts
import type { SaveFile, SubCharacter } from "../core/types";
import { reduceGame } from "../core/reducer";
import { BALANCE } from "../content/balance";
import { advanceRun } from "./step";
import { BaselinePolicy } from "./policies";

const POLICY = new BaselinePolicy();

/**
 * Advance every sub-character's parallel life up to `nowUnixSec`.
 *
 * A running sub is advanced by running the normal run machinery
 * (`advanceRun` + policy) on a per-sub view of the save, writing back only the
 * sub's own `meta` + `currentRun` so global state is untouched. When automation
 * is enabled, a fallen run is claimed and restarted, and an idle sub is started.
 *
 * Pure: `(SaveFile, number) -> SaveFile`. Returns the same reference when nothing
 * changes so callers can skip persistence cheaply.
 */
export function advanceSubCharacters(
  save: SaveFile,
  nowUnixSec: number,
  stepSec = 1
): SaveFile {
  if (save.subCharacters.length === 0) return save;

  let working = save;
  const ids = save.subCharacters.map((s) => s.id);

  for (const id of ids) {
    // 1. Advance a live run.
    const sub = working.subCharacters.find((s) => s.id === id);
    if (!sub) continue;

    if (sub.currentRun?.alive) {
      const start = sub.currentRun.lastTickUnixSec;
      const elapsed = Math.min(nowUnixSec - start, BALANCE.maxOfflineSec);
      if (elapsed > 0) {
        const view: SaveFile = { ...working, meta: sub.meta, currentRun: sub.currentRun };
        const advanced = advanceRun(view, start, elapsed, stepSec, POLICY);
        working = replaceSub(working, id, {
          ...sub,
          meta: advanced.meta,
          currentRun: advanced.currentRun,
        });
      }
    }

    // 2/3. Automation: claim+restart a fallen run, or start an idle one.
    const after = working.subCharacters.find((s) => s.id === id);
    if (!after || !after.automationConfig.enabled) continue;

    if (after.currentRun && !after.currentRun.alive) {
      working = reduceGame(working, {
        type: "CLAIM_SUBCHARACTER_DEATH",
        subCharId: id,
        nowUnixSec,
      });
    }
    const claimed = working.subCharacters.find((s) => s.id === id);
    if (claimed && !claimed.currentRun) {
      working = reduceGame(working, {
        type: "START_SUBCHARACTER_RUN",
        subCharId: id,
        nowUnixSec,
      });
    }
  }

  return working;
}

function replaceSub(save: SaveFile, subId: string, updated: SubCharacter): SaveFile {
  return {
    ...save,
    subCharacters: save.subCharacters.map((s) => (s.id === subId ? updated : s)),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/sub-runner.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/sim/subRunner.ts`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add src/sim/subRunner.ts tests/unit/sub-runner.test.ts
git commit -m "feat: add advanceSubCharacters sub-run engine"
```

---

## Task 2: Drive the engine (live, offline, tests)

**Files:**
- Modify: `src/app/game.ts`
- Modify: `src/app/bootstrap.ts:160-168` (the `__test.advanceTime` hook)
- Modify: `src/ui/scenes/HudScene.ts:59-88` (`onTick`)

- [ ] **Step 1: Add `advanceSubs` to GameController and advance subs after offline reconcile**

In `src/app/game.ts`, add the import near the other core imports:

```ts
import { advanceSubCharacters } from "../sim/subRunner";
```

In the constructor, replace the reconcile branch:

```ts
    if (existing) {
      // Reconcile offline progression
      this.saveFile = reconcileOffline(existing, now);
    } else {
      this.saveFile = freshSave(now);
    }
```

with:

```ts
    if (existing) {
      // Reconcile offline progression (main run), then auto-play subs offline.
      const reconciled = reconcileOffline(existing, now);
      this.saveFile = advanceSubCharacters(reconciled, now, 10);
    } else {
      this.saveFile = freshSave(now);
    }
```

Add this method to the class (after `dispatch`):

```ts
  /** Advance all sub-character lives up to `nowUnixSec`, persisting if changed. */
  advanceSubs(nowUnixSec: number): void {
    const next = advanceSubCharacters(this.saveFile, nowUnixSec, 1);
    if (next !== this.saveFile) {
      this.saveFile = next;
      saveToDisk(this.saveFile);
    }
  }
```

- [ ] **Step 2: Advance subs from the HUD tick**

In `src/ui/scenes/HudScene.ts`, inside `onTick`, after the death check block (the `if (run && !run.alive && !run.currentDungeon) { ... }` block at lines ~71-73) and before the toast block, add:

```ts
    // Advance sub-character lives, then refresh the Subs tab if open.
    (this.game as any).advanceSubs(now);
    if (this.scene.isActive("SubCharactersScene")) {
      this.scene.get("SubCharactersScene").scene.restart();
    }
```

- [ ] **Step 3: Advance subs inside the test-only `advanceTime` hook**

In `src/app/bootstrap.ts`, add the import near the top imports:

```ts
import { advanceSubCharacters } from "../sim/subRunner";
```

Replace the `advanceTime` hook body (lines ~160-168):

```ts
    advanceTime: (ms) => {
      const seconds = Math.max(1, Math.round(ms / 1000));
      const start =
        game.saveFile.currentRun?.lastTickUnixSec ?? game.saveFile.updatedAtUnixSec;
      const advanced = advanceRun(game.saveFile, start, seconds, 1);
      setSave(advanced);
      restartActiveScenes(game);
      return game.saveFile;
    },
```

with:

```ts
    advanceTime: (ms) => {
      const seconds = Math.max(1, Math.round(ms / 1000));
      const start =
        game.saveFile.currentRun?.lastTickUnixSec ?? game.saveFile.updatedAtUnixSec;
      const advanced = advanceRun(game.saveFile, start, seconds, 1);
      const withSubs = advanceSubCharacters(advanced, start + seconds, 10);
      setSave(withSubs);
      restartActiveScenes(game);
      return game.saveFile;
    },
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/app/game.ts src/app/bootstrap.ts src/ui/scenes/HudScene.ts`
Expected: clean.

- [ ] **Step 5: Run the unit suite (no regressions)**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/game.ts src/app/bootstrap.ts src/ui/scenes/HudScene.ts
git commit -m "feat: drive sub-character runs live, offline, and in tests"
```

---

## Task 3: SubCharactersScene status + controls

**Files:**
- Modify: `src/ui/scenes/SubCharactersScene.ts`

- [ ] **Step 1: Add imports and a status helper**

In `src/ui/scenes/SubCharactersScene.ts`, replace the import block at the top:

```ts
import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { FINAL_DUNGEON } from "../../content/dungeons";
```

with:

```ts
import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import { DUNGEON_REGISTRY, FINAL_DUNGEON } from "../../content/dungeons";
import { computeLegacyAshBreakdown } from "../../core/scoring";
import type { SubCharacter } from "../../core/types";

function formatAge(ageSeconds: number): string {
  const m = Math.floor(ageSeconds / 60);
  const s = Math.floor(ageSeconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
```

- [ ] **Step 2: Replace the occupied-slot rendering with status + controls**

In `create()`, replace the entire `else { // Occupied slot ... }` block (the body that runs when `sub` exists, currently drawing the card rectangle, name, the `Path: ...` line, and the AUTO toggle) with a single call:

```ts
      } else {
        this.drawSubCard(sub, y);
      }
```

Then increase the per-slot vertical step. Replace:

```ts
      y += 70;
      if (y > CONTENT_BOTTOM - 60) break; // Don't overflow
```

with:

```ts
      y += 88;
      if (y > CONTENT_BOTTOM - 70) break; // Don't overflow
```

- [ ] **Step 3: Add the `drawSubCard` method**

Add this method to the `SubCharactersScene` class (after `create()`, before `drawLocked()`):

```ts
  /** One occupied sub-character card: identity, run status, and a context action. */
  private drawSubCard(sub: SubCharacter, y: number): void {
    const run = sub.currentRun;
    const pathStr = sub.path ? sub.path.charAt(0).toUpperCase() + sub.path.slice(1) : "—";

    this.add.rectangle(LAYOUT.width / 2, y + 34, LAYOUT.cardWidth, 72, 0x1a1a2e, 0.95);

    this.add.text(P + 8, y, sub.name, {
      fontFamily: FONTS.body,
      fontSize: "14px",
      color: COLORS.textPrimary,
    });

    this.add.text(
      P + 8,
      y + 18,
      `Path: ${pathStr}  |  ${sub.stats.totalRunsCompleted} runs  |  ${Math.floor(sub.meta.legacyAsh)} ash`,
      { fontFamily: FONTS.body, fontSize: "11px", color: COLORS.textSecondary }
    );

    // AUTO toggle — governs auto-restart on death / auto-start when idle.
    const autoOn = sub.automationConfig.enabled;
    const autoBtn = this.add
      .text(LAYOUT.width - P - 8, y, `[AUTO ${autoOn ? "ON" : "OFF"}]`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: autoOn ? COLORS.vitalityHigh : COLORS.textMuted,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    autoBtn.on("pointerup", () => {
      this.dispatch({
        type: "TOGGLE_SUBCHARACTER_AUTOMATION",
        subCharId: sub.id,
        enabled: !autoOn,
        nowUnixSec: this.nowUnixSec,
      });
      this.refresh();
    });

    // Status line + context action.
    if (!run) {
      this.add.text(P + 8, y + 38, "Status: Idle — not running", {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.textMuted,
      });
      this.drawCardButton(y + 52, "[ Start Run ]", () => {
        this.dispatch({ type: "START_SUBCHARACTER_RUN", subCharId: sub.id, nowUnixSec: this.nowUnixSec });
        this.refresh();
      });
    } else if (run.alive) {
      const dungeon = run.currentDungeon
        ? DUNGEON_REGISTRY.get(run.currentDungeon.dungeonId)?.name
        : null;
      const where = dungeon ? ` · delving ${dungeon}` : "";
      this.add.text(
        P + 8,
        y + 38,
        `Status: Running · age ${formatAge(run.lifespan.ageSeconds)} · ${run.lifespan.stage}${where}`,
        { fontFamily: FONTS.body, fontSize: "11px", color: COLORS.vitalityHigh }
      );
      this.drawVitalityBar(P + 8, y + 54, run.lifespan.vitality);
    } else {
      // deepestDungeonIndex is a depthIndex shared by multiple dungeons, so show
      // the depth number rather than guessing a (possibly wrong) dungeon name.
      this.add.text(P + 8, y + 38, `Status: Fallen · reached depth ${run.deepestDungeonIndex}`, {
        fontFamily: FONTS.body,
        fontSize: "11px",
        color: COLORS.vitalityLow,
      });
      const ash = computeLegacyAshBreakdown(run).total;
      this.drawCardButton(y + 52, `[ Claim ${Math.floor(ash)} ash ]`, () => {
        this.dispatch({ type: "CLAIM_SUBCHARACTER_DEATH", subCharId: sub.id, nowUnixSec: this.nowUnixSec });
        this.refresh();
      });
    }
  }

  /** Right-aligned text button inside a card row. */
  private drawCardButton(centerY: number, label: string, onClick: () => void): void {
    const btn = this.add
      .text(LAYOUT.width - P - 8, centerY, label, {
        fontFamily: FONTS.body,
        fontSize: "12px",
        color: COLORS.accent,
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerup", onClick);
  }

  /** Compact vitality bar for a running sub. */
  private drawVitalityBar(x: number, y: number, vitality: number): void {
    const width = 180;
    const height = 8;
    const v01 = Math.max(0, Math.min(1, vitality / 100));
    const color =
      vitality > 60 ? COLORS.vitalityHigh : vitality > 25 ? COLORS.vitalityMid : COLORS.vitalityLow;
    this.add.rectangle(x + width / 2, y + height / 2, width, height, 0x15151f, 1).setStrokeStyle(1, 0x2d2d3d, 1);
    if (v01 > 0) {
      this.add.rectangle(
        x + (width * v01) / 2,
        y + height / 2,
        width * v01,
        height - 2,
        Phaser.Display.Color.HexStringToColor(color).color,
        1
      );
    }
    this.add
      .text(x + width + 8, y - 1, `${Math.floor(vitality)}%`, {
        fontFamily: FONTS.body,
        fontSize: "10px",
        color,
      });
  }
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Run: `npx eslint src/ui/scenes/SubCharactersScene.ts`
Expected: clean.

- [ ] **Step 5: Verify existing sub-character e2e still passes**

Run: `npx playwright test playability`
Expected: PASS — the existing "sub-characters stay locked until the gate" test still finds `[ Create Sub ]` and `[AUTO OFF]`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/scenes/SubCharactersScene.ts
git commit -m "feat: show sub-character run status with Start/Claim controls"
```

---

## Task 4: End-to-end flow test

**Files:**
- Create: `tests/e2e/sub-characters-run.spec.ts`

- [ ] **Step 1: Write the e2e test**

Create `tests/e2e/sub-characters-run.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import {
  captureBrowserErrors,
  emitSceneButtonByText,
  expectNoBrowserErrors,
  getSceneTexts,
  resetApp,
} from "./helpers";

test.describe("sub-character runs", () => {
  test("start a sub run, watch it fall, then claim ash", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await resetApp(page);

    // Unlock subs and create one.
    await page.evaluate(() => {
      const t = (window as any).__test;
      t.dispatch({ type: "DEBUG_SET_SUBCHARACTERS_UNLOCKED", unlocked: true });
      t.dispatch({ type: "CREATE_SUBCHARACTER", name: "Probe", nowUnixSec: Math.floor(Date.now() / 1000) });
      t.startScene("SubCharactersScene");
    });

    let texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.includes("Idle — not running"))).toBe(true);

    // Start the run.
    await emitSceneButtonByText(page, "SubCharactersScene", "[ Start Run ]");
    await page.waitForTimeout(150);
    texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.startsWith("Status: Running"))).toBe(true);

    // Age the sub until it falls. Pure aging kills by 1800s (100 vitality over
    // 30 min); loop in 2-min steps, capped well past that to survive trait variance.
    const fell = await page.evaluate(() => {
      const t = (window as any).__test;
      for (let i = 0; i < 30; i++) {
        t.advanceTime(120_000); // +2 min
        const sub = t.getSave().subCharacters[0];
        if (sub.currentRun && !sub.currentRun.alive) return true;
      }
      return false;
    });
    expect(fell).toBe(true);

    await page.evaluate(() => (window as any).__test.startScene("SubCharactersScene"));
    texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.startsWith("Status: Fallen"))).toBe(true);

    const ashBefore = await page.evaluate(
      () => (window as any).__test.getSave().subCharacters[0].meta.legacyAsh
    );

    // Claim the fallen run.
    const claimLabel = texts.find((s) => s.startsWith("[ Claim "))!;
    await emitSceneButtonByText(page, "SubCharactersScene", claimLabel);
    await page.waitForTimeout(150);

    const sub = await page.evaluate(() => (window as any).__test.getSave().subCharacters[0]);
    expect(sub.meta.legacyAsh).toBeGreaterThan(ashBefore);
    expect(sub.stats.totalRunsCompleted).toBeGreaterThanOrEqual(1);
    expect(sub.currentRun).toBeNull(); // back to Idle

    texts = await getSceneTexts(page, "SubCharactersScene");
    expect(texts.some((s) => s.includes("Idle — not running"))).toBe(true);

    expectNoBrowserErrors(errors);
  });
});
```

- [ ] **Step 2: Run the e2e test**

Run: `npx playwright test sub-characters-run`
Expected: PASS.

- [ ] **Step 3: Run the full suites**

Run: `npx vitest run`
Run: `npx playwright test`
Expected: unit all pass; e2e all pass except the pre-existing `run-flow` porter-gold assertion (known-unrelated; confirm no *new* failures).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/sub-characters-run.spec.ts
git commit -m "test: e2e sub-character start/fall/claim flow"
```

---

## Task 5: Manual visual check + finish

- [ ] **Step 1: Capture the Subs tab with a running and a fallen sub**

Add a temporary spec `tests/e2e/_subshot.spec.ts`:

```ts
import { test } from "@playwright/test";
import { resetApp } from "./helpers";

test("capture subs", async ({ page }) => {
  await resetApp(page);
  await page.evaluate(() => {
    const t = (window as any).__test;
    t.dispatch({ type: "DEBUG_SET_SUBCHARACTERS_UNLOCKED", unlocked: true });
    t.dispatch({ type: "CREATE_SUBCHARACTER", name: "Probe", nowUnixSec: Math.floor(Date.now() / 1000) });
    t.dispatch({ type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: Math.floor(Date.now() / 1000) });
    t.startScene("SubCharactersScene");
  });
  await page.waitForTimeout(300);
  await page.locator("canvas").first().screenshot({ path: ".runtime/subs.png" });
});
```

Run: `npx playwright test _subshot`
Then read `.runtime/subs.png` and confirm: status line, vitality bar, and the AUTO/Start controls render without overlap.

- [ ] **Step 2: Remove the temporary screenshot spec**

```bash
rm tests/e2e/_subshot.spec.ts .runtime/subs.png
```

- [ ] **Step 3: Final typecheck + lint + format**

Run: `npx tsc --noEmit`
Run: `npx eslint src`
Run: `npx prettier --check src tests/unit`
Expected: clean (run `npx prettier --write src tests/unit` if the check flags formatting).

- [ ] **Step 4: Commit any formatting fixes**

```bash
git add -A
git commit -m "chore: format sub-character run changes"
```

---

## Self-Review notes

- **Spec coverage:** unlock (no change, documented) ✓; states Idle/Running/Fallen ✓ (Task 3 status line); engine reuse via view + write-back ✓ (Task 1); auto-claim/restart/idle-start ✓ (Task 1); live drive ✓ (Task 2, HUD); offline drive ✓ (Task 2, constructor); UI Start/Claim/AUTO ✓ (Task 3); unit + e2e tests ✓ (Tasks 1, 4).
- **Dropped rotation:** `automationConfig.dungeonIds` is simply not consumed; no schema change, no UI — consistent with the spec decision. The dead `AUTO_RUN_SUBCHARACTER` reducer case is left untouched (out of scope).
- **Type consistency:** `advanceSubCharacters(save, now, stepSec?)` is called with `(reconciled, now, 10)`, `(this.saveFile, now, 1)`, `(advanced, start+seconds, 1)`, and in tests — signatures match. Event shapes match `events.ts`.
- **Known limitation:** offline advancement simulates at most one life per sub then restarts at `now`; remaining offline time is not chained into subsequent lives. Acceptable for v1 (noted in spec risks).
