"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_STATS = void 0;
exports.applyModifiers = applyModifiers;
exports.traceModifiers = traceModifiers;
exports.collectRunModifiers = collectRunModifiers;
exports.computeStats = computeStats;
const conditions_1 = require("./conditions");
const traits_1 = require("../content/traits");
const items_1 = require("../content/items");
const talents_1 = require("../content/talents");
const jobs_1 = require("../content/jobs");
const legacyPerks_1 = require("../content/legacyPerks");
// ─── Base stat defaults ───────────────────────────────────────────────────────
exports.BASE_STATS = {
    power: 10,
    survivability: 10,
    goldRate: 1,
    essenceRate: 1,
    legendaryDropRate: 0.02,
    holyAffinity: 0,
    unholyAffinity: 0,
    vitalityDecayRate: 1,
    dungeonSuccessRate: 0.5,
    itemFindRate: 1,
    bossWearMultiplier: 1,
    dungeonWearMultiplier: 1,
    alignmentDriftHoly: 1,
    alignmentDriftUnholy: 1,
    talentCostMultiplier: 1,
    jobOutputMultiplier: 1,
    discoveryRate: 1,
};
// ─── Apply modifier list to base stats ───────────────────────────────────────
/**
 * Apply modifiers in order: additive sum first, then multiplicative, then clamps.
 * Returns final values for all stats.
 */
function applyModifiers(base, modifiers, run, context) {
    const result = { ...base };
    // Pass 1: additive
    for (const mod of modifiers) {
        if (mod.op !== "add")
            continue;
        if (!(0, conditions_1.evaluateCondition)(mod.condition, run, context))
            continue;
        result[mod.stat] = (result[mod.stat] ?? 0) + mod.value;
    }
    // Pass 2: multiplicative
    for (const mod of modifiers) {
        if (mod.op !== "mul")
            continue;
        if (!(0, conditions_1.evaluateCondition)(mod.condition, run, context))
            continue;
        result[mod.stat] = (result[mod.stat] ?? 0) * mod.value;
    }
    // Pass 3: clamps
    for (const mod of modifiers) {
        if (mod.op === "setMin") {
            if (!(0, conditions_1.evaluateCondition)(mod.condition, run, context))
                continue;
            result[mod.stat] = Math.max(result[mod.stat] ?? 0, mod.value);
        }
        else if (mod.op === "setMax") {
            if (!(0, conditions_1.evaluateCondition)(mod.condition, run, context))
                continue;
            result[mod.stat] = Math.min(result[mod.stat] ?? 0, mod.value);
        }
    }
    return result;
}
/**
 * Build traced contributions per stat for debug/UI display.
 */
function traceModifiers(base, modifiers, run, context) {
    const activeModifiers = modifiers.filter((m) => (0, conditions_1.evaluateCondition)(m.condition, run, context));
    const statKeys = Object.keys(base);
    return statKeys.map((stat) => {
        const relevant = activeModifiers.filter((m) => m.stat === stat);
        const contributions = relevant.map((m) => ({
            source: m.source,
            op: m.op,
            value: m.value,
        }));
        const result = applyModifiers(base, activeModifiers, run, context);
        return {
            stat,
            finalValue: result[stat],
            contributions,
        };
    });
}
/**
 * Collect all active modifiers from current run (traits + items + talents).
 */
function collectRunModifiers(run) {
    const mods = [];
    // Traits
    for (const tid of [...run.visibleTraitIds, ...run.hiddenTraitIds]) {
        const def = traits_1.TRAIT_REGISTRY.get(tid);
        if (def)
            mods.push(...def.modifiers);
    }
    // Equipped items
    const equippedInstanceIds = [
        run.equipment.weapon,
        run.equipment.armor,
        run.equipment.artifact,
    ].filter(Boolean);
    for (const instanceId of equippedInstanceIds) {
        const inst = run.inventory.items.find((i) => i.instanceId === instanceId);
        if (!inst)
            continue;
        const def = items_1.ITEM_REGISTRY.get(inst.itemId);
        if (def)
            mods.push(...def.baseModifiers);
    }
    // Talents
    for (const nodeId of run.talents.unlockedNodeIds) {
        const def = talents_1.TALENT_REGISTRY.get(nodeId);
        if (def)
            mods.push(...def.modifiers);
    }
    // Active job
    if (run.currentJobId) {
        const job = jobs_1.JOB_REGISTRY.get(run.currentJobId);
        if (job?.modifiers) {
            mods.push(...job.modifiers);
        }
    }
    // Trait evolution modifiers (stacked on top of base trait modifiers)
    for (const tid of run.evolvedTraitIds) {
        const def = traits_1.TRAIT_REGISTRY.get(tid);
        if (def?.evolutionModifiers)
            mods.push(...def.evolutionModifiers);
    }
    // Legacy perk modifiers (permanent prestige bonuses carried into this run)
    for (const perkId of run.activeLegacyPerkIds) {
        const def = legacyPerks_1.LEGACY_PERK_REGISTRY.get(perkId);
        if (def?.modifiers)
            mods.push(...def.modifiers);
    }
    return mods;
}
/**
 * Compute final stats for a run.
 */
function computeStats(run, context) {
    const mods = collectRunModifiers(run);
    return applyModifiers({ ...exports.BASE_STATS }, mods, run, context);
}
