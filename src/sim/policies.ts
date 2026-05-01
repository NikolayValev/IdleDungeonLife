import type { SaveFile, RunState, ComputedStats } from "../core/types";
import type { GameEvent } from "../core/events";
import { computeStats } from "../core/modifiers";
import { computeDungeonScore, resolveDungeonOutcome } from "../core/stats";
import { DUNGEONS } from "../content/dungeons";
import { TALENTS } from "../content/talents";
import { ITEM_REGISTRY } from "../content/items";
import { JOB_REGISTRY } from "../content/jobs";

export type PolicyAction =
  | Extract<
      GameEvent,
      {
        type:
          | "ASSIGN_JOB"
          | "START_DUNGEON"
          | "EQUIP_ITEM"
          | "UNLOCK_TALENT"
          | "UNLOCK_JOB"
          | "UNLOCK_DUNGEON";
      }
    >
  | null;

export interface Policy {
  decide(save: SaveFile, nowUnixSec: number): PolicyAction;
}

function scoreStats(stats: ComputedStats): number {
  return (
    stats.power * 4 +
    stats.survivability * 3 +
    stats.dungeonSuccessRate * 30 +
    stats.goldRate * 8 +
    stats.essenceRate * 20 +
    stats.itemFindRate * 14 +
    stats.legendaryDropRate * 220 +
    stats.jobOutputMultiplier * 10 +
    stats.discoveryRate * 12 -
    stats.vitalityDecayRate * 12 -
    stats.dungeonWearMultiplier * 10 -
    stats.bossWearMultiplier * 6
  );
}

function withEquippedItem(run: RunState, itemInstanceId: string): RunState | null {
  const instance = run.inventory.items.find((item) => item.instanceId === itemInstanceId);
  if (!instance) return null;
  const itemDef = ITEM_REGISTRY.get(instance.itemId);
  if (!itemDef) return null;

  return {
    ...run,
    equipment: {
      ...run.equipment,
      [itemDef.slot]: itemInstanceId,
    },
  };
}

function bestItemAction(save: SaveFile): PolicyAction {
  const run = save.currentRun;
  if (!run?.alive) return null;

  const baseScore = scoreStats(computeStats(run));
  let best: { itemInstanceId: string; delta: number } | null = null;

  for (const instance of run.inventory.items) {
    const candidateRun = withEquippedItem(run, instance.instanceId);
    if (!candidateRun) continue;
    const candidateScore = scoreStats(computeStats(candidateRun));
    const delta = candidateScore - baseScore;

    if (delta <= 0) continue;
    if (!best || delta > best.delta) {
      best = { itemInstanceId: instance.instanceId, delta };
    }
  }

  return best ? { type: "EQUIP_ITEM", itemInstanceId: best.itemInstanceId } : null;
}

function bestTalentAction(save: SaveFile): PolicyAction {
  const run = save.currentRun;
  if (!run?.alive) return null;

  const baseScore = scoreStats(computeStats(run));
  let best:
    | {
        nodeId: string;
        cost: number;
        delta: number;
      }
    | null = null;

  for (const talent of TALENTS) {
    if (run.talents.unlockedNodeIds.includes(talent.id)) continue;
    if (!talent.prerequisites.every((id) => run.talents.unlockedNodeIds.includes(id))) {
      continue;
    }

    const effectiveCost = talent.costEssence * computeStats(run).talentCostMultiplier;
    if (run.resources.essence < effectiveCost) continue;

    const candidateRun: RunState = {
      ...run,
      talents: {
        unlockedNodeIds: [...run.talents.unlockedNodeIds, talent.id],
      },
    };

    const delta = scoreStats(computeStats(candidateRun)) - baseScore;
    if (delta <= 0) continue;

    if (
      !best ||
      effectiveCost < best.cost ||
      (effectiveCost === best.cost && delta > best.delta)
    ) {
      best = {
        nodeId: talent.id,
        cost: effectiveCost,
        delta,
      };
    }
  }

  return best ? { type: "UNLOCK_TALENT", nodeId: best.nodeId } : null;
}

function bestJobAction(save: SaveFile): PolicyAction {
  const run = save.currentRun;
  if (!run?.alive) return null;

  const bestJob = save.meta.unlockedJobIds.reduce(
    (best, jobId) => {
      const job = JOB_REGISTRY.get(jobId);
      if (!job) return best;
      const incomeScore = job.baseGoldPerSec * 10 + (job.baseEssencePerSec ?? 0) * 40;
      if (!best || incomeScore > best.incomeScore) {
        return { jobId, incomeScore };
      }
      return best;
    },
    null as { jobId: string; incomeScore: number } | null
  );

  if (!bestJob || run.currentJobId === bestJob.jobId) return null;
  return { type: "ASSIGN_JOB", jobId: bestJob.jobId };
}

function meetsUnlockRequirement(save: SaveFile, requirement?: { dungeonCleared?: string; traitDiscovered?: string; legacyPathChosen?: boolean }): boolean {
  if (!requirement) return true;
  if (requirement.traitDiscovered && !save.meta.discoveredTraitIds.includes(requirement.traitDiscovered)) {
    return false;
  }
  if (requirement.dungeonCleared) {
    const run = save.currentRun;
    if (!run || !run.bossesCleared.includes(requirement.dungeonCleared)) {
      return false;
    }
  }
  if (requirement.legacyPathChosen && !save.meta.legacyPath) {
    return false;
  }
  return true;
}

function bestUnlockAction(save: SaveFile): PolicyAction {
  const run = save.currentRun;
  if (!run?.alive) return null;

  const unlockableDungeons = DUNGEONS.filter((dungeon) => {
    if (save.meta.unlockedDungeonIds.includes(dungeon.id)) return false;
    const cost = dungeon.unlockRequirement?.legacyAsh ?? 0;
    if (save.meta.legacyAsh < cost) return false;
    return meetsUnlockRequirement(save, dungeon.unlockRequirement);
  }).map((dungeon) => ({
    dungeonId: dungeon.id,
    score: dungeon.depthIndex * 100 - (dungeon.unlockRequirement?.legacyAsh ?? 0),
  }));

  const unlockableJobs = Array.from(JOB_REGISTRY.values())
    .filter((job) => {
      if (save.meta.unlockedJobIds.includes(job.id)) return false;
      const cost = job.unlockRequirement?.legacyAsh ?? 0;
      if (save.meta.legacyAsh < cost) return false;
      return meetsUnlockRequirement(save, job.unlockRequirement);
    })
    .map((job) => ({
      jobId: job.id,
      score:
        job.baseGoldPerSec * 80 +
        (job.baseEssencePerSec ?? 0) * 220 -
        (job.unlockRequirement?.legacyAsh ?? 0),
    }));

  unlockableDungeons.sort((a, b) => b.score - a.score);
  unlockableJobs.sort((a, b) => b.score - a.score);

  const bestDungeon = unlockableDungeons[0];
  const bestJob = unlockableJobs[0];

  if (!bestDungeon && !bestJob) return null;
  if (bestDungeon && !bestJob) return { type: "UNLOCK_DUNGEON", dungeonId: bestDungeon.dungeonId };
  if (bestJob && !bestDungeon) return { type: "UNLOCK_JOB", jobId: bestJob.jobId };

  if ((bestDungeon?.score ?? -Infinity) >= (bestJob?.score ?? -Infinity)) {
    return { type: "UNLOCK_DUNGEON", dungeonId: bestDungeon!.dungeonId };
  }
  return { type: "UNLOCK_JOB", jobId: bestJob!.jobId };
}

function bestDungeonAction(save: SaveFile, nowUnixSec: number): PolicyAction {
  const run = save.currentRun;
  if (!run?.alive || run.currentDungeon) return null;

  const candidates = DUNGEONS.filter(
    (dungeon) =>
      save.meta.unlockedDungeonIds.includes(dungeon.id) &&
      run.resources.gold >= dungeon.goldCost
  ).map((dungeon) => {
    const score = computeDungeonScore(run, dungeon.tags);
    const outcome = resolveDungeonOutcome(score, dungeon.difficulty);
    const margin = score - dungeon.difficulty;
    const outcomeWeight =
      outcome === "success" ? 40 : outcome === "partial" ? 12 : -20;
    const value =
      dungeon.depthIndex * 100 +
      margin * 3 +
      outcomeWeight -
      dungeon.goldCost * 0.15 -
      dungeon.vitalityWear * 1.5;
    return { dungeonId: dungeon.id, value };
  });

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.value - left.value);
  return { type: "START_DUNGEON", dungeonId: candidates[0].dungeonId, nowUnixSec };
}

export class BaselinePolicy implements Policy {
  decide(save: SaveFile, nowUnixSec: number): PolicyAction {
    const run = save.currentRun;
    if (!run?.alive) return null;

    return (
      bestUnlockAction(save) ??
      bestJobAction(save) ??
      bestItemAction(save) ??
      bestTalentAction(save) ??
      bestDungeonAction(save, nowUnixSec)
    );
  }
}

/**
 * Conservative policy: prioritizes survival over progression
 * - Favors job income and equipment improvements
 * - Avoids difficult dungeons, favors easy/medium dungeons
 */
export class ConservativePolicy implements Policy {
  decide(save: SaveFile, nowUnixSec: number): PolicyAction {
    const run = save.currentRun;
    if (!run?.alive) return null;

    // First priority: jobs and equipment for steady income and survivability
    return (
      bestUnlockAction(save) ??
      bestJobAction(save) ??
      bestItemAction(save) ??
      bestTalentAction(save) ??
      bestDungeonAction(save, nowUnixSec)
    );
  }
}

/**
 * Aggressive policy: prioritizes depth and rewards
 * - Favors high-difficulty dungeons for legendary drops
 * - Pushes depth limits and risk/reward ratio
 */
export class AggressivePolicy implements Policy {
  decide(save: SaveFile, nowUnixSec: number): PolicyAction {
    const run = save.currentRun;
    if (!run?.alive) return null;

    // Reorder to push dungeons earlier, talents for legendary boost
    return (
      bestUnlockAction(save) ??
      bestTalentAction(save) ??
      bestDungeonAction(save, nowUnixSec) ??
      bestJobAction(save) ??
      bestItemAction(save)
    );
  }
}
