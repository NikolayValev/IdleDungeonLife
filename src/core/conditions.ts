import type { Condition, RunState, Tag } from "./types";
import { ITEM_REGISTRY } from "../content/items";
import { TRAIT_REGISTRY } from "../content/traits";

/**
 * Evaluate a condition against the current run state.
 * Returns true if the condition is satisfied (or if condition is undefined).
 */
export function evaluateCondition(
  condition: Condition | undefined,
  run: RunState,
  context?: { dungeonTags?: Tag[] }
): boolean {
  if (!condition) return true;

  switch (condition.type) {
    case "alignmentBelow":
      return run.alignment.holyUnholy < condition.value;

    case "alignmentAbove":
      return run.alignment.holyUnholy > condition.value;

    case "hasTrait":
      return (
        run.visibleTraitIds.includes(condition.traitId) ||
        run.hiddenTraitIds.includes(condition.traitId)
      );

    case "runHasTag":
      return run.visibleTraitIds.some((tid) => {
        const def = TRAIT_REGISTRY.get(tid);
        return def?.tags.includes(condition.tag) ?? false;
      });

    case "dungeonHasTag":
      return context?.dungeonTags?.includes(condition.tag) ?? false;

    case "equippedItemHasTag": {
      const slots = [
        run.equipment.weapon,
        run.equipment.armor,
        run.equipment.artifact,
      ].filter(Boolean) as string[];
      return slots.some((instanceId) => {
        const inst = run.inventory.items.find(
          (i) => i.instanceId === instanceId
        );
        if (!inst) return false;
        const def = ITEM_REGISTRY.get(inst.itemId);
        return def?.tags.includes(condition.tag) ?? false;
      });
    }

    case "biologicalStageIs":
      return run.lifespan.stage === condition.stage;

    case "ageSecondsAtLeast":
      return run.lifespan.ageSeconds >= condition.value;

    default:
      return true;
  }
}
