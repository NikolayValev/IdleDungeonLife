import { describe, it, expect } from "vitest";
import { freshSave } from "../../src/core/save";
import { reduceGame } from "../../src/core/reducer";
import { advanceSubCharacters } from "../../src/sim/subRunner";
import type { SaveFile } from "../../src/core/types";

const NOW = 1000;

// A save with sub-characters unlocked and one created sub (id "sub_0").
function withOneSub(): SaveFile {
  let save = freshSave(NOW);
  save = reduceGame(save, { type: "DEBUG_SET_SUBCHARACTERS_UNLOCKED", unlocked: true });
  save = reduceGame(save, { type: "CREATE_SUBCHARACTER", name: "Probe", nowUnixSec: NOW });
  return save;
}

function setAuto(save: SaveFile, enabled: boolean): SaveFile {
  return reduceGame(save, {
    type: "TOGGLE_SUBCHARACTER_AUTOMATION",
    subCharId: "sub_0",
    enabled,
    nowUnixSec: NOW,
  });
}

describe("advanceSubCharacters", () => {
  it("does nothing when there are no sub-characters", () => {
    const save = freshSave(NOW);
    expect(advanceSubCharacters(save, NOW + 10)).toBe(save);
  });

  it("leaves an idle sub idle when automation is off", () => {
    const save = withOneSub();
    const next = advanceSubCharacters(save, NOW + 60);
    expect(next.subCharacters[0].currentRun).toBeNull();
  });

  it("auto-starts an idle sub when automation is on", () => {
    const save = setAuto(withOneSub(), true);
    const next = advanceSubCharacters(save, NOW + 1);
    expect(next.subCharacters[0].currentRun?.alive).toBe(true);
  });

  it("ages a running sub to death over a long span (automation off => Fallen)", () => {
    let save = withOneSub();
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });
    expect(save.subCharacters[0].currentRun?.alive).toBe(true);

    const next = advanceSubCharacters(save, NOW + 86400, 30);
    const run = next.subCharacters[0].currentRun;
    expect(run).not.toBeNull();
    expect(run!.alive).toBe(false); // Fallen, awaiting manual claim
  });

  it("auto-claims and restarts a fallen run when automation is on", () => {
    let save = setAuto(withOneSub(), true);
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });

    const next = advanceSubCharacters(save, NOW + 86400, 30);
    const sub = next.subCharacters[0];
    expect(sub.stats.totalRunsCompleted).toBeGreaterThanOrEqual(1); // a life was claimed
    expect(sub.meta.legacyAsh).toBeGreaterThan(0); // ash banked
    expect(sub.currentRun?.alive).toBe(true); // a fresh life started
  });

  it("does not mutate the main run or global achievements while advancing a sub", () => {
    let save = setAuto(withOneSub(), true);
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });
    const mainBefore = JSON.stringify(save.currentRun);

    const next = advanceSubCharacters(save, NOW + 3600, 30);
    expect(JSON.stringify(next.currentRun)).toBe(mainBefore);
  });

  it("is deterministic for identical inputs", () => {
    let save = withOneSub();
    save = reduceGame(save, { type: "START_SUBCHARACTER_RUN", subCharId: "sub_0", nowUnixSec: NOW });
    const a = advanceSubCharacters(save, NOW + 3600, 30);
    const b = advanceSubCharacters(save, NOW + 3600, 30);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
