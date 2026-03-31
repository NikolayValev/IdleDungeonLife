const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseSave,
  migrateSave,
  loadFromStorage,
  freshSave,
  SAVE_VERSION,
} = require("../../.test-build/src/core/save.js");
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
