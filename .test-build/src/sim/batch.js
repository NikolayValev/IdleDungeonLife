"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBatch = runBatch;
const scoring_1 = require("../core/scoring");
const reducer_1 = require("../core/reducer");
const save_1 = require("../core/save");
const analytics_1 = require("../core/analytics");
const policies_1 = require("./policies");
const evaluator_1 = require("./evaluator");
const step_1 = require("./step");
function bucketScore(score) {
    const bucketSize = 100;
    const start = Math.floor(score / bucketSize) * bucketSize;
    return `${start}-${start + bucketSize - 1}`;
}
function runBatch(seedStart, count, options = {}) {
    const { durationSec = 2 * 3600, stepSec = 10, policy = new policies_1.BaselinePolicy(), silent = true, } = options;
    const previousSink = new analytics_1.ConsoleAnalyticsSink();
    const sink = new analytics_1.LocalArrayAnalyticsSink();
    if (silent) {
        (0, analytics_1.setAnalyticsSink)(sink);
    }
    const runs = [];
    const scoreDistribution = {};
    const startTime = 1_000_000;
    for (let index = 0; index < count; index++) {
        const seed = seedStart + index;
        let save = (0, save_1.freshSave)(startTime);
        save = (0, reducer_1.reduceGame)(save, { type: "START_NEW_RUN", nowUnixSec: startTime, seed });
        let now = startTime;
        const end = startTime + durationSec;
        while (now < end && save.currentRun?.alive) {
            now = Math.min(now + stepSec, end);
            save = (0, step_1.stepRun)(save, now, policy);
        }
        const finalRun = save.currentRun;
        if (!finalRun) {
            continue;
        }
        const scoredRun = (0, evaluator_1.evaluateRun)(finalRun, save.meta);
        const discoveries = save.meta.discoveredItemIds.length + save.meta.discoveredTraitIds.length;
        const projectedAsh = save.meta.legacyAsh + (0, scoring_1.computeLegacyAshReward)(finalRun);
        const result = {
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
        (0, analytics_1.setAnalyticsSink)(previousSink);
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
