import type { Tag, UnlockRequirement } from "../core/types";

export interface DungeonDef {
  id: string;
  name: string;
  tags: Tag[];
  /** 0-based index for depth tracking */
  depthIndex: number;
  unlockRequirement?: UnlockRequirement;
  goldCost: number;
  durationSec: number;
  difficulty: number;
  vitalityWear: number;
  lootTableId: string;
  alignmentShiftHolyUnholy?: number;
  flavorText?: string;
}

export const DUNGEONS: DungeonDef[] = [
  {
    id: "abandoned_chapel",
    name: "Abandoned Chapel",
    tags: ["holy", "shrine", "neutral"],
    depthIndex: 0,
    goldCost: 10,
    durationSec: 60,
    difficulty: 12,
    vitalityWear: 3,
    lootTableId: "loot_chapel",
    alignmentShiftHolyUnholy: 5,
    flavorText: "Dust-choked pews, a broken altar. Something still prays here.",
  },
  {
    id: "grave_hollow",
    name: "Grave Hollow",
    tags: ["unholy", "decay"],
    depthIndex: 1,
    unlockRequirement: { legacyAsh: 5 },
    goldCost: 20,
    durationSec: 90,
    difficulty: 18,
    vitalityWear: 5,
    lootTableId: "loot_grave",
    alignmentShiftHolyUnholy: -8,
    flavorText: "The dead don't rest here. They wait.",
  },
  {
    id: "relic_vault",
    name: "Relic Vault",
    tags: ["relic", "knowledge"],
    depthIndex: 2,
    unlockRequirement: { legacyAsh: 15 },
    goldCost: 40,
    durationSec: 120,
    difficulty: 26,
    vitalityWear: 6,
    lootTableId: "loot_vault",
    flavorText: "Sealed for a century. Whatever was worth sealing is still inside.",
  },
  {
    id: "abyss_stair",
    name: "Abyss Stair",
    tags: ["abyss", "unholy"],
    depthIndex: 3,
    unlockRequirement: { legacyAsh: 30 },
    goldCost: 75,
    durationSec: 180,
    difficulty: 38,
    vitalityWear: 10,
    lootTableId: "loot_abyss",
    alignmentShiftHolyUnholy: -15,
    flavorText: "Each step down is a year off your life. Some think it's worth it.",
  },
  {
    id: "the_silent_prelate",
    name: "The Silent Prelate",
    tags: ["boss", "holy", "fate"],
    depthIndex: 4,
    unlockRequirement: { legacyAsh: 50 },
    goldCost: 150,
    durationSec: 300,
    difficulty: 60,
    vitalityWear: 20,
    lootTableId: "loot_boss",
    flavorText: "It has not spoken in three hundred years. It will not speak to you either.",
  },
];

export const DUNGEON_REGISTRY = new Map<string, DungeonDef>(
  DUNGEONS.map((d) => [d.id, d])
);
