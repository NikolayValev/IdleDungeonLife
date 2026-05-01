"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDungeonScore = computeDungeonScore;
exports.resolveDungeonOutcome = resolveDungeonOutcome;
exports.getRunStats = getRunStats;
const modifiers_1 = require("./modifiers");
/**
 * Compute the effective dungeon success score for the current run.
 * Used to determine dungeon completion outcomes.
 */
function computeDungeonScore(run, dungeonTags) {
    const stats = (0, modifiers_1.computeStats)(run, { dungeonTags });
    const holyAffinityScore = (dungeonTags.includes("holy") || dungeonTags.includes("shrine")
        ? stats.holyAffinity
        : 0) * 0.2;
    const unholyAffinityScore = (dungeonTags.includes("unholy") ||
        dungeonTags.includes("abyss") ||
        dungeonTags.includes("decay")
        ? stats.unholyAffinity
        : 0) * 0.2;
    // Weighted combination of power, survivability, success scaling, and tag affinity.
    return (stats.power * 0.6 +
        stats.survivability * 0.4 +
        stats.dungeonSuccessRate * 10 +
        holyAffinityScore +
        unholyAffinityScore);
}
/**
 * Determine if a dungeon attempt succeeds.
 * Returns "success", "partial", or "failure".
 */
function resolveDungeonOutcome(score, difficulty) {
    if (score >= difficulty)
        return "success";
    if (score >= difficulty * 0.6)
        return "partial";
    return "failure";
}
/**
 * Compute stats for the run with the given context.
 */
function getRunStats(run) {
    return (0, modifiers_1.computeStats)(run);
}
