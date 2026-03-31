import type { SaveFile, RunState, ComputedStats } from "../core/types";
import type { GameEvent } from "../core/events";
import { computeStats } from "../core/modifiers";
import { computeDungeonScore, resolveDungeonOutcome } from "../core/stats";
import { DUNGEONS } from "../content/dungeons";
import { TALENTS } from "../content/talents";
import { ITEM_REGISTRY } from "../content/items";
import { JOB_REGISTRY } from "../content/jobs";

export type PolicyAction =
  | Extract<GameEvent, { type: "ASSIGN_JOB" | "START_DUNGEON" | "EQUIP_ITEM" | "UNLOCK_TALENT" }>
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
      bestJobAction(save) ??
      bestItemAction(save) ??
      bestTalentAction(save) ??
      bestDungeonAction(save, nowUnixSec)
    );
  }
}
