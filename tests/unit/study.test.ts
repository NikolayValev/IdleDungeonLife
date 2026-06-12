import { test, expect } from "vitest";

import {
  enroll,
  accrueRefinement,
  checkBreakthroughReadiness,
  performBreakthrough,
  computeDriftContribution,
  emptyStudyState,
} from "../../src/core/study";
import type { StudyState } from "../../src/core/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function freshState(): StudyState {
  return emptyStudyState();
}

/** Enroll at a school without any gates crossed. */
function enrolled(schoolId: "choir" | "hollow_order" | "archive"): StudyState {
  const result = enroll(freshState(), schoolId, []);
  if (result.rejectedReason !== null) {
    throw new Error(`Enrollment unexpectedly rejected: ${result.rejectedReason}`);
  }
  return result.state;
}

// ─── §9 test 2: bottleneck clamps at 100; no auto-breakthrough ────────────────

test("refinement clamps at 100 and does not auto-advance stage", () => {
  // Start enrolled at choir, stage 0, refinement 0.
  const state = enrolled("choir");
  // Accrue a huge number of years — should clamp at 100, stage stays at 0.
  const { state: after } = accrueRefinement(state, 9999, []);
  expect(after.schools.choir.refinement).toBe(100);
  expect(after.schools.choir.stage).toBe(0);
  expect(after.schools.choir.bottlenecked).toBe(true);
});

test("a 0-year budget is a no-op", () => {
  const state = enrolled("hollow_order");
  const { state: after, yearsActuallyStudied } = accrueRefinement(state, 0, []);
  expect(after).toStrictEqual(state);
  expect(yearsActuallyStudied).toBe(0);
});

test("further accrual while bottlenecked is a no-op", () => {
  const state = enrolled("archive");
  const { state: bottlenecked } = accrueRefinement(state, 9999, []);
  expect(bottlenecked.schools.archive.bottlenecked).toBe(true);

  const { state: again, yearsActuallyStudied } = accrueRefinement(bottlenecked, 100, []);
  expect(again).toStrictEqual(bottlenecked);
  expect(yearsActuallyStudied).toBe(0);
});

// ─── §9 test 3: breakthrough conditions, stage+arts+lifespan, vitality toll ──

test("breakthrough fails when refinement < 100", () => {
  const state = enrolled("archive");
  const { state: partial } = accrueRefinement(state, 1, []);
  // Make sure refinement is less than 100.
  expect(partial.schools.archive.refinement).toBeLessThan(100);

  const readiness = checkBreakthroughReadiness(partial, 0, [], [], 0);
  expect(readiness.ready).toBe(false);
  expect(readiness.unmetHints.some((h) => h.includes("Refinement"))).toBe(true);
});

test("breakthrough succeeds for archive stage 1 with all conditions met", () => {
  // Stage 1 for archive: only refinement required.
  const state = enrolled("archive");
  const { state: full } = accrueRefinement(state, 9999, []);
  expect(full.schools.archive.refinement).toBe(100);

  const readiness = checkBreakthroughReadiness(full, 0, [], [], 0);
  expect(readiness.ready).toBe(true);
  expect(readiness.unmetHints).toHaveLength(0);

  const { state: after, deltas } = performBreakthrough(full);
  expect(after.schools.archive.stage).toBe(1);
  expect(after.schools.archive.refinement).toBe(0);
  expect(after.schools.archive.bottlenecked).toBe(false);
  // Arts gained: archive stage 1 = ["archive_eye_1", "archive_codex_1"]
  expect(deltas.artsGained).toContain("archive_eye_1");
  expect(deltas.artsGained).toContain("archive_codex_1");
  expect(after.artsKnown).toContain("archive_eye_1");
  // Lifespan grant at stage 1 index 0 is 0 per spec.
  expect(deltas.lifespanGrantYears).toBe(0);
  // Vitality toll at stage 1 should be >0.
  expect(deltas.vitalityTollPct).toBeGreaterThan(0);
});

test("breakthrough to stage 2 grants correct lifespan bonus (+4 years)", () => {
  // Use hollow_order (fastest, so quickest to stage 2 in test).
  // Stage 2 conditions for hollow_order: alignment ≤ 30.
  let state = enrolled("hollow_order");
  // First breakthrough: stage 0 → 1
  const { state: s1 } = accrueRefinement(state, 9999, []);
  expect(checkBreakthroughReadiness(s1, 0, [], [], 0).ready).toBe(true);
  const { state: afterS1 } = performBreakthrough(s1);
  expect(afterS1.schools.hollow_order.stage).toBe(1);

  // Second breakthrough: stage 1 → 2 (alignment 0 satisfies ≤ 30)
  const { state: s2 } = accrueRefinement(afterS1, 9999, []);
  const readiness2 = checkBreakthroughReadiness(s2, 0, [], [], 0);
  expect(readiness2.ready).toBe(true);

  const { deltas: deltas2 } = performBreakthrough(s2);
  expect(deltas2.lifespanGrantYears).toBe(4); // stage 2 grant
});

test("breakthrough returns correct vitality toll", () => {
  const state = enrolled("choir");
  const { state: full } = accrueRefinement(state, 9999, []);
  const { deltas } = performBreakthrough(full);
  // Choir stage 1 toll (index 0) = 5%.
  expect(deltas.vitalityTollPct).toBe(5);
});

test("breakthrough rejected when alignment out of range", () => {
  // Hollow order stage 2 needs alignment ≤ 30. Test with +50.
  let state = enrolled("hollow_order");
  // Advance to stage 1 first.
  const { state: s1 } = accrueRefinement(state, 9999, []);
  state = performBreakthrough(s1).state;

  // Now try stage 2 with alignment = +50 (out of range).
  const { state: s2 } = accrueRefinement(state, 9999, []);
  const readiness = checkBreakthroughReadiness(s2, 50, [], [], 0);
  expect(readiness.ready).toBe(false);
  expect(readiness.unmetHints.some((h) => h.includes("Alignment"))).toBe(true);
});

test("breakthrough rejected when required manual missing", () => {
  // Choir stage 4 needs manual_choir_codex_holy. We skip ahead to stage 3 by force.
  const state = enrolled("choir");
  const forcedState: StudyState = {
    ...state,
    schools: {
      ...state.schools,
      choir: { stage: 3, refinement: 100, bottlenecked: true },
    },
  };
  const readiness = checkBreakthroughReadiness(
    forcedState,
    50, // alignment in range for choir stage 4 (≥ 10)
    [], // no manuals
    ["the_silent_prelate"], // boss satisfied
    50 // age ok (no min age for stage 4)
  );
  expect(readiness.ready).toBe(false);
  expect(readiness.unmetHints.some((h) => h.includes("manual") || h.includes("Manual"))).toBe(true);
});

// ─── §9 test 5: gate-barred enrollment; arts retained after gate crossing ─────

test("enrollment at choir is rejected after crossing abyss_2", () => {
  const result = enroll(freshState(), "choir", ["abyss_1", "abyss_2"]);
  expect(result.rejectedReason).not.toBeNull();
  expect(result.rejectedReason).toContain("abyss_2");
  expect(result.state.enrolled).toBeNull();
});

test("enrollment at hollow_order is rejected after crossing holy_2", () => {
  const result = enroll(freshState(), "hollow_order", ["holy_1", "holy_2"]);
  expect(result.rejectedReason).not.toBeNull();
  expect(result.state.enrolled).toBeNull();
});

test("archive is never barred, regardless of gates crossed", () => {
  const allGates = ["abyss_1", "abyss_2", "abyss_3", "holy_1", "holy_2", "holy_3"] as const;
  const result = enroll(freshState(), "archive", [...allGates]);
  expect(result.rejectedReason).toBeNull();
  expect(result.state.enrolled).toBe("archive");
});

test("arts already known are retained after a later gate crossing forces re-enrollment", () => {
  // Simulate: studied choir, got arts, then crossed abyss_2.
  // Arts stay on the character; only new enrollment at choir is blocked.
  const initial = enrolled("choir");
  const { state: withRefinement } = accrueRefinement(initial, 9999, []);
  const { state: withStage1 } = performBreakthrough(withRefinement);

  // Character now knows choir stage 1 arts.
  expect(withStage1.artsKnown).toContain("choir_ward_1");
  expect(withStage1.artsKnown).toContain("choir_restoration_1");

  // Cross abyss_2 — try to re-enroll at choir, should be rejected.
  const reEnrollResult = enroll(withStage1, "choir", ["abyss_1", "abyss_2"]);
  expect(reEnrollResult.rejectedReason).not.toBeNull();

  // Arts are still present on the returned state (the state was not modified).
  expect(reEnrollResult.state.artsKnown).toContain("choir_ward_1");
  expect(reEnrollResult.state.artsKnown).toContain("choir_restoration_1");
});

// ─── §9 test 6: archive dampens drift ────────────────────────────────────────

test("archive enrollment returns externalDriftFactor < 1 (dampening active)", () => {
  const { driftPerYear, externalDriftFactor } = computeDriftContribution("archive");
  expect(driftPerYear).toBe(0); // archive is neutral
  expect(externalDriftFactor).toBeGreaterThan(0);
  expect(externalDriftFactor).toBeLessThan(1); // dampening applied
});

test("choir enrollment contributes positive drift and no external dampening", () => {
  const { driftPerYear, externalDriftFactor } = computeDriftContribution("choir");
  expect(driftPerYear).toBeGreaterThan(0); // pulls toward holy
  expect(externalDriftFactor).toBe(1); // no dampening
});

test("hollow_order enrollment contributes negative drift and no external dampening", () => {
  const { driftPerYear, externalDriftFactor } = computeDriftContribution("hollow_order");
  expect(driftPerYear).toBeLessThan(0); // pulls toward abyss
  expect(externalDriftFactor).toBe(1); // no dampening
});

test("not enrolled returns zero drift and no dampening", () => {
  const { driftPerYear, externalDriftFactor } = computeDriftContribution(null);
  expect(driftPerYear).toBe(0);
  expect(externalDriftFactor).toBe(1);
});

// ─── §9 test 7: determinism ───────────────────────────────────────────────────

test("same inputs always produce identical StudyState", () => {
  const state = enrolled("hollow_order");
  const ops = (s: StudyState) => {
    const { state: s1 } = accrueRefinement(s, 9999, []);
    const { state: s2 } = performBreakthrough(s1);
    const { state: s3 } = accrueRefinement(s2, 9999, []);
    return s3;
  };

  const resultA = ops(state);
  const resultB = ops(state);
  expect(resultA).toStrictEqual(resultB);
});

test("identical enrollment + accrual produces identical readiness", () => {
  const state = enrolled("archive");
  const { state: full } = accrueRefinement(state, 9999, []);

  const r1 = checkBreakthroughReadiness(full, 0, [], [], 0);
  const r2 = checkBreakthroughReadiness(full, 0, [], [], 0);
  expect(r1).toStrictEqual(r2);
});
