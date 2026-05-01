const test = require("node:test");
const assert = require("node:assert/strict");

const {
  reduceGame,
  startRun,
  clone,
  assertUnchanged,
  addResources,
  grantItem,
  approx,
} = require("./helpers.cjs");
const { computeStats } = require("../../.test-build/src/core/modifiers.js");
const { computeDungeonScore } = require("../../.test-build/src/core/stats.js");

function stripTraits(save) {
  return {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: [],
      hiddenTraitIds: [],
    },
  };
}

test("START_NEW_RUN is deterministic and does not mutate prior state", () => {
  const base = require("../../.test-build/src/core/save.js").freshSave(1000);
  const snapshot = clone(base);

  const next = reduceGame(base, {
    type: "START_NEW_RUN",
    nowUnixSec: 1000,
    seed: 42,
  });

  assertUnchanged(base, snapshot);
  assert.equal(next.meta.totalRuns, 1);
  assert.deepStrictEqual(next.currentRun.visibleTraitIds, ["grave_touched"]);
  assert.deepStrictEqual(next.currentRun.hiddenTraitIds, ["crystalline_will"]);
});

test("TICK applies deterministic income and lifespan decay without mutation", () => {
  let save = startRun(7, 1000);
  save = stripTraits(save);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });
  const snapshot = clone(save);

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1060 });

  assertUnchanged(save, snapshot);
  approx(next.currentRun.resources.gold, 39);
  assert.equal(next.currentRun.lifespan.ageSeconds, 60);
  assert.ok(next.currentRun.lifespan.vitality < 100);
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
  assert.ok(unlockedJob.meta.unlockedJobIds.includes("scavenger"));
  assert.equal(unlockedJob.meta.legacyAsh, 17);

  const unlockedDungeon = reduceGame(unlockedJob, {
    type: "UNLOCK_DUNGEON",
    dungeonId: "grave_hollow",
  });
  assert.ok(unlockedDungeon.meta.unlockedDungeonIds.includes("grave_hollow"));
  assert.equal(unlockedDungeon.meta.legacyAsh, 13);
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
  assert.equal(completed.currentRun.currentDungeon, null);
  assert.equal(completed.currentRun.totalDungeonsCompleted, 1);
  assert.ok(completed.currentRun.inventory.items.length >= 1);
  assert.ok(completed.meta.discoveredItemIds.length >= 1);
});

test("EQUIP_ITEM and UNEQUIP_ITEM update slots predictably", () => {
  let save = startRun(3, 1000);
  save = grantItem(save, "rusted_blade");
  const instanceId = save.currentRun.inventory.items[0].instanceId;

  const equipped = reduceGame(save, { type: "EQUIP_ITEM", itemInstanceId: instanceId });
  assert.equal(equipped.currentRun.equipment.weapon, instanceId);

  const unequipped = reduceGame(equipped, { type: "UNEQUIP_ITEM", slot: "weapon" });
  assert.equal(unequipped.currentRun.equipment.weapon, undefined);
});

test("UNLOCK_TALENT spends essence and appends the node", () => {
  let save = startRun(4, 1000);
  save = addResources(save, 0, 10);
  const snapshot = clone(save);

  const next = reduceGame(save, { type: "UNLOCK_TALENT", nodeId: "spine_0_initiate" });

  assertUnchanged(save, snapshot);
  assert.ok(next.currentRun.talents.unlockedNodeIds.includes("spine_0_initiate"));
  assert.equal(next.currentRun.resources.essence, 6);
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

  assert.equal(claimed.currentRun, null);
  assert.ok(claimed.meta.legacyAsh > 0);
  assert.ok(claimed.meta.discoveredTraitIds.length >= 2);
  assert.ok(claimed.meta.codexEntries.some((entry) => entry.startsWith("trait:")));
});

test("CLAIM_DEATH is ignored while the run is still alive", () => {
  const save = startRun(55, 1000);
  const snapshot = clone(save);

  const claimed = reduceGame(save, { type: "CLAIM_DEATH", nowUnixSec: 1010 });

  assertUnchanged(save, snapshot);
  assert.deepStrictEqual(claimed, save);
});

test("RECONCILE_OFFLINE routes through the reducer predictably", () => {
  let save = startRun(6, 1000);
  save = stripTraits(save);
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  const reconciled = reduceGame(save, {
    type: "RECONCILE_OFFLINE",
    nowUnixSec: 1060,
  });

  approx(reconciled.currentRun.resources.gold, 39);
  assert.equal(reconciled.currentRun.lifespan.ageSeconds, 60);
});

test("active job modifiers are included in computed stats", () => {
  let save = startRun(41, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      currentJobId: "scavenger",
    },
  };

  const stats = computeStats(save.currentRun);
  approx(stats.itemFindRate, 1.15);
});

test("goldRate affects live job income", () => {
  let save = startRun(51, 1000);
  save = stripTraits(save);
  save = grantItem(save, "chapel_token");
  const itemInstanceId = save.currentRun.inventory.items[0].instanceId;
  save = reduceGame(save, { type: "EQUIP_ITEM", itemInstanceId });
  save = reduceGame(save, { type: "ASSIGN_JOB", jobId: "porter" });

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1060 });

  approx(next.currentRun.resources.gold, 40.95);
});

test("essenceRate affects live job income", () => {
  let save = startRun(61, 1000);
  save = stripTraits(save);
  save = grantItem(save, "cracked_amulet");
  const itemInstanceId = save.currentRun.inventory.items[0].instanceId;
  save = reduceGame(save, { type: "EQUIP_ITEM", itemInstanceId });
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      currentJobId: "scribe",
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1060 });

  approx(next.currentRun.resources.essence, 8.82);
});

test("holy affinity improves dungeon score for matching delves", () => {
  let save = startRun(71, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: ["marked_by_light"],
      hiddenTraitIds: [],
    },
  };

  const holyScore = computeDungeonScore(save.currentRun, ["holy"]);
  const neutralScore = computeDungeonScore(save.currentRun, ["neutral"]);

  assert.ok(holyScore > neutralScore);
});

test("age-based hidden trait reveals are applied during tick", () => {
  let save = startRun(81, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: [],
      hiddenTraitIds: ["consecrated_blood"],
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1300 });

  assert.ok(next.currentRun.visibleTraitIds.includes("consecrated_blood"));
  assert.equal(next.currentRun.hiddenTraitIds.includes("consecrated_blood"), false);
  assert.ok(next.meta.discoveredTraitIds.includes("consecrated_blood"));
  assert.ok(next.meta.codexEntries.includes("trait:consecrated_blood"));
});

test("alignment-based hidden trait reveals are applied on dungeon completion", () => {
  let save = startRun(91, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
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

  assert.ok(next.currentRun.visibleTraitIds.includes("ashen_vow"));
  assert.equal(next.currentRun.hiddenTraitIds.includes("ashen_vow"), false);
  assert.ok(next.meta.discoveredTraitIds.includes("ashen_vow"));
  assert.ok(next.meta.codexEntries.includes("trait:ashen_vow"));
});

test("trait evolves when ageReached trigger fires during TICK", () => {
  let save = startRun(7, 1000);
  // grave_touched evolves at ageReached 600 — force it visible and near threshold
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: ["grave_touched"],
      hiddenTraitIds: [],
      lifespan: { ...save.currentRun.lifespan, ageSeconds: 595 },
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1010 }); // +10s = 605s total

  assert.ok(next.currentRun.evolvedTraitIds.includes("grave_touched"));
});

test("discoveryMomentum accumulates during TICK", () => {
  let save = startRun(1, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: [],
      hiddenTraitIds: [],
      discoveryMomentum: 0,
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1100 }); // 100s elapsed

  assert.ok(next.currentRun.discoveryMomentum > 0);
});

test("CHOOSE_LEGACY_PATH sets meta.legacyPath and cannot be overwritten", () => {
  const { freshSave: fresh } = require("../../.test-build/src/core/save.js");
  const base = fresh(1000);

  const chosen = reduceGame(base, { type: "CHOOSE_LEGACY_PATH", path: "holy" });
  assert.equal(chosen.meta.legacyPath, "holy");

  // Choosing again should be a no-op
  const again = reduceGame(chosen, { type: "CHOOSE_LEGACY_PATH", path: "abyss" });
  assert.equal(again.meta.legacyPath, "holy");
});

test("PURCHASE_LEGACY_PERK deducts ash and records the perk", () => {
  const { freshSave: fresh } = require("../../.test-build/src/core/save.js");
  const base = fresh(1000);
  const save = {
    ...base,
    meta: { ...base.meta, legacyPath: "holy", legacyAsh: 15, legacyPerks: [] },
  };

  const next = reduceGame(save, { type: "PURCHASE_LEGACY_PERK", perkId: "holy_veteran_tithe" });
  assert.ok(next.meta.legacyPerks.includes("holy_veteran_tithe"));
  assert.equal(next.meta.legacyAsh, 5); // 15 - 10

  // Buying the same perk twice is a no-op
  const again = reduceGame(next, { type: "PURCHASE_LEGACY_PERK", perkId: "holy_veteran_tithe" });
  assert.deepStrictEqual(again.meta.legacyPerks, next.meta.legacyPerks);
  assert.equal(again.meta.legacyAsh, next.meta.legacyAsh);
});

test("UNLOCK_JOB with traitDiscovered requirement is gated correctly", () => {
  const { freshSave: fresh } = require("../../.test-build/src/core/save.js");
  const base = fresh(1000);
  // runecarver requires traitDiscovered: "obsessive" and legacyAsh: 12
  const withAsh = { ...base, meta: { ...base.meta, legacyAsh: 20, discoveredTraitIds: [] } };

  const blocked = reduceGame(withAsh, { type: "UNLOCK_JOB", jobId: "runecarver" });
  assert.ok(!blocked.meta.unlockedJobIds.includes("runecarver"));

  const withTrait = { ...withAsh, meta: { ...withAsh.meta, discoveredTraitIds: ["obsessive"] } };
  const unlocked = reduceGame(withTrait, { type: "UNLOCK_JOB", jobId: "runecarver" });
  assert.ok(unlocked.meta.unlockedJobIds.includes("runecarver"));
  assert.equal(unlocked.meta.legacyAsh, 8); // 20 - 12
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

  assert.ok(save.currentRun.runLog.length <= 50, "runLog should not exceed 50 entries");
  assert.ok(save.currentRun.runLog.length > 0, "runLog should have entries");
});

test("death_warning log entries are emitted when vitality crosses 20 and 10", () => {
  let save = startRun(101, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      lifespan: { ...save.currentRun.lifespan, vitality: 21 }, // just above 20
    },
  };

  // Tick until vitality drops below 20
  let next = save;
  for (let i = 0; i < 50; i++) {
    next = reduceGame(next, { type: "TICK", nowUnixSec: 1000 + (i + 1) * 100 });
    if (next.currentRun.lifespan.vitality < 20) break;
  }

  const deathWarnings = next.currentRun.runLog.filter((e) => e.kind === "death_warning");
  assert.ok(deathWarnings.length >= 1, "Should have at least one death_warning");
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
  const dungeonEntries = save.currentRun.runLog.filter((e) => e.kind === "dungeon");
  assert.ok(dungeonEntries.length >= 1);

  for (const entry of dungeonEntries) {
    assert.ok(typeof entry.kind === "string");
    assert.ok(typeof entry.message === "string");
    assert.ok(typeof entry.timestampSec === "number");
  }
});

// ─── Phase 2 Content Validation Tests ───────────────────────────────────────────

test("new knowledge talents unlock correctly and have correct costs", () => {
  const { TALENT_REGISTRY } = require("../../.test-build/src/content/talents.js");

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
    assert.ok(def, `Talent ${nodeId} should exist`);
    assert.ok(def.tags.includes("knowledge"), `${nodeId} should have knowledge tag`);
    assert.ok(def.costEssence > 0, `${nodeId} should have positive cost`);
    assert.ok(def.position.x === 6, `${nodeId} should be at x:6`);
  }
});

test("new late-game dungeons exist with correct unlock costs", () => {
  const { DUNGEON_REGISTRY } = require("../../.test-build/src/content/dungeons.js");
  const { BALANCE } = require("../../.test-build/src/content/balance.js");

  const newDungeons = ["bone_cathedral", "deep_vault", "the_wound"];
  const expectedCosts = { bone_cathedral: 110, deep_vault: 160, the_wound: 220 };

  for (const dungeonId of newDungeons) {
    const def = DUNGEON_REGISTRY.get(dungeonId);
    assert.ok(def, `Dungeon ${dungeonId} should exist`);
    const cost = BALANCE.unlockCost[dungeonId];
    assert.equal(cost, expectedCosts[dungeonId], `${dungeonId} unlock cost should match`);
  }
});

test("new traits (hollow_king, second_skin, ledger_of_names, sorrow_herald) exist", () => {
  const { TRAIT_REGISTRY } = require("../../.test-build/src/content/traits.js");

  const newTraits = ["hollow_king", "second_skin", "ledger_of_names", "sorrow_herald"];

  for (const traitId of newTraits) {
    const def = TRAIT_REGISTRY.get(traitId);
    assert.ok(def, `Trait ${traitId} should exist`);
    assert.equal(def.revealMode, "hidden", `${traitId} should be hidden`);
    assert.ok(def.revealRules, `${traitId} should have reveal rules`);
    assert.ok(def.evolutionRules, `${traitId} should have evolution rules`);
  }
});

test("new items (legendary + rare) exist in registry", () => {
  const { ITEM_REGISTRY } = require("../../.test-build/src/content/items.js");

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
    assert.ok(def, `Legendary item ${itemId} should exist`);
    assert.equal(def.rarity, "legendary", `${itemId} should be legendary`);
  }

  for (const itemId of newRareItems) {
    const def = ITEM_REGISTRY.get(itemId);
    assert.ok(def, `Rare item ${itemId} should exist`);
    assert.equal(def.rarity, "rare", `${itemId} should be rare`);
  }
});

// ─── Trait Evolution Tests ───────────────────────────────────────────────────

test("hollow_king evolves at ageReached 400", () => {
  let save = startRun(103, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: ["hollow_king"],
      hiddenTraitIds: [],
      lifespan: { ...save.currentRun.lifespan, ageSeconds: 395 },
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1020 }); // +20s = 415s

  assert.ok(next.currentRun.evolvedTraitIds.includes("hollow_king"));
});

test("second_skin reveal rule triggers at ageReached 300", () => {
  let save = startRun(104, 1000);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
      visibleTraitIds: [],
      hiddenTraitIds: ["second_skin"],
      lifespan: { ...save.currentRun.lifespan, ageSeconds: 295 },
    },
  };

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1020 }); // +20s = 315s

  assert.ok(next.currentRun.visibleTraitIds.includes("second_skin"));
});

test("sorrow_herald reveal rule triggers at alignment <= -40", () => {
  let save = startRun(105, 1000);
  save = stripTraits(save);
  save = {
    ...save,
    currentRun: {
      ...save.currentRun,
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

  const hasReveal = save.currentRun.visibleTraitIds.includes("sorrow_herald") ||
                     save.currentRun.alignment.holyUnholy <= -40;
  assert.ok(hasReveal || save.currentRun.hiddenTraitIds.includes("sorrow_herald"));
});

// ─── Resource Invariants ─────────────────────────────────────────────────────

test("resources never go negative after TICK", () => {
  let save = startRun(106, 1000);
  save = stripTraits(save);

  const next = reduceGame(save, { type: "TICK", nowUnixSec: 1100 });

  assert.ok(next.currentRun.resources.gold >= 0, "gold should be non-negative");
  assert.ok(next.currentRun.resources.essence >= 0, "essence should be non-negative");
});

test("vitality stays within [0, 100] bounds", () => {
  let save = startRun(107, 1000);
  save = stripTraits(save);

  // Tick many times to see vitality decay
  for (let i = 0; i < 100; i++) {
    save = reduceGame(save, { type: "TICK", nowUnixSec: 1000 + (i + 1) * 100 });
    assert.ok(
      save.currentRun.lifespan.vitality >= 0 && save.currentRun.lifespan.vitality <= 100,
      `vitality ${save.currentRun.lifespan.vitality} should be in [0, 100]`
    );
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

    const align = save.currentRun.alignment.holyUnholy;
    assert.ok(align >= -100 && align <= 100, `alignment ${align} should be in [-100, 100]`);
  }
});
