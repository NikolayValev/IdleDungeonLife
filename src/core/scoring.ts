import type { RunState } from "./types";
import { BALANCE } from "../content/balance";

export interface RunScore {
  total: number;
  dungeonDepthScore: number;
  legacyAshScore: number;
  survivalScore: number;
  discoveryScore: number;
  buildDiversityScore: number;
  dominancePenalty: number;
}

export interface LegacyAshBreakdown {
  total: number;
  depthBonus: number;
  ageBonus: number;
  bossBonus: number;
  dungeonBonus: number;
}

const WEIGHTS = {
  dungeonDepth: 40,
  legacyAsh: 20,
  survival: 15,
  discovery: 15,
  buildDiversity: 10,
};

/**
 * Score a completed/dead run. Higher = better.
 */
export function scoreRun(run: RunState, discoveryCount: number): RunScore {
  const clearedDepth = Math.max(0, run.deepestDungeonIndex);
  const dungeonDepthScore = clearedDepth * WEIGHTS.dungeonDepth;

  const legacyAshScore = computeLegacyAshReward(run);

  const survivalScore = Math.min(
    WEIGHTS.survival * 10,
    Math.floor(run.lifespan.ageSeconds / 60) * 2
  );

  const discoveryScore = discoveryCount * 5;

  // Build diversity: bonus for using multiple unlocked talent branches
  const buildDiversityScore = Math.min(
    WEIGHTS.buildDiversity * 10,
    run.talents.unlockedNodeIds.length * 3
  );

  // Penalty for over-relying on single mechanic (e.g. only one talent path)
  const dominancePenalty = 0; // Placeholder for V2

  const total =
    dungeonDepthScore +
    legacyAshScore * 0.5 +
    survivalScore +
    discoveryScore +
    buildDiversityScore -
    dominancePenalty;

  return {
    total: Math.floor(total),
    dungeonDepthScore,
    legacyAshScore,
    survivalScore,
    discoveryScore,
    buildDiversityScore,
    dominancePenalty,
  };
}

/**
 * Compute Legacy Ash reward for a run.
 */
export function computeLegacyAshBreakdown(run: RunState): LegacyAshBreakdown {
  const depthBonus =
    Math.max(0, run.deepestDungeonIndex) * BALANCE.legacyAsh.depthMultiplier;
  const ageBonus =
    Math.floor(run.lifespan.ageSeconds / 60) *
    BALANCE.legacyAsh.ageMinuteMultiplier;
  const bossBonus =
    run.bossesCleared.length * BALANCE.legacyAsh.bossBonus;
  const dungeonBonus =
    run.totalDungeonsCompleted * BALANCE.legacyAsh.dungeonPerCompletion;

  return {
    total: depthBonus + ageBonus + bossBonus + dungeonBonus,
    depthBonus,
    ageBonus,
    bossBonus,
    dungeonBonus,
  };
}

export function computeLegacyAshReward(run: RunState): number {
  return computeLegacyAshBreakdown(run).total;
}
