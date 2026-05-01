import type { RunState, ComputedStats } from "./types";
import { computeStats } from "./modifiers";

/**
 * Compute the effective dungeon success score for the current run.
 * Used to determine dungeon completion outcomes.
 */
export function computeDungeonScore(
  run: RunState,
  dungeonTags: import("./types").Tag[]
): number {
  const stats = computeStats(run, { dungeonTags });
  const holyAffinityScore =
    (dungeonTags.includes("holy") || dungeonTags.includes("shrine")
      ? stats.holyAffinity
      : 0) * 0.2;
  const unholyAffinityScore =
    (dungeonTags.includes("unholy") ||
    dungeonTags.includes("abyss") ||
    dungeonTags.includes("decay")
      ? stats.unholyAffinity
      : 0) * 0.2;

  // Weighted combination of power, survivability, success scaling, and tag affinity.
  return (
    stats.power * 0.6 +
    stats.survivability * 0.4 +
    stats.dungeonSuccessRate * 10 +
    holyAffinityScore +
    unholyAffinityScore
  );
}

/**
 * Determine if a dungeon attempt succeeds.
 * Returns "success", "partial", or "failure".
 */
export function resolveDungeonOutcome(
  score: number,
  difficulty: number
): "success" | "partial" | "failure" {
  if (score >= difficulty) return "success";
  if (score >= difficulty * 0.6) return "partial";
  return "failure";
}

/**
 * Compute stats for the run with the given context.
 */
export function getRunStats(run: RunState): ComputedStats {
  return computeStats(run);
}
