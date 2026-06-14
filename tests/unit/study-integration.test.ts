import { test, expect } from "vitest";

import { startRun, reduceGame, reconcileOffline, addResources } from "./helpers";
import { emptyStudyState } from "../../src/core/study";
import type { SaveFile, StudyState } from "../../src/core/types";

function withStudy(save: SaveFile, study: Partial<StudyState>): SaveFile {
  return {
    ...save,
    currentRun: {
      ...save.currentRun!,
      study: { ...emptyStudyState(), ...study },
    },
  };
}

test("ASSIGN_STUDY enrolls, switches occupation to study, and clears the job", () => {
  let save = startRun(11, 1000);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });
  expect(save.currentRun!.occupation).toBe("job");

  save = reduceGame(save, { type: "ASSIGN_STUDY", schoolId: "choir" });
  expect(save.currentRun!.occupation).toBe("study");
  expect(save.currentRun!.currentJobId).toBeNull();
  expect(save.currentRun!.study.enrolled).toBe("choir");
});

test("studying accrues refinement, deducts gold upkeep, and clamps at the bottleneck", () => {
  let save = startRun(12, 1000);
  save = addResources(save, 1000, 0);
  save = reduceGame(save, { type: "ASSIGN_STUDY", schoolId: "choir" });

  const goldBefore = save.currentRun!.resources.gold;
  // Study long enough to fill the meter at the derived year rate.
  save = reduceGame(save, { type: "TICK", nowUnixSec: 1300 });

  const choir = save.currentRun!.study.schools.choir;
  expect(choir.refinement).toBe(100);
  expect(choir.bottlenecked).toBe(true);
  expect(choir.stage).toBe(0); // never auto-advances
  expect(save.currentRun!.resources.gold).toBeLessThan(goldBefore); // upkeep paid
});

test("study stalls when gold runs out (no debt)", () => {
  let save = startRun(13, 1000);
  save = addResources(save, 5, 0); // barely any gold
  save = reduceGame(save, { type: "ASSIGN_STUDY", schoolId: "choir" });
  save = reduceGame(save, { type: "TICK", nowUnixSec: 1600 });

  expect(save.currentRun!.resources.gold).toBeGreaterThanOrEqual(0); // never negative
  // Only a sliver of refinement before the gold ran out.
  expect(save.currentRun!.study.schools.choir.refinement).toBeLessThan(100);
});

test("offline study accrual caps at the bottleneck and never auto-breaks through", () => {
  let save = startRun(14, 1000);
  save = addResources(save, 5000, 0);
  save = reduceGame(save, { type: "ASSIGN_STUDY", schoolId: "choir" });
  // 10 hours away.
  const offline = reconcileOffline({ ...save, updatedAtUnixSec: 1000 }, 1000 + 10 * 3600);

  const choir = offline.currentRun!.study.schools.choir;
  expect(choir.refinement).toBe(100);
  expect(choir.bottlenecked).toBe(true);
  expect(choir.stage).toBe(0); // breakthroughs never auto-fire offline
});

test("gate-barred enrollment is a no-op and keeps prior progress", () => {
  let save = startRun(15, 1000);
  // Forsake the choir: crossing abyss_2 bars enrollment there.
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      alignment: { ...save.currentRun!.alignment, gatesCrossed: ["abyss_1", "abyss_2"] },
    },
  };
  save = reduceGame(save, { type: "ASSIGN_STUDY", schoolId: "choir" });

  expect(save.currentRun!.study.enrolled).toBeNull();
  expect(save.currentRun!.occupation).toBe("idle");

  // The Archive never bars anyone.
  save = reduceGame(save, { type: "ASSIGN_STUDY", schoolId: "archive" });
  expect(save.currentRun!.study.enrolled).toBe("archive");
});

test("PERFORM_BREAKTHROUGH advances a bottlenecked stage, grants arts, applies the toll, and fires a ceremony", () => {
  let save = startRun(16, 1000);
  save = withStudy(save, {
    enrolled: "choir",
    schools: {
      choir: { stage: 0, refinement: 100, bottlenecked: true },
      hollow_order: { stage: 0, refinement: 0, bottlenecked: false },
      archive: { stage: 0, refinement: 0, bottlenecked: false },
    },
  });
  save = { ...save, currentRun: { ...save.currentRun!, occupation: "study" } };
  const vitalityBefore = save.currentRun!.lifespan.vitality;

  save = reduceGame(save, { type: "PERFORM_BREAKTHROUGH", nowUnixSec: 1100 });

  const choir = save.currentRun!.study.schools.choir;
  expect(choir.stage).toBe(1);
  expect(choir.refinement).toBe(0);
  expect(save.currentRun!.study.artsKnown).toContain("choir_ward_1");
  expect(save.currentRun!.lifespan.vitality).toBeLessThan(vitalityBefore); // toll paid

  const effect = (save.transientEffects ?? []).find((e) => e.kind === "breakthrough");
  expect(effect?.refId).toBe("choir");
  expect(save.currentRun!.chronicle.some((c) => c.kind === "breakthrough")).toBe(true);
});

test("PERFORM_BREAKTHROUGH is a no-op when conditions are unmet", () => {
  let save = startRun(17, 1000);
  save = withStudy(save, {
    enrolled: "choir",
    schools: {
      choir: { stage: 0, refinement: 40, bottlenecked: false }, // not at 100
      hollow_order: { stage: 0, refinement: 0, bottlenecked: false },
      archive: { stage: 0, refinement: 0, bottlenecked: false },
    },
  });
  const before = save.currentRun!.study.schools.choir.stage;
  save = reduceGame(save, { type: "PERFORM_BREAKTHROUGH", nowUnixSec: 1100 });
  expect(save.currentRun!.study.schools.choir.stage).toBe(before);
});

test("a fatal breakthrough toll yields an ascensionDeath epitaph", () => {
  let save = startRun(18, 1000);
  save = withStudy(save, {
    enrolled: "choir",
    schools: {
      choir: { stage: 1, refinement: 100, bottlenecked: true },
      hollow_order: { stage: 0, refinement: 0, bottlenecked: false },
      archive: { stage: 0, refinement: 0, bottlenecked: false },
    },
  });
  save = {
    ...save,
    currentRun: { ...save.currentRun!, occupation: "study", lifespan: { ...save.currentRun!.lifespan, vitality: 3 } },
  };

  // Stage 1→2 toll (8%) exceeds 3 vitality → fatal.
  save = reduceGame(save, { type: "PERFORM_BREAKTHROUGH", nowUnixSec: 1100 });
  expect(save.currentRun!.alive).toBe(false);
  expect(save.currentRun!.deathCause).toBe("breakthrough");

  save = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 1200 });
  const record = save.playthroughArchive.records.at(-1);
  expect(record!.epitaph!.arc).toBe("ascensionDeath");
});
