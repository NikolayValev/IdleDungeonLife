import { test, expect } from "vitest";

import { applyAlignmentDelta } from "../../src/core/alignment";
import type { AlignmentState } from "../../src/core/types";
import {
  startRun,
  reduceGame,
  reconcileOffline,
  addResources,
} from "./helpers";

function fresh(overrides: Partial<AlignmentState> = {}): AlignmentState {
  return { holyUnholy: 0, minCap: -100, maxCap: 100, gatesCrossed: [], ...overrides };
}

// 1. Delta applies and clamps to caps.
test("delta applies and clamps to the current caps", () => {
  expect(applyAlignmentDelta(fresh(), 30).alignment.holyUnholy).toBe(30);

  // already narrowed: abyss_2 left maxCap at +15
  const narrowed = fresh({ minCap: -100, maxCap: 15, gatesCrossed: ["abyss_1", "abyss_2"] });
  expect(applyAlignmentDelta(narrowed, 999).alignment.holyUnholy).toBe(15);
  expect(applyAlignmentDelta(fresh(), -999).alignment.holyUnholy).toBe(-100);
});

// 2. Crossing each gate sets the correct caps and appends to gatesCrossed.
test("each gate sets the correct opposite cap and records itself", () => {
  const cases: Array<[number, string, "minCap" | "maxCap", number]> = [
    [-25, "abyss_1", "maxCap", 50],
    [-50, "abyss_2", "maxCap", 15],
    [-75, "abyss_3", "maxCap", -25],
    [25, "holy_1", "minCap", -50],
    [50, "holy_2", "minCap", -15],
    [75, "holy_3", "minCap", 25],
  ];
  for (const [delta, gate, cap, capValue] of cases) {
    const result = applyAlignmentDelta(fresh(), delta);
    expect(result.alignment.gatesCrossed).toContain(gate);
    expect(result.alignment[cap]).toBe(capValue);
    expect(result.crossings.at(-1)!.gate).toBe(gate);
  }
});

// 3. A gate never fires twice; caps never widen within a life.
test("a gate never fires twice and caps only narrow", () => {
  const first = applyAlignmentDelta(fresh(), -30); // crosses abyss_1, maxCap -> 50
  expect(first.alignment.gatesCrossed).toStrictEqual(["abyss_1"]);

  // Recover toward neutral (but not past +25, which would be a *different* gate),
  // then re-cross the same -25 threshold: no re-fire, cap unchanged.
  const back = applyAlignmentDelta(first.alignment, 20); // -30 -> -10 (no gate)
  expect(back.crossings).toStrictEqual([]);
  const again = applyAlignmentDelta(back.alignment, -20); // -10 -> -30, re-cross -25
  expect(again.alignment.gatesCrossed).toStrictEqual(["abyss_1"]);
  expect(again.crossings).toStrictEqual([]);
  expect(again.alignment.maxCap).toBe(50); // never widened back to 100
});

// 4. A single large delta crosses multiple gates, in ascending tier order.
test("a single large delta crosses multiple gates in order", () => {
  const result = applyAlignmentDelta(fresh(), -60); // crosses abyss_1 (-25) and abyss_2 (-50)
  expect(result.alignment.gatesCrossed).toStrictEqual(["abyss_1", "abyss_2"]);
  expect(result.crossings.map((c) => c.gate)).toStrictEqual(["abyss_1", "abyss_2"]);
  expect(result.alignment.maxCap).toBe(15);
  // the cumulative caps are recorded per crossing
  expect(result.crossings[0].newCaps.maxCap).toBe(50);
  expect(result.crossings[1].newCaps.maxCap).toBe(15);
});

// 5. Post-abyss_2, no sequence of positive deltas exceeds +15.
test("post-abyss_2 no sequence of positive deltas exceeds +15", () => {
  let state = applyAlignmentDelta(fresh(), -55).alignment; // through abyss_1 + abyss_2
  expect(state.maxCap).toBe(15);
  for (const delta of [5, 40, 3, 100, 7, 999]) {
    state = applyAlignmentDelta(state, delta).alignment;
    expect(state.holyUnholy).toBeLessThanOrEqual(15);
  }
});

// 6. Determinism: the engine is a pure function of its inputs.
test("applyAlignmentDelta is deterministic and does not mutate its input", () => {
  const input = fresh({ holyUnholy: -20 });
  const snapshot = structuredClone(input);
  const a = applyAlignmentDelta(input, -10);
  const b = applyAlignmentDelta(input, -10);
  expect(a).toStrictEqual(b);
  expect(input).toStrictEqual(snapshot); // unchanged
});

// 7. Offline drift crosses gates identically to online play.
test("offline reconciliation crosses gates identically to online completion", () => {
  // Position a run at -20 with an unholy dungeon (grave_hollow, -8) in progress,
  // so completing it crosses abyss_1 (threshold -25) either way.
  let base = startRun(4242, 1000);
  base = reduceGame(base, { type: "DEBUG_UNLOCK_DUNGEON", dungeonId: "grave_hollow" });
  base = addResources(base, 1000, 0);
  base = {
    ...base,
    currentRun: {
      ...base.currentRun!,
      alignment: { ...base.currentRun!.alignment, holyUnholy: -20 },
    },
  };
  const started = reduceGame(base, {
    type: "START_DUNGEON",
    dungeonId: "grave_hollow",
    nowUnixSec: 1000,
  });
  const completesAt = started.currentRun!.currentDungeon!.completesAtUnixSec;

  // Online: tick to completion, then complete.
  let online = reduceGame(started, { type: "TICK", nowUnixSec: completesAt });
  online = reduceGame(online, { type: "COMPLETE_DUNGEON", nowUnixSec: completesAt });

  // Offline: same elapsed time reconciled in one shot.
  const offline = reconcileOffline(
    { ...started, updatedAtUnixSec: 1000 },
    completesAt + 1
  );

  expect(offline.currentRun!.alignment).toStrictEqual(online.currentRun!.alignment);
  expect(online.currentRun!.alignment.gatesCrossed).toContain("abyss_1");
  expect(online.currentRun!.alignment.maxCap).toBe(50);
});

// A gate crossing emits a transient ceremony effect + a chronicle entry.
test("crossing a gate during a delve emits a transient effect and a chronicle entry", () => {
  let base = startRun(777, 1000);
  base = reduceGame(base, { type: "DEBUG_UNLOCK_DUNGEON", dungeonId: "grave_hollow" });
  base = addResources(base, 1000, 0);
  base = {
    ...base,
    currentRun: {
      ...base.currentRun!,
      alignment: { ...base.currentRun!.alignment, holyUnholy: -20 },
    },
  };
  const started = reduceGame(base, {
    type: "START_DUNGEON",
    dungeonId: "grave_hollow",
    nowUnixSec: 1000,
  });
  const completesAt = started.currentRun!.currentDungeon!.completesAtUnixSec;
  let after = reduceGame(started, { type: "TICK", nowUnixSec: completesAt });
  after = reduceGame(after, { type: "COMPLETE_DUNGEON", nowUnixSec: completesAt });

  const effects = after.transientEffects ?? [];
  const gateEffect = effects.find((e) => e.kind === "gateCrossed");
  expect(gateEffect?.refId).toBe("abyss_1");
  expect(gateEffect?.detail).toMatchObject({ newCaps: { maxCap: 50 } });

  const chronicleGate = after.currentRun!.chronicle.find((c) => c.kind === "gateCrossed");
  expect(chronicleGate?.refId).toBe("abyss_1");
});
