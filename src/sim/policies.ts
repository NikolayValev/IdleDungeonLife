import type { SaveFile } from "../core/types";
import { computeStats } from "../core/modifiers";
import { DUNGEONS } from "../content/dungeons";
import { TALENTS } from "../content/talents";
import { ITEM_REGISTRY } from "../content/items";
import { JOB_REGISTRY } from "../content/jobs";

/**
 * Policy interface: given a save state, decide what event to fire next.
 * Returns null if no action should be taken this step.
 */
export type PolicyAction =
  | { type: "ASSIGN_JOB"; jobId: string }
  | { type: "START_DUNGEON"; dungeonId: string; nowUnixSec: number }
  | { type: "EQUIP_ITEM"; itemInstanceId: string }
  | { type: "UNLOCK_TALENT"; nodeId: string }
  | null;

export interface Policy {
  decide(save: SaveFile, nowUnixSec: number): PolicyAction;
}

/**
 * Baseline greedy policy:
 * 1. Pick best unlocked job
 * 2. Equip best available item per slot
 * 3. Unlock affordable talent with best power contribution
 * 4. Enter best affordable dungeon not currently in progress
 */
export class BaselinePolicy implements Policy {
  decide(save: SaveFile, nowUnixSec: number): PolicyAction {
    const run = save.currentRun;
    if (!run?.alive) return null;
    if (run.currentDungeon) return null; // busy

    const stats = computeStats(run);

    // 1. Assign best job
    const bestJob = save.meta.unlockedJobIds.reduce(
      (best, jid) => {
        const j = JOB_REGISTRY.get(jid);
        if (!j) return best;
        const income = j.baseGoldPerSec + (j.baseEssencePerSec ?? 0) * 5;
        if (!best || income > best.income) return { id: jid, income };
        return best;
      },
      null as { id: string; income: number } | null
    );

    if (bestJob && run.currentJobId !== bestJob.id) {
      return { type: "ASSIGN_JOB", jobId: bestJob.id };
    }

    // 2. Equip best items
    const slots: Array<"weapon" | "armor" | "artifact"> = ["weapon", "armor", "artifact"];
    for (const slot of slots) {
      const unequipped = run.inventory.items.filter((inst) => {
        const currentEquipped = [
          run.equipment.weapon,
          run.equipment.armor,
          run.equipment.artifact,
        ];
        if (currentEquipped.includes(inst.instanceId)) return false;
        const def = ITEM_REGISTRY.get(inst.itemId);
        return def?.slot === slot;
      });

      if (unequipped.length > 0) {
        // Score each item by power + survivability modifier sum
        const scored = unequipped.map((inst) => {
          const def = ITEM_REGISTRY.get(inst.itemId);
          const score = def?.baseModifiers.reduce((s, m) => {
            if (m.stat === "power" || m.stat === "survivability") return s + m.value;
            return s;
          }, 0) ?? 0;
          return { inst, score };
        });
        scored.sort((a, b) => b.score - a.score);

        const currentSlotId = run.equipment[slot];
        if (!currentSlotId || scored[0].score > 0) {
          const currentScore = currentSlotId
            ? (() => {
                const ci = run.inventory.items.find(
                  (i) => i.instanceId === currentSlotId
                );
                const def = ci && ITEM_REGISTRY.get(ci.itemId);
                return (
                  def?.baseModifiers.reduce((s, m) => {
                    if (m.stat === "power" || m.stat === "survivability")
                      return s + m.value;
                    return s;
                  }, 0) ?? 0
                );
              })()
            : -Infinity;

          if (scored[0].score > currentScore) {
            return {
              type: "EQUIP_ITEM",
              itemInstanceId: scored[0].inst.instanceId,
            };
          }
        }
      }
    }

    // 3. Unlock affordable talent
    const affordable = TALENTS.filter((t) => {
      if (run.talents.unlockedNodeIds.includes(t.id)) return false;
      const prereqsMet = t.prerequisites.every((p) =>
        run.talents.unlockedNodeIds.includes(p)
      );
      if (!prereqsMet) return false;
      const cost = t.costEssence * stats.talentCostMultiplier;
      return run.resources.essence >= cost;
    });

    if (affordable.length > 0) {
      // Pick talent with highest power benefit
      const best = affordable.reduce((a, b) => {
        const scoreA = a.modifiers.reduce(
          (s, m) => (m.stat === "power" ? s + m.value : s),
          0
        );
        const scoreB = b.modifiers.reduce(
          (s, m) => (m.stat === "power" ? s + m.value : s),
          0
        );
        return scoreA >= scoreB ? a : b;
      });
      return { type: "UNLOCK_TALENT", nodeId: best.id };
    }

    // 4. Enter best affordable dungeon
    const availableDungeons = DUNGEONS.filter(
      (d) =>
        save.meta.unlockedDungeonIds.includes(d.id) &&
        run.resources.gold >= d.goldCost
    );

    if (availableDungeons.length > 0) {
      // Prefer deepest dungeon we can afford
      const best = availableDungeons.reduce((a, b) =>
        b.depthIndex > a.depthIndex ? b : a
      );
      return {
        type: "START_DUNGEON",
        dungeonId: best.id,
        nowUnixSec,
      };
    }

    return null;
  }
}
