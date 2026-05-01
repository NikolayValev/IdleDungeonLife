const test = require("node:test");
const assert = require("node:assert/strict");

const {
  reduceGame,
  reconcileOffline,
  startRun,
  addResources,
  approx,
} = require("./helpers.cjs");
const { BALANCE } = require("../../.test-build/src/content/balance.js");

function stripTraits(save) {
  return {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: [],
      hiddenTraitIds: [],
    },
  };
}

test("short offline interval applies job income and vitality decay once", () => {
  let save = startRun(21, 1000);
  save = stripTraits(save);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  const reconciled = reconcileOffline(save, 1030);

  approx(reconciled.currentRun.resources.gold, 19.5);
  assert.equal(reconciled.currentRun.lifespan.ageSeconds, 30);
  assert.ok(reconciled.currentRun.lifespan.vitality < 100);
});

test("medium offline interval completes a dungeon exactly once", () => {
  let save = startRun(22, 1000);
  save = addResources(save, 100, 0);
  save = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });

  const reconciled = reconcileOffline(save, 1120);
  const repeated = reconcileOffline(reconciled, 1120);

  assert.equal(reconciled.currentRun.currentDungeon, null);
  assert.equal(reconciled.currentRun.totalDungeonsCompleted, 1);
  assert.deepStrictEqual(repeated, reconciled);
});

test("long offline interval is clamped", () => {
  let save = startRun(23, 1000);
  save = stripTraits(save);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  // Test with offset > 24h to trigger clamping
  const reconciled = reconcileOffline(save, 1000 + 30 * 3600); // 30h offset

  assert.equal(reconciled.updatedAtUnixSec, 1000 + 30 * 3600);
  assert.equal(reconciled.currentRun.lifespan.ageSeconds, BALANCE.maxOfflineSec); // Should be clamped to 24h
});
