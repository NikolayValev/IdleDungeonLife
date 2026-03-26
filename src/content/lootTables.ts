import { ITEMS } from "./items"

export interface LootTableEntry {
  itemId: string;
  weight: number;
  minRarity?: "common" | "rare" | "legendary";
}

export interface LootTable {
  id: string;
  entries: LootTableEntry[];
  /** Base number of items to roll */
  baseDropCount: number;
  /** Gold reward range */
  goldMin: number;
  goldMax: number;
  /** Essence reward range */
  essenceMin: number;
  essenceMax: number;
}

function itemsByRarity(rarity: "common" | "rare" | "legendary", weight: number): LootTableEntry[] {
  return ITEMS.filter((i) => i.rarity === rarity).map((i) => ({ itemId: i.id, weight }));
}

export const LOOT_TABLES: LootTable[] = [
  {
    id: "loot_chapel",
    entries: [
      ...itemsByRarity("common", 60),
      ...itemsByRarity("rare", 15),
      ...itemsByRarity("legendary", 2),
    ],
    baseDropCount: 1,
    goldMin: 8,
    goldMax: 18,
    essenceMin: 0,
    essenceMax: 3,
  },
  {
    id: "loot_grave",
    entries: [
      ...itemsByRarity("common", 50),
      ...itemsByRarity("rare", 22),
      ...itemsByRarity("legendary", 4),
    ],
    baseDropCount: 1,
    goldMin: 15,
    goldMax: 30,
    essenceMin: 1,
    essenceMax: 5,
  },
  {
    id: "loot_vault",
    entries: [
      ...itemsByRarity("common", 40),
      ...itemsByRarity("rare", 35),
      ...itemsByRarity("legendary", 8),
    ],
    baseDropCount: 1,
    goldMin: 30,
    goldMax: 55,
    essenceMin: 3,
    essenceMax: 10,
  },
  {
    id: "loot_abyss",
    entries: [
      ...itemsByRarity("common", 30),
      ...itemsByRarity("rare", 40),
      ...itemsByRarity("legendary", 12),
    ],
    baseDropCount: 2,
    goldMin: 55,
    goldMax: 100,
    essenceMin: 5,
    essenceMax: 18,
  },
  {
    id: "loot_boss",
    entries: [
      ...itemsByRarity("common", 10),
      ...itemsByRarity("rare", 30),
      ...itemsByRarity("legendary", 25),
    ],
    baseDropCount: 2,
    goldMin: 120,
    goldMax: 200,
    essenceMin: 15,
    essenceMax: 35,
  },
];

export const LOOT_TABLE_REGISTRY = new Map<string, LootTable>(
  LOOT_TABLES.map((l) => [l.id, l])
);
