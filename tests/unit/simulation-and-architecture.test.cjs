const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { runBatch } = require("../../.test-build/src/sim/batch.js");

function walk(dir, matcher, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, matcher, results);
    } else if (matcher(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

test("batch simulation is stable for the same seed window", () => {
  const left = runBatch(10000, 5, { durationSec: 900, stepSec: 15 });
  const right = runBatch(10000, 5, { durationSec: 900, stepSec: 15 });

  assert.deepStrictEqual(left, right);
  assert.equal(Object.values(left.scoreDistribution).reduce((sum, count) => sum + count, 0), 5);
});

test("core and sim contain no Phaser imports", () => {
  const files = [
    ...walk(path.join(process.cwd(), "src", "core"), (file) => file.endsWith(".ts")),
    ...walk(path.join(process.cwd(), "src", "sim"), (file) => file.endsWith(".ts")),
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(/from\s+["']phaser["']/.test(source), false, file);
  }
});

test("UI layers do not emit analytics events directly", () => {
  const files = walk(path.join(process.cwd(), "src", "ui"), (file) => file.endsWith(".ts"));

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(source.includes("trackEvent("), false, file);
  }
});
