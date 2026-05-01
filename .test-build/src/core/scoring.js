"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreRun = scoreRun;
exports.computeLegacyAshBreakdown = computeLegacyAshBreakdown;
exports.computeLegacyAshReward = computeLegacyAshReward;
const balance_1 = require("../content/balance");
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
function scoreRun(run, discoveryCount) {
    const clearedDepth = Math.max(0, run.deepestDungeonIndex);
    const dungeonDepthScore = clearedDepth * WEIGHTS.dungeonDepth;
    const legacyAshScore = computeLegacyAshReward(run);
    const survivalScore = Math.min(WEIGHTS.survival * 10, Math.floor(run.lifespan.ageSeconds / 60) * 2);
    const discoveryScore = discoveryCount * 5;
    // Build diversity: bonus for using multiple unlocked talent branches
    const buildDiversityScore = Math.min(WEIGHTS.buildDiversity * 10, run.talents.unlockedNodeIds.length * 3);
    // Penalty for over-relying on single mechanic (e.g. only one talent path)
    const dominancePenalty = 0; // Placeholder for V2
    const total = dungeonDepthScore +
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
function computeLegacyAshBreakdown(run) {
    const depthBonus = Math.max(0, run.deepestDungeonIndex) * balance_1.BALANCE.legacyAsh.depthMultiplier;
    const ageBonus = Math.floor(run.lifespan.ageSeconds / 60) *
        balance_1.BALANCE.legacyAsh.ageMinuteMultiplier;
    const bossBonus = run.bossesCleared.length * balance_1.BALANCE.legacyAsh.bossBonus;
    const dungeonBonus = run.totalDungeonsCompleted * balance_1.BALANCE.legacyAsh.dungeonPerCompletion;
    return {
        total: depthBonus + ageBonus + bossBonus + dungeonBonus,
        depthBonus,
        ageBonus,
        bossBonus,
        dungeonBonus,
    };
}
function computeLegacyAshReward(run) {
    return computeLegacyAshBreakdown(run).total;
}
