import { test, expect } from "vitest";

import { migrateSave, parseSave, freshSave, emptyStudyState, SAVE_VERSION } from "../../src/core/save";
import type { SaveFile } from "../../src/core/types";
import { startRun } from "./helpers";

// ─── Alignment caps + gate history (alignment-spec §9.8) ─────────────────────

test("legacy run without alignment caps gets full-range caps, value preserved, empty history", () => {
  const save = startRun(123, 1000);
  const legacyRun = { ...save.currentRun } as Record<string, unknown>;
  legacyRun.alignment = { holyUnholy: -42 }; // pre-F1 shape: value only
  delete legacyRun.chronicle;
  delete legacyRun.study;

  const parsed = parseSave(JSON.stringify({ ...save, version: 3, currentRun: legacyRun }));

  expect(parsed?.currentRun).toBeTruthy();
  expect(parsed!.currentRun!.alignment).toStrictEqual({
    holyUnholy: -42,
    minCap: -100,
    maxCap: 100,
    gatesCrossed: [],
  });
});

test("alignment value is clamped within provided caps and invalid gates dropped", () => {
  const save = startRun(7, 1000);
  const run = { ...save.currentRun } as Record<string, unknown>;
  run.alignment = {
    holyUnholy: 80, // outside the maxCap below — must clamp down
    minCap: -50,
    maxCap: 15,
    gatesCrossed: ["abyss_2", "not_a_gate", 9],
  };

  const parsed = parseSave(JSON.stringify({ ...save, currentRun: run }));

  expect(parsed!.currentRun!.alignment.holyUnholy).toBe(15);
  expect(parsed!.currentRun!.alignment.minCap).toBe(-50);
  expect(parsed!.currentRun!.alignment.maxCap).toBe(15);
  expect(parsed!.currentRun!.alignment.gatesCrossed).toStrictEqual(["abyss_2"]);
});

// ─── Chronicle + Study shells (epitaph-spec §9.8, study-spec §9.9) ───────────

test("legacy run without chronicle/study gets empty defaults", () => {
  const save = startRun(55, 1000);
  const legacyRun = { ...save.currentRun } as Record<string, unknown>;
  delete legacyRun.chronicle;
  delete legacyRun.study;

  const parsed = parseSave(JSON.stringify({ ...save, version: 3, currentRun: legacyRun }));

  expect(parsed!.currentRun!.chronicle).toStrictEqual([]);
  expect(parsed!.currentRun!.study).toStrictEqual(emptyStudyState());
});

test("chronicle entries are preserved and invalid kinds dropped", () => {
  const save = startRun(9, 1000);
  const run = { ...save.currentRun } as Record<string, unknown>;
  run.chronicle = [
    { year: 19, kind: "jobTaken", refId: "porter" },
    { year: 43, kind: "gateCrossed", refId: "abyss_1" },
    { year: 50, kind: "not_a_kind" }, // dropped
    { kind: "death" }, // year defaults to 0
  ];

  const parsed = parseSave(JSON.stringify({ ...save, currentRun: run }));

  expect(parsed!.currentRun!.chronicle).toStrictEqual([
    { year: 19, kind: "jobTaken", refId: "porter" },
    { year: 43, kind: "gateCrossed", refId: "abyss_1" },
    { year: 0, kind: "death" },
  ]);
});

test("study state preserves valid school progress and enrollment", () => {
  const save = startRun(11, 1000);
  const run = { ...save.currentRun } as Record<string, unknown>;
  run.study = {
    enrolled: "hollow_order",
    schools: {
      hollow_order: { stage: 3, refinement: 100, bottlenecked: true },
      choir: { stage: 1, refinement: 40, bottlenecked: false },
      // archive omitted — defaults applied
    },
    artsKnown: ["sacrifice_i", "sacrifice_i", "decay_ward"], // dedup
  };

  const parsed = parseSave(JSON.stringify({ ...save, currentRun: run }));

  expect(parsed!.currentRun!.study.enrolled).toBe("hollow_order");
  expect(parsed!.currentRun!.study.schools.hollow_order).toStrictEqual({
    stage: 3,
    refinement: 100,
    bottlenecked: true,
  });
  expect(parsed!.currentRun!.study.schools.archive).toStrictEqual({
    stage: 0,
    refinement: 0,
    bottlenecked: false,
  });
  expect(parsed!.currentRun!.study.artsKnown).toStrictEqual(["sacrifice_i", "decay_ward"]);
});

test("invalid enrollment school falls back to null", () => {
  const save = startRun(12, 1000);
  const run = { ...save.currentRun } as Record<string, unknown>;
  run.study = { enrolled: "wizard_tower", schools: {}, artsKnown: [] };

  const parsed = parseSave(JSON.stringify({ ...save, currentRun: run }));

  expect(parsed!.currentRun!.study.enrolled).toBeNull();
});

// ─── Fresh save + new-run shells ─────────────────────────────────────────────

test("a freshly started run carries valid F1 shells", () => {
  const save = startRun(321, 1000);
  const run = save.currentRun!;

  expect(run.alignment).toStrictEqual({
    holyUnholy: 0,
    minCap: -100,
    maxCap: 100,
    gatesCrossed: [],
  });
  expect(run.chronicle).toStrictEqual([]);
  expect(run.study).toStrictEqual(emptyStudyState());
  expect(run.appearanceSelection).toBeUndefined();
});

// ─── Version gate ────────────────────────────────────────────────────────────

test("parseSave rejects saves newer than the F1 version and accepts the current one", () => {
  expect(SAVE_VERSION).toBe(4);
  expect(parseSave(`{"version":5,"updatedAtUnixSec":0,"meta":{},"currentRun":null}`)).toBeNull();

  const ok = parseSave(`{"version":4,"updatedAtUnixSec":0,"meta":{},"currentRun":null}`);
  expect(ok!.version).toBe(SAVE_VERSION);
});

// ─── Past-life record shells on the playthrough archive ──────────────────────

test("playthrough records preserve epitaph/chronicle/appearance/notable when present", () => {
  const save = startRun(99, 1000);
  const record = {
    id: "rec1",
    recordVersion: 1,
    recordedAtUnixSec: 2000,
    seed: 99,
    outcome: "death",
    finalRun: save.currentRun,
    finalMeta: save.meta,
    finalScore: {
      total: 0,
      dungeonDepthScore: 0,
      legacyAshScore: 0,
      survivalScore: 0,
      discoveryScore: 0,
      buildDiversityScore: 0,
      dominancePenalty: 0,
    },
    legacyAsh: {
      earned: 0,
      baseBreakdown: { total: 0, depthBonus: 0, ageBonus: 0, bossBonus: 0, dungeonBonus: 0 },
      evolutionBonus: 0,
      momentumBonus: 0,
    },
    timeline: [],
    epitaph: {
      lines: ["Died at 71, deep in The Wound.", "Marked by the Abyss."],
      primaryFacet: "abyss",
      secondaryFacet: "delver",
      arc: "forsaken",
    },
    chronicle: [{ year: 43, kind: "gateCrossed", refId: "abyss_2" }],
    appearanceSelection: {
      layers: [{ sheetId: "body/adult", variant: "ashen", zPos: 10 }],
      paletteOverrides: [{ target: "skin", variant: "ash" }],
    },
    notable: true,
  };

  const parsed = parseSave(
    JSON.stringify({
      ...save,
      playthroughArchive: { version: 1, maxRecords: 100, records: [record] },
    })
  );

  const stored = parsed!.playthroughArchive.records[0];
  expect(stored.epitaph).toStrictEqual(record.epitaph);
  expect(stored.chronicle).toStrictEqual(record.chronicle);
  expect(stored.appearanceSelection).toStrictEqual(record.appearanceSelection);
  expect(stored.notable).toBe(true);
});

test("playthrough records without past-life fields omit them (no defaults injected)", () => {
  const base = freshSave(1000);
  const migrated = migrateSave(base as unknown as SaveFile);
  expect(migrated.playthroughArchive.records).toStrictEqual([]);

  // A record with no identity fields stays clean.
  const save = startRun(1, 1000);
  const record = {
    id: "plain",
    recordVersion: 1,
    recordedAtUnixSec: 2000,
    seed: 1,
    outcome: "death",
    finalRun: save.currentRun,
    finalMeta: save.meta,
    finalScore: {
      total: 0,
      dungeonDepthScore: 0,
      legacyAshScore: 0,
      survivalScore: 0,
      discoveryScore: 0,
      buildDiversityScore: 0,
      dominancePenalty: 0,
    },
    legacyAsh: {
      earned: 0,
      baseBreakdown: { total: 0, depthBonus: 0, ageBonus: 0, bossBonus: 0, dungeonBonus: 0 },
      evolutionBonus: 0,
      momentumBonus: 0,
    },
    timeline: [],
  };

  const parsed = parseSave(
    JSON.stringify({
      ...save,
      playthroughArchive: { version: 1, maxRecords: 100, records: [record] },
    })
  );
  const stored = parsed!.playthroughArchive.records[0];
  expect(stored.epitaph).toBeUndefined();
  expect("chronicle" in stored).toBe(false);
  expect(stored.notable).toBeUndefined();
});
