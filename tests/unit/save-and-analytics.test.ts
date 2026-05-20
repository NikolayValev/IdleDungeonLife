import { test, expect } from "vitest";

import {
  appendPlaythroughRecord,
  parseSave,
  migrateSave,
  loadFromStorage,
  freshSave,
  SAVE_VERSION,
} from "../../src/core/save";
import type { StorageLike } from "../../src/core/save";
import type { SaveFile } from "../../src/core/types";
import { startRun, grantItem } from "./helpers";
import {
  LocalArrayAnalyticsSink,
  setAnalyticsSink,
  trackEvent,
  ConsoleAnalyticsSink,
} from "../../src/core/analytics";

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
  } as unknown as SaveFile);

  expect(migrated.version).toBe(SAVE_VERSION);
  expect(migrated.meta.legacyAsh).toBe(4);
});

test("parseSave rejects unsupported future versions and tolerates old or missing ones", () => {
  expect(parseSave('{"version":999,"updatedAtUnixSec":0,"meta":{},"currentRun":null}')).toBeNull();

  const parsed = parseSave(
    JSON.stringify({
      updatedAtUnixSec: 100,
      meta: {},
      currentRun: null,
    })
  );
  expect(parsed!.version).toBe(SAVE_VERSION);
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

  expect(parsed).toBeTruthy();
  expect(parsed!.currentRun).toBeNull();
  expect(parsed!.meta.unlockedDungeonIds).toStrictEqual(["abandoned_chapel"]);
  expect(parsed!.meta.unlockedJobIds).toStrictEqual(["porter"]);
});

test("parseSave normalizes salvageable active run fields", () => {
  const save = startRun(123, 1000);
  const run = save.currentRun;
  expect(run).toBeTruthy();

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

  expect(parsed?.currentRun).toBeTruthy();
  expect(parsed!.currentRun!.visibleTraitIds).toStrictEqual(["grave_touched"]);
  expect(parsed!.currentRun!.hiddenTraitIds).toStrictEqual([]);
  expect(parsed!.currentRun!.inventory.items).toStrictEqual([
    { instanceId: "valid_1", itemId: "rusted_blade" },
  ]);
  expect(parsed!.currentRun!.resources.gold).toBe(0);
  expect(parsed!.currentRun!.resources.essence).toBe(3);
  expect(parsed!.currentRun!.lifespan.ageSeconds).toBe(0);
  expect(parsed!.currentRun!.lifespan.vitality).toBe(100);
  expect(parsed!.currentRun!.lifespan.stage).toBe("youth");
  expect(parsed!.currentRun!.currentDungeon).toStrictEqual({
    dungeonId: "abandoned_chapel",
    startedAtUnixSec: 1200,
    completesAtUnixSec: 1200,
  });
});

test("parseSave drops equipment that does not match an inventory slot", () => {
  let save = startRun(124, 1000);
  save = grantItem(save, "rusted_blade");
  save = grantItem(save, "worn_leathers");

  const weaponInstanceId = save.currentRun!.inventory.items.find((item) => item.itemId === "rusted_blade")!.instanceId;
  const armorInstanceId = save.currentRun!.inventory.items.find((item) => item.itemId === "worn_leathers")!.instanceId;

  const parsed = parseSave(
    JSON.stringify({
      ...save,
      currentRun: {
        ...save.currentRun,
        equipment: {
          weapon: armorInstanceId,
          armor: weaponInstanceId,
          artifact: "missing_instance",
        },
      },
    })
  );

  expect(parsed?.currentRun).toBeTruthy();
  expect(parsed!.currentRun!.equipment).toStrictEqual({});
});

test("parseSave drops invalid active dungeons with unknown ids", () => {
  const save = startRun(125, 1000);

  const parsed = parseSave(
    JSON.stringify({
      ...save,
      currentRun: {
        ...save.currentRun,
        currentDungeon: {
          dungeonId: "not_a_real_dungeon",
          startedAtUnixSec: 1000,
          completesAtUnixSec: 1100,
        },
      },
    })
  );

  expect(parsed?.currentRun).toBeTruthy();
  expect(parsed!.currentRun!.currentDungeon).toBeNull();
});

test("loadFromStorage does not crash on invalid payloads", () => {
  const storage = {
    getItem() {
      return "{not-json";
    },
  };

  expect(loadFromStorage(storage as unknown as StorageLike)).toBeNull();
});

test("LocalArrayAnalyticsSink records deterministic sequence numbers", () => {
  const sink = new LocalArrayAnalyticsSink();
  setAnalyticsSink(sink);
  trackEvent("run_started", { seed: 1 });
  trackEvent("run_summary", { totalDungeons: 2 });
  setAnalyticsSink(new ConsoleAnalyticsSink());

  expect(
    sink.flush().map((event) => event.seq)
  ).toStrictEqual([0, 1]);
});

test("freshSave always uses current save version", () => {
  expect(freshSave(123).version).toBe(SAVE_VERSION);
});

test("freshSave initializes an empty playthrough archive", () => {
  const save = freshSave(123);

  expect(save.playthroughArchive).toBeTruthy();
  expect(save.playthroughArchive.version).toBe(1);
  expect(save.playthroughArchive.maxRecords).toBe(100);
  expect(save.playthroughArchive.records).toStrictEqual([]);
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

  expect(parsed).toBeTruthy();
  expect(parsed!.playthroughArchive.maxRecords).toBe(1);
  expect(parsed!.playthroughArchive.records).toStrictEqual([]);
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
    finalRun: startRun(11, 1000).currentRun!,
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

  expect(third.playthroughArchive.records.map((record) => record.id)).toStrictEqual([
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

  const migrated = migrateSave(v2Save as unknown as SaveFile);

  expect(migrated.version).toBe(SAVE_VERSION);
  expect(migrated.meta.legacyPath).toBeNull();
  expect(migrated.meta.legacyPerks).toStrictEqual([]);
  expect(migrated.meta.legacyAsh).toBe(7);
  expect(migrated.meta.discoveredTraitIds).toStrictEqual(["grave_touched"]);
});

test("v2-to-v3 migration adds evolvedTraitIds, discoveryMomentum, activeLegacyPerkIds to run", () => {
  const existingSave = startRun(123, 1000);
  // Simulate a v2 run (without the new fields)
  const runWithoutNewFields = { ...existingSave.currentRun } as Record<string, unknown>;
  delete runWithoutNewFields.evolvedTraitIds;
  delete runWithoutNewFields.discoveryMomentum;
  delete runWithoutNewFields.activeLegacyPerkIds;
  delete runWithoutNewFields.legacyPath;

  const parsed = parseSave(JSON.stringify({ ...existingSave, version: 2, currentRun: runWithoutNewFields }));
  expect(parsed?.currentRun).toBeTruthy();
  expect(parsed!.currentRun!.evolvedTraitIds).toStrictEqual([]);
  expect(parsed!.currentRun!.discoveryMomentum).toBe(0);
  expect(parsed!.currentRun!.activeLegacyPerkIds).toStrictEqual([]);
  expect(parsed!.currentRun!.legacyPath).toBeNull();
});
