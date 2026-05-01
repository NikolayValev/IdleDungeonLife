/**
 * Balance runner: runs multiple isolated game instances with profiles
 * Collects comprehensive metrics for balancing iteration
 */
import type { RunScore } from "../core/scoring";
import { scoreRun, computeLegacyAshReward } from "../core/scoring";
import { reduceGame } from "../core/reducer";
import { freshSave } from "../core/save";
import {
  LocalArrayAnalyticsSink,
  setAnalyticsSink,
  getAnalyticsSink,
} from "../core/analytics";
import { ITEM_REGISTRY } from "../content/items";
import { stepRun } from "./step";
import type { BalanceProfile } from "./balance-profiles";
import type { MetaProgress } from "../core/types";

export interface BalanceRunOptions {
  carryOverMeta?: boolean;
}

export interface MilestoneEvent {
  milestoneId: string;
  reachedAtSec: number;
  seed: number;
}

export interface BalanceRunResult {
  seed: number;
  score: RunScore;
  survivalTime: number;
  depth: number;
  discoveries: number;
  ash: number;
  totalDungeons: number;
  bossesCleared: number;
  traits: string[];
  items: string[];
  milestones: MilestoneEvent[];
  /** Time when first milestone was reached */
  firstMilestoneTime?: number;
}

export interface MilestoneStats {
  name: string;
  reachedCount: number;
  averageTimeToReach: number; // in seconds
  percentReached: number; // 0-100
}

export interface BalanceRunStats {
  profileName: string;
  totalRuns: number;
  completedRuns: number;
  scoreDistribution: Record<string, number>;
  milestoneStats: Record<string, MilestoneStats>;
  averages: {
    score: number;
    survivalTime: number;
    depth: number;
    discoveries: number;
    ash: number;
    totalDungeons: number;
    firstMilestoneTime?: number;
  };
  minMax: {
    minScore: number;
    maxScore: number;
    minDepth: number;
    maxDepth: number;
  };
}

function cloneMetaProgress(meta: MetaProgress): MetaProgress {
  return {
    unlockedDungeonIds: [...meta.unlockedDungeonIds],
    unlockedJobIds: [...meta.unlockedJobIds],
    discoveredTraitIds: [...meta.discoveredTraitIds],
    discoveredItemIds: [...meta.discoveredItemIds],
    codexEntries: [...meta.codexEntries],
    legacyAsh: meta.legacyAsh,
    totalRuns: meta.totalRuns,
    legacyPath: meta.legacyPath,
    legacyPerks: [...meta.legacyPerks],
  };
}

function bucketScore(score: number): string {
  const bucketSize = 100;
  const start = Math.floor(score / bucketSize) * bucketSize;
  return `${start}-${start + bucketSize - 1}`;
}

/**
 * Check if a milestone condition is met.
 * Supports both pattern-based (depth_X, time_X, trait_X) and named milestones.
 */
function checkMilestone(
  survivalTime: number,
  depth: number,
  bossesCleared: number,
  legendaryFound: boolean,
  traitsEvolved: number,
  milestoneId: string
): boolean {
  // Handle named milestones first
  if (milestoneId === "boss_defeated") {
    return bossesCleared > 0;
  }
  if (milestoneId === "legendary_found") {
    return legendaryFound;
  }
  if (milestoneId === "trait_evolved") {
    return traitsEvolved > 0;
  }

  // Handle pattern-based milestones (depth_X, time_X, trait_X)
  const matches = milestoneId.match(/^(\w+)_(\d+)$/);
  if (!matches) {
    // Unknown milestone type - silently ignore
    return false;
  }

  const [, type, value] = matches;
  const numValue = parseInt(value, 10);

  switch (type) {
    case "depth":
      return depth >= numValue;
    case "time":
      return survivalTime >= numValue;
    case "trait":
      return traitsEvolved >= numValue;
    default:
      return false;
  }
}

/**
 * Run a single balance test profile with n isolated instances
 * Validates inputs, manages analytics sink lifecycle with try/finally
 */
export function runBalanceTest(
  profile: BalanceProfile,
  seedStart: number,
  count: number,
  options: BalanceRunOptions = {}
): BalanceRunStats {
  // Validate inputs before proceeding
  if (!profile || !profile.policy) {
    throw new Error("Invalid profile: profile and policy are required");
  }

  const durationSec = profile.durationSec ?? 2 * 3600;
  const stepSec = profile.stepSec ?? 10;

  if (stepSec <= 0) {
    throw new Error("Invalid profile: stepSec must be greater than 0");
  }
  if (durationSec <= 0) {
    throw new Error("Invalid profile: durationSec must be greater than 0");
  }
  if (count <= 0) {
    throw new Error("Invalid run count: must be greater than 0");
  }

  // Capture the actual current sink and restore it in finally block
  const previousSink = getAnalyticsSink();
  const sink = new LocalArrayAnalyticsSink();
  setAnalyticsSink(sink);

  try {
    const milestoneIds = profile.milestones ?? [];
    const carryOverMeta = options.carryOverMeta === true;
    const runs: BalanceRunResult[] = [];
    const scoreDistribution: Record<string, number> = {};
    const milestoneEvents: Record<string, MilestoneEvent[]> = {};

    // Initialize milestone tracking
    for (const milestoneId of milestoneIds) {
      milestoneEvents[milestoneId] = [];
    }

    const startTime = 1_000_000;
    let carriedMeta = cloneMetaProgress(freshSave(startTime).meta);

    for (let index = 0; index < count; index++) {
      const seed = seedStart + index;
      let save = freshSave(startTime);
      if (carryOverMeta) {
        save = { ...save, meta: cloneMetaProgress(carriedMeta) };
      }
      save = reduceGame(save, { type: "START_NEW_RUN", nowUnixSec: startTime, seed });

      let now = startTime;
      const end = startTime + durationSec;
      const reachedMilestones = new Set<string>();

      while (now < end && save.currentRun?.alive) {
        now = Math.min(now + stepSec, end);
        save = stepRun(save, now, profile.policy);

        const run = save.currentRun;
        if (run) {
          // Check for legendary items by looking them up in registry
          const legendaryFound = run.inventory.items.some((item) => {
            const itemDef = ITEM_REGISTRY.get(item.itemId);
            return itemDef?.rarity === "legendary";
          });
          // Use evolved trait count (not visible+hidden count)
          const traitsEvolved = run.evolvedTraitIds.length;

          for (const milestoneId of milestoneIds) {
            if (reachedMilestones.has(milestoneId)) continue;

            if (
              checkMilestone(
                run.lifespan.ageSeconds,
                run.deepestDungeonIndex,
                run.bossesCleared.length,
                legendaryFound,
                traitsEvolved,
                milestoneId
              )
            ) {
              reachedMilestones.add(milestoneId);
              milestoneEvents[milestoneId].push({
                milestoneId,
                reachedAtSec: now - startTime,
                seed,
              });
            }
          }
        }
      }

      const finalRun = save.currentRun;
      if (!finalRun) {
        continue;
      }

      // Compute actual score instead of unsafe placeholder
      const discoveries =
        save.meta.discoveredItemIds.length + save.meta.discoveredTraitIds.length;
      const scoredRun = scoreRun(finalRun, discoveries);
      const projectedAsh = save.meta.legacyAsh + computeLegacyAshReward(finalRun);

      const milestoneArray = Array.from(reachedMilestones).map((id) => ({
        milestoneId: id,
        reachedAtSec: milestoneEvents[id].find((e) => e.seed === seed)?.reachedAtSec ?? 0,
        seed,
      }));

      const firstMilestoneTime =
        milestoneArray.length > 0
          ? Math.min(...milestoneArray.map((m) => m.reachedAtSec))
          : undefined;

      const result: BalanceRunResult = {
        seed,
        score: scoredRun,
        survivalTime: finalRun.lifespan.ageSeconds,
        depth: finalRun.deepestDungeonIndex,
        discoveries,
        ash: projectedAsh,
        totalDungeons: finalRun.totalDungeonsCompleted,
        bossesCleared: finalRun.bossesCleared.length,
        traits: [...finalRun.visibleTraitIds, ...finalRun.hiddenTraitIds],
        items: finalRun.inventory.items.map((item) => item.itemId),
        milestones: milestoneArray,
        firstMilestoneTime,
      };

      if (carryOverMeta) {
        // Simulate end-of-run meta carryover by banking projected ash and completed runs.
        carriedMeta = {
          ...cloneMetaProgress(save.meta),
          legacyAsh: projectedAsh,
          totalRuns: save.meta.totalRuns + 1,
        };
      }

      runs.push(result);
      const bucket = bucketScore(result.score.total);
      scoreDistribution[bucket] = (scoreDistribution[bucket] ?? 0) + 1;
    }

    // Compute milestone statistics
    const milestoneStats: Record<string, MilestoneStats> = {};
    for (const milestoneId of milestoneIds) {
      const events = milestoneEvents[milestoneId];
      const reachedCount = events.length;
      const avgTime =
        events.length > 0
          ? events.reduce((sum, e) => sum + e.reachedAtSec, 0) / events.length
          : 0;

      milestoneStats[milestoneId] = {
        name: milestoneId,
        reachedCount,
        averageTimeToReach: avgTime,
        percentReached: (reachedCount / count) * 100,
      };
    }

    const completedRuns = runs.length;
    const divisor = Math.max(1, completedRuns);

    const scores = runs.map((r) => r.score.total);
    const depths = runs.map((r) => r.depth);

    return {
      profileName: profile.name,
      totalRuns: count,
      completedRuns,
      scoreDistribution,
      milestoneStats,
      averages: {
        score: runs.reduce((sum, run) => sum + run.score.total, 0) / divisor,
        survivalTime: runs.reduce((sum, run) => sum + run.survivalTime, 0) / divisor,
        depth: runs.reduce((sum, run) => sum + run.depth, 0) / divisor,
        discoveries: runs.reduce((sum, run) => sum + run.discoveries, 0) / divisor,
        ash: runs.reduce((sum, run) => sum + run.ash, 0) / divisor,
        totalDungeons: runs.reduce((sum, run) => sum + run.totalDungeons, 0) / divisor,
        firstMilestoneTime:
          runs.filter((r) => r.firstMilestoneTime).length > 0
            ? runs
                .filter((r) => r.firstMilestoneTime)
                .reduce((sum, r) => sum + (r.firstMilestoneTime ?? 0), 0) /
              runs.filter((r) => r.firstMilestoneTime).length
            : undefined,
      },
      minMax: {
        minScore: scores.length > 0 ? Math.min(...scores) : 0,
        maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        minDepth: depths.length > 0 ? Math.min(...depths) : 0,
        maxDepth: depths.length > 0 ? Math.max(...depths) : 0,
      },
    };
  } finally {
    // Always restore the previous sink, even if an error occurs
    setAnalyticsSink(previousSink);
  }
}

/**
 * Run balance tests across multiple profiles for comparison
 */
export function runBalanceComparison(
  profiles: BalanceProfile[],
  seedStart: number,
  runsPerProfile: number,
  options: BalanceRunOptions = {}
): BalanceRunStats[] {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error("profiles must be a non-empty array");
  }
  if (runsPerProfile <= 0) {
    throw new Error("runsPerProfile must be greater than 0");
  }

  const results: BalanceRunStats[] = [];
  let currentSeed = seedStart;

  for (const profile of profiles) {
    const stats = runBalanceTest(profile, currentSeed, runsPerProfile, options);
    results.push(stats);
    currentSeed += runsPerProfile;
  }

  return results;
}
