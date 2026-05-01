"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_VITALITY_DECAY_PER_SEC = void 0;
exports.calculateStage = calculateStage;
exports.tickLifespan = tickLifespan;
exports.applyDungeonWear = applyDungeonWear;
// Stage thresholds as fractions of total expected life
const STAGE_THRESHOLDS = {
    youth: 0.2,
    prime: 0.6,
    decline: 0.85,
    terminal: 1.0,
};
/**
 * Determine biological stage from vitality (100 = full life, 0 = dead).
 * Stage is based on vitality remaining, not raw age.
 */
function calculateStage(vitality) {
    if (vitality > (1 - STAGE_THRESHOLDS.youth) * 100)
        return "youth";
    if (vitality > (1 - STAGE_THRESHOLDS.prime) * 100)
        return "prime";
    if (vitality > (1 - STAGE_THRESHOLDS.decline) * 100)
        return "decline";
    return "terminal";
}
/**
 * Apply passive time-based lifespan decay.
 *
 * @param lifespan  Current lifespan state
 * @param stats     Computed stats (uses vitalityDecayRate)
 * @param elapsedSec  Seconds elapsed since last tick
 * @returns Updated lifespan state and whether the character is now dead
 */
function tickLifespan(lifespan, stats, elapsedSec) {
    const decayPerSec = exports.BASE_VITALITY_DECAY_PER_SEC * stats.vitalityDecayRate;
    const decay = decayPerSec * elapsedSec;
    const newAge = lifespan.ageSeconds + elapsedSec;
    const newVitality = Math.max(0, lifespan.vitality - decay);
    const newStage = calculateStage(newVitality);
    const died = newVitality <= 0;
    return {
        lifespan: {
            ageSeconds: newAge,
            vitality: newVitality,
            stage: newStage,
        },
        died,
    };
}
/**
 * Apply dungeon-completion vitality wear.
 *
 * @param lifespan     Current lifespan state
 * @param stats        Computed stats (uses dungeonWearMultiplier / bossWearMultiplier)
 * @param baseWear     Base wear from dungeon definition
 * @param isBoss       Whether this is a boss dungeon
 */
function applyDungeonWear(lifespan, stats, baseWear, isBoss) {
    const multiplier = isBoss
        ? stats.bossWearMultiplier * stats.dungeonWearMultiplier
        : stats.dungeonWearMultiplier;
    const totalWear = baseWear * multiplier;
    const newVitality = Math.max(0, lifespan.vitality - totalWear);
    return {
        ...lifespan,
        vitality: newVitality,
        stage: calculateStage(newVitality),
    };
}
// Base decay: ~100 vitality over ~30 minutes active play. Tunable in balance.ts via modifiers.
// This is 100 / (30 * 60) ≈ 0.0556/sec at vitalityDecayRate = 1
exports.BASE_VITALITY_DECAY_PER_SEC = 100 / (30 * 60);
