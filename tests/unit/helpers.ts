import { expect } from "vitest";

import { freshSave } from "../../src/core/save";
import { reduceGame, reconcileOffline } from "../../src/core/reducer";
import type { SaveFile } from "../../src/core/types";

function startRun(seed = 1234, nowUnixSec = 1000): SaveFile {
  const save = freshSave(nowUnixSec);
  return reduceGame(save, {
    type: "START_NEW_RUN",
    nowUnixSec,
    seed,
  });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function assertUnchanged<T>(original: T, snapshot: T): void {
  expect(original).toStrictEqual(snapshot);
}

function addResources(save: SaveFile, gold = 0, essence = 0): SaveFile {
  return reduceGame(save, { type: "DEBUG_ADD_RESOURCES", gold, essence });
}

function grantItem(save: SaveFile, itemId: string): SaveFile {
  return reduceGame(save, { type: "DEBUG_GRANT_ITEM", itemId });
}

function approx(actual: number, expected: number, epsilon = 1e-9): void {
  expect(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  ).toBeTruthy();
}

export {
  freshSave,
  reduceGame,
  reconcileOffline,
  startRun,
  clone,
  assertUnchanged,
  addResources,
  grantItem,
  approx,
};
