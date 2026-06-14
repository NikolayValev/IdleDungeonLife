import { test, expect } from "vitest";

import { composeAppearance } from "../../src/core/appearance";
import { AVATAR_MANIFEST, AVATAR_TUNING } from "../../src/content/avatarManifest";
import type { RunState, GateId, SchoolId } from "../../src/core/types";
import { startRun } from "./helpers";

function runWith(overrides: {
  gatesCrossed?: GateId[];
  holyUnholy?: number;
  ageSeconds?: number;
  vitality?: number;
  currentJobId?: string | null;
  occupation?: RunState["occupation"];
  enrolled?: SchoolId | null;
}): RunState {
  const base = startRun(1, 1000).currentRun!;
  return {
    ...base,
    alignment: {
      ...base.alignment,
      holyUnholy: overrides.holyUnholy ?? base.alignment.holyUnholy,
      gatesCrossed: overrides.gatesCrossed ?? base.alignment.gatesCrossed,
    },
    lifespan: {
      ...base.lifespan,
      ageSeconds: overrides.ageSeconds ?? base.lifespan.ageSeconds,
      vitality: overrides.vitality ?? base.lifespan.vitality,
    },
    currentJobId:
      overrides.currentJobId !== undefined ? overrides.currentJobId : base.currentJobId,
    occupation: overrides.occupation ?? base.occupation,
    study: { ...base.study, enrolled: overrides.enrolled ?? base.study.enrolled },
  };
}

// 1. Determinism.
test("composeAppearance is deterministic for the same state + seed", () => {
  const run = runWith({ gatesCrossed: ["abyss_1"], currentJobId: "porter", occupation: "job" });
  expect(composeAppearance(run, 42)).toStrictEqual(composeAppearance(run, 42));
});

// 2. Gate mapping keys off history (caps/gatesCrossed), not current alignment.
test("scars key off gate history, not current alignment value", () => {
  // Same current alignment value; only gate history differs.
  const forsaken = runWith({ holyUnholy: -20, gatesCrossed: ["abyss_1", "abyss_2", "abyss_3"] });
  const clean = runWith({ holyUnholy: -20, gatesCrossed: [] });

  const forsakenSel = composeAppearance(forsaken, 5);
  const cleanSel = composeAppearance(clean, 5);

  expect(forsakenSel.layers.some((l) => l.sheetId === "overlay/abyss_marks")).toBe(true);
  expect(forsakenSel.paletteOverrides).toContainEqual({ target: "skin", variant: "ashen" });

  expect(cleanSel.layers.some((l) => l.sheetId === "overlay/abyss_marks")).toBe(false);
  expect(cleanSel.paletteOverrides.find((p) => p.target === "skin")?.variant).not.toBe("ashen");
});

// 3. Layer budget never exceeded across many states.
test("layer budget (<=12) is never exceeded across varied states", () => {
  const gateCombos: GateId[][] = [
    [],
    ["abyss_3"],
    ["holy_3"],
    ["abyss_1", "abyss_2", "abyss_3"],
    ["holy_1", "holy_2", "holy_3"],
  ];
  const jobs = [null, "porter", "scribe"];
  for (const gatesCrossed of gateCombos) {
    for (const currentJobId of jobs) {
      for (let seed = 0; seed < 20; seed++) {
        const run = runWith({ gatesCrossed, currentJobId, occupation: currentJobId ? "job" : "idle" });
        const sel = composeAppearance(run, seed);
        expect(sel.layers.length).toBeLessThanOrEqual(AVATAR_TUNING.maxLayers);
      }
    }
  }
});

// 4. Every emitted sheetId resolves in the manifest (no dangling sheets).
test("all emitted layers resolve to sheets in the manifest", () => {
  const run = runWith({
    gatesCrossed: ["abyss_3", "holy_3"],
    occupation: "study",
    enrolled: "hollow_order",
  });
  for (let seed = 0; seed < 30; seed++) {
    const sel = composeAppearance(run, seed);
    for (const l of sel.layers) {
      expect(AVATAR_MANIFEST.has(l.sheetId), `unknown sheet ${l.sheetId}`).toBe(true);
      expect(l.zPos).toBe(AVATAR_MANIFEST.get(l.sheetId)!.zPos);
    }
  }
});

// 5. zPos ordering: layers are sorted ascending.
test("emitted layers are ordered by zPos", () => {
  const run = runWith({
    gatesCrossed: ["holy_1", "holy_2", "holy_3"],
    occupation: "study",
    enrolled: "choir",
  });
  const sel = composeAppearance(run, 9);
  const zs = sel.layers.map((l) => l.zPos);
  expect(zs).toStrictEqual([...zs].sort((a, b) => a - b));
});

// School robe vs job outfit selection.
test("studying wears the school robe; otherwise the job outfit", () => {
  const studying = composeAppearance(
    runWith({ occupation: "study", enrolled: "archive", currentJobId: null }),
    1
  );
  expect(studying.layers.some((l) => l.sheetId === "torso/school/archive")).toBe(true);

  const working = composeAppearance(
    runWith({ occupation: "job", currentJobId: "porter" }),
    1
  );
  expect(working.layers.some((l) => l.sheetId === "torso/job/porter")).toBe(true);
});
