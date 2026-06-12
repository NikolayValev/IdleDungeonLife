// ─── Study System — pure module ───────────────────────────────────────────────
// No Phaser / DOM / window / canvas / Math.random / Date.now.
// All mutations return new objects; inputs are never modified.

import type { ArtId, GateId, SchoolId, StudyState } from "./types";
import { emptyStudyState } from "./save";
import {
  SCHOOL_REGISTRY,
  MANUAL_REGISTRY,
  BASE_REFINEMENT_RATE,
  SCHOOL_RATE_MODIFIER,
  STAGE_STUDY_YEAR_COSTS,
  SCHOOL_DRIFT_PER_YEAR,
  ARCHIVE_DRIFT_DAMPEN_FACTOR,
  BREAKTHROUGH_VITALITY_TOLL_PCT,
  BREAKTHROUGH_LIFESPAN_GRANT_YEARS,
} from "../content/schools";

// ─── Enrollment ───────────────────────────────────────────────────────────────

export interface EnrollResult {
  state: StudyState;
  /** Null when enrollment succeeded; a reason string if it was rejected. */
  rejectedReason: string | null;
}

/**
 * Attempt to enroll the character in `schoolId`.
 * Barred if the school's `barredByGates` list intersects `gatesCrossed`.
 * Does NOT strip arts already known.
 */
export function enroll(
  state: StudyState,
  schoolId: SchoolId,
  gatesCrossed: GateId[]
): EnrollResult {
  const def = SCHOOL_REGISTRY.get(schoolId);
  if (!def) {
    return { state, rejectedReason: `Unknown school: ${schoolId}` };
  }

  for (const barGate of def.barredByGates) {
    if (gatesCrossed.includes(barGate)) {
      return {
        state,
        rejectedReason: `Enrollment barred: gate ${barGate} has been crossed`,
      };
    }
  }

  return {
    state: { ...state, enrolled: schoolId },
    rejectedReason: null,
  };
}

// ─── Refinement accrual ───────────────────────────────────────────────────────

/**
 * Compute the refinement rate (points per study-year) for a given school and
 * list of owned manual IDs, taking stage cost scaling into account.
 *
 * rate = BASE_REFINEMENT_RATE × schoolMod × manualBonus × (baseYears / stageCost)
 *
 * where baseYears = STAGE_STUDY_YEAR_COSTS[0] = 6 (the cheapest stage, used as
 * the "reference" so the meter fills in the expected number of years at base rate).
 */
export function computeRefinementRate(
  schoolId: SchoolId,
  currentStage: number,
  ownedManualIds: string[]
): number {
  const schoolMod = SCHOOL_RATE_MODIFIER[schoolId] ?? 1;

  // Manual bonuses stack multiplicatively.
  let manualBonus = 1;
  for (const mid of ownedManualIds) {
    const m = MANUAL_REGISTRY.get(mid);
    if (m && m.school === schoolId) {
      manualBonus *= m.refinementBonusMul;
    }
  }

  // Stage cost scaling: each stage requires more effective years.
  const stageCost = STAGE_STUDY_YEAR_COSTS[currentStage] ?? STAGE_STUDY_YEAR_COSTS[4];
  const baseYears = STAGE_STUDY_YEAR_COSTS[0]; // 6
  const stageScale = baseYears / stageCost;

  return BASE_REFINEMENT_RATE * schoolMod * manualBonus * stageScale;
}

export interface AccrueRefinementResult {
  state: StudyState;
  yearsActuallyStudied: number;
}

/**
 * Accrue refinement for `years` study-years at the enrolled school.
 * - Clamps at 100; sets `bottlenecked = true` once 100 is reached.
 * - Never auto-advances a stage.
 * - A 0-year budget is a no-op.
 * - If not enrolled, or already bottlenecked, returns unchanged state.
 */
export function accrueRefinement(
  state: StudyState,
  years: number,
  ownedManualIds: string[]
): AccrueRefinementResult {
  if (years <= 0 || state.enrolled === null) {
    return { state, yearsActuallyStudied: 0 };
  }

  const schoolId = state.enrolled;
  const progress = state.schools[schoolId];

  if (progress.bottlenecked) {
    return { state, yearsActuallyStudied: 0 };
  }

  // Stage 5 is the max; you cannot refine beyond that.
  if (progress.stage >= 5) {
    return { state, yearsActuallyStudied: 0 };
  }

  const rate = computeRefinementRate(schoolId, progress.stage, ownedManualIds);
  const gained = rate * years;
  const newRefinement = Math.min(100, progress.refinement + gained);
  const bottlenecked = newRefinement >= 100;

  const newProgress = {
    ...progress,
    refinement: newRefinement,
    bottlenecked,
  };

  return {
    state: {
      ...state,
      schools: { ...state.schools, [schoolId]: newProgress },
    },
    yearsActuallyStudied: years,
  };
}

// ─── Breakthrough readiness ───────────────────────────────────────────────────

export interface BreakthroughReadiness {
  ready: boolean;
  unmetHints: string[];
}

/**
 * Check whether a breakthrough is possible for the enrolled school.
 * Returns `ready = true` only when ALL conditions are satisfied.
 * When not ready, `unmetHints` lists human-readable reasons.
 *
 * Inputs passed in by the caller — this function is PURE and receives context:
 *   `alignment`     — current holyUnholy value
 *   `ownedManualIds` — IDs of manuals in inventory
 *   `bossesFelled`  — boss IDs cleared this life
 *   `ageYears`      — current in-game age in years
 */
export function checkBreakthroughReadiness(
  state: StudyState,
  alignment: number,
  ownedManualIds: string[],
  bossesFelled: string[],
  ageYears: number
): BreakthroughReadiness {
  const hints: string[] = [];

  if (state.enrolled === null) {
    return { ready: false, unmetHints: ["Not enrolled in a school"] };
  }

  const schoolId = state.enrolled;
  const progress = state.schools[schoolId];
  const targetStage = progress.stage + 1;

  if (targetStage > 5) {
    return { ready: false, unmetHints: ["Already at maximum stage"] };
  }

  const def = SCHOOL_REGISTRY.get(schoolId);
  if (!def) {
    return { ready: false, unmetHints: [`Unknown school: ${schoolId}`] };
  }

  const conditions = def.breakthroughConditions[targetStage - 1];
  if (!conditions) {
    return { ready: false, unmetHints: [`No conditions defined for stage ${targetStage}`] };
  }

  // Refinement must be 100.
  if (progress.refinement < 100) {
    hints.push(`Refinement must reach 100 (currently ${Math.floor(progress.refinement)})`);
  }

  // Manual required.
  if (conditions.manualRequired && !ownedManualIds.includes(conditions.manualRequired)) {
    const manualDef = MANUAL_REGISTRY.get(conditions.manualRequired);
    const name = manualDef ? manualDef.name : conditions.manualRequired;
    hints.push(`Requires manual: ${name}`);
  }

  // Alignment range.
  if (conditions.alignmentRange) {
    const { min, max } = conditions.alignmentRange;
    if (alignment < min || alignment > max) {
      hints.push(
        `Alignment must be between ${min} and ${max} (currently ${Math.round(alignment)})`
      );
    }
  }

  // Boss required.
  if (conditions.bossRequired && !bossesFelled.includes(conditions.bossRequired)) {
    hints.push(`Boss not yet felled: ${conditions.bossRequired}`);
  }

  // Minimum age.
  if (conditions.minAgeYears !== undefined && ageYears < conditions.minAgeYears) {
    hints.push(`Must be at least ${conditions.minAgeYears} years old (currently ${Math.floor(ageYears)})`);
  }

  return { ready: hints.length === 0, unmetHints: hints };
}

// ─── Perform breakthrough ─────────────────────────────────────────────────────

export interface BreakthroughDeltas {
  /** Vitality toll as a percentage of max vitality (0–100). */
  vitalityTollPct: number;
  /** Years added to lifespan. */
  lifespanGrantYears: number;
  /** Arts newly granted (may already be in artsKnown if re-studying). */
  artsGained: ArtId[];
}

export interface BreakthroughResult {
  state: StudyState;
  deltas: BreakthroughDeltas;
}

/**
 * Perform a breakthrough for the enrolled school.
 * Caller MUST first check `checkBreakthroughReadiness` and abort if not ready.
 * Returns new StudyState (stage +1, refinement reset to 0, arts added) plus
 * the deltas the caller should apply to vitality and lifespan.
 */
export function performBreakthrough(state: StudyState): BreakthroughResult {
  if (state.enrolled === null) {
    throw new Error("Cannot perform breakthrough: not enrolled");
  }

  const schoolId = state.enrolled;
  const progress = state.schools[schoolId];
  const targetStage = progress.stage + 1;

  if (targetStage > 5) {
    throw new Error("Cannot perform breakthrough: already at maximum stage");
  }

  const def = SCHOOL_REGISTRY.get(schoolId);
  if (!def) {
    throw new Error(`Unknown school: ${schoolId}`);
  }

  // Arts granted at this stage (only those not already known).
  const newArts = (def.artsAtStage[targetStage - 1] ?? []).filter(
    (artId) => !state.artsKnown.includes(artId)
  );
  const allArts = [...state.artsKnown, ...newArts];

  const newProgress = {
    stage: targetStage,
    refinement: 0,
    bottlenecked: false,
  };

  const newState: StudyState = {
    ...state,
    schools: { ...state.schools, [schoolId]: newProgress },
    artsKnown: allArts,
  };

  const tollPct = BREAKTHROUGH_VITALITY_TOLL_PCT[targetStage - 1] ?? 0;
  const lifespanGrant = BREAKTHROUGH_LIFESPAN_GRANT_YEARS[targetStage - 1] ?? 0;

  return {
    state: newState,
    deltas: {
      vitalityTollPct: tollPct,
      lifespanGrantYears: lifespanGrant,
      artsGained: newArts,
    },
  };
}

// ─── Alignment drift contribution ─────────────────────────────────────────────

export interface DriftContribution {
  /** The per-study-year drift delta this school contributes while enrolled. */
  driftPerYear: number;
  /**
   * If enrolled at the Archive, this factor (0–1) is applied to ALL incoming
   * drift from external sources (dungeons, items, etc.) before applying it.
   * 1 = no dampening (not at Archive). 0 = full block.
   */
  externalDriftFactor: number;
}

/**
 * Return the alignment-drift contribution and/or dampen factor while studying.
 * Pass `enrolled = null` to get the "not studying" neutral contribution.
 */
export function computeDriftContribution(enrolled: SchoolId | null): DriftContribution {
  if (enrolled === null) {
    return { driftPerYear: 0, externalDriftFactor: 1 };
  }

  const driftPerYear = SCHOOL_DRIFT_PER_YEAR[enrolled] ?? 0;
  const externalDriftFactor = enrolled === "archive" ? ARCHIVE_DRIFT_DAMPEN_FACTOR : 1;

  return { driftPerYear, externalDriftFactor };
}

// ─── Utility: empty state ─────────────────────────────────────────────────────

/**
 * Convenience re-export so callers in tests/reducers don't need to touch save.ts
 * just to get a blank state.
 */
export { emptyStudyState };
