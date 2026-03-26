import type { RunScore } from "../core/scoring";
import { reduceGame } from "../core/reducer";
import { BaselinePolicy, type Policy } from "./policies";
import { evaluateRun } from "./evaluator";
import { freshSave } from "../core/save";
import { LocalArrayAnalyticsSink, setAnalyticsSink, ConsoleAnalyticsSink } from "../core/analytics";

export interface BatchConfig {
  runs: number;
  seed?: number;
  durationSec?: number;
  stepSec?: number;
  policy?: Policy;
  silent?: boolean;
}

export interface BatchResult {
  runIndex: number;
  seed: number;
  score: RunScore;
  ageSeconds: number;
  deepestDungeonIndex: number;
  legacyAshEarned: number;
  bossesCleared: number;
  totalDungeons: number;
}

export interface BatchSummary {
  results: BatchResult[];
  avgScore: number;
  avgAgeSeconds: number;
  avgDepth: number;
  avgLegacyAsh: number;
}

/**
 * Run N headless simulated runs and return aggregated stats.
 * Seeds are deterministic: base seed + run index.
 */
export function runBatch(config: BatchConfig): BatchSummary {
  const {
    runs,
    seed: baseSeed = 1337,
    durationSec = 3600 * 2, // 2 hours simulated
    stepSec = 10,
    policy = new BaselinePolicy(),
    silent = true,
  } = config;

  const sink = new LocalArrayAnalyticsSink();
  if (silent) setAnalyticsSink(sink);

  const results: BatchResult[] = [];
  const START_TIME = 1_000_000;

  for (let i = 0; i < runs; i++) {
    const runSeed = (baseSeed + i * 7919) >>> 0;
    let save = freshSave(START_TIME);

    // Start run with deterministic seed
    save = reduceGame(save, {
      type: "START_NEW_RUN",
      nowUnixSec: START_TIME,
      seed: runSeed,
    });

    let now = START_TIME;
    const end = START_TIME + durationSec;

    while (now < end && save.currentRun?.alive) {
      now = Math.min(now + stepSec, end);

      // Check dungeon completion
      const dungeon = save.currentRun.currentDungeon;
      if (dungeon && now >= dungeon.completesAtUnixSec) {
        save = reduceGame(save, {
          type: "COMPLETE_DUNGEON",
          nowUnixSec: dungeon.completesAtUnixSec,
        });
      }

      // Policy decision
      const action = policy.decide(save, now);
      if (action) {
        save = reduceGame(save, action as any);
      }

      // Tick
      save = reduceGame(save, { type: "TICK", nowUnixSec: now });
    }

    // Claim death if alive at end of sim
    if (save.currentRun) {
      save = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: now });
    }

    const score = evaluateRun(save);
    const run = save.currentRun;

    results.push({
      runIndex: i,
      seed: runSeed,
      score,
      ageSeconds: run?.lifespan.ageSeconds ?? 0,
      deepestDungeonIndex: run?.deepestDungeonIndex ?? 0,
      legacyAshEarned: save.meta.legacyAsh,
      bossesCleared: run?.bossesCleared.length ?? 0,
      totalDungeons: run?.totalDungeonsCompleted ?? 0,
    });
  }

  const avgScore = results.reduce((s, r) => s + r.score.total, 0) / runs;
  const avgAgeSeconds = results.reduce((s, r) => s + r.ageSeconds, 0) / runs;
  const avgDepth = results.reduce((s, r) => s + r.deepestDungeonIndex, 0) / runs;
  const avgLegacyAsh = results.reduce((s, r) => s + r.legacyAshEarned, 0) / runs;

  if (silent) setAnalyticsSink(new ConsoleAnalyticsSink());

  return { results, avgScore, avgAgeSeconds, avgDepth, avgLegacyAsh };
}
