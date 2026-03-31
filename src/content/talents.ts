import { BALANCE } from "./balance";
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

const cost = <T extends keyof typeof BALANCE.talentCosts>(id: T) => BALANCE.talentCosts[id];
const talent = (definition: TalentNodeDef): TalentNodeDef => definition;

export const TALENTS: TalentNodeDef[] = [
  talent({
    id: "spine_0_initiate",
    name: "Initiate's Resolve",
    description: "The first discipline. Small gains everywhere.",
    tags: ["neutral"],
    costEssence: cost("spine_0_initiate"),
    prerequisites: [],
    modifiers: [
      { stat: "power", op: "add", value: 2, source: "spine_0_initiate" },
      { stat: "survivability", op: "add", value: 2, source: "spine_0_initiate" },
    ],
    position: { x: 2, y: 0 },
  }),
  talent({
    id: "spine_1_focused",
    name: "Focused Effort",
    description: "Work faster. Build momentum sooner.",
    tags: ["neutral", "wealth"],
    costEssence: cost("spine_1_focused"),
    prerequisites: ["spine_0_initiate"],
    modifiers: [
      { stat: "jobOutputMultiplier", op: "mul", value: 1.18, source: "spine_1_focused" },
    ],
    position: { x: 2, y: 1 },
  }),
  talent({
    id: "spine_2_seasoned",
    name: "Seasoned Survivor",
    description: "Slow the baseline burn and toughen up.",
    tags: ["vitality", "neutral"],
    costEssence: cost("spine_2_seasoned"),
    prerequisites: ["spine_1_focused"],
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.88, source: "spine_2_seasoned" },
      { stat: "survivability", op: "add", value: 4, source: "spine_2_seasoned" },
    ],
    position: { x: 2, y: 2 },
  }),
  talent({
    id: "spine_3_veteran",
    name: "Veteran's Edge",
    description: "Dungeon work becomes practiced instead of desperate.",
    tags: ["neutral"],
    costEssence: cost("spine_3_veteran"),
    prerequisites: ["spine_2_seasoned"],
    modifiers: [
      { stat: "dungeonSuccessRate", op: "add", value: 0.08, source: "spine_3_veteran" },
      { stat: "power", op: "add", value: 4, source: "spine_3_veteran" },
    ],
    position: { x: 2, y: 3 },
  }),
  talent({
    id: "spine_4_crossroads",
    name: "Crossroads Method",
    description: "Turn depth into options instead of a straight line.",
    tags: ["knowledge", "fate"],
    costEssence: cost("spine_4_crossroads"),
    prerequisites: ["spine_3_veteran"],
    modifiers: [
      { stat: "essenceRate", op: "mul", value: 1.18, source: "spine_4_crossroads" },
      { stat: "discoveryRate", op: "mul", value: 1.1, source: "spine_4_crossroads" },
    ],
    position: { x: 2, y: 4 },
  }),
  talent({
    id: "spine_5_apex",
    name: "Apex Delver",
    description: "A late capstone that rewards a split doctrine.",
    tags: ["fate", "boss"],
    costEssence: cost("spine_5_apex"),
    prerequisites: ["spine_4_crossroads", "holy_3_sanctuary", "abyss_3_pact"],
    modifiers: [
      { stat: "power", op: "add", value: 8, source: "spine_5_apex" },
      { stat: "dungeonSuccessRate", op: "add", value: 0.12, source: "spine_5_apex" },
      { stat: "legendaryDropRate", op: "add", value: 0.02, source: "spine_5_apex" },
    ],
    position: { x: 2, y: 5 },
  }),
  talent({
    id: "holy_1_light",
    name: "Inner Light",
    description: "A modest holy drift and cleaner vitality curve.",
    tags: ["holy", "vitality"],
    costEssence: cost("holy_1_light"),
    prerequisites: ["spine_1_focused"],
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.92, source: "holy_1_light" },
      { stat: "holyAffinity", op: "add", value: 8, source: "holy_1_light" },
      { stat: "alignmentDriftHoly", op: "mul", value: 1.18, source: "holy_1_light" },
    ],
    position: { x: 0, y: 1 },
  }),
  talent({
    id: "holy_2_ministry",
    name: "Field Ministry",
    description: "Holy labor pays better when your gear and choices support it.",
    tags: ["holy", "wealth"],
    costEssence: cost("holy_2_ministry"),
    prerequisites: ["holy_1_light", "spine_2_seasoned"],
    modifiers: [
      { stat: "jobOutputMultiplier", op: "mul", value: 1.15, source: "holy_2_ministry" },
      {
        stat: "goldRate",
        op: "mul",
        value: 1.1,
        source: "holy_2_ministry",
        condition: { type: "alignmentAbove", axis: "holyUnholy", value: 15 },
      },
    ],
    position: { x: 0, y: 2 },
  }),
  talent({
    id: "holy_3_sanctuary",
    name: "Sanctuary Doctrine",
    description: "Holy and shrine delves become meaningfully safer.",
    tags: ["holy", "shrine"],
    costEssence: cost("holy_3_sanctuary"),
    prerequisites: ["holy_2_ministry"],
    modifiers: [
      {
        stat: "dungeonSuccessRate",
        op: "add",
        value: 0.12,
        source: "holy_3_sanctuary",
        condition: { type: "dungeonHasTag", tag: "holy" },
      },
      {
        stat: "dungeonWearMultiplier",
        op: "mul",
        value: 0.9,
        source: "holy_3_sanctuary",
        condition: { type: "dungeonHasTag", tag: "shrine" },
      },
    ],
    position: { x: 0, y: 3 },
  }),
  talent({
    id: "holy_4_tithe",
    name: "Tithe Engine",
    description: "Trade certainty for holy throughput.",
    tags: ["holy", "wealth", "relic"],
    costEssence: cost("holy_4_tithe"),
    prerequisites: ["holy_2_ministry", "abyss_1_hunger"],
    modifiers: [
      { stat: "jobOutputMultiplier", op: "mul", value: 1.1, source: "holy_4_tithe" },
      {
        stat: "itemFindRate",
        op: "mul",
        value: 1.12,
        source: "holy_4_tithe",
        condition: { type: "alignmentAbove", axis: "holyUnholy", value: 20 },
      },
    ],
    position: { x: 0, y: 4 },
  }),
  talent({
    id: "holy_5_consecration",
    name: "Full Consecration",
    description: "Deep holy commitment extends your usable lifespan.",
    tags: ["holy", "vitality", "fate"],
    costEssence: cost("holy_5_consecration"),
    prerequisites: ["holy_3_sanctuary", "spine_4_crossroads"],
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.72, source: "holy_5_consecration" },
      { stat: "alignmentDriftHoly", op: "mul", value: 1.5, source: "holy_5_consecration" },
    ],
    position: { x: 0, y: 5 },
  }),
  talent({
    id: "holy_6_reliquary",
    name: "Reliquary Command",
    description: "Holy relic specialization with a hybrid prerequisite.",
    tags: ["holy", "relic", "boss"],
    costEssence: cost("holy_6_reliquary"),
    prerequisites: ["holy_4_tithe", "abyss_2_corruption"],
    modifiers: [
      {
        stat: "legendaryDropRate",
        op: "add",
        value: 0.04,
        source: "holy_6_reliquary",
        condition: { type: "dungeonHasTag", tag: "relic" },
      },
      {
        stat: "bossWearMultiplier",
        op: "mul",
        value: 0.8,
        source: "holy_6_reliquary",
        condition: { type: "dungeonHasTag", tag: "boss" },
      },
    ],
    position: { x: 0, y: 6 },
  }),
  talent({
    id: "holy_7_transfiguration",
    name: "Transfiguration",
    description: "A late holy capstone that still demands abyssal literacy.",
    tags: ["holy", "boss", "fate"],
    costEssence: cost("holy_7_transfiguration"),
    prerequisites: ["holy_5_consecration", "holy_6_reliquary", "abyss_3_pact"],
    modifiers: [
      { stat: "survivability", op: "add", value: 10, source: "holy_7_transfiguration" },
      { stat: "bossWearMultiplier", op: "mul", value: 0.65, source: "holy_7_transfiguration" },
      { stat: "jobOutputMultiplier", op: "mul", value: 0.95, source: "holy_7_transfiguration" },
    ],
    position: { x: 0, y: 7 },
  }),
  talent({
    id: "abyss_1_hunger",
    name: "Hollow Hunger",
    description: "Abyssal strength comes online early and stays expensive.",
    tags: ["abyss", "unholy"],
    costEssence: cost("abyss_1_hunger"),
    prerequisites: ["spine_1_focused"],
    modifiers: [
      { stat: "power", op: "add", value: 6, source: "abyss_1_hunger" },
      { stat: "unholyAffinity", op: "add", value: 8, source: "abyss_1_hunger" },
    ],
    position: { x: 4, y: 1 },
  }),
  talent({
    id: "abyss_2_corruption",
    name: "Willing Corruption",
    description: "Convert lifespan into immediate force.",
    tags: ["abyss", "decay"],
    costEssence: cost("abyss_2_corruption"),
    prerequisites: ["abyss_1_hunger", "spine_2_seasoned"],
    modifiers: [
      { stat: "power", op: "add", value: 8, source: "abyss_2_corruption" },
      { stat: "vitalityDecayRate", op: "mul", value: 1.15, source: "abyss_2_corruption" },
    ],
    position: { x: 4, y: 2 },
  }),
  talent({
    id: "abyss_3_pact",
    name: "Abyssal Pact",
    description: "Abyss-focused loot and drop scaling begin here.",
    tags: ["abyss", "fate", "relic"],
    costEssence: cost("abyss_3_pact"),
    prerequisites: ["abyss_2_corruption"],
    modifiers: [
      {
        stat: "legendaryDropRate",
        op: "add",
        value: 0.04,
        source: "abyss_3_pact",
        condition: { type: "dungeonHasTag", tag: "abyss" },
      },
      { stat: "itemFindRate", op: "mul", value: 1.18, source: "abyss_3_pact" },
    ],
    position: { x: 4, y: 3 },
  }),
  talent({
    id: "abyss_4_black_ledger",
    name: "Black Ledger",
    description: "Unholy enterprise. Strong work output if you drift dark enough.",
    tags: ["wealth", "unholy"],
    costEssence: cost("abyss_4_black_ledger"),
    prerequisites: ["abyss_2_corruption", "holy_1_light"],
    modifiers: [
      { stat: "jobOutputMultiplier", op: "mul", value: 1.14, source: "abyss_4_black_ledger" },
      {
        stat: "goldRate",
        op: "mul",
        value: 1.12,
        source: "abyss_4_black_ledger",
        condition: { type: "alignmentBelow", axis: "holyUnholy", value: -15 },
      },
    ],
    position: { x: 4, y: 4 },
  }),
  talent({
    id: "abyss_5_gravecraft",
    name: "Gravecraft",
    description: "Decay and abyss delves lean hard in your favor.",
    tags: ["abyss", "decay", "boss"],
    costEssence: cost("abyss_5_gravecraft"),
    prerequisites: ["abyss_3_pact", "spine_4_crossroads"],
    modifiers: [
      {
        stat: "dungeonSuccessRate",
        op: "add",
        value: 0.14,
        source: "abyss_5_gravecraft",
        condition: { type: "dungeonHasTag", tag: "decay" },
      },
      {
        stat: "dungeonWearMultiplier",
        op: "mul",
        value: 0.88,
        source: "abyss_5_gravecraft",
        condition: { type: "dungeonHasTag", tag: "abyss" },
      },
    ],
    position: { x: 4, y: 5 },
  }),
  talent({
    id: "abyss_6_marrow_engine",
    name: "Marrow Engine",
    description: "A late hybrid node for terminal-stage and decline-stage builds.",
    tags: ["vitality", "decay", "unholy"],
    costEssence: cost("abyss_6_marrow_engine"),
    prerequisites: ["abyss_4_black_ledger", "holy_2_ministry"],
    modifiers: [
      {
        stat: "vitalityDecayRate",
        op: "mul",
        value: 0.82,
        source: "abyss_6_marrow_engine",
        condition: { type: "biologicalStageIs", stage: "terminal" },
      },
      {
        stat: "power",
        op: "add",
        value: 12,
        source: "abyss_6_marrow_engine",
        condition: { type: "biologicalStageIs", stage: "decline" },
      },
      { stat: "alignmentDriftUnholy", op: "mul", value: 1.4, source: "abyss_6_marrow_engine" },
    ],
    position: { x: 4, y: 6 },
  }),
  talent({
    id: "abyss_7_consumed",
    name: "Consumed",
    description: "The deepest abyssal capstone. Strong, risky, and not purely linear.",
    tags: ["abyss", "decay", "boss"],
    costEssence: cost("abyss_7_consumed"),
    prerequisites: ["abyss_5_gravecraft", "abyss_6_marrow_engine", "holy_3_sanctuary"],
    modifiers: [
      { stat: "power", op: "add", value: 16, source: "abyss_7_consumed" },
      {
        stat: "dungeonSuccessRate",
        op: "add",
        value: 0.16,
        source: "abyss_7_consumed",
        condition: { type: "dungeonHasTag", tag: "abyss" },
      },
      { stat: "vitalityDecayRate", op: "mul", value: 1.2, source: "abyss_7_consumed" },
    ],
    position: { x: 4, y: 7 },
  }),
];

export const TALENT_REGISTRY = new Map<string, TalentNodeDef>(
  TALENTS.map((talentNode) => [talentNode.id, talentNode])
);
