import type { Modifier, Tag } from "../core/types";

export interface TraitRevealRule {
  triggerEvent: "dungeonCompleted" | "alignmentThreshold" | "ageReached";
  value?: number;
  dungeonTag?: Tag;
}

export interface TraitDef {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  tags: Tag[];
  rarityWeight: number;
  revealMode: "visible" | "partial" | "hidden";
  modifiers: Modifier[];
  revealRules?: TraitRevealRule[];
}

export const TRAITS: TraitDef[] = [
  {
    id: "marked_by_light",
    name: "Marked by Light",
    description: "A divine brand sears your flesh. Holy shrines feel like home; dark places recoil.",
    flavorText: "The mark does not burn. It reminds.",
    tags: ["holy", "shrine"],
    rarityWeight: 10,
    revealMode: "visible",
    modifiers: [
      { stat: "holyAffinity", op: "add", value: 15, source: "marked_by_light" },
      { stat: "dungeonSuccessRate", op: "add", value: 0.1, source: "marked_by_light",
        condition: { type: "dungeonHasTag", tag: "shrine" } },
      { stat: "vitalityDecayRate", op: "mul", value: 1.2, source: "marked_by_light",
        condition: { type: "dungeonHasTag", tag: "abyss" } },
    ],
  },
  {
    id: "grave_touched",
    name: "Grave-Touched",
    description: "You crossed the threshold once and came back wrong. Death slows around you—but you slow too.",
    flavorText: "Cold hands. Warm memories.",
    tags: ["unholy", "decay"],
    rarityWeight: 10,
    revealMode: "visible",
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.75, source: "grave_touched" },
      { stat: "goldRate", op: "mul", value: 0.8, source: "grave_touched" },
      { stat: "unholyAffinity", op: "add", value: 10, source: "grave_touched" },
    ],
  },
  {
    id: "obsessive",
    name: "Obsessive",
    description: "When you find a purpose, you devour it. Essence flows freely—but one path crowds out others.",
    flavorText: "Singular. Dangerous. Effective.",
    tags: ["knowledge", "fate"],
    rarityWeight: 8,
    revealMode: "visible",
    modifiers: [
      { stat: "essenceRate", op: "mul", value: 1.5, source: "obsessive" },
      { stat: "talentCostMultiplier", op: "mul", value: 1.25, source: "obsessive" },
    ],
  },
  {
    id: "fated",
    name: "Fated",
    description: "The threads of fate know your name. Rare finds come naturally—but fate always collects its due.",
    flavorText: "You did not choose this path.",
    tags: ["fate", "relic"],
    rarityWeight: 6,
    revealMode: "partial",
    modifiers: [
      { stat: "legendaryDropRate", op: "add", value: 0.03, source: "fated" },
      { stat: "itemFindRate", op: "mul", value: 1.25, source: "fated" },
      { stat: "vitalityDecayRate", op: "mul", value: 1.1, source: "fated" },
    ],
    revealRules: [{ triggerEvent: "dungeonCompleted", dungeonTag: "relic" }],
  },
  {
    id: "frail_body",
    name: "Frail Body",
    description: "Your constitution was never strong. Every dungeon takes more from you than it should.",
    flavorText: "The spirit outpaces the flesh.",
    tags: ["decay", "vitality"],
    rarityWeight: 12,
    revealMode: "visible",
    modifiers: [
      { stat: "dungeonWearMultiplier", op: "mul", value: 1.4, source: "frail_body" },
      { stat: "survivability", op: "add", value: -5, source: "frail_body" },
    ],
  },
  {
    id: "lucid_mind",
    name: "Lucid Mind",
    description: "Your thoughts cut through fog. The Scribe's work comes naturally, and secrets unfold faster.",
    flavorText: "Clarity is its own kind of power.",
    tags: ["knowledge", "neutral"],
    rarityWeight: 10,
    revealMode: "visible",
    modifiers: [
      { stat: "essenceRate", op: "mul", value: 1.3, source: "lucid_mind" },
      { stat: "discoveryRate", op: "mul", value: 1.25, source: "lucid_mind" },
    ],
  },
  {
    id: "abyss_drawn",
    name: "Abyss-Drawn",
    description: "Something in the deep calls to you. You hear it. You answer. Every time.",
    flavorText: "Not darkness. Belonging.",
    tags: ["abyss", "unholy"],
    rarityWeight: 6,
    revealMode: "partial",
    modifiers: [
      { stat: "power", op: "add", value: 8, source: "abyss_drawn",
        condition: { type: "dungeonHasTag", tag: "abyss" } },
      { stat: "unholyAffinity", op: "add", value: 20, source: "abyss_drawn" },
      { stat: "alignmentDriftUnholy", op: "mul", value: 1.5, source: "abyss_drawn" },
    ],
    revealRules: [{ triggerEvent: "alignmentThreshold", value: -30 }],
  },
  {
    id: "consecrated_blood",
    name: "Consecrated Blood",
    description: "Your lineage was blessed—or cursed—by a holy order. Relics respond to your touch.",
    flavorText: "The old rites remember you.",
    tags: ["holy", "relic", "fate"],
    rarityWeight: 5,
    revealMode: "hidden",
    modifiers: [
      { stat: "holyAffinity", op: "add", value: 25, source: "consecrated_blood" },
      { stat: "itemFindRate", op: "mul", value: 1.3, source: "consecrated_blood",
        condition: { type: "dungeonHasTag", tag: "relic" } },
      { stat: "dungeonSuccessRate", op: "add", value: 0.15, source: "consecrated_blood",
        condition: { type: "alignmentAbove", axis: "holyUnholy", value: 30 } },
    ],
    revealRules: [{ triggerEvent: "ageReached", value: 300 }],
  },
];

export const TRAIT_REGISTRY = new Map<string, TraitDef>(
  TRAITS.map((t) => [t.id, t])
);
