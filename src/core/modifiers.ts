import type { Modifier, StatKey, ComputedStats, StatTrace, RunState } from "./types";
import { evaluateCondition } from "./conditions";
import type { Tag } from "./types";
import { TRAIT_REGISTRY } from "../content/traits";
import { ITEM_REGISTRY } from "../content/items";
import { TALENT_REGISTRY } from "../content/talents";
import { JOB_REGISTRY } from "../content/jobs";
import { LEGACY_PERK_REGISTRY } from "../content/legacyPerks";

// ─── Base stat defaults ───────────────────────────────────────────────────────

export const BASE_STATS: ComputedStats = {
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
export function applyModifiers(
  base: ComputedStats,
  modifiers: Modifier[],
  run: RunState,
  context?: { dungeonTags?: Tag[] }
): ComputedStats {
  const result = { ...base };

  // Pass 1: additive
  for (const mod of modifiers) {
    if (mod.op !== "add") continue;
    if (!evaluateCondition(mod.condition, run, context)) continue;
    result[mod.stat] = (result[mod.stat] ?? 0) + mod.value;
  }

  // Pass 2: multiplicative
  for (const mod of modifiers) {
    if (mod.op !== "mul") continue;
    if (!evaluateCondition(mod.condition, run, context)) continue;
    result[mod.stat] = (result[mod.stat] ?? 0) * mod.value;
  }

  // Pass 3: clamps
  for (const mod of modifiers) {
    if (mod.op === "setMin") {
      if (!evaluateCondition(mod.condition, run, context)) continue;
      result[mod.stat] = Math.max(result[mod.stat] ?? 0, mod.value);
    } else if (mod.op === "setMax") {
      if (!evaluateCondition(mod.condition, run, context)) continue;
      result[mod.stat] = Math.min(result[mod.stat] ?? 0, mod.value);
    }
  }

  return result;
}

/**
 * Build traced contributions per stat for debug/UI display.
 */
export function traceModifiers(
  base: ComputedStats,
  modifiers: Modifier[],
  run: RunState,
  context?: { dungeonTags?: Tag[] }
): StatTrace[] {
  const activeModifiers = modifiers.filter((m) =>
    evaluateCondition(m.condition, run, context)
  );

  const statKeys = Object.keys(base) as StatKey[];
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
export function collectRunModifiers(run: RunState): Modifier[] {
  const mods: Modifier[] = [];

  // Traits
  for (const tid of [...run.visibleTraitIds, ...run.hiddenTraitIds]) {
    const def = TRAIT_REGISTRY.get(tid);
    if (def) mods.push(...def.modifiers);
  }

  // Equipped items
  const equippedInstanceIds = [
    run.equipment.weapon,
    run.equipment.armor,
    run.equipment.artifact,
  ].filter(Boolean) as string[];

  for (const instanceId of equippedInstanceIds) {
    const inst = run.inventory.items.find((i) => i.instanceId === instanceId);
    if (!inst) continue;
    const def = ITEM_REGISTRY.get(inst.itemId);
    if (def) mods.push(...def.baseModifiers);
  }

  // Talents
  for (const nodeId of run.talents.unlockedNodeIds) {
    const def = TALENT_REGISTRY.get(nodeId);
    if (def) mods.push(...def.modifiers);
  }

  // Active job
  if (run.currentJobId) {
    const job = JOB_REGISTRY.get(run.currentJobId);
    if (job?.modifiers) {
      mods.push(...job.modifiers);
    }
  }

  // Trait evolution modifiers (stacked on top of base trait modifiers)
  for (const tid of run.evolvedTraitIds) {
    const def = TRAIT_REGISTRY.get(tid);
    if (def?.evolutionModifiers) mods.push(...def.evolutionModifiers);
  }

  // Legacy perk modifiers (permanent prestige bonuses carried into this run)
  for (const perkId of run.activeLegacyPerkIds) {
    const def = LEGACY_PERK_REGISTRY.get(perkId);
    if (def?.modifiers) mods.push(...def.modifiers);
  }

  return mods;
}

/**
 * Compute final stats for a run.
 */
export function computeStats(
  run: RunState,
  context?: { dungeonTags?: Tag[] }
): ComputedStats {
  const mods = collectRunModifiers(run);
  return applyModifiers({ ...BASE_STATS }, mods, run, context);
}
