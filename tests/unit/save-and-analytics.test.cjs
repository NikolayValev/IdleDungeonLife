const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseSave,
  migrateSave,
  loadFromStorage,
  freshSave,
  SAVE_VERSION,
} = require("../../.test-build/src/core/save.js");
const { startRun } = require("./helpers.cjs");
const {
  LocalArrayAnalyticsSink,
  setAnalyticsSink,
  trackEvent,
  ConsoleAnalyticsSink,
} = require("../../.test-build/src/core/analytics.js");

test("migrateSave upgrades older versions without crashing", () => {
  const migrated = migrateSave({
    version: 1,
    updatedAtUnixSec: 1234,
    meta: {
      unlockedDungeonIds: ["abandoned_chapel"],
      unlockedJobIds: ["porter"],
      discoveredTraitIds: [],
      discoveredItemIds: [],
      codexEntries: [],
      legacyAsh: 4,
      totalRuns: 2,
    },
    currentRun: null,
  });

  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.meta.legacyAsh, 4);
});

test("parseSave rejects unsupported future versions and tolerates old or missing ones", () => {
  assert.equal(parseSave('{"version":999,"updatedAtUnixSec":0,"meta":{},"currentRun":null}'), null);

  const parsed = parseSave(
    JSON.stringify({
      updatedAtUnixSec: 100,
      meta: {},
      currentRun: null,
    })
  );
  assert.equal(parsed.version, SAVE_VERSION);
});

test("parseSave drops structurally invalid active runs", () => {
  const parsed = parseSave(
    JSON.stringify({
      version: SAVE_VERSION,
      updatedAtUnixSec: 100,
      meta: {},
      currentRun: {},
    })
  );

  assert.ok(parsed);
  assert.equal(parsed.currentRun, null);
  assert.deepStrictEqual(parsed.meta.unlockedDungeonIds, ["abandoned_chapel"]);
  assert.deepStrictEqual(parsed.meta.unlockedJobIds, ["porter"]);
});

test("parseSave normalizes salvageable active run fields", () => {
  const save = startRun(123, 1000);
  const run = save.currentRun;
  assert.ok(run);

  const parsed = parseSave(
    JSON.stringify({
      ...save,
      currentRun: {
        ...run,
        visibleTraitIds: ["grave_touched", "grave_touched"],
        hiddenTraitIds: ["fated", 7],
        inventory: {
          items: [
            { instanceId: "valid_1", itemId: "rusted_blade" },
            { instanceId: "missing_item_id" },
          ],
        },
        resources: { gold: -5, essence: 3 },
        lifespan: { ageSeconds: -20, vitality: 125, stage: "impossible" },
        currentDungeon: {
          dungeonId: "abandoned_chapel",
          startedAtUnixSec: 1200,
          completesAtUnixSec: 1100,
        },
      },
    })
  );

  assert.ok(parsed?.currentRun);
  assert.deepStrictEqual(parsed.currentRun.visibleTraitIds, ["grave_touched"]);
  assert.deepStrictEqual(parsed.currentRun.hiddenTraitIds, []);
  assert.deepStrictEqual(parsed.currentRun.inventory.items, [
    { instanceId: "valid_1", itemId: "rusted_blade" },
  ]);
  assert.equal(parsed.currentRun.resources.gold, 0);
  assert.equal(parsed.currentRun.resources.essence, 3);
  assert.equal(parsed.currentRun.lifespan.ageSeconds, 0);
  assert.equal(parsed.currentRun.lifespan.vitality, 100);
  assert.equal(parsed.currentRun.lifespan.stage, "youth");
  assert.deepStrictEqual(parsed.currentRun.currentDungeon, {
    dungeonId: "abandoned_chapel",
    startedAtUnixSec: 1200,
    completesAtUnixSec: 1200,
  });
});

test("loadFromStorage does not crash on invalid payloads", () => {
  const storage = {
    getItem() {
      return "{not-json";
    },
  };

  assert.equal(loadFromStorage(storage), null);
});

test("LocalArrayAnalyticsSink records deterministic sequence numbers", () => {
  const sink = new LocalArrayAnalyticsSink();
  setAnalyticsSink(sink);
  trackEvent("run_started", { seed: 1 });
  trackEvent("run_summary", { totalDungeons: 2 });
  setAnalyticsSink(new ConsoleAnalyticsSink());

  assert.deepStrictEqual(
    sink.flush().map((event) => event.seq),
    [0, 1]
  );
});

test("freshSave always uses current save version", () => {
  assert.equal(freshSave(123).version, SAVE_VERSION);
});

test("v2-to-v3 migration adds legacyPath, legacyPerks defaults to meta", () => {
  const v2Save = {
    version: 2,
    updatedAtUnixSec: 5000,
    meta: {
      unlockedDungeonIds: ["abandoned_chapel"],
      unlockedJobIds: ["porter"],
      discoveredTraitIds: ["grave_touched"],
      discoveredItemIds: [],
      codexEntries: ["trait:grave_touched"],
      legacyAsh: 7,
      totalRuns: 3,
    },
    currentRun: null,
  };

  const migrated = migrateSave(v2Save);

  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.meta.legacyPath, null);
  assert.deepStrictEqual(migrated.meta.legacyPerks, []);
  assert.equal(migrated.meta.legacyAsh, 7);
  assert.deepStrictEqual(migrated.meta.discoveredTraitIds, ["grave_touched"]);
});

test("v2-to-v3 migration adds evolvedTraitIds, discoveryMomentum, activeLegacyPerkIds to run", () => {
  const { startRun } = require("./helpers.cjs");
  const existingSave = startRun(123, 1000);
  // Simulate a v2 run (without the new fields)
  const runWithoutNewFields = { ...existingSave.currentRun };
  delete runWithoutNewFields.evolvedTraitIds;
  delete runWithoutNewFields.discoveryMomentum;
  delete runWithoutNewFields.activeLegacyPerkIds;
  delete runWithoutNewFields.legacyPath;

  const parsed = parseSave(JSON.stringify({ ...existingSave, version: 2, currentRun: runWithoutNewFields }));
  assert.ok(parsed?.currentRun);
  assert.deepStrictEqual(parsed.currentRun.evolvedTraitIds, []);
  assert.equal(parsed.currentRun.discoveryMomentum, 0);
  assert.deepStrictEqual(parsed.currentRun.activeLegacyPerkIds, []);
  assert.equal(parsed.currentRun.legacyPath, null);
});
