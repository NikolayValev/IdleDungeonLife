import type { RunScore } from "../core/scoring";
import { computeLegacyAshReward } from "../core/scoring";
import { reduceGame } from "../core/reducer";
import { freshSave } from "../core/save";
import { LocalArrayAnalyticsSink, setAnalyticsSink, ConsoleAnalyticsSink } from "../core/analytics";
import { BaselinePolicy, type Policy } from "./policies";
import { evaluateRun } from "./evaluator";
import { stepRun } from "./step";

export interface BatchOptions {
  durationSec?: number;
  stepSec?: number;
  policy?: Policy;
  silent?: boolean;
}

export interface BatchRunResult {
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
}

export interface BatchResult {
  runs: BatchRunResult[];
  scoreDistribution: Record<string, number>;
  averages: {
    score: number;
    survivalTime: number;
    depth: number;
    discoveries: number;
    ash: number;
    totalDungeons: number;
  };
}

function bucketScore(score: number): string {
  const bucketSize = 100;
  const start = Math.floor(score / bucketSize) * bucketSize;
  return `${start}-${start + bucketSize - 1}`;
}

export function runBatch(
  seedStart: number,
  count: number,
  options: BatchOptions = {}
): BatchResult {
  const {
    durationSec = 2 * 3600,
    stepSec = 10,
    policy = new BaselinePolicy(),
    silent = true,
  } = options;

  const previousSink = new ConsoleAnalyticsSink();
  const sink = new LocalArrayAnalyticsSink();
  if (silent) {
    setAnalyticsSink(sink);
  }

  const runs: BatchRunResult[] = [];
  const scoreDistribution: Record<string, number> = {};
  const startTime = 1_000_000;

  for (let index = 0; index < count; index++) {
    const seed = seedStart + index;
    let save = freshSave(startTime);
    save = reduceGame(save, { type: "START_NEW_RUN", nowUnixSec: startTime, seed });

    let now = startTime;
    const end = startTime + durationSec;

    while (now < end && save.currentRun?.alive) {
      now = Math.min(now + stepSec, end);
      save = stepRun(save, now, policy);
    }

    const finalRun = save.currentRun;
    if (!finalRun) {
      continue;
    }

    const scoredRun = evaluateRun(finalRun, save.meta);
    const discoveries =
      save.meta.discoveredItemIds.length + save.meta.discoveredTraitIds.length;

    const projectedAsh = save.meta.legacyAsh + computeLegacyAshReward(finalRun);

    const result: BatchRunResult = {
      seed,
      score: scoredRun,
      survivalTime: finalRun.lifespan.ageSeconds,
      depth: finalRun.deepestDungeonIndex,
      discoveries,
      // Report ash the run has earned by the end of the simulation window
      // without mutating reducer state or requiring an invalid death claim.
      ash: projectedAsh,
      totalDungeons: finalRun.totalDungeonsCompleted,
      bossesCleared: finalRun.bossesCleared.length,
      traits: [...finalRun.visibleTraitIds, ...finalRun.hiddenTraitIds],
      items: finalRun.inventory.items.map((item) => item.itemId),
    };

    runs.push(result);
    const bucket = bucketScore(result.score.total);
    scoreDistribution[bucket] = (scoreDistribution[bucket] ?? 0) + 1;
  }

  if (silent) {
    setAnalyticsSink(previousSink);
  }

  const divisor = Math.max(1, runs.length);
  return {
    runs,
    scoreDistribution,
    averages: {
      score: runs.reduce((sum, run) => sum + run.score.total, 0) / divisor,
      survivalTime: runs.reduce((sum, run) => sum + run.survivalTime, 0) / divisor,
      depth: runs.reduce((sum, run) => sum + run.depth, 0) / divisor,
      discoveries: runs.reduce((sum, run) => sum + run.discoveries, 0) / divisor,
      ash: runs.reduce((sum, run) => sum + run.ash, 0) / divisor,
      totalDungeons: runs.reduce((sum, run) => sum + run.totalDungeons, 0) / divisor,
    },
  };
}
