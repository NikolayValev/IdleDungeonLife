import { test, expect } from "vitest";

import { reduceGame, startRun, addResources } from "./helpers";
import { stepRun } from "../../src/sim/step";
import { BaselinePolicy } from "../../src/sim/policies";
import { runBatch } from "../../src/sim/batch";
import { evaluateRun } from "../../src/sim/evaluator";

test("same seed generates identical starting traits", () => {
  const left = startRun(777, 1000);
  const right = startRun(777, 1000);

  expect(left.currentRun!.visibleTraitIds).toStrictEqual(right.currentRun!.visibleTraitIds);
  expect(left.currentRun!.hiddenTraitIds).toStrictEqual(right.currentRun!.hiddenTraitIds);
});

test("same seed yields identical dungeon outcome and loot", () => {
  let left = addResources(startRun(888, 1000), 100, 0);
  let right = addResources(startRun(888, 1000), 100, 0);

  left = reduceGame(left, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });
  right = reduceGame(right, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });

  left = stepRun(left, 1060);
  right = stepRun(right, 1060);

  expect(left.currentRun!.inventory.items).toStrictEqual(right.currentRun!.inventory.items);
  expect(left.currentRun!.totalDungeonsCompleted).toBe(right.currentRun!.totalDungeonsCompleted);
  expect(left.currentRun!.alignment.holyUnholy).toBe(right.currentRun!.alignment.holyUnholy);
});

test("same seed and policy produce identical headless final scores", () => {
  const policy = new BaselinePolicy();
  const left = runBatch(9000, 1, { durationSec: 900, stepSec: 10, policy });
  const right = runBatch(9000, 1, { durationSec: 900, stepSec: 10, policy });

  expect(left).toStrictEqual(right);
  expect(left.runs[0].score.total).toBe(right.runs[0].score.total);
});

test("evaluated score is deterministic for the same final run", () => {
  const batch = runBatch(9100, 1, { durationSec: 600, stepSec: 10 });
  const rerun = runBatch(9100, 1, { durationSec: 600, stepSec: 10 });

  expect(batch.runs[0].score).toStrictEqual(rerun.runs[0].score);
  expect(batch.runs[0].traits).toStrictEqual(rerun.runs[0].traits);
  expect(batch.runs[0].items).toStrictEqual(rerun.runs[0].items);
  expect(
    evaluateRun(
      {
        ...startRun(123, 1000).currentRun!,
        lifespan: { ...startRun(123, 1000).currentRun!.lifespan, ageSeconds: 120 },
      },
      { discoveredItemIds: [], discoveredTraitIds: [] }
    ).total
  ).toBe(
    evaluateRun(
      {
        ...startRun(123, 1000).currentRun!,
        lifespan: { ...startRun(123, 1000).currentRun!.lifespan, ageSeconds: 120 },
      },
      { discoveredItemIds: [], discoveredTraitIds: [] }
    ).total
  );
});
