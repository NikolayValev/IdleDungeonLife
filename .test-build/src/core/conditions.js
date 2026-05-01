"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCondition = evaluateCondition;
const items_1 = require("../content/items");
const traits_1 = require("../content/traits");
/**
 * Evaluate a condition against the current run state.
 * Returns true if the condition is satisfied (or if condition is undefined).
 */
function evaluateCondition(condition, run, context) {
    if (!condition)
        return true;
    switch (condition.type) {
        case "alignmentBelow":
            return run.alignment.holyUnholy < condition.value;
        case "alignmentAbove":
            return run.alignment.holyUnholy > condition.value;
        case "hasTrait":
            return (run.visibleTraitIds.includes(condition.traitId) ||
                run.hiddenTraitIds.includes(condition.traitId));
        case "runHasTag":
            return run.visibleTraitIds.some((tid) => {
                const def = traits_1.TRAIT_REGISTRY.get(tid);
                return def?.tags.includes(condition.tag) ?? false;
            });
        case "dungeonHasTag":
            return context?.dungeonTags?.includes(condition.tag) ?? false;
        case "equippedItemHasTag": {
            const slots = [
                run.equipment.weapon,
                run.equipment.armor,
                run.equipment.artifact,
            ].filter(Boolean);
            return slots.some((instanceId) => {
                const inst = run.inventory.items.find((i) => i.instanceId === instanceId);
                if (!inst)
                    return false;
                const def = items_1.ITEM_REGISTRY.get(inst.itemId);
                return def?.tags.includes(condition.tag) ?? false;
            });
        }
        case "biologicalStageIs":
            return run.lifespan.stage === condition.stage;
        case "ageSecondsAtLeast":
            return run.lifespan.ageSeconds >= condition.value;
        case "traitEvolved":
            return run.evolvedTraitIds.includes(condition.traitId);
        case "legacyPathIs":
            return run.legacyPath === condition.path;
        case "discoveryMomentumAtLeast":
            return run.discoveryMomentum >= condition.value;
        default:
            return true;
    }
}
