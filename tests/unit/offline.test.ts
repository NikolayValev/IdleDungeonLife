import { test, expect } from "vitest";

import { reduceGame, reconcileOffline, startRun, addResources, approx } from "./helpers";
import { BALANCE } from "../../src/content/balance";
import type { SaveFile } from "../../src/core/types";

function stripTraits(save: SaveFile): SaveFile {
  return {
    ...save,
    currentRun: {
      ...save.currentRun!,
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

  approx(reconciled.currentRun!.resources.gold, 19.5);
  expect(reconciled.currentRun!.lifespan.ageSeconds).toBe(30);
  expect(reconciled.currentRun!.lifespan.vitality < 100).toBeTruthy();
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

  expect(reconciled.currentRun!.currentDungeon).toBeNull();
  expect(reconciled.currentRun!.totalDungeonsCompleted).toBe(1);
  expect(repeated).toStrictEqual(reconciled);
});

test("long offline interval is clamped", () => {
  let save = startRun(23, 1000);
  save = stripTraits(save);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  const reconciled = reconcileOffline(save, 1000 + 30 * 3600);

  expect(reconciled.updatedAtUnixSec).toBe(1000 + 30 * 3600);
  expect(reconciled.currentRun!.lifespan.ageSeconds).toBe(BALANCE.maxOfflineSec);
});
