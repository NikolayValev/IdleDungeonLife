"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBalanceTest = runBalanceTest;
exports.runBalanceComparison = runBalanceComparison;
const scoring_1 = require("../core/scoring");
const reducer_1 = require("../core/reducer");
const save_1 = require("../core/save");
const analytics_1 = require("../core/analytics");
const items_1 = require("../content/items");
const step_1 = require("./step");
function cloneMetaProgress(meta) {
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
function bucketScore(score) {
    const bucketSize = 100;
    const start = Math.floor(score / bucketSize) * bucketSize;
    return `${start}-${start + bucketSize - 1}`;
}
/**
 * Check if a milestone condition is met.
 * Supports both pattern-based (depth_X, time_X, trait_X) and named milestones.
 */
function checkMilestone(survivalTime, depth, bossesCleared, legendaryFound, traitsEvolved, milestoneId) {
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
function runBalanceTest(profile, seedStart, count, options = {}) {
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
    const previousSink = (0, analytics_1.getAnalyticsSink)();
    const sink = new analytics_1.LocalArrayAnalyticsSink();
    (0, analytics_1.setAnalyticsSink)(sink);
    try {
        const milestoneIds = profile.milestones ?? [];
        const carryOverMeta = options.carryOverMeta === true;
        const runs = [];
        const scoreDistribution = {};
        const milestoneEvents = {};
        // Initialize milestone tracking
        for (const milestoneId of milestoneIds) {
            milestoneEvents[milestoneId] = [];
        }
        const startTime = 1_000_000;
        let carriedMeta = cloneMetaProgress((0, save_1.freshSave)(startTime).meta);
        for (let index = 0; index < count; index++) {
            const seed = seedStart + index;
            let save = (0, save_1.freshSave)(startTime);
            if (carryOverMeta) {
                save = { ...save, meta: cloneMetaProgress(carriedMeta) };
            }
            save = (0, reducer_1.reduceGame)(save, { type: "START_NEW_RUN", nowUnixSec: startTime, seed });
            let now = startTime;
            const end = startTime + durationSec;
            const reachedMilestones = new Set();
            while (now < end && save.currentRun?.alive) {
                now = Math.min(now + stepSec, end);
                save = (0, step_1.stepRun)(save, now, profile.policy);
                const run = save.currentRun;
                if (run) {
                    // Check for legendary items by looking them up in registry
                    const legendaryFound = run.inventory.items.some((item) => {
                        const itemDef = items_1.ITEM_REGISTRY.get(item.itemId);
                        return itemDef?.rarity === "legendary";
                    });
                    // Use evolved trait count (not visible+hidden count)
                    const traitsEvolved = run.evolvedTraitIds.length;
                    for (const milestoneId of milestoneIds) {
                        if (reachedMilestones.has(milestoneId))
                            continue;
                        if (checkMilestone(run.lifespan.ageSeconds, run.deepestDungeonIndex, run.bossesCleared.length, legendaryFound, traitsEvolved, milestoneId)) {
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
            const discoveries = save.meta.discoveredItemIds.length + save.meta.discoveredTraitIds.length;
            const scoredRun = (0, scoring_1.scoreRun)(finalRun, discoveries);
            const projectedAsh = save.meta.legacyAsh + (0, scoring_1.computeLegacyAshReward)(finalRun);
            const milestoneArray = Array.from(reachedMilestones).map((id) => ({
                milestoneId: id,
                reachedAtSec: milestoneEvents[id].find((e) => e.seed === seed)?.reachedAtSec ?? 0,
                seed,
            }));
            const firstMilestoneTime = milestoneArray.length > 0
                ? Math.min(...milestoneArray.map((m) => m.reachedAtSec))
                : undefined;
            const result = {
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
        const milestoneStats = {};
        for (const milestoneId of milestoneIds) {
            const events = milestoneEvents[milestoneId];
            const reachedCount = events.length;
            const avgTime = events.length > 0
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
                firstMilestoneTime: runs.filter((r) => r.firstMilestoneTime).length > 0
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
    }
    finally {
        // Always restore the previous sink, even if an error occurs
        (0, analytics_1.setAnalyticsSink)(previousSink);
    }
}
/**
 * Run balance tests across multiple profiles for comparison
 */
function runBalanceComparison(profiles, seedStart, runsPerProfile, options = {}) {
    if (!Array.isArray(profiles) || profiles.length === 0) {
        throw new Error("profiles must be a non-empty array");
    }
    if (runsPerProfile <= 0) {
        throw new Error("runsPerProfile must be greater than 0");
    }
    const results = [];
    let currentSeed = seedStart;
    for (const profile of profiles) {
        const stats = runBalanceTest(profile, currentSeed, runsPerProfile, options);
        results.push(stats);
        currentSeed += runsPerProfile;
    }
    return results;
}
