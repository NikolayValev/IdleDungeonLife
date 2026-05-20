import { test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { runBatch } from "../../src/sim/batch";

function walk(dir: string, matcher: (file: string) => boolean, results: string[] = []): string[] {
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

  expect(left).toStrictEqual(right);
  expect(Object.values(left.scoreDistribution).reduce((sum, count) => sum + count, 0)).toBe(5);
});

test("core and sim contain no Phaser imports", () => {
  const files = [
    ...walk(path.join(process.cwd(), "src", "core"), (file) => file.endsWith(".ts")),
    ...walk(path.join(process.cwd(), "src", "sim"), (file) => file.endsWith(".ts")),
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    expect(/from\s+["']phaser["']/.test(source), file).toBe(false);
  }
});

test("UI layers do not emit analytics events directly", () => {
  const files = walk(path.join(process.cwd(), "src", "ui"), (file) => file.endsWith(".ts"));

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    expect(source.includes("trackEvent("), file).toBe(false);
  }
});
