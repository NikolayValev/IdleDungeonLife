const test = require("node:test");
const assert = require("node:assert/strict");

const {
  appendPlaythroughRecord,
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

test("freshSave initializes an empty playthrough archive", () => {
  const save = freshSave(123);

  assert.ok(save.playthroughArchive);
  assert.equal(save.playthroughArchive.version, 1);
  assert.equal(save.playthroughArchive.maxRecords, 100);
  assert.deepStrictEqual(save.playthroughArchive.records, []);
});

test("parseSave tolerates malformed playthrough archive payloads", () => {
  const parsed = parseSave(
    JSON.stringify({
      version: SAVE_VERSION,
      updatedAtUnixSec: 100,
      meta: {},
      currentRun: null,
      playthroughArchive: {
        maxRecords: -10,
        records: [{ nope: true }, { id: "x", finalRun: null }],
      },
    })
  );

  assert.ok(parsed);
  assert.equal(parsed.playthroughArchive.maxRecords, 1);
  assert.deepStrictEqual(parsed.playthroughArchive.records, []);
});

test("appendPlaythroughRecord keeps only latest records within cap", () => {
  const base = freshSave(1000);
  const capped = {
    ...base,
    playthroughArchive: {
      ...base.playthroughArchive,
      maxRecords: 2,
      records: [],
    },
  };

  const first = appendPlaythroughRecord(capped, {
    id: "1",
    recordVersion: 1,
    recordedAtUnixSec: 1001,
    seed: 11,
    outcome: "death",
    finalRun: startRun(11, 1000).currentRun,
    finalMeta: capped.meta,
    finalScore: {
      total: 1,
      dungeonDepthScore: 0,
      legacyAshScore: 0,
      survivalScore: 0,
      discoveryScore: 0,
      buildDiversityScore: 0,
      dominancePenalty: 0,
    },
    legacyAsh: {
      earned: 0,
      baseBreakdown: {
        total: 0,
        depthBonus: 0,
        ageBonus: 0,
        bossBonus: 0,
        dungeonBonus: 0,
      },
      evolutionBonus: 0,
      momentumBonus: 0,
    },
    timeline: [],
  });
  const second = appendPlaythroughRecord(first, {
    ...first.playthroughArchive.records[0],
    id: "2",
    recordedAtUnixSec: 1002,
    seed: 12,
  });
  const third = appendPlaythroughRecord(second, {
    ...first.playthroughArchive.records[0],
    id: "3",
    recordedAtUnixSec: 1003,
    seed: 13,
  });

  assert.deepStrictEqual(third.playthroughArchive.records.map((record) => record.id), [
    "2",
    "3",
  ]);
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
