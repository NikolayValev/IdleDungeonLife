const test = require("node:test");
const assert = require("node:assert/strict");

const { reduceGame, startRun, addResources } = require("./helpers.cjs");
const { stepRun } = require("../../.test-build/src/sim/step.js");
const { BaselinePolicy } = require("../../.test-build/src/sim/policies.js");
const { runBatch } = require("../../.test-build/src/sim/batch.js");
const { evaluateRun } = require("../../.test-build/src/sim/evaluator.js");

test("same seed generates identical starting traits", () => {
  const left = startRun(777, 1000);
  const right = startRun(777, 1000);

  assert.deepStrictEqual(left.currentRun.visibleTraitIds, right.currentRun.visibleTraitIds);
  assert.deepStrictEqual(left.currentRun.hiddenTraitIds, right.currentRun.hiddenTraitIds);
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

  assert.deepStrictEqual(left.currentRun.inventory.items, right.currentRun.inventory.items);
  assert.equal(left.currentRun.totalDungeonsCompleted, right.currentRun.totalDungeonsCompleted);
  assert.equal(left.currentRun.alignment.holyUnholy, right.currentRun.alignment.holyUnholy);
});

test("same seed and policy produce identical headless final scores", () => {
  const policy = new BaselinePolicy();
  const left = runBatch(9000, 1, { durationSec: 900, stepSec: 10, policy });
  const right = runBatch(9000, 1, { durationSec: 900, stepSec: 10, policy });

  assert.deepStrictEqual(left, right);
  assert.equal(left.runs[0].score.total, right.runs[0].score.total);
});

test("evaluated score is deterministic for the same final run", () => {
  const batch = runBatch(9100, 1, { durationSec: 600, stepSec: 10 });
  const rerun = runBatch(9100, 1, { durationSec: 600, stepSec: 10 });

  assert.deepStrictEqual(batch.runs[0].score, rerun.runs[0].score);
  assert.deepStrictEqual(batch.runs[0].traits, rerun.runs[0].traits);
  assert.deepStrictEqual(batch.runs[0].items, rerun.runs[0].items);
  assert.equal(
    evaluateRun(
      {
        ...startRun(123, 1000).currentRun,
        lifespan: { ...startRun(123, 1000).currentRun.lifespan, ageSeconds: 120 },
      },
      { discoveredItemIds: [], discoveredTraitIds: [] }
    ).total,
    evaluateRun(
      {
        ...startRun(123, 1000).currentRun,
        lifespan: { ...startRun(123, 1000).currentRun.lifespan, ageSeconds: 120 },
      },
      { discoveredItemIds: [], discoveredTraitIds: [] }
    ).total
  );
});
