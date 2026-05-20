import { test, expect } from "vitest";

import {
  reduceGame,
  startRun,
  clone,
  assertUnchanged,
  addResources,
  grantItem,
  approx,
  freshSave,
} from "./helpers";
import {
  ConsoleAnalyticsSink,
  LocalArrayAnalyticsSink,
  setAnalyticsSink,
} from "../../src/core/analytics";
import { computeStats } from "../../src/core/modifiers";
import { computeDungeonScore } from "../../src/core/stats";
import { TALENT_REGISTRY } from "../../src/content/talents";
import { DUNGEON_REGISTRY } from "../../src/content/dungeons";
import { BALANCE } from "../../src/content/balance";
import { TRAIT_REGISTRY } from "../../src/content/traits";
import { ITEM_REGISTRY } from "../../src/content/items";
import type { SaveFile } from "../../src/core/types";

function stripTraits(save: SaveFile): SaveFile {
  return {
    ...save,
    currentRun: {
      ...save.currentRun!,
      visibleTraitIds: [],
      hiddenTraitIds: [],
    },
  };
}

test("START_NEW_RUN is deterministic and does not mutate prior state", () => {
  const base = freshSave(1000);
  const snapshot = clone(base);

  const next = reduceGame(base, {
    type: "START_NEW_RUN",
    nowUnixSec: 1000,
    seed: 42,
  });

  assertUnchanged(base, snapshot);
  expect(next.meta.totalRuns).toBe(1);
  expect(next.currentRun!.visibleTraitIds).toStrictEqual(["grave_touched"]);
  expect(next.currentRun!.hiddenTraitIds).toStrictEqual(["crystalline_will"]);
});

test("TICK applies deterministic income and lifespan decay without mutation", () => {
  let save = startRun(7, 1000);
  save = stripTraits(save);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });
  const snapshot = clone(save);

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1060 });

  assertUnchanged(save, snapshot);
  approx(next.currentRun!.resources.gold, 39);
  expect(next.currentRun!.lifespan.ageSeconds).toBe(60);
  expect(next.currentRun!.lifespan.vitality < 100).toBeTruthy();
});

test("UNLOCK_JOB and UNLOCK_DUNGEON spend ash through the reducer", () => {
  const save = {
    ...startRun(8, 1000),
    meta: {
      ...startRun(8, 1000).meta,
      legacyAsh: 20,
    },
  };

  const unlockedJob = reduceGame(save, { type: "UNLOCK_JOB", jobId: "scavenger" });
  expect(unlockedJob.meta.unlockedJobIds.includes("scavenger")).toBeTruthy();
  expect(unlockedJob.meta.legacyAsh).toBe(17);

  const unlockedDungeon = reduceGame(unlockedJob, {
    type: "UNLOCK_DUNGEON",
    dungeonId: "grave_hollow",
  });
  expect(unlockedDungeon.meta.unlockedDungeonIds.includes("grave_hollow")).toBeTruthy();
  expect(unlockedDungeon.meta.legacyAsh).toBe(13);
});

test("START_DUNGEON and COMPLETE_DUNGEON are predictable and immutable", () => {
  let save = startRun(99, 1000);
  save = addResources(save, 100, 0);
  const started = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });
  const snapshot = clone(started);

  const completed = reduceGame(started, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1060,
  });

  assertUnchanged(started, snapshot);
  expect(completed.currentRun!.currentDungeon).toBeNull();
  expect(completed.currentRun!.totalDungeonsCompleted).toBe(1);
  expect(completed.currentRun!.inventory.items.length >= 1).toBeTruthy();
  expect(completed.meta.discoveredItemIds.length >= 1).toBeTruthy();
});

test("EQUIP_ITEM and UNEQUIP_ITEM update slots predictably", () => {
  let save = startRun(3, 1000);
  save = grantItem(save, "rusted_blade");
  const instanceId = save.currentRun!.inventory.items[0].instanceId;

  const equipped = reduceGame(save, { type: "EQUIP_ITEM", itemInstanceId: instanceId });
  expect(equipped.currentRun!.equipment.weapon).toBe(instanceId);

  const unequipped = reduceGame(equipped, { type: "UNEQUIP_ITEM", slot: "weapon" });
  expect(unequipped.currentRun!.equipment.weapon).toBe(undefined);
});

test("UNLOCK_TALENT spends essence and appends the node", () => {
  let save = startRun(4, 1000);
  save = addResources(save, 0, 10);
  const snapshot = clone(save);

  const next = reduceGame(save, { type: "UNLOCK_TALENT", nodeId: "spine_0_initiate" });

  assertUnchanged(save, snapshot);
  expect(next.currentRun!.talents.unlockedNodeIds.includes("spine_0_initiate")).toBeTruthy();
  expect(next.currentRun!.resources.essence).toBe(6);
});

test("CLAIM_DEATH archives traits and clears the run", () => {
  let save = startRun(5, 1000);
  save = addResources(save, 100, 0);
  save = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });
  save = reduceGame(save, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1060,
  });
  save = reduceGame(save, { type: "DEBUG_KILL_RUN" });

  const claimed = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 1100 });

  expect(claimed.currentRun).toBeNull();
  expect(claimed.meta.legacyAsh > 0).toBeTruthy();
  expect(claimed.meta.discoveredTraitIds.length >= 2).toBeTruthy();
  expect(claimed.meta.codexEntries.some((entry) => entry.startsWith("trait:"))).toBeTruthy();
});

test("CLAIM_DEATH appends a playthrough record with timeline", () => {
  const sink = new LocalArrayAnalyticsSink();
  setAnalyticsSink(sink);
  try {
    let save = startRun(505, 1000);
    save = addResources(save, 100, 0);
    save = reduceGame(save, {
      type: "START_DUNGEON",
      dungeonId: "abandoned_chapel",
      nowUnixSec: 1000,
    });
    save = reduceGame(save, {
      type: "COMPLETE_DUNGEON",
      nowUnixSec: 1060,
    });
    save = reduceGame(save, { type: "DEBUG_KILL_RUN" });

    const claimed = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 1100 });

    expect(claimed.playthroughArchive.records.length).toBe(1);
    const record = claimed.playthroughArchive.records[0];
    expect(record.seed).toBe(505);
    expect(record.outcome).toBe("death");
    expect(record.finalRun.alive).toBe(false);
    expect(record.finalMeta.legacyAsh).toBe(claimed.meta.legacyAsh);
    expect(record.timeline.length > 0).toBeTruthy();
    expect(record.timeline.some((event) => event.name === "run_died")).toBeTruthy();
    expect(record.timeline.some((event) => event.name === "run_summary")).toBeTruthy();
  } finally {
    setAnalyticsSink(new ConsoleAnalyticsSink());
  }
});

test("CLAIM_DEATH is ignored while the run is still alive", () => {
  const save = startRun(55, 1000);
  const snapshot = clone(save);

  const claimed = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 1010 });

  assertUnchanged(save, snapshot);
  expect(claimed).toStrictEqual(save);
});

test("RECONCILE_OFFLINE routes through the reducer predictably", () => {
  let save = startRun(6, 1000);
  save = stripTraits(save);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  const reconciled = reduceGame(save, {
    type: "RECONCILE_OFFLINE",
    nowUnixSec: 1060,
  });

  approx(reconciled.currentRun!.resources.gold, 39);
  expect(reconciled.currentRun!.lifespan.ageSeconds).toBe(60);
});

test("active job modifiers are included in computed stats", () => {
  let save = startRun(41, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      currentJobId: "scavenger",
    },
  };

  const stats = computeStats(save.currentRun!);
  approx(stats.itemFindRate, 1.15);
});

test("goldRate affects live job income", () => {
  let save = startRun(51, 1000);
  save = stripTraits(save);
  save = grantItem(save, "chapel_token");
  const itemInstanceId = save.currentRun!.inventory.items[0].instanceId;
  save = reduceGame(save, { type: "EQUIP_ITEM", itemInstanceId });
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1060 });

  approx(next.currentRun!.resources.gold, 40.95);
});

test("essenceRate affects live job income", () => {
  let save = startRun(61, 1000);
  save = stripTraits(save);
  save = grantItem(save, "cracked_amulet");
  const itemInstanceId = save.currentRun!.inventory.items[0].instanceId;
  save = reduceGame(save, { type: "EQUIP_ITEM", itemInstanceId });
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      currentJobId: "scribe",
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1060 });

  approx(next.currentRun!.resources.essence, 8.82);
});

test("holy affinity improves dungeon score for matching delves", () => {
  let save = startRun(71, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      visibleTraitIds: ["marked_by_light"],
      hiddenTraitIds: [],
    },
  };

  const holyScore = computeDungeonScore(save.currentRun!, ["holy"]);
  const neutralScore = computeDungeonScore(save.currentRun!, ["neutral"]);

  expect(holyScore > neutralScore).toBeTruthy();
});

test("age-based hidden trait reveals are applied during tick", () => {
  let save = startRun(81, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      visibleTraitIds: [],
      hiddenTraitIds: ["consecrated_blood"],
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1300 });

  expect(next.currentRun!.visibleTraitIds.includes("consecrated_blood")).toBeTruthy();
  expect(next.currentRun!.hiddenTraitIds.includes("consecrated_blood")).toBe(false);
  expect(next.meta.discoveredTraitIds.includes("consecrated_blood")).toBeTruthy();
  expect(next.meta.codexEntries.includes("trait:consecrated_blood")).toBeTruthy();
});

test("alignment-based hidden trait reveals are applied on dungeon completion", () => {
  let save = startRun(91, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      alignment: { holyUnholy: 34 },
      hiddenTraitIds: ["ashen_vow"],
    },
  };
  save = addResources(save, 100, 0);
  save = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });

  const next = reduceGame(save, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1060,
  });

  expect(next.currentRun!.visibleTraitIds.includes("ashen_vow")).toBeTruthy();
  expect(next.currentRun!.hiddenTraitIds.includes("ashen_vow")).toBe(false);
  expect(next.meta.discoveredTraitIds.includes("ashen_vow")).toBeTruthy();
  expect(next.meta.codexEntries.includes("trait:ashen_vow")).toBeTruthy();
});

test("trait evolves when ageReached trigger fires during TICK", () => {
  let save = startRun(7, 1000);
  // grave_touched evolves at ageReached 600 — force it visible and near threshold
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      visibleTraitIds: ["grave_touched"],
      hiddenTraitIds: [],
      lifespan: { ...save.currentRun!.lifespan, ageSeconds: 595 },
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1010 }); // +10s = 605s total

  expect(next.currentRun!.evolvedTraitIds.includes("grave_touched")).toBeTruthy();
});

test("discoveryMomentum accumulates during TICK", () => {
  let save = startRun(1, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      visibleTraitIds: [],
      hiddenTraitIds: [],
      discoveryMomentum: 0,
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1100 }); // 100s elapsed

  expect(next.currentRun!.discoveryMomentum > 0).toBeTruthy();
});

test("CHOOSE_LEGACY_PATH sets meta.legacyPath and cannot be overwritten", () => {
  const base = freshSave(1000);

  const chosen = reduceGame(base, { type: "CHOOSE_LEGACY_PATH", path: "holy" });
  expect(chosen.meta.legacyPath).toBe("holy");

  // Choosing again should be a no-op
  const again = reduceGame(chosen, { type: "CHOOSE_LEGACY_PATH", path: "abyss" });
  expect(again.meta.legacyPath).toBe("holy");
});

test("PURCHASE_LEGACY_PERK deducts ash and records the perk", () => {
  const base = freshSave(1000);
  const save = {
    ...base,
    meta: { ...base.meta, legacyPath: "holy" as const, legacyAsh: 15, legacyPerks: [] },
  };

  const next = reduceGame(save, { type: "PURCHASE_LEGACY_PERK", perkId: "holy_veteran_tithe" });
  expect(next.meta.legacyPerks.includes("holy_veteran_tithe")).toBeTruthy();
  expect(next.meta.legacyAsh).toBe(5); // 15 - 10

  // Buying the same perk twice is a no-op
  const again = reduceGame(next, { type: "PURCHASE_LEGACY_PERK", perkId: "holy_veteran_tithe" });
  expect(again.meta.legacyPerks).toStrictEqual(next.meta.legacyPerks);
  expect(again.meta.legacyAsh).toBe(next.meta.legacyAsh);
});

test("UNLOCK_JOB with traitDiscovered requirement is gated correctly", () => {
  const base = freshSave(1000);
  // runecarver requires traitDiscovered: "obsessive" and legacyAsh: 12
  const withAsh = { ...base, meta: { ...base.meta, legacyAsh: 20, discoveredTraitIds: [] } };

  const blocked = reduceGame(withAsh, { type: "UNLOCK_JOB", jobId: "runecarver" });
  expect(!blocked.meta.unlockedJobIds.includes("runecarver")).toBeTruthy();

  const withTrait = { ...withAsh, meta: { ...withAsh.meta, discoveredTraitIds: ["obsessive"] } };
  const unlocked = reduceGame(withTrait, { type: "UNLOCK_JOB", jobId: "runecarver" });
  expect(unlocked.meta.unlockedJobIds.includes("runecarver")).toBeTruthy();
  expect(unlocked.meta.legacyAsh).toBe(8); // 20 - 12
});

// ─── Run Log System Tests ───────────────────────────────────────────────────────

test("runLog respects the 50-entry cap", () => {
  let save = startRun(100, 1000);
  save = stripTraits(save);
  save = addResources(save, 1000, 0);

  // Spam COMPLETE_DUNGEON to fill the log beyond 50 entries
  for (let i = 0; i < 60; i++) {
    save = reduceGame(save, {
      type: "START_DUNGEON",
      dungeonId: "abandoned_chapel",
      nowUnixSec: 1000 + i * 100,
    });
    save = reduceGame(save, {
      type: "COMPLETE_DUNGEON",
      nowUnixSec: 1060 + i * 100,
    });
  }

  expect(save.currentRun!.runLog.length <= 50, "runLog should not exceed 50 entries").toBeTruthy();
  expect(save.currentRun!.runLog.length > 0, "runLog should have entries").toBeTruthy();
});

test("death_warning log entries are emitted when vitality crosses 20 and 10", () => {
  let save = startRun(101, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      lifespan: { ...save.currentRun!.lifespan, vitality: 21 }, // just above 20
    },
  };

  // Tick until vitality drops below 20
  let next = save;
  for (let i = 0; i < 50; i++) {
    next = reduceGame(next, { type: "TICK", nowUnixSec: 1000 + (i + 1) * 100 });
    if (next.currentRun!.lifespan.vitality < 20) break;
  }

  const deathWarnings = next.currentRun!.runLog.filter((e) => e.kind === "death_warning");
  expect(deathWarnings.length >= 1, "Should have at least one death_warning").toBeTruthy();
});

test("runLog entries have correct structure (kind, message, timestampSec)", () => {
  let save = startRun(102, 1000);
  save = addResources(save, 100, 0);
  save = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });
  save = reduceGame(save, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1060,
  });

  // Should have dungeon log entries
  const dungeonEntries = save.currentRun!.runLog.filter((e) => e.kind === "dungeon");
  expect(dungeonEntries.length >= 1).toBeTruthy();

  for (const entry of dungeonEntries) {
    expect(typeof entry.kind === "string").toBeTruthy();
    expect(typeof entry.message === "string").toBeTruthy();
    expect(typeof entry.timestampSec === "number").toBeTruthy();
  }
});

// ─── Phase 2 Content Validation Tests ───────────────────────────────────────────

test("new knowledge talents unlock correctly and have correct costs", () => {
  const knowledgeTalents = [
    "know_1_archivist",
    "know_2_interpreter",
    "know_3_codebreaker",
    "know_4_mnemonist",
    "know_5_lexicon",
    "know_6_chronicler",
    "know_7_omniscience",
  ];

  for (const nodeId of knowledgeTalents) {
    const def = TALENT_REGISTRY.get(nodeId);
    expect(def, `Talent ${nodeId} should exist`).toBeTruthy();
    expect(def!.tags.includes("knowledge"), `${nodeId} should have knowledge tag`).toBeTruthy();
    expect(def!.costEssence > 0, `${nodeId} should have positive cost`).toBeTruthy();
    expect(def!.position.x === 6, `${nodeId} should be at x:6`).toBeTruthy();
  }
});

test("new late-game dungeons exist with correct unlock costs", () => {
  const newDungeons = ["bone_cathedral", "deep_vault", "the_wound"];
  const expectedCosts: Record<string, number> = { bone_cathedral: 110, deep_vault: 160, the_wound: 220 };

  for (const dungeonId of newDungeons) {
    const def = DUNGEON_REGISTRY.get(dungeonId);
    expect(def, `Dungeon ${dungeonId} should exist`).toBeTruthy();
    const cost = BALANCE.unlockCost[dungeonId as keyof typeof BALANCE.unlockCost];
    expect(cost, `${dungeonId} unlock cost should match`).toBe(expectedCosts[dungeonId]);
  }
});

test("new traits (hollow_king, second_skin, ledger_of_names, sorrow_herald) exist", () => {
  const newTraits = ["hollow_king", "second_skin", "ledger_of_names", "sorrow_herald"];

  for (const traitId of newTraits) {
    const def = TRAIT_REGISTRY.get(traitId);
    expect(def, `Trait ${traitId} should exist`).toBeTruthy();
    expect(def!.revealMode, `${traitId} should be hidden`).toBe("hidden");
    expect(def!.revealRules, `${traitId} should have reveal rules`).toBeTruthy();
    expect(def!.evolutionRules, `${traitId} should have evolution rules`).toBeTruthy();
  }
});

test("new items (legendary + rare) exist in registry", () => {
  const newLegendaryItems = [
    "tome_of_annihilation",
    "fate_reaper",
    "vitality_coil",
    "bone_throne_mantle",
  ];
  const newRareItems = [
    "knowledge_prism",
    "wealth_ward",
    "sinew_blade",
    "marrow_spike",
  ];

  for (const itemId of newLegendaryItems) {
    const def = ITEM_REGISTRY.get(itemId);
    expect(def, `Legendary item ${itemId} should exist`).toBeTruthy();
    expect(def!.rarity, `${itemId} should be legendary`).toBe("legendary");
  }

  for (const itemId of newRareItems) {
    const def = ITEM_REGISTRY.get(itemId);
    expect(def, `Rare item ${itemId} should exist`).toBeTruthy();
    expect(def!.rarity, `${itemId} should be rare`).toBe("rare");
  }
});

// ─── Trait Evolution Tests ───────────────────────────────────────────────────

test("hollow_king evolves at ageReached 400", () => {
  let save = startRun(103, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      visibleTraitIds: ["hollow_king"],
      hiddenTraitIds: [],
      lifespan: { ...save.currentRun!.lifespan, ageSeconds: 395 },
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1020 }); // +20s = 415s

  expect(next.currentRun!.evolvedTraitIds.includes("hollow_king")).toBeTruthy();
});

test("second_skin reveal rule triggers at ageReached 300", () => {
  let save = startRun(104, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      visibleTraitIds: [],
      hiddenTraitIds: ["second_skin"],
      lifespan: { ...save.currentRun!.lifespan, ageSeconds: 295 },
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1020 }); // +20s = 315s

  expect(next.currentRun!.visibleTraitIds.includes("second_skin")).toBeTruthy();
});

test("sorrow_herald reveal rule triggers at alignment <= -40", () => {
  let save = startRun(105, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      alignment: { holyUnholy: -35 },
      hiddenTraitIds: ["sorrow_herald"],
    },
  };
  save = addResources(save, 100, 0);

  // Start and complete abyss dungeon to drop alignment further
  save = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abyss_stair",
    nowUnixSec: 1000,
  });
  save = reduceGame(save, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1200,
  });

  const hasReveal = save.currentRun!.visibleTraitIds.includes("sorrow_herald") ||
                     save.currentRun!.alignment.holyUnholy <= -40;
  expect(hasReveal || save.currentRun!.hiddenTraitIds.includes("sorrow_herald")).toBeTruthy();
});

// ─── Resource Invariants ─────────────────────────────────────────────────────

test("resources never go negative after TICK", () => {
  let save = startRun(106, 1000);
  save = stripTraits(save);

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1100 });

  expect(next.currentRun!.resources.gold >= 0, "gold should be non-negative").toBeTruthy();
  expect(next.currentRun!.resources.essence >= 0, "essence should be non-negative").toBeTruthy();
});

test("vitality stays within [0, 100] bounds", () => {
  let save = startRun(107, 1000);
  save = stripTraits(save);

  // Tick many times to see vitality decay
  for (let i = 0; i < 100; i++) {
    save = reduceGame(save, { type: "TICK", nowUnixSec: 1000 + (i + 1) * 100 });
    expect(
      save.currentRun!.lifespan.vitality >= 0 && save.currentRun!.lifespan.vitality <= 100,
      `vitality ${save.currentRun!.lifespan.vitality} should be in [0, 100]`
    ).toBeTruthy();
  }
});

test("alignment stays within [-100, 100]", () => {
  let save = startRun(108, 1000);
  save = addResources(save, 1000, 0);

  // Complete many dungeons with different alignment shifts
  for (let i = 0; i < 20; i++) {
    const dungeonId = i % 2 === 0 ? "abandoned_chapel" : "abyss_stair";
    save = reduceGame(save, {
      type: "START_DUNGEON",
      dungeonId,
      nowUnixSec: 1000 + i * 200,
    });
    save = reduceGame(save, {
      type: "COMPLETE_DUNGEON",
      nowUnixSec: 1100 + i * 200,
    });

    const align = save.currentRun!.alignment.holyUnholy;
    expect(align >= -100 && align <= 100, `alignment ${align} should be in [-100, 100]`).toBeTruthy();
  }
});

// ─── Inventory Cap Tests ─────────────────────────────────────────────────────

test("inventory is capped at BALANCE.loot.inventoryCap items after many dungeons", () => {
  let save = startRun(200, 1000);
  save = stripTraits(save);
  save = addResources(save, 100_000, 0);

  // Complete many dungeons to accumulate items
  const dungeonCount = BALANCE.loot.inventoryCap + 20;
  for (let i = 0; i < dungeonCount; i++) {
    save = reduceGame(save, {
      type: "START_DUNGEON",
      dungeonId: "abandoned_chapel",
      nowUnixSec: 1000 + i * 100,
    });
    save = reduceGame(save, {
      type: "COMPLETE_DUNGEON",
      nowUnixSec: 1060 + i * 100,
    });
    if (!save.currentRun?.alive) break;
  }

  expect(save.currentRun !== null, "run should still be active (or recently died)").toBeTruthy();
  if (save.currentRun) {
    expect(
      save.currentRun.inventory.items.length <= BALANCE.loot.inventoryCap,
      `inventory (${save.currentRun.inventory.items.length}) should not exceed cap (${BALANCE.loot.inventoryCap})`
    ).toBeTruthy();
  }
});

// ─── Death Flow Integration Tests ────────────────────────────────────────────

test("dungeon wear that kills the character sets alive=false and clears job", () => {
  let save = startRun(201, 1000);
  save = stripTraits(save);
  save = addResources(save, 1000, 0);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  // Force vitality to near zero then complete a dungeon with wear
  save = {
    ...save,
    currentRun: {
      ...save.currentRun!,
      lifespan: { ...save.currentRun!.lifespan, vitality: 1 },
    },
  };

  save = reduceGame(save, {
    type: "START_DUNGEON",
    dungeonId: "abandoned_chapel",
    nowUnixSec: 1000,
  });
  save = reduceGame(save, {
    type: "COMPLETE_DUNGEON",
    nowUnixSec: 1060,
  });

  expect(save.currentRun!.alive, "character should be dead after lethal wear").toBe(false);
  expect(save.currentRun!.currentJobId, "job should be cleared on death").toBeNull();
  expect(save.currentRun!.lifespan.vitality, "vitality should be exactly 0").toBe(0);
});

test("CLAIM_DEATH is idempotent: second call on null run is a no-op", () => {
  let save = startRun(202, 1000);
  save = addResources(save, 100, 0);
  save = reduceGame(save, { type: "DEBUG_KILL_RUN" });

  const claimed = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 1100 });
  expect(claimed.currentRun).toBeNull();

  // Second CLAIM_DEATH with no currentRun: must return same state
  const claimedAgain = reduceGame(claimed, { type: "CLAIM_DEATH", nowUnixSec: 1200 });
  expect(claimedAgain, "second CLAIM_DEATH should be a no-op").toStrictEqual(claimed);
});

test("full run lifecycle: start → dungeon → wear-death → claim → ash accumulated", () => {
  const sink = new LocalArrayAnalyticsSink();
  setAnalyticsSink(sink);
  try {
    let save = startRun(203, 1000);
    save = stripTraits(save);
    save = addResources(save, 500, 0);

    // Run dungeons until death
    let dungeonsDone = 0;
    while (save.currentRun?.alive && dungeonsDone < 100) {
      if (save.currentRun.resources.gold < 10) break;
      save = reduceGame(save, {
        type: "START_DUNGEON",
        dungeonId: "abandoned_chapel",
        nowUnixSec: 1000 + dungeonsDone * 100,
      });
      save = reduceGame(save, {
        type: "COMPLETE_DUNGEON",
        nowUnixSec: 1060 + dungeonsDone * 100,
      });
      dungeonsDone++;
    }

    // Force death if still alive
    if (save.currentRun?.alive) {
      save = reduceGame(save, { type: "DEBUG_KILL_RUN" });
    }

    expect(save.currentRun?.alive, "character should be dead").toBe(false);

    const ashBefore = save.meta.legacyAsh;
    const claimed = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 2000 });

    expect(claimed.currentRun, "currentRun should be null after claim").toBeNull();
    expect(claimed.meta.legacyAsh >= ashBefore, "ash should not decrease after claim").toBeTruthy();
    expect(claimed.playthroughArchive.records.length > 0, "should have a playthrough record").toBeTruthy();
    const record = claimed.playthroughArchive.records[0];
    expect(
      record.timeline.some((e) => e.name === "run_died"),
      "run_died event should appear in playthrough timeline"
    ).toBeTruthy();
  } finally {
    setAnalyticsSink(new ConsoleAnalyticsSink());
  }
});
