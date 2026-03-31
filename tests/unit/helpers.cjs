const assert = require("node:assert/strict");

const { freshSave } = require("../../.test-build/src/core/save.js");
const { reduceGame, reconcileOffline } = require("../../.test-build/src/core/reducer.js");

function startRun(seed = 1234, nowUnixSec = 1000) {
  const save = freshSave(nowUnixSec);
  return reduceGame(save, {
    type: "START_NEW_RUN",
    nowUnixSec,
    seed,
  });
}

function clone(value) {
  return structuredClone(value);
}

function assertUnchanged(original, snapshot) {
  assert.deepStrictEqual(original, snapshot);
}

function addResources(save, gold = 0, essence = 0) {
  return reduceGame(save, { type: "DEBUG_ADD_RESOURCES", gold, essence });
}

function grantItem(save, itemId) {
  return reduceGame(save, { type: "DEBUG_GRANT_ITEM", itemId });
}

function approx(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

module.exports = {
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
