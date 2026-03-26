import type { Modifier, Tag } from "../core/types";

export interface TalentNodeDef {
  id: string;
  name: string;
  description: string;
  tags: Tag[];
  costEssence: number;
  prerequisites: string[];
  modifiers: Modifier[];
  position: { x: number; y: number };
}

// Tree layout: 1 central spine (5 nodes), 2 branches (4+4 nodes) = 13 nodes total
// Sanctified/Vital branch (holy/vitality)
// Abyssal/Decaying branch (abyss/decay)

export const TALENTS: TalentNodeDef[] = [
  // ── Central Spine ─────────────────────────────────────────────────────────────
  {
    id: "spine_0_initiate",
    name: "Initiate's Resolve",
    description: "Steel yourself. Every run begins here.",
    tags: ["neutral"],
    costEssence: 5,
    prerequisites: [],
    modifiers: [
      { stat: "power", op: "add", value: 2, source: "spine_0_initiate" },
      { stat: "survivability", op: "add", value: 2, source: "spine_0_initiate" },
    ],
    position: { x: 2, y: 0 },
  },
  {
    id: "spine_1_focused",
    name: "Focused Effort",
    description: "Work harder. Earn faster.",
    tags: ["neutral", "wealth"],
    costEssence: 12,
    prerequisites: ["spine_0_initiate"],
    modifiers: [
      { stat: "jobOutputMultiplier", op: "mul", value: 1.2, source: "spine_1_focused" },
    ],
    position: { x: 2, y: 1 },
  },
  {
    id: "spine_2_seasoned",
    name: "Seasoned Survivor",
    description: "You've seen enough to last a bit longer.",
    tags: ["vitality", "neutral"],
    costEssence: 22,
    prerequisites: ["spine_1_focused"],
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.85, source: "spine_2_seasoned" },
      { stat: "survivability", op: "add", value: 5, source: "spine_2_seasoned" },
    ],
    position: { x: 2, y: 2 },
  },
  {
    id: "spine_3_veteran",
    name: "Veteran's Edge",
    description: "Dungeon delving becomes second nature.",
    tags: ["neutral"],
    costEssence: 35,
    prerequisites: ["spine_2_seasoned"],
    modifiers: [
      { stat: "dungeonSuccessRate", op: "add", value: 0.1, source: "spine_3_veteran" },
      { stat: "power", op: "add", value: 5, source: "spine_3_veteran" },
    ],
    position: { x: 2, y: 3 },
  },
  {
    id: "spine_4_apex",
    name: "Apex Delver",
    description: "At the peak of your arc. Push further than any before.",
    tags: ["fate"],
    costEssence: 55,
    prerequisites: ["spine_3_veteran"],
    modifiers: [
      { stat: "power", op: "add", value: 8, source: "spine_4_apex" },
      { stat: "dungeonSuccessRate", op: "add", value: 0.12, source: "spine_4_apex" },
      { stat: "legendaryDropRate", op: "add", value: 0.02, source: "spine_4_apex" },
    ],
    position: { x: 2, y: 4 },
  },
  // ── Sanctified Branch (left, holy/vitality) ───────────────────────────────────
  {
    id: "holy_1_light",
    name: "Inner Light",
    description: "Holy alignment flows into constitution.",
    tags: ["holy", "vitality"],
    costEssence: 18,
    prerequisites: ["spine_1_focused"],
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.9, source: "holy_1_light" },
      { stat: "holyAffinity", op: "add", value: 10, source: "holy_1_light" },
    ],
    position: { x: 0, y: 1 },
  },
  {
    id: "holy_2_blessing",
    name: "Shrine Blessing",
    description: "Shrines bend in your favor.",
    tags: ["holy", "shrine"],
    costEssence: 30,
    prerequisites: ["holy_1_light"],
    modifiers: [
      { stat: "dungeonSuccessRate", op: "add", value: 0.12, source: "holy_2_blessing",
        condition: { type: "dungeonHasTag", tag: "shrine" } },
      { stat: "vitalityDecayRate", op: "mul", value: 0.85, source: "holy_2_blessing",
        condition: { type: "dungeonHasTag", tag: "shrine" } },
    ],
    position: { x: 0, y: 2 },
  },
  {
    id: "holy_3_consecration",
    name: "Full Consecration",
    description: "Your blood is blessed now. You will age gracefully.",
    tags: ["holy", "vitality", "fate"],
    costEssence: 48,
    prerequisites: ["holy_2_blessing"],
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.7, source: "holy_3_consecration" },
      { stat: "alignmentDriftHoly", op: "mul", value: 1.5, source: "holy_3_consecration" },
    ],
    position: { x: 0, y: 3 },
  },
  {
    id: "holy_4_divine",
    name: "Divine Vessel",
    description: "Your vitality is almost unnatural now. Boss encounters carry less weight.",
    tags: ["holy", "boss", "fate"],
    costEssence: 70,
    prerequisites: ["holy_3_consecration"],
    modifiers: [
      { stat: "bossWearMultiplier", op: "mul", value: 0.65, source: "holy_4_divine" },
      { stat: "survivability", op: "add", value: 10, source: "holy_4_divine" },
    ],
    position: { x: 0, y: 4 },
  },
  // ── Abyssal Branch (right, abyss/decay) ────────────────────────────────────────
  {
    id: "abyss_1_hunger",
    name: "Hollow Hunger",
    description: "Feed on the darkness to strengthen your strikes.",
    tags: ["abyss", "unholy"],
    costEssence: 18,
    prerequisites: ["spine_1_focused"],
    modifiers: [
      { stat: "power", op: "add", value: 6, source: "abyss_1_hunger" },
      { stat: "unholyAffinity", op: "add", value: 8, source: "abyss_1_hunger" },
    ],
    position: { x: 4, y: 1 },
  },
  {
    id: "abyss_2_corruption",
    name: "Willing Corruption",
    description: "Trade years for power. The abyss takes; you take more.",
    tags: ["abyss", "decay"],
    costEssence: 30,
    prerequisites: ["abyss_1_hunger"],
    modifiers: [
      { stat: "power", op: "add", value: 10, source: "abyss_2_corruption" },
      { stat: "vitalityDecayRate", op: "mul", value: 1.2, source: "abyss_2_corruption" },
    ],
    position: { x: 4, y: 2 },
  },
  {
    id: "abyss_3_pact",
    name: "Abyssal Pact",
    description: "The stair knows you. Legendary drops surge in the deep.",
    tags: ["abyss", "fate", "relic"],
    costEssence: 48,
    prerequisites: ["abyss_2_corruption"],
    modifiers: [
      { stat: "legendaryDropRate", op: "add", value: 0.05, source: "abyss_3_pact",
        condition: { type: "dungeonHasTag", tag: "abyss" } },
      { stat: "itemFindRate", op: "mul", value: 1.3, source: "abyss_3_pact" },
    ],
    position: { x: 4, y: 3 },
  },
  {
    id: "abyss_4_consumed",
    name: "Consumed",
    description: "You are barely here. The abyss fights through you. The cost is everything.",
    tags: ["abyss", "decay", "boss"],
    costEssence: 70,
    prerequisites: ["abyss_3_pact"],
    modifiers: [
      { stat: "power", op: "add", value: 18, source: "abyss_4_consumed" },
      { stat: "dungeonSuccessRate", op: "add", value: 0.15, source: "abyss_4_consumed",
        condition: { type: "dungeonHasTag", tag: "abyss" } },
      { stat: "vitalityDecayRate", op: "mul", value: 1.35, source: "abyss_4_consumed" },
    ],
    position: { x: 4, y: 4 },
  },
];

export const TALENT_REGISTRY = new Map<string, TalentNodeDef>(
  TALENTS.map((t) => [t.id, t])
);
