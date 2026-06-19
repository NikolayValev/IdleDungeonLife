# Portfolio-Ready Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Idle Dungeon Life portfolio-ready: a first-run welcome overlay, an in-app auto-play demo, auto-generated stage/level screenshots committed to the repo, and refreshed README/about-page links.

**Architecture:** A sandboxed real-reducer demo plays a scripted scenario against a throwaway in-memory save while disk persistence is suppressed, then restores the visitor's save. A new `IntroScene` gates fresh visitors. A dedicated Playwright config drives the existing dev hooks to capture canonical states as PNGs.

**Tech Stack:** Phaser 3.90, TypeScript 5.9, Vite 8, Vitest (`tests/unit/*.test.ts`, node env, import from `../../src/...`), Playwright (Edge, port 5174).

---

## File Structure

- `src/app/game.ts` (modify) — `GameController`: add `demoActive`, `advanceTime()`, `enterDemo()`/`exitDemo()`, `isFreshInstall`, and persistence guards.
- `src/app/demo/scenario.ts` (create) — pure `DemoBeat[]` scenario data + timing constant.
- `src/app/demo/DemoRunner.ts` (create) — pure beat-stepper driven by an injected `DemoHost`.
- `src/ui/scenes/IntroScene.ts` (create) — welcome overlay with Play / Watch demo.
- `src/ui/scenes/DemoScene.ts` (create) — caption banner + Skip button; wires `DemoRunner` to Phaser timers and the live `GameController`.
- `src/app/bootstrap.ts` (modify) — register new scenes; route fresh visitors to `IntroScene`.
- `src/ui/scenes/HudScene.ts` (modify) — add a "?" button that reopens `IntroScene`.
- `tests/screenshots/capture.spec.ts` (create) — canonical-state PNG capture.
- `playwright.screenshots.config.ts` (create) — dedicated config (separate from `test:e2e`).
- `tests/unit/demo-scenario.test.ts` + `tests/unit/demo-runner.test.ts` (create) — unit coverage for the two Phaser-free modules.
- `tests/e2e/intro-demo.spec.ts` (create) — intro/demo e2e.
- `README.md`, `public/about.html` (modify) — link the committed screenshots and the live URL.
- `artifacts/screenshots/*.png` (create, committed).
- `package.json` (modify) — add `screenshots` script.

> **Unit test note:** Unit tests are **Vitest** `tests/unit/*.test.ts` files that import directly from `../../src/...` (see `tests/unit/alignment.test.ts`). The Vitest `environment` is `node`, so a test must NOT import any module that pulls in Phaser at module load — `src/app/game.ts` does (`import Phaser from "phaser"`), so do not unit-test it directly. The two new unit tests target only Phaser-free modules (`scenario.ts`, `DemoRunner.ts`). Run with `npm run test:unit`.

---

## Task 1: GameController demo-safety (persistence guard + advanceTime)

**Files:**
- Modify: `src/app/game.ts`

> No unit test here: `GameController` extends `Phaser.Game` and `game.ts` imports Phaser at module load, which is awkward under Vitest's node environment. The exact behavior implemented in this task (no persistence while a demo runs; snapshot restored on exit) is asserted end-to-end by the Task 8 e2e test, which reads the real `idledungeonlife_save` localStorage key before/during/after a demo. Verify this task with `npm run build`.

- [ ] **Step 1: Implement**

In `src/app/game.ts`, add the import and the demo-safe logic. Add to the top imports:

```ts
import { advanceRun } from "../sim/step";
```

Add fields and methods to `GameController`:

```ts
  demoActive = false;
  readonly isFreshInstall: boolean;
  private _demoSnapshot: SaveFile | null = null;
```

Set `isFreshInstall` in the constructor where `existing` is computed:

```ts
    const existing = loadFromDisk();
    this.isFreshInstall = existing === null;
```

Guard persistence in `dispatch`:

```ts
  dispatch(event: GameEvent): void {
    try {
      this.saveFile = reduceGame(this.saveFile, event);
      if (!this.demoActive) saveToDisk(this.saveFile);
    } catch (err) {
      console.error("[GameController] dispatch error for event", event.type, err);
    }
  }
```

Guard the persist loop:

```ts
  private _persistLoop(): void {
    setInterval(() => {
      if (!this.demoActive) saveToDisk(this.saveFile);
    }, 10_000);
  }
```

Add the time-advance method (shared with dev hooks later) and demo lifecycle:

```ts
  advanceTime(ms: number): SaveFile {
    const seconds = Math.max(1, Math.round(ms / 1000));
    const start =
      this.saveFile.currentRun?.lastTickUnixSec ?? this.saveFile.updatedAtUnixSec;
    const advanced = advanceRun(this.saveFile, start, seconds, 1);
    this.saveFile = advanceSubCharacters(advanced, start + seconds, 10);
    if (!this.demoActive) saveToDisk(this.saveFile);
    return this.saveFile;
  }

  enterDemo(nowUnixSec: number): void {
    this._demoSnapshot = this.saveFile;
    this.demoActive = true;
    this.saveFile = freshSave(nowUnixSec);
  }

  exitDemo(): void {
    if (this._demoSnapshot) this.saveFile = this._demoSnapshot;
    this._demoSnapshot = null;
    this.demoActive = false;
    saveToDisk(this.saveFile);
  }
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: 0 TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/game.ts
git commit -m "feat: demo-safe GameController (persistence guard + advanceTime)"
```

---

## Task 2: Demo scenario data

**Files:**
- Create: `src/app/demo/scenario.ts`
- Test: `tests/unit/demo-scenario.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/demo-scenario.test.ts
import { test, expect } from "vitest";
import { buildDemoScenario, DEMO_HOLD_MS } from "../../src/app/demo/scenario";

test("scenario beats are well-formed", () => {
  const beats = buildDemoScenario();
  expect(beats.length).toBeGreaterThanOrEqual(8);
  expect(DEMO_HOLD_MS).toBeGreaterThanOrEqual(1000);
  for (const beat of beats) {
    expect(typeof beat.caption).toBe("string");
    expect(beat.caption.length).toBeGreaterThan(0);
    expect(["dispatch", "advanceTime", "switchScene"]).toContain(beat.kind);
    if (beat.kind === "dispatch") {
      expect(typeof beat.event(1000).type).toBe("string");
    }
    if (beat.kind === "advanceTime") expect(beat.ms).toBeGreaterThan(0);
    if (beat.kind === "switchScene") expect(typeof beat.sceneKey).toBe("string");
  }
});

test("scenario starts a run and ends on the death screen", () => {
  const beats = buildDemoScenario();
  const first = beats[0];
  expect(first.kind).toBe("dispatch");
  if (first.kind === "dispatch") expect(first.event(1000).type).toBe("START_NEW_RUN");
  const last = beats[beats.length - 1];
  expect(last.kind).toBe("switchScene");
  if (last.kind === "switchScene") expect(last.sceneKey).toBe("DeathScene");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/app/demo/scenario.ts
import type { GameEvent } from "../../core/events";

export type DemoBeat =
  | { kind: "dispatch"; event: (nowUnixSec: number) => GameEvent; caption: string }
  | { kind: "advanceTime"; ms: number; caption: string }
  | { kind: "switchScene"; sceneKey: string; caption: string };

export const DEMO_HOLD_MS = 2600;

export function buildDemoScenario(): DemoBeat[] {
  return [
    { kind: "dispatch", event: (now) => ({ type: "START_NEW_RUN", nowUnixSec: now }), caption: "Every character lives once. A new life begins." },
    { kind: "switchScene", sceneKey: "MainScene", caption: "Born into the Abandoned Chapel." },
    { kind: "dispatch", event: () => ({ type: "ASSIGN_JOB", jobId: "porter" }), caption: "Honest work as a Porter funds the descent." },
    { kind: "advanceTime", ms: 120_000, caption: "Time passes. Gold accrues; the body ages." },
    { kind: "dispatch", event: (now) => ({ type: "START_DUNGEON", dungeonId: "abandoned_chapel", nowUnixSec: now }), caption: "Into the first dungeon." },
    { kind: "switchScene", sceneKey: "DungeonsScene", caption: "The Abandoned Chapel yields its secrets." },
    { kind: "advanceTime", ms: 90_000, caption: "Delving deeper..." },
    { kind: "switchScene", sceneKey: "CodexScene", caption: "Every discovery is recorded in the Codex." },
    { kind: "switchScene", sceneKey: "TalentsScene", caption: "Talents reshape the build across a lifetime." },
    { kind: "advanceTime", ms: 600_000, caption: "The years take their toll." },
    { kind: "dispatch", event: () => ({ type: "DEBUG_KILL_RUN" }), caption: "Lifespan spent." },
    { kind: "switchScene", sceneKey: "DeathScene", caption: "Death is progress — legacy ash endures." },
  ];
}
```

> `DEBUG_KILL_RUN` is a real reducer event (see `src/core/events.ts` / `src/app/debug.ts`), valid in production builds. The demo uses the real reducer, so this is authentic state.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/demo/scenario.ts tests/unit/demo-scenario.test.ts
git commit -m "feat: demo scenario beats"
```

---

## Task 3: DemoRunner (pure beat-stepper)

**Files:**
- Create: `src/app/demo/DemoRunner.ts`
- Test: `tests/unit/demo-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/demo-runner.test.ts
import { test, expect } from "vitest";
import { DemoRunner, type DemoHost } from "../../src/app/demo/DemoRunner";
import type { DemoBeat } from "../../src/app/demo/scenario";

function fakeHost() {
  const calls: Array<[string, unknown]> = [];
  const host: DemoHost & { calls: typeof calls; cancelled: boolean } = {
    calls,
    cancelled: false,
    dispatch: (e) => calls.push(["dispatch", e.type]),
    advanceTime: (ms) => calls.push(["advanceTime", ms]),
    switchScene: (k) => calls.push(["switchScene", k]),
    setCaption: (c) => calls.push(["caption", c]),
    now: () => 1000,
    isCancelled() { return host.cancelled; },
  };
  return host;
}

test("runBeat dispatches the right host call and sets caption", () => {
  const host = fakeHost();
  const beats: DemoBeat[] = [{ kind: "switchScene", sceneKey: "MainScene", caption: "hi" }];
  const runner = new DemoRunner(beats, host);
  expect(runner.runBeat(0)).toBe(true);
  expect(host.calls).toEqual([["caption", "hi"], ["switchScene", "MainScene"]]);
});

test("runBeat stops past the end and when cancelled", () => {
  const host = fakeHost();
  const beats: DemoBeat[] = [{ kind: "advanceTime", ms: 5, caption: "x" }];
  const runner = new DemoRunner(beats, host);
  expect(runner.runBeat(1)).toBe(false);
  host.cancelled = true;
  expect(runner.runBeat(0)).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/app/demo/DemoRunner.ts
import type { GameEvent } from "../../core/events";
import type { DemoBeat } from "./scenario";

export interface DemoHost {
  dispatch(event: GameEvent): void;
  advanceTime(ms: number): void;
  switchScene(sceneKey: string): void;
  setCaption(text: string): void;
  now(): number;
  isCancelled(): boolean;
}

export class DemoRunner {
  constructor(
    private readonly beats: DemoBeat[],
    private readonly host: DemoHost
  ) {}

  get length(): number {
    return this.beats.length;
  }

  /** Execute the beat at `index`. Returns false when done or cancelled. */
  runBeat(index: number): boolean {
    if (this.host.isCancelled() || index < 0 || index >= this.beats.length) {
      return false;
    }
    const beat = this.beats[index];
    this.host.setCaption(beat.caption);
    switch (beat.kind) {
      case "dispatch":
        this.host.dispatch(beat.event(this.host.now()));
        break;
      case "advanceTime":
        this.host.advanceTime(beat.ms);
        break;
      case "switchScene":
        this.host.switchScene(beat.sceneKey);
        break;
    }
    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/demo/DemoRunner.ts tests/unit/demo-runner.test.ts
git commit -m "feat: DemoRunner beat-stepper"
```

---

## Task 4: IntroScene (welcome overlay)

**Files:**
- Create: `src/ui/scenes/IntroScene.ts`

This scene has no headless unit test (Phaser rendering); it is covered by the e2e test in Task 8. Verify via build + the e2e spec.

- [ ] **Step 1: Implement IntroScene**

```ts
// src/ui/scenes/IntroScene.ts
import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";

const P = LAYOUT.padding;

export class IntroScene extends BaseScene {
  constructor() {
    super({ key: "IntroScene" });
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);

    let y = LAYOUT.height * 0.22;

    this.add
      .text(LAYOUT.width / 2, y, "Idle Dungeon Life", {
        fontFamily: FONTS.heading,
        fontSize: "28px",
        color: COLORS.accent,
      })
      .setOrigin(0.5, 0);
    y += 44;

    this.add
      .text(LAYOUT.width / 2, y, "Every character lives once.", {
        fontFamily: FONTS.flavor,
        fontSize: "16px",
        color: COLORS.accentHoly,
        fontStyle: "italic",
      })
      .setOrigin(0.5, 0);
    y += 48;

    this.add
      .text(
        LAYOUT.width / 2,
        y,
        "An idle RPG. Send an adventurer into ancient dungeons; they age in real time, gather traits, and push deeper until their lifespan runs out. Death is progress — legacy ash funds the next life.",
        {
          fontFamily: FONTS.body,
          fontSize: "13px",
          color: COLORS.textSecondary,
          align: "center",
          wordWrap: { width: LAYOUT.width - P * 4 },
        }
      )
      .setOrigin(0.5, 0);
    y += 130;

    this.makeButton(y, "[ Play ]", COLORS.accent, () => this.startPlaying());
    y += 44;
    this.makeButton(y, "[ Watch demo ]", COLORS.textSecondary, () => {
      this.scene.start("DemoScene");
    });
  }

  private makeButton(y: number, label: string, color: string, onClick: () => void): void {
    const btn = this.add
      .text(LAYOUT.width / 2, y, label, {
        fontFamily: FONTS.body,
        fontSize: "18px",
        color,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerover", () => btn.setColor(COLORS.vitalityHigh));
    btn.on("pointerout", () => btn.setColor(color));
    btn.on("pointerup", onClick);
  }

  private startPlaying(): void {
    if (!this.saveFile.currentRun) {
      this.dispatch({ type: "START_NEW_RUN", nowUnixSec: this.nowUnixSec });
    }
    if (!this.scene.isActive("HudScene")) this.scene.run("HudScene");
    this.scene.run("MainScene");
    this.scene.bringToTop("HudScene");
    this.scene.stop("IntroScene");
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: 0 TS errors. (`DemoScene` is referenced by string key and added in Task 5/6; that is fine.)

- [ ] **Step 3: Commit**

```bash
git add src/ui/scenes/IntroScene.ts
git commit -m "feat: IntroScene welcome overlay"
```

---

## Task 5: DemoScene (wires DemoRunner to Phaser + live controller)

**Files:**
- Create: `src/ui/scenes/DemoScene.ts`

Covered by e2e in Task 8.

- [ ] **Step 1: Implement DemoScene**

```ts
// src/ui/scenes/DemoScene.ts
import { BaseScene } from "./BaseScene";
import { COLORS, FONTS, LAYOUT } from "../theme";
import type { GameController } from "../../app/game";
import { DemoRunner, type DemoHost } from "../../app/demo/DemoRunner";
import { buildDemoScenario, DEMO_HOLD_MS } from "../../app/demo/scenario";

const CONTENT_SCENES = [
  "MainScene",
  "JobsScene",
  "DungeonsScene",
  "InventoryScene",
  "TalentsScene",
  "CodexScene",
  "DeathScene",
  "SubCharactersScene",
  "AchievementsScene",
];

export class DemoScene extends BaseScene {
  private cancelled = false;
  private captionText!: Phaser.GameObjects.Text;
  private index = 0;
  private runner!: DemoRunner;

  constructor() {
    super({ key: "DemoScene" });
  }

  create(): void {
    this.cancelled = false;
    this.index = 0;
    const game = this.game as GameController;
    game.enterDemo(this.nowUnixSec);

    const host: DemoHost = {
      dispatch: (event) => game.dispatch(event),
      advanceTime: (ms) => game.advanceTime(ms),
      switchScene: (key) => this.showDemoScene(key),
      setCaption: (text) => this.captionText.setText(text),
      now: () => this.nowUnixSec,
      isCancelled: () => this.cancelled,
    };
    this.runner = new DemoRunner(buildDemoScenario(), host);

    this.drawChrome();
    this.step();
  }

  private drawChrome(): void {
    this.add
      .rectangle(0, LAYOUT.height - 92, LAYOUT.width, 92, 0x000000, 0.78)
      .setOrigin(0, 0);
    this.captionText = this.add
      .text(LAYOUT.width / 2, LAYOUT.height - 76, "", {
        fontFamily: FONTS.flavor,
        fontSize: "14px",
        color: COLORS.textPrimary,
        align: "center",
        wordWrap: { width: LAYOUT.width - 48 },
      })
      .setOrigin(0.5, 0);

    const skip = this.add
      .text(LAYOUT.width / 2, LAYOUT.height - 26, "[ Skip demo ]", {
        fontFamily: FONTS.body,
        fontSize: "13px",
        color: COLORS.accent,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    skip.on("pointerup", () => this.endDemo());
  }

  private step(): void {
    if (!this.runner.runBeat(this.index)) {
      this.endDemo();
      return;
    }
    this.index += 1;
    this.time.delayedCall(DEMO_HOLD_MS, () => this.step());
  }

  /** Bring a content scene up underneath the demo overlay. */
  private showDemoScene(sceneKey: string): void {
    CONTENT_SCENES.filter((key) => key !== sceneKey && this.scene.isActive(key)).forEach(
      (key) => this.scene.stop(key)
    );
    const target = this.scene.get(sceneKey);
    if (target.scene.isActive()) {
      target.scene.restart();
    } else {
      this.scene.run(sceneKey);
    }
    this.scene.bringToTop("DemoScene");
  }

  private endDemo(): void {
    this.cancelled = true;
    const game = this.game as GameController;
    game.exitDemo();
    CONTENT_SCENES.filter((key) => this.scene.isActive(key)).forEach((key) =>
      this.scene.stop(key)
    );
    this.scene.start("IntroScene");
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: 0 TS errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/scenes/DemoScene.ts
git commit -m "feat: DemoScene auto-play overlay"
```

---

## Task 6: Wire scenes into bootstrap + fresh-visitor routing + HUD reopen

**Files:**
- Modify: `src/app/bootstrap.ts`
- Modify: `src/ui/scenes/HudScene.ts`

- [ ] **Step 1: Register scenes in the config array**

In `src/app/bootstrap.ts`, add imports near the other scene imports:

```ts
import { IntroScene } from "../ui/scenes/IntroScene";
import { DemoScene } from "../ui/scenes/DemoScene";
```

Add both to the `scene:` array (order: put `IntroScene` and `DemoScene` before `HudScene`):

```ts
  scene: [
    MainScene,
    JobsScene,
    DungeonsScene,
    InventoryScene,
    TalentsScene,
    CodexScene,
    DeathScene,
    SubCharactersScene,
    AchievementsScene,
    IntroScene,
    DemoScene,
    HudScene,
  ],
```

- [ ] **Step 2: Route fresh visitors to IntroScene**

Replace the first-launch + READY block in `bootstrap()`:

```ts
  // First-launch: start initial run if no current run
  if (!game.saveFile.currentRun) {
    game.dispatch({ type: "START_NEW_RUN", nowUnixSec: nowUnixSec() });
  }

  // Start HUD overlay after main scene is ready
  game.events.on(Phaser.Core.Events.READY, () => {
    game.scene.start("HudScene");
    game.scene.start("MainScene");
    game.scene.bringToTop("HudScene");
  });
```

with:

```ts
  game.events.on(Phaser.Core.Events.READY, () => {
    if (game.isFreshInstall) {
      // First-time visitor: show the welcome overlay; IntroScene's Play button
      // starts the run + HUD. Do not auto-start a run yet.
      game.scene.start("IntroScene");
      return;
    }
    if (!game.saveFile.currentRun) {
      game.dispatch({ type: "START_NEW_RUN", nowUnixSec: nowUnixSec() });
    }
    game.scene.start("HudScene");
    game.scene.start("MainScene");
    game.scene.bringToTop("HudScene");
  });
```

- [ ] **Step 3: Reuse `GameController.advanceTime` in the dev hook (DRY)**

In `installDevHooks`, replace the body of the `advanceTime` hook so it delegates to the controller method added in Task 1:

```ts
    advanceTime: (ms) => {
      game.advanceTime(ms);
      restartActiveScenes(game);
      return game.saveFile;
    },
```

Remove the now-unused local `advanceRun`/`advanceSubCharacters` imports from `bootstrap.ts` **only if** they are no longer referenced elsewhere in the file; otherwise leave them. Run `npm run lint` to confirm.

- [ ] **Step 4: Add a "?" reopen button to the HUD**

In `src/ui/scenes/HudScene.ts`, at the end of `create()` (after `this.updateHud()` and the timer setup), add a small help button that re-opens the intro overlay:

```ts
    const help = this.add
      .text(LAYOUT.width - 18, 4, "?", {
        fontFamily: FONTS.body,
        fontSize: "16px",
        color: COLORS.textSecondary,
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    help.on("pointerup", () => this.scene.run("IntroScene"));
```

> Do NOT set `__hudElement = true` on the help button. That flag marks elements that `updateHud()` destroys and redraws every tick; the help button is created once in `create()` and must persist. Leaving the flag unset is correct.

- [ ] **Step 5: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: 0 TS errors, no lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/bootstrap.ts src/ui/scenes/HudScene.ts
git commit -m "feat: route fresh visitors to IntroScene + HUD help button"
```

---

## Task 7: Screenshot capture (dedicated Playwright config)

**Files:**
- Create: `playwright.screenshots.config.ts`
- Create: `tests/screenshots/capture.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the npm script**

In `package.json` `scripts`, add:

```json
    "screenshots": "playwright test --config playwright.screenshots.config.ts",
```

- [ ] **Step 2: Create the dedicated config**

```ts
// playwright.screenshots.config.ts
import { defineConfig } from "@playwright/test";

const edgeChannel = process.platform === "win32" ? "msedge" : undefined;

export default defineConfig({
  testDir: "./tests/screenshots",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: edgeChannel,
    headless: true,
    viewport: { width: 1400, height: 1000 },
  },
});
```

> The main `playwright.config.ts` has `testDir: "./tests/e2e"`, so this new spec under `tests/screenshots/` is excluded from `npm run test:e2e`.

- [ ] **Step 3: Write the capture spec**

```ts
// tests/screenshots/capture.spec.ts
import { test } from "@playwright/test";
import { resetApp, getState } from "../e2e/helpers";

const DIR = "artifacts/screenshots";

async function shot(page: import("@playwright/test").Page, name: string): Promise<void> {
  await page.waitForTimeout(600);
  await page.locator("canvas").screenshot({ path: `${DIR}/${name}.png` });
}

async function start(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__test.startScene("MainScene");
  });
  await page.waitForTimeout(300);
}

test("capture canonical screenshots", async ({ page }) => {
  // Fresh load shows the intro overlay.
  await resetApp(page);
  await page.evaluate(() => (window as any).__game.scene.start("IntroScene"));
  await shot(page, "01-intro");

  // Begin a run and capture early life in MainScene.
  await page.evaluate(() => {
    (window as any).__test.dispatch({ type: "START_NEW_RUN", nowUnixSec: Math.floor(Date.now() / 1000) });
    (window as any).__game.scene.start("HudScene");
    (window as any).__test.startScene("MainScene");
    (window as any).__test.dispatch({ type: "ASSIGN_JOB", jobId: "porter" });
  });
  await shot(page, "02-early-chapel");

  // Mid-game dungeon dive.
  await page.evaluate(() => {
    (window as any).__debug.unlockDungeon("sunken_archive");
    (window as any).__test.dispatch({ type: "START_DUNGEON", dungeonId: "sunken_archive", nowUnixSec: Math.floor(Date.now() / 1000) });
    (window as any).__test.startScene("DungeonsScene");
  });
  await shot(page, "03-mid-dungeon");

  // Deep / late dungeon.
  await page.evaluate(() => {
    (window as any).__debug.unlockDungeon("bone_cathedral");
    (window as any).__test.dispatch({ type: "START_DUNGEON", dungeonId: "bone_cathedral", nowUnixSec: Math.floor(Date.now() / 1000) });
    (window as any).__test.startScene("DungeonsScene");
  });
  await shot(page, "04-deep-dungeon");

  // Talents tree.
  await page.evaluate(() => (window as any).__test.startScene("TalentsScene"));
  await shot(page, "05-talents");

  // Codex.
  await page.evaluate(() => (window as any).__test.startScene("CodexScene"));
  await shot(page, "06-codex");

  // Sub-characters.
  await page.evaluate(() => {
    (window as any).__debug.toggleSubCharacters();
    (window as any).__test.startScene("SubCharactersScene");
  });
  await shot(page, "07-subs");

  // Death + legacy screen (advance time for ash, then kill).
  await page.evaluate(() => {
    (window as any).__test.startScene("MainScene");
    (window as any).__test.advanceTime(600_000);
    (window as any).__debug.killRun();
    (window as any).__test.startScene("DeathScene");
  });
  await shot(page, "08-death-legacy");

  // Sanity: hooks still present.
  await getState(page);
});
```

- [ ] **Step 4: Run the capture**

Run: `npm run screenshots`
Expected: PASS; eight PNGs written under `artifacts/screenshots/`. If a `startScene`/dungeon id errors, fix the id against `src/content/dungeons.ts` (valid ids include `abandoned_chapel`, `sunken_archive`, `bone_cathedral`, `the_wound`).

- [ ] **Step 5: Verify PNGs are non-empty**

Run: `node -e "const fs=require('fs');const f=fs.readdirSync('artifacts/screenshots');console.log(f);for(const n of f){if(fs.statSync('artifacts/screenshots/'+n).size<2000)throw new Error('tiny: '+n)}"`
Expected: lists 8 PNGs, none suspiciously tiny.

- [ ] **Step 6: Commit (including the PNGs)**

Confirm `artifacts/` is not git-ignored:

Run: `git check-ignore artifacts/screenshots/01-intro.png || echo "not ignored"`
Expected: prints `not ignored`. If it IS ignored, add a negation rule to `.gitignore` (`!artifacts/screenshots/`) before committing.

```bash
git add playwright.screenshots.config.ts tests/screenshots/capture.spec.ts package.json artifacts/screenshots/*.png
git commit -m "feat: automated stage/level screenshot capture"
```

---

## Task 8: Intro/demo e2e test

**Files:**
- Create: `tests/e2e/intro-demo.spec.ts`

- [ ] **Step 1: Write the test**

```ts
// tests/e2e/intro-demo.spec.ts
import { expect, test } from "@playwright/test";
import { captureBrowserErrors, expectNoBrowserErrors, getSceneTexts, getState, waitForHooks } from "./helpers";

async function freshVisit(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await waitForHooks(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForHooks(page);
}

test.describe("intro + demo", () => {
  test("fresh visitor sees the intro overlay", async ({ page }) => {
    const errors = captureBrowserErrors(page);
    await freshVisit(page);
    const state = await getState(page);
    expect(state.activeScenes).toContain("IntroScene");
    const texts = await getSceneTexts(page, "IntroScene");
    expect(texts.join(" ")).toContain("Every character lives once.");
    expectNoBrowserErrors(errors);
  });

  test("watch demo runs sandboxed and skip restores without persisting", async ({ page }) => {
    await freshVisit(page);

    // Capture the (empty) real save before the demo.
    const before = await page.evaluate(() => localStorage.getItem("idledungeonlife_save"));

    // Start the demo from the IntroScene button.
    await page.evaluate(() => {
      const scene = (window as any).__game.scene.getScene("IntroScene");
      const btn = scene.children.list.find(
        (c: { text?: string }) => c.text === "[ Watch demo ]"
      );
      btn.emit("pointerup");
    });
    await page.waitForTimeout(800);

    let state = await getState(page);
    expect(state.activeScenes).toContain("DemoScene");
    // Demo is sandboxed: it must not have written a save while running.
    const during = await page.evaluate(() => localStorage.getItem("idledungeonlife_save"));
    expect(during).toBe(before);

    // Skip the demo.
    await page.evaluate(() => {
      const scene = (window as any).__game.scene.getScene("DemoScene");
      const btn = scene.children.list.find(
        (c: { text?: string }) => c.text === "[ Skip demo ]"
      );
      btn.emit("pointerup");
    });
    await page.waitForTimeout(500);

    state = await getState(page);
    expect(state.activeScenes).toContain("IntroScene");
    expect(state.activeScenes).not.toContain("DemoScene");
  });

  test("play button starts a real run", async ({ page }) => {
    await freshVisit(page);
    await page.evaluate(() => {
      const scene = (window as any).__game.scene.getScene("IntroScene");
      const btn = scene.children.list.find((c: { text?: string }) => c.text === "[ Play ]");
      btn.emit("pointerup");
    });
    await page.waitForTimeout(500);
    const state = await getState(page);
    expect(state.activeScenes).toContain("MainScene");
    expect(state.activeScenes).toContain("HudScene");
    expect(state.run?.alive).toBe(true);
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS, including the three new tests and all pre-existing specs. If the demo `localStorage` assertion is flaky because the persist loop fires, confirm Task 1's `_persistLoop` guard is in place.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/intro-demo.spec.ts
git commit -m "test: intro overlay + sandboxed demo e2e"
```

---

## Task 9: README + about page + hosting verification

**Files:**
- Modify: `README.md`
- Modify: `public/about.html`

- [ ] **Step 1: Add a Screenshots section + Play link to README**

After the "Gameplay at a glance" section in `README.md`, insert:

```markdown
## Play it

- **Live:** https://idle-dungeon-life.vercel.app
- **Watch the demo:** open the game and choose **Watch demo** on the welcome screen — it auto-plays one full lifetime (job, dungeon dives, death, legacy) in a sandbox that never touches your save.

## Screenshots

| | |
| --- | --- |
| ![Welcome](artifacts/screenshots/01-intro.png) | ![Early life](artifacts/screenshots/02-early-chapel.png) |
| ![Dungeon dive](artifacts/screenshots/03-mid-dungeon.png) | ![Deep dungeon](artifacts/screenshots/04-deep-dungeon.png) |
| ![Talents](artifacts/screenshots/05-talents.png) | ![Codex](artifacts/screenshots/06-codex.png) |
| ![Sub-characters](artifacts/screenshots/07-subs.png) | ![Death & legacy](artifacts/screenshots/08-death-legacy.png) |

Screenshots are generated with `npm run screenshots` (Playwright drives the game through canonical states).
```

> Confirm the live URL against `.vercel/project.json` (`projectName: idle-dungeon-life`). If the deployed domain differs, use the actual production domain from the Vercel dashboard.

- [ ] **Step 2: Add a screenshots section to the about page**

In `public/about.html`, before the closing `</body>`, add a section that links the same eight PNGs (relative to the deployed site root — copy them so they ship). Since `public/` is served at the site root by Vite, add the screenshots to `public/screenshots/` as well so they are reachable in production:

Run: `node -e "const fs=require('fs');fs.mkdirSync('public/screenshots',{recursive:true});for(const n of fs.readdirSync('artifacts/screenshots'))fs.copyFileSync('artifacts/screenshots/'+n,'public/screenshots/'+n)"`

Then add to `public/about.html` (match the page's existing section markup/classes; this is the minimal structure):

```html
  <section>
    <h2>Screenshots</h2>
    <p>Generated automatically from the running game.</p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
      <img src="/screenshots/01-intro.png" alt="Welcome screen" style="width:100%;border:1px solid var(--line);" />
      <img src="/screenshots/02-early-chapel.png" alt="Early life in the Abandoned Chapel" style="width:100%;border:1px solid var(--line);" />
      <img src="/screenshots/03-mid-dungeon.png" alt="Dungeon dive" style="width:100%;border:1px solid var(--line);" />
      <img src="/screenshots/04-deep-dungeon.png" alt="Deep dungeon" style="width:100%;border:1px solid var(--line);" />
      <img src="/screenshots/05-talents.png" alt="Talents tree" style="width:100%;border:1px solid var(--line);" />
      <img src="/screenshots/06-codex.png" alt="Codex" style="width:100%;border:1px solid var(--line);" />
      <img src="/screenshots/07-subs.png" alt="Sub-characters" style="width:100%;border:1px solid var(--line);" />
      <img src="/screenshots/08-death-legacy.png" alt="Death and legacy" style="width:100%;border:1px solid var(--line);" />
    </div>
  </section>
```

- [ ] **Step 3: Hosting verification (production build, manual)**

Run: `npm run build && npm run preview`
Then open the preview URL in a browser and confirm, in a fresh profile / cleared `localStorage`:
1. The welcome overlay appears.
2. **Watch demo** runs through beats and **Skip demo** returns to the overlay.
3. **Play** starts a normal run; reloading keeps the run (save persisted).
4. The "?" button in the HUD reopens the overlay.
5. `/about` shows the screenshots.

Record the result. Stop the preview server when done.

- [ ] **Step 4: Final regression**

Run: `npm run test:unit && npm run build && npm run lint`
Expected: all unit tests pass, 0 TS errors, no lint errors.

Run: `npm run test:e2e`
Expected: full suite green.

- [ ] **Step 5: Commit**

```bash
git add README.md public/about.html public/screenshots/*.png
git commit -m "docs: link demo + screenshots from README and about page"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** A=Tasks 4,6; B=Tasks 1,2,3,5; C=Task 7; D=Task 9. Unit tests: Tasks 2,3 (Phaser-free modules). E2E: Task 8 (intro overlay + sandboxed demo, including the no-persist/restore assertions that cover Task 1). Screenshot run: Task 7.
- **Type consistency:** `DemoBeat`, `DemoHost`, `DemoRunner.runBeat`, `GameController.{demoActive,advanceTime,enterDemo,exitDemo,isFreshInstall}`, scene keys `IntroScene`/`DemoScene` are used identically across tasks.
- **Save key:** the real localStorage key is `idledungeonlife_save` (asserted untouched in Task 8). The DeathScene's `import` button uses a different legacy key (`idleDungeonSave`) — do not "fix" it as part of this pass; it is out of scope.
```
