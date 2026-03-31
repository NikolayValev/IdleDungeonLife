import type { SaveFile, RunState, ItemInstance, Tag } from "./types";
import type { GameEvent } from "./events";
import { SeededRandomProvider, deriveSeed } from "./rng";
import { tickLifespan, applyDungeonWear } from "./lifespan";
import { computeStats } from "./modifiers";
import { computeDungeonScore, resolveDungeonOutcome } from "./stats";
import { computeLegacyAshReward } from "./scoring";
import { trackEvent } from "./analytics";
import { TRAIT_REGISTRY, TRAITS } from "../content/traits";
import { JOB_REGISTRY } from "../content/jobs";
import { DUNGEON_REGISTRY } from "../content/dungeons";
import { TALENT_REGISTRY } from "../content/talents";
import { LOOT_TABLE_REGISTRY } from "../content/lootTables";
import { ITEM_REGISTRY } from "../content/items";
import { BALANCE } from "../content/balance";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeInstanceId(
  seed: number,
  lootTableId: string,
  rollIndex: number,
  dropIndex: number,
  itemId: string
): string {
  return `inst_${deriveSeed(
    seed,
    `${lootTableId}:${rollIndex}:${dropIndex}:${itemId}`
  ).toString(16)}`;
}

function makeCodexEntryId(kind: "item" | "trait", id: string): string {
  return `${kind}:${id}`;
}

function brokenItemEssence(itemId: string): number {
  const def = ITEM_REGISTRY.get(itemId);
  if (!def) return 0;
  return BALANCE.itemBreakEssence[def.rarity];
}

function clampAlignment(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

// ─── Trait Generation ─────────────────────────────────────────────────────────

function generateStartingTraits(
  seed: number
): { visibleTraitIds: string[]; hiddenTraitIds: string[] } {
  const rng = new SeededRandomProvider(deriveSeed(seed, "traits"));
  const pool = [...TRAITS];

  // Pick 2 distinct traits by weighted random
  const picked: string[] = [];
  while (picked.length < 2) {
    const remaining = pool.filter((p) => !picked.includes(p.id));
    if (remaining.length === 0) break;
    const weights = remaining.map((p) => p.rarityWeight);
    const candidate = rng.weightedPick(remaining, weights);
    picked.push(candidate.id);
  }

  const [first, second] = picked;
  const firstDef = TRAIT_REGISTRY.get(first);

  // First trait: prefer visible revealMode for the visible slot
  const visible = firstDef?.revealMode === "visible" ? [first] : [second];
  const hidden = visible[0] === first ? [second] : [first];

  return { visibleTraitIds: visible, hiddenTraitIds: hidden };
}

// ─── Loot Rolls ───────────────────────────────────────────────────────────────

function rollLoot(
  lootTableId: string,
  seed: number,
  rollIndex: number,
  stats: ReturnType<typeof computeStats>,
  run: RunState,
  dungeonTags: Tag[],
  dungeonDifficulty: number
): { items: ItemInstance[]; gold: number; essence: number } {
  const table = LOOT_TABLE_REGISTRY.get(lootTableId);
  if (!table) return { items: [], gold: 0, essence: 0 };

  const rng = new SeededRandomProvider(deriveSeed(seed, `loot_${lootTableId}_${rollIndex}`));

  // Gold
  const gold = rng.nextInt(table.goldMin, table.goldMax);
  const essence = rng.nextInt(table.essenceMin, table.essenceMax);

  // Items
  const items: ItemInstance[] = [];
  const dropCount = Math.max(
    0,
    table.baseDropCount +
      (rng.nextFloat() < BALANCE.loot.bonusDropChancePerItemFind * stats.itemFindRate ? 1 : 0)
  );

  const positiveAlignment = Math.max(0, run.alignment.holyUnholy);
  const negativeAlignment = Math.max(0, -run.alignment.holyUnholy);
  const alignmentSynergy =
    (dungeonTags.includes("holy") || dungeonTags.includes("shrine") ? positiveAlignment : 0) +
    (dungeonTags.includes("unholy") || dungeonTags.includes("abyss") || dungeonTags.includes("decay")
      ? negativeAlignment
      : 0) +
    (dungeonTags.includes("fate") ? Math.abs(run.alignment.holyUnholy) * 0.35 : 0);

  for (let i = 0; i < dropCount; i++) {
    const rarityWeights = {
      common: table.rarityWeights.common,
      rare:
        table.rarityWeights.rare +
        dungeonDifficulty * BALANCE.loot.rareDifficultyWeight +
        alignmentSynergy * BALANCE.loot.rareAlignmentWeight +
        Math.max(0, stats.itemFindRate - 1) * BALANCE.loot.itemFindRareWeight,
      legendary:
        table.rarityWeights.legendary +
        dungeonDifficulty * BALANCE.loot.legendaryDifficultyWeight +
        alignmentSynergy * BALANCE.loot.legendaryAlignmentWeight +
        stats.legendaryDropRate * BALANCE.loot.legendaryStatWeight,
    };
    const rarityFilter = rng.weightedPick(
      ["common", "rare", "legendary"] as const,
      [rarityWeights.common, rarityWeights.rare, rarityWeights.legendary]
    );
    const filtered = table.entries.filter((e) => {
      const def = ITEM_REGISTRY.get(e.itemId);
      return def?.rarity === rarityFilter;
    });

    const pool = filtered.length > 0 ? filtered : table.entries;
    const chosen = rng.weightedPick(pool, pool.map((e) => e.weight));
    items.push({
      instanceId: makeInstanceId(seed, lootTableId, rollIndex, i, chosen.itemId),
      itemId: chosen.itemId,
    });
  }

  return { items, gold, essence };
}

// ─── New Run Builder ──────────────────────────────────────────────────────────

function buildNewRun(seed: number, nowUnixSec: number): RunState {
  const { visibleTraitIds, hiddenTraitIds } = generateStartingTraits(seed);

  return {
    seed,
    alive: true,
    alignment: { holyUnholy: 0 },
    lifespan: { ageSeconds: 0, vitality: 100, stage: "youth" },
    visibleTraitIds,
    hiddenTraitIds,
    inventory: { items: [] },
    equipment: {},
    talents: { unlockedNodeIds: [] },
    resources: {
      gold: BALANCE.startingGold,
      essence: BALANCE.startingEssence,
    },
    currentDungeon: null,
    currentJobId: null,
    lastTickUnixSec: nowUnixSec,
    deepestDungeonIndex: -1,
    totalDungeonsCompleted: 0,
    bossesCleared: [],
  };
}

// ─── Tick Logic ───────────────────────────────────────────────────────────────

function applyTick(run: RunState, nowUnixSec: number): RunState {
  if (!run.alive) return run;

  const elapsed = Math.max(0, nowUnixSec - run.lastTickUnixSec);
  if (elapsed === 0) return run;

  let updated = { ...run, lastTickUnixSec: nowUnixSec };
  const stats = computeStats(updated);

  // Job income
  if (updated.currentJobId) {
    const job = JOB_REGISTRY.get(updated.currentJobId);
    if (job) {
      const mult = stats.jobOutputMultiplier;
      updated = {
        ...updated,
        resources: {
          gold: updated.resources.gold + job.baseGoldPerSec * mult * elapsed,
          essence:
            updated.resources.essence +
            (job.baseEssencePerSec ?? 0) * mult * elapsed,
        },
      };
    }
  }

  // Lifespan decay
  const { lifespan, died } = tickLifespan(updated.lifespan, stats, elapsed);
  updated = {
    ...updated,
    lifespan,
    currentJobId: died ? null : updated.currentJobId,
  };

  if (died) {
    updated = { ...updated, alive: false };
  }

  return updated;
}

// ─── Main Reducer ─────────────────────────────────────────────────────────────

export function reduceGame(state: SaveFile, event: GameEvent): SaveFile {
  switch (event.type) {
    case "START_NEW_RUN": {
      const seed =
        event.seed ?? Math.floor((event.nowUnixSec * 1234567) ^ 0xdeadbeef);
      const run = buildNewRun(seed, event.nowUnixSec);

      trackEvent("run_started", {
        seed,
        runNumber: state.meta.totalRuns + 1,
        visibleTrait: run.visibleTraitIds[0],
      });

      for (const tid of [...run.visibleTraitIds, ...run.hiddenTraitIds]) {
        trackEvent("trait_assigned", { traitId: tid, visible: run.visibleTraitIds.includes(tid) });
      }

      return {
        ...state,
        updatedAtUnixSec: event.nowUnixSec,
        meta: { ...state.meta, totalRuns: state.meta.totalRuns + 1 },
        currentRun: run,
      };
    }

    case "TICK": {
      if (!state.currentRun) return state;
      const updated = applyTick(state.currentRun, event.nowUnixSec);
      return {
        ...state,
        updatedAtUnixSec: event.nowUnixSec,
        currentRun: updated,
      };
    }

    case "ASSIGN_JOB": {
      if (!state.currentRun?.alive) return state;
      if (!state.meta.unlockedJobIds.includes(event.jobId)) return state;
      return {
        ...state,
        currentRun: { ...state.currentRun, currentJobId: event.jobId },
      };
    }

    case "UNLOCK_JOB": {
      const job = JOB_REGISTRY.get(event.jobId);
      if (!job) return state;
      if (state.meta.unlockedJobIds.includes(event.jobId)) return state;
      const cost = job.unlockRequirement?.legacyAsh ?? 0;
      if (state.meta.legacyAsh < cost) return state;

      return {
        ...state,
        meta: {
          ...state.meta,
          legacyAsh: state.meta.legacyAsh - cost,
          unlockedJobIds: [...state.meta.unlockedJobIds, event.jobId],
        },
      };
    }

    case "UNLOCK_DUNGEON": {
      const dungeon = DUNGEON_REGISTRY.get(event.dungeonId);
      if (!dungeon) return state;
      if (state.meta.unlockedDungeonIds.includes(event.dungeonId)) return state;
      const cost = dungeon.unlockRequirement?.legacyAsh ?? 0;
      if (state.meta.legacyAsh < cost) return state;

      return {
        ...state,
        meta: {
          ...state.meta,
          legacyAsh: state.meta.legacyAsh - cost,
          unlockedDungeonIds: [...state.meta.unlockedDungeonIds, event.dungeonId],
        },
      };
    }

    case "START_DUNGEON": {
      if (!state.currentRun?.alive) return state;
      if (state.currentRun.currentDungeon) return state; // already in dungeon

      const dungeon = DUNGEON_REGISTRY.get(event.dungeonId);
      if (!dungeon) return state;
      if (!state.meta.unlockedDungeonIds.includes(event.dungeonId)) return state;
      if (state.currentRun.resources.gold < dungeon.goldCost) return state;

      const newGold = state.currentRun.resources.gold - dungeon.goldCost;
      const completesAt = event.nowUnixSec + dungeon.durationSec;

      trackEvent("dungeon_started", {
        dungeonId: event.dungeonId,
        cost: dungeon.goldCost,
        completesAt,
      });

      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          resources: { ...state.currentRun.resources, gold: newGold },
          currentDungeon: {
            dungeonId: event.dungeonId,
            startedAtUnixSec: event.nowUnixSec,
            completesAtUnixSec: completesAt,
          },
        },
      };
    }

    case "COMPLETE_DUNGEON": {
      if (!state.currentRun?.alive) return state;
      const activeDungeon = state.currentRun.currentDungeon;
      if (!activeDungeon) return state;
      if (event.nowUnixSec < activeDungeon.completesAtUnixSec) return state;

      const dungeon = DUNGEON_REGISTRY.get(activeDungeon.dungeonId);
      if (!dungeon) return state;

      const stats = computeStats(state.currentRun, { dungeonTags: dungeon.tags });
      const score = computeDungeonScore(state.currentRun, dungeon.tags);
      const outcome = resolveDungeonOutcome(score, dungeon.difficulty);

      // Loot
      const lootRollIdx = state.currentRun.totalDungeonsCompleted;
      const loot =
        outcome !== "failure"
          ? rollLoot(
              dungeon.lootTableId,
              state.currentRun.seed,
              lootRollIdx,
              stats,
              state.currentRun,
              dungeon.tags,
              dungeon.difficulty
            )
          : { items: [], gold: 0, essence: 0 };

      // Wear (always applied even on failure)
      const isBoss = dungeon.tags.includes("boss");
      const newLifespan = applyDungeonWear(
        state.currentRun.lifespan,
        stats,
        dungeon.vitalityWear,
        isBoss
      );

      // Alignment drift
      let newAlignment = state.currentRun.alignment.holyUnholy;
      if (dungeon.alignmentShiftHolyUnholy) {
        const drift = dungeon.alignmentShiftHolyUnholy * BALANCE.alignmentDriftScale;
        if (drift > 0) newAlignment += drift * stats.alignmentDriftHoly;
        else newAlignment += drift * stats.alignmentDriftUnholy;
        newAlignment = clampAlignment(newAlignment);

        trackEvent("alignment_shifted", {
          dungeonId: dungeon.id,
          delta: drift,
          newValue: newAlignment,
        });
      }

      // Discoveries
      const newDiscoveries = new Set(state.meta.discoveredItemIds);
      const newTraitDiscoveries = new Set(state.meta.discoveredTraitIds);
      const newCodexEntries = new Set(state.meta.codexEntries);

      for (const inst of loot.items) {
        newDiscoveries.add(inst.itemId);
        newCodexEntries.add(makeCodexEntryId("item", inst.itemId));
        trackEvent("item_found", { itemId: inst.itemId, dungeonId: dungeon.id });
      }

      // Reveal hidden traits on dungeon completion if rules match
      const newVisible = [...state.currentRun.visibleTraitIds];
      const newHidden = [...state.currentRun.hiddenTraitIds];
      for (const tid of [...newHidden]) {
        const def = TRAIT_REGISTRY.get(tid);
        if (!def?.revealRules) continue;
        for (const rule of def.revealRules) {
          if (
            rule.triggerEvent === "dungeonCompleted" &&
            (!rule.dungeonTag || dungeon.tags.includes(rule.dungeonTag))
          ) {
            newVisible.push(tid);
            newHidden.splice(newHidden.indexOf(tid), 1);
            newTraitDiscoveries.add(tid);
            newCodexEntries.add(makeCodexEntryId("trait", tid));
          }
        }
      }

      // Track depth
      const newDepth = Math.max(
        state.currentRun.deepestDungeonIndex,
        dungeon.depthIndex
      );
      const newBossesCleared = isBoss
        ? [...new Set([...state.currentRun.bossesCleared, dungeon.id])]
        : state.currentRun.bossesCleared;

      trackEvent("dungeon_completed", {
        dungeonId: dungeon.id,
        outcome,
        lootCount: loot.items.length,
        gold: loot.gold,
        essence: loot.essence,
      });

      const died = newLifespan.vitality <= 0;

      return {
        ...state,
        meta: {
          ...state.meta,
          discoveredItemIds: [...newDiscoveries],
          discoveredTraitIds: [...newTraitDiscoveries],
          codexEntries: [...newCodexEntries],
        },
        currentRun: {
          ...state.currentRun,
          alive: !died,
          currentDungeon: null,
          currentJobId: died ? null : state.currentRun.currentJobId,
          lifespan: newLifespan,
          alignment: { holyUnholy: newAlignment },
          visibleTraitIds: newVisible,
          hiddenTraitIds: newHidden,
          inventory: {
            items: [...state.currentRun.inventory.items, ...loot.items],
          },
          resources: {
            gold: state.currentRun.resources.gold + loot.gold,
            essence: state.currentRun.resources.essence + loot.essence,
          },
          deepestDungeonIndex: newDepth,
          totalDungeonsCompleted: state.currentRun.totalDungeonsCompleted + 1,
          bossesCleared: newBossesCleared,
        },
      };
    }

    case "EQUIP_ITEM": {
      if (!state.currentRun?.alive) return state;
      const inst = state.currentRun.inventory.items.find(
        (i) => i.instanceId === event.itemInstanceId
      );
      if (!inst) return state;

      const def = ITEM_REGISTRY.get(inst.itemId);
      if (!def) return state;

      const slot = def.slot as "weapon" | "armor" | "artifact";
      const newEquipment = { ...state.currentRun.equipment, [slot]: event.itemInstanceId };

      trackEvent("item_equipped", { itemId: inst.itemId, slot });

      return {
        ...state,
        currentRun: { ...state.currentRun, equipment: newEquipment },
      };
    }

    case "UNEQUIP_ITEM": {
      if (!state.currentRun?.alive) return state;
      const newEquipment = { ...state.currentRun.equipment };
      delete newEquipment[event.slot];
      return {
        ...state,
        currentRun: { ...state.currentRun, equipment: newEquipment },
      };
    }

    case "BREAK_ITEM": {
      if (!state.currentRun?.alive) return state;

      const inst = state.currentRun.inventory.items.find(
        (item) => item.instanceId === event.itemInstanceId
      );
      if (!inst) return state;

      const def = ITEM_REGISTRY.get(inst.itemId);
      if (!def) return state;

      const essence = brokenItemEssence(inst.itemId);
      const newEquipment = { ...state.currentRun.equipment };
      (["weapon", "armor", "artifact"] as const).forEach((slot) => {
        if (newEquipment[slot] === inst.instanceId) {
          delete newEquipment[slot];
        }
      });

      trackEvent("item_broken", {
        itemId: inst.itemId,
        rarity: def.rarity,
        essence,
      });

      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          equipment: newEquipment,
          inventory: {
            items: state.currentRun.inventory.items.filter(
              (item) => item.instanceId !== event.itemInstanceId
            ),
          },
          resources: {
            ...state.currentRun.resources,
            essence: state.currentRun.resources.essence + essence,
          },
        },
      };
    }

    case "DEBUG_ADD_RESOURCES": {
      if (!state.currentRun) return state;

      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          resources: {
            gold: state.currentRun.resources.gold + (event.gold ?? 0),
            essence: state.currentRun.resources.essence + (event.essence ?? 0),
          },
        },
      };
    }

    case "DEBUG_UNLOCK_JOB": {
      if (state.meta.unlockedJobIds.includes(event.jobId)) return state;
      if (!JOB_REGISTRY.has(event.jobId)) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          unlockedJobIds: [...state.meta.unlockedJobIds, event.jobId],
        },
      };
    }

    case "DEBUG_UNLOCK_DUNGEON": {
      if (state.meta.unlockedDungeonIds.includes(event.dungeonId)) return state;
      if (!DUNGEON_REGISTRY.has(event.dungeonId)) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          unlockedDungeonIds: [...state.meta.unlockedDungeonIds, event.dungeonId],
        },
      };
    }

    case "DEBUG_GRANT_ITEM": {
      if (!state.currentRun) return state;
      if (!ITEM_REGISTRY.has(event.itemId)) return state;

      const nextIndex = state.currentRun.inventory.items.filter(
        (item) => item.itemId === event.itemId
      ).length;

      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          inventory: {
            items: [
              ...state.currentRun.inventory.items,
              {
                instanceId: makeInstanceId(
                  state.currentRun.seed,
                  "debug",
                  state.currentRun.totalDungeonsCompleted,
                  nextIndex,
                  event.itemId
                ),
                itemId: event.itemId,
              },
            ],
          },
        },
      };
    }

    case "DEBUG_KILL_RUN": {
      if (!state.currentRun) return state;
      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          alive: false,
          currentJobId: null,
          lifespan: { ...state.currentRun.lifespan, vitality: 0 },
        },
      };
    }

    case "UNLOCK_TALENT": {
      if (!state.currentRun?.alive) return state;
      const node = TALENT_REGISTRY.get(event.nodeId);
      if (!node) return state;
      if (state.currentRun.talents.unlockedNodeIds.includes(event.nodeId)) return state;

      // Check prerequisites
      const prereqsMet = node.prerequisites.every((p) =>
        state.currentRun!.talents.unlockedNodeIds.includes(p)
      );
      if (!prereqsMet) return state;

      // Check cost
      const stats = computeStats(state.currentRun);
      const cost = node.costEssence * stats.talentCostMultiplier;
      if (state.currentRun.resources.essence < cost) return state;

      trackEvent("talent_unlocked", {
        nodeId: event.nodeId,
        cost,
        essence: state.currentRun.resources.essence,
      });

      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          resources: {
            ...state.currentRun.resources,
            essence: state.currentRun.resources.essence - cost,
          },
          talents: {
            unlockedNodeIds: [...state.currentRun.talents.unlockedNodeIds, event.nodeId],
          },
        },
      };
    }

    case "CLAIM_DEATH": {
      if (!state.currentRun) return state;
      // Can claim death if vitality <= 0 OR if run is manually ended
      const run = state.currentRun;
      const ashEarned = computeLegacyAshReward(run);

      // Discover traits on death
      const newDiscoveredTraits = new Set([
        ...state.meta.discoveredTraitIds,
        ...run.visibleTraitIds,
        ...run.hiddenTraitIds,
      ]);
      const newCodexEntries = new Set(state.meta.codexEntries);
      for (const tid of [...run.visibleTraitIds, ...run.hiddenTraitIds]) {
        newCodexEntries.add(makeCodexEntryId("trait", tid));
      }

      trackEvent("run_died", {
        seed: run.seed,
        ageSeconds: run.lifespan.ageSeconds,
        ashEarned,
        deepestDungeon: run.deepestDungeonIndex,
      });

      trackEvent("run_summary", {
        seed: run.seed,
        totalDungeons: run.totalDungeonsCompleted,
        bossesCleared: run.bossesCleared.length,
        legacyAshEarned: ashEarned,
      });

      return {
        ...state,
        updatedAtUnixSec: event.nowUnixSec,
        meta: {
          ...state.meta,
          legacyAsh: state.meta.legacyAsh + ashEarned,
          discoveredTraitIds: [...newDiscoveredTraits],
          codexEntries: [...newCodexEntries],
        },
        currentRun: null,
      };
    }

    case "RECONCILE_OFFLINE": {
      return reconcileOffline(state, event.nowUnixSec);
    }

    default:
      return state;
  }
}

// ─── Offline Reconciliation ───────────────────────────────────────────────────

export function reconcileOffline(save: SaveFile, nowUnixSec: number): SaveFile {
  if (!save.currentRun?.alive) return { ...save, updatedAtUnixSec: nowUnixSec };

  const maxElapsed = BALANCE.maxOfflineSec;
  const rawElapsed = nowUnixSec - save.updatedAtUnixSec;
  const elapsed = Math.min(rawElapsed, maxElapsed);

  if (elapsed <= 0) return save;

  const simulatedNow = save.updatedAtUnixSec + elapsed;
  let current = save;

  while (current.currentRun?.alive) {
    const completionAt = current.currentRun.currentDungeon?.completesAtUnixSec;
    if (
      completionAt == null ||
      completionAt > simulatedNow ||
      completionAt <= current.currentRun.lastTickUnixSec
    ) {
      break;
    }

    current = reduceGame(current, { type: "TICK", nowUnixSec: completionAt });
    current = reduceGame(current, { type: "COMPLETE_DUNGEON", nowUnixSec: completionAt });
  }

  if (current.currentRun?.alive && current.currentRun.lastTickUnixSec < simulatedNow) {
    current = reduceGame(current, { type: "TICK", nowUnixSec: simulatedNow });
  }

  return { ...current, updatedAtUnixSec: nowUnixSec };
}
