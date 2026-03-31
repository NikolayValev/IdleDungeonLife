const test = require("node:test");
const assert = require("node:assert/strict");

const {
  reduceGame,
  startRun,
  clone,
  assertUnchanged,
  addResources,
  grantItem,
  approx,
} = require("./helpers.cjs");

test("START_NEW_RUN is deterministic and does not mutate prior state", () => {
  const base = require("../../.test-build/src/core/save.js").freshSave(1000);
  const snapshot = clone(base);

  const next = reduceGame(base, {
    type: "START_NEW_RUN",
    nowUnixSec: 1000,
    seed: 42,
  });

  assertUnchanged(base, snapshot);
  assert.equal(next.meta.totalRuns, 1);
  assert.deepStrictEqual(next.currentRun.visibleTraitIds, ["grave_touched"]);
  assert.deepStrictEqual(next.currentRun.hiddenTraitIds, ["saint_eater"]);
});

test("TICK applies deterministic income and lifespan decay without mutation", () => {
  let save = startRun(7, 1000);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });
  const snapshot = clone(save);

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1060 });

  assertUnchanged(save, snapshot);
  approx(next.currentRun.resources.gold, 39);
  assert.equal(next.currentRun.lifespan.ageSeconds, 60);
  assert.ok(next.currentRun.lifespan.vitality < 100);
});

test("UNLOCK_JOB and UNLOCK_DUNGEON spend ash through the reducer", () => {
  const save = {
    ...startRun(8, 1000),
    meta: {
      ...startRun(8, 1000).meta,
      legacyAsh: 20,
    },
  };

  const unlockedJob = reduceGame(save, { type: "UNLOCK_JOB", jobId: "scavenger" });
  assert.ok(unlockedJob.meta.unlockedJobIds.includes("scavenger"));
  assert.equal(unlockedJob.meta.legacyAsh, 17);

  const unlockedDungeon = reduceGame(unlockedJob, {
    type: "UNLOCK_DUNGEON",
    dungeonId: "grave_hollow",
  });
  assert.ok(unlockedDungeon.meta.unlockedDungeonIds.includes("grave_hollow"));
  assert.equal(unlockedDungeon.meta.legacyAsh, 13);
});

test("START_DUNGEON and COMPLETE_DUNGEON are predictable and immutable", () => {
  let save = startRun(99, 1000);
  save = addResources(save, 100, 0);
  const started = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });
  const snapshot = clone(started);

  const completed = reduceGame(started, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1060,
  });

  assertUnchanged(started, snapshot);
  assert.equal(completed.currentRun.currentDungeon, null);
  assert.equal(completed.currentRun.totalDungeonsCompleted, 1);
  assert.ok(completed.currentRun.inventory.items.length >= 1);
  assert.ok(completed.meta.discoveredItemIds.length >= 1);
});

test("EQUIP_ITEM and UNEQUIP_ITEM update slots predictably", () => {
  let save = startRun(3, 1000);
  save = grantItem(save, "rusted_blade");
  const instanceId = save.currentRun.inventory.items[0].instanceId;

  const equipped = reduceGame(save, { type: "EQUIP_ITEM", itemInstanceId: instanceId });
  assert.equal(equipped.currentRun.equipment.weapon, instanceId);

  const unequipped = reduceGame(equipped, { type: "UNEQUIP_ITEM", slot: "weapon" });
  assert.equal(unequipped.currentRun.equipment.weapon, undefined);
});

test("UNLOCK_TALENT spends essence and appends the node", () => {
  let save = startRun(4, 1000);
  save = addResources(save, 0, 10);
  const snapshot = clone(save);

  const next = reduceGame(save, { type: "UNLOCK_TALENT", nodeId: "spine_0_initiate" });

  assertUnchanged(save, snapshot);
  assert.ok(next.currentRun.talents.unlockedNodeIds.includes("spine_0_initiate"));
  assert.equal(next.currentRun.resources.essence, 6);
});

test("CLAIM_DEATH archives traits and clears the run", () => {
  let save = startRun(5, 1000);
  save = addResources(save, 100, 0);
  save = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });
  save = reduceGame(save, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1060,
  });
  save = reduceGame(save, { type: "DEBUG_KILL_RUN" });

  const claimed = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 1100 });

  assert.equal(claimed.currentRun, null);
  assert.ok(claimed.meta.legacyAsh > 0);
  assert.ok(claimed.meta.discoveredTraitIds.length >= 2);
  assert.ok(claimed.meta.codexEntries.some((entry) => entry.startsWith("trait:")));
});

test("RECONCILE_OFFLINE routes through the reducer predictably", () => {
  let save = startRun(6, 1000);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  const reconciled = reduceGame(save, {
    type: "RECONCILE_OFFLINE",
    nowUnixSec: 1060,
  });

  approx(reconciled.currentRun.resources.gold, 39);
  assert.equal(reconciled.currentRun.lifespan.ageSeconds, 60);
});
