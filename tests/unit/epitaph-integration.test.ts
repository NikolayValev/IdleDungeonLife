import { test, expect } from "vitest";

import { startRun, reduceGame, addResources } from "./helpers";

// The death reduction composes an epitaph from the dead run and stores it on the
// playthrough record, alongside a chronicle that ends with a `death` entry.
test("CLAIM_DEATH composes an epitaph onto the archived playthrough record", () => {
  let save = startRun(2024, 1000);
  save = addResources(save, 500, 50);

  // Kill the run, then claim death.
  save = reduceGame(save, { type: "DEBUG_KILL_RUN" });
  save = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 2000 });

  const record = save.playthroughArchive.records.at(-1);
  expect(record).toBeTruthy();
  expect(record!.epitaph).toBeTruthy();
  expect(record!.epitaph!.lines.length).toBeGreaterThanOrEqual(1);
  expect(record!.epitaph!.lines.length).toBeLessThanOrEqual(3);
  // primaryFacet is always present (faint lives still pick a best facet).
  expect(record!.epitaph!.primaryFacet).toBeTruthy();
  // The stored chronicle ends with the terminal death entry.
  expect(record!.chronicle?.at(-1)?.kind).toBe("death");
  // Whole epitaph stays within the ~140-char display cap.
  expect(record!.epitaph!.lines.join(" ").length).toBeLessThanOrEqual(140);
});

test("epitaph composition at death is deterministic for the same seed", () => {
  const playOneLife = (): string[] => {
    let save = startRun(7777, 1000);
    save = addResources(save, 500, 50);
    save = reduceGame(save, { type: "DEBUG_KILL_RUN" });
    save = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 2000 });
    return save.playthroughArchive.records.at(-1)!.epitaph!.lines;
  };
  expect(playOneLife()).toStrictEqual(playOneLife());
});
