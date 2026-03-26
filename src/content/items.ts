import type { Modifier, Tag } from "../core/types";

export interface ItemDef {
  id: string;
  name: string;
  slot: "weapon" | "armor" | "artifact";
  rarity: "common" | "rare" | "legendary";
  tags: Tag[];
  baseModifiers: Modifier[];
  flavorText?: string;
}

export const ITEMS: ItemDef[] = [
  // ── Common Weapons ──────────────────────────────────────────────────────────
  {
    id: "rusted_blade",
    name: "Rusted Blade",
    slot: "weapon",
    rarity: "common",
    tags: ["neutral"],
    baseModifiers: [{ stat: "power", op: "add", value: 4, source: "rusted_blade" }],
    flavorText: "Dull but present.",
  },
  {
    id: "chapel_mace",
    name: "Chapel Mace",
    slot: "weapon",
    rarity: "common",
    tags: ["holy"],
    baseModifiers: [
      { stat: "power", op: "add", value: 5, source: "chapel_mace" },
      { stat: "holyAffinity", op: "add", value: 5, source: "chapel_mace" },
    ],
    flavorText: "Blessed once. Believed in twice.",
  },
  {
    id: "grave_dagger",
    name: "Grave Dagger",
    slot: "weapon",
    rarity: "common",
    tags: ["unholy", "decay"],
    baseModifiers: [
      { stat: "power", op: "add", value: 6, source: "grave_dagger" },
      { stat: "vitalityDecayRate", op: "mul", value: 1.05, source: "grave_dagger" },
    ],
    flavorText: "It smells of old earth.",
  },
  {
    id: "scavenger_pick",
    name: "Scavenger's Pick",
    slot: "weapon",
    rarity: "common",
    tags: ["neutral", "relic"],
    baseModifiers: [
      { stat: "power", op: "add", value: 3, source: "scavenger_pick" },
      { stat: "itemFindRate", op: "mul", value: 1.1, source: "scavenger_pick" },
    ],
    flavorText: "Scratched and reliable.",
  },
  // ── Rare Weapons ────────────────────────────────────────────────────────────
  {
    id: "shard_of_prelate",
    name: "Shard of the Prelate",
    slot: "weapon",
    rarity: "rare",
    tags: ["holy", "fate"],
    baseModifiers: [
      { stat: "power", op: "add", value: 12, source: "shard_of_prelate" },
      { stat: "dungeonSuccessRate", op: "add", value: 0.08, source: "shard_of_prelate",
        condition: { type: "dungeonHasTag", tag: "holy" } },
    ],
    flavorText: "A fragment of something that should not be fragmented.",
  },
  {
    id: "abyss_brand",
    name: "Abyss Brand",
    slot: "weapon",
    rarity: "rare",
    tags: ["abyss", "unholy"],
    baseModifiers: [
      { stat: "power", op: "add", value: 14, source: "abyss_brand" },
      { stat: "unholyAffinity", op: "add", value: 10, source: "abyss_brand" },
      { stat: "dungeonWearMultiplier", op: "mul", value: 1.1, source: "abyss_brand" },
    ],
    flavorText: "The hilt is warm. It should not be warm.",
  },
  // ── Legendary Weapons ────────────────────────────────────────────────────────
  {
    id: "relic_sovereign",
    name: "Relic Sovereign",
    slot: "weapon",
    rarity: "legendary",
    tags: ["relic", "fate", "holy"],
    baseModifiers: [
      { stat: "power", op: "add", value: 22, source: "relic_sovereign" },
      { stat: "legendaryDropRate", op: "add", value: 0.04, source: "relic_sovereign" },
      { stat: "holyAffinity", op: "add", value: 15, source: "relic_sovereign" },
    ],
    flavorText: "It passed through seven hands before yours. Each one died rich.",
  },
  // ── Common Armor ────────────────────────────────────────────────────────────
  {
    id: "worn_leathers",
    name: "Worn Leathers",
    slot: "armor",
    rarity: "common",
    tags: ["neutral"],
    baseModifiers: [{ stat: "survivability", op: "add", value: 4, source: "worn_leathers" }],
    flavorText: "Cracked but covering.",
  },
  {
    id: "pilgrim_vestments",
    name: "Pilgrim Vestments",
    slot: "armor",
    rarity: "common",
    tags: ["holy", "shrine"],
    baseModifiers: [
      { stat: "survivability", op: "add", value: 5, source: "pilgrim_vestments" },
      { stat: "vitalityDecayRate", op: "mul", value: 0.95, source: "pilgrim_vestments" },
    ],
    flavorText: "Sewn by hands that believed something.",
  },
  {
    id: "scavenger_coat",
    name: "Scavenger's Coat",
    slot: "armor",
    rarity: "common",
    tags: ["neutral", "wealth"],
    baseModifiers: [
      { stat: "survivability", op: "add", value: 3, source: "scavenger_coat" },
      { stat: "goldRate", op: "mul", value: 1.08, source: "scavenger_coat" },
    ],
    flavorText: "Every pocket has something in it.",
  },
  {
    id: "grave_shroud",
    name: "Grave Shroud",
    slot: "armor",
    rarity: "common",
    tags: ["unholy", "decay"],
    baseModifiers: [
      { stat: "survivability", op: "add", value: 6, source: "grave_shroud" },
      { stat: "unholyAffinity", op: "add", value: 8, source: "grave_shroud" },
    ],
    flavorText: "Technically a burial garment.",
  },
  // ── Rare Armor ───────────────────────────────────────────────────────────────
  {
    id: "vault_plate",
    name: "Vault Plate",
    slot: "armor",
    rarity: "rare",
    tags: ["relic", "knowledge"],
    baseModifiers: [
      { stat: "survivability", op: "add", value: 12, source: "vault_plate" },
      { stat: "dungeonSuccessRate", op: "add", value: 0.06, source: "vault_plate" },
    ],
    flavorText: "Forged for archivists who expected violence.",
  },
  {
    id: "abyss_carapace",
    name: "Abyss Carapace",
    slot: "armor",
    rarity: "rare",
    tags: ["abyss", "unholy"],
    baseModifiers: [
      { stat: "survivability", op: "add", value: 14, source: "abyss_carapace" },
      { stat: "bossWearMultiplier", op: "mul", value: 0.8, source: "abyss_carapace" },
    ],
    flavorText: "Something that lived in the deep shed this.",
  },
  // ── Legendary Armor ──────────────────────────────────────────────────────────
  {
    id: "prelate_raiment",
    name: "Prelate's Raiment",
    slot: "armor",
    rarity: "legendary",
    tags: ["holy", "fate", "boss"],
    baseModifiers: [
      { stat: "survivability", op: "add", value: 25, source: "prelate_raiment" },
      { stat: "vitalityDecayRate", op: "mul", value: 0.7, source: "prelate_raiment" },
      { stat: "holyAffinity", op: "add", value: 20, source: "prelate_raiment" },
    ],
    flavorText: "Still warm from its last wearer.",
  },
  // ── Common Artifacts ─────────────────────────────────────────────────────────
  {
    id: "cracked_amulet",
    name: "Cracked Amulet",
    slot: "artifact",
    rarity: "common",
    tags: ["neutral"],
    baseModifiers: [{ stat: "essenceRate", op: "add", value: 0.05, source: "cracked_amulet" }],
    flavorText: "Still gives off a faint hum.",
  },
  {
    id: "chapel_token",
    name: "Chapel Token",
    slot: "artifact",
    rarity: "common",
    tags: ["holy", "shrine"],
    baseModifiers: [
      { stat: "alignmentDriftHoly", op: "mul", value: 1.3, source: "chapel_token" },
      { stat: "goldRate", op: "mul", value: 1.05, source: "chapel_token" },
    ],
    flavorText: "Given to faithful pilgrims at the door.",
  },
  {
    id: "hollow_bone",
    name: "Hollow Bone",
    slot: "artifact",
    rarity: "common",
    tags: ["unholy", "decay"],
    baseModifiers: [
      { stat: "unholyAffinity", op: "add", value: 5, source: "hollow_bone" },
      { stat: "vitalityDecayRate", op: "mul", value: 0.9, source: "hollow_bone" },
    ],
    flavorText: "Bleached, light, quiet.",
  },
  // ── Rare Artifacts ───────────────────────────────────────────────────────────
  {
    id: "scribe_lens",
    name: "Scribe's Lens",
    slot: "artifact",
    rarity: "rare",
    tags: ["knowledge", "relic"],
    baseModifiers: [
      { stat: "essenceRate", op: "mul", value: 1.4, source: "scribe_lens" },
      { stat: "discoveryRate", op: "mul", value: 1.3, source: "scribe_lens" },
    ],
    flavorText: "Everything seen through it is annotated in the margins of your mind.",
  },
  {
    id: "fate_coin",
    name: "Fate Coin",
    slot: "artifact",
    rarity: "rare",
    tags: ["fate", "wealth"],
    baseModifiers: [
      { stat: "goldRate", op: "mul", value: 1.25, source: "fate_coin" },
      { stat: "legendaryDropRate", op: "add", value: 0.02, source: "fate_coin" },
    ],
    flavorText: "Both sides are heads. Neither is luck.",
  },
  // ── Legendary Artifact ───────────────────────────────────────────────────────
  {
    id: "the_last_seal",
    name: "The Last Seal",
    slot: "artifact",
    rarity: "legendary",
    tags: ["fate", "abyss", "boss"],
    baseModifiers: [
      { stat: "power", op: "add", value: 10, source: "the_last_seal" },
      { stat: "survivability", op: "add", value: 10, source: "the_last_seal" },
      { stat: "dungeonSuccessRate", op: "add", value: 0.12, source: "the_last_seal",
        condition: { type: "dungeonHasTag", tag: "boss" } },
      { stat: "vitalityDecayRate", op: "mul", value: 1.15, source: "the_last_seal" },
    ],
    flavorText: "Whatever it sealed is still sealed. Probably.",
  },
  // ── Extra commons for variety ─────────────────────────────────────────────────
  {
    id: "iron_talisman",
    name: "Iron Talisman",
    slot: "artifact",
    rarity: "common",
    tags: ["neutral", "vitality"],
    baseModifiers: [
      { stat: "dungeonWearMultiplier", op: "mul", value: 0.9, source: "iron_talisman" },
    ],
    flavorText: "Plain. Heavy. Effective.",
  },
  {
    id: "bone_axe",
    name: "Bone Axe",
    slot: "weapon",
    rarity: "common",
    tags: ["unholy"],
    baseModifiers: [
      { stat: "power", op: "add", value: 5, source: "bone_axe" },
    ],
    flavorText: "Unclear whose bones.",
  },
  {
    id: "ash_cloak",
    name: "Ash Cloak",
    slot: "armor",
    rarity: "common",
    tags: ["neutral", "decay"],
    baseModifiers: [
      { stat: "survivability", op: "add", value: 3, source: "ash_cloak" },
      { stat: "essenceRate", op: "add", value: 0.04, source: "ash_cloak" },
    ],
    flavorText: "It smells like the end of something.",
  },
];

export const ITEM_REGISTRY = new Map<string, ItemDef>(
  ITEMS.map((i) => [i.id, i])
);
