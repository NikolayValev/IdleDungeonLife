import { BALANCE } from "./balance";
import type { Tag, UnlockRequirement } from "../core/types";

export interface DungeonDef {
  id: string;
  name: string;
  tags: Tag[];
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

const tuned = <T extends keyof typeof BALANCE.dungeonTuning>(id: T) => BALANCE.dungeonTuning[id];

export const DUNGEONS: DungeonDef[] = [
  {
    id: "abandoned_chapel",
    name: "Abandoned Chapel",
    tags: ["holy", "shrine", "neutral"],
    depthIndex: 0,
    ...tuned("abandoned_chapel"),
    lootTableId: "loot_chapel",
    alignmentShiftHolyUnholy: 5,
    flavorText: "Dust-choked pews, a broken altar. Something still prays here.",
  },
  {
    id: "grave_hollow",
    name: "Grave Hollow",
    tags: ["unholy", "decay"],
    depthIndex: 1,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.grave_hollow },
    ...tuned("grave_hollow"),
    lootTableId: "loot_grave",
    alignmentShiftHolyUnholy: -8,
    flavorText: "The dead do not rest here. They wait.",
  },
  {
    id: "sunken_archive",
    name: "Sunken Archive",
    tags: ["knowledge", "relic"],
    depthIndex: 2,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.sunken_archive },
    ...tuned("sunken_archive"),
    lootTableId: "loot_archive",
    flavorText: "Ink-black water laps at catalog shelves that were never meant to drown.",
  },
  {
    id: "gilded_warehouse",
    name: "Gilded Warehouse",
    tags: ["wealth", "relic", "fate"],
    depthIndex: 3,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.gilded_warehouse },
    ...tuned("gilded_warehouse"),
    lootTableId: "loot_gilded",
    alignmentShiftHolyUnholy: -4,
    flavorText: "The ledgers are gone. The traps and tribute chests remain.",
  },
  {
    id: "verdant_ossuary",
    name: "Verdant Ossuary",
    tags: ["vitality", "decay"],
    depthIndex: 4,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.verdant_ossuary },
    ...tuned("verdant_ossuary"),
    lootTableId: "loot_ossuary",
    flavorText: "Roots thread through old bones and pulse when you step too close.",
  },
  {
    id: "relic_vault",
    name: "Relic Vault",
    tags: ["relic", "knowledge", "fate"],
    depthIndex: 5,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.relic_vault },
    ...tuned("relic_vault"),
    lootTableId: "loot_vault",
    flavorText: "Sealed for a century. Whatever was worth sealing is still inside.",
  },
  {
    id: "molting_god_pit",
    name: "Molting God Pit",
    tags: ["abyss", "decay", "vitality"],
    depthIndex: 6,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.molting_god_pit },
    ...tuned("molting_god_pit"),
    lootTableId: "loot_molting",
    alignmentShiftHolyUnholy: -10,
    flavorText: "The floor sheds. So will you.",
  },
  {
    id: "abyss_stair",
    name: "Abyss Stair",
    tags: ["abyss", "unholy", "fate"],
    depthIndex: 7,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.abyss_stair },
    ...tuned("abyss_stair"),
    lootTableId: "loot_abyss",
    alignmentShiftHolyUnholy: -15,
    flavorText: "Each step down is a year off your life. Some think it is worth it.",
  },
  {
    id: "the_silent_prelate",
    name: "The Silent Prelate",
    tags: ["boss", "holy", "fate", "shrine"],
    depthIndex: 8,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.the_silent_prelate },
    ...tuned("the_silent_prelate"),
    lootTableId: "loot_prelate",
    alignmentShiftHolyUnholy: 12,
    flavorText: "It has not spoken in three hundred years. It will not speak to you either.",
  },
  {
    id: "the_eclipsed_saint",
    name: "The Eclipsed Saint",
    tags: ["boss", "abyss", "holy", "unholy"],
    depthIndex: 9,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.the_eclipsed_saint },
    ...tuned("the_eclipsed_saint"),
    lootTableId: "loot_eclipsed",
    alignmentShiftHolyUnholy: -18,
    flavorText: "Half halo, half wound. It punishes whichever faith you choose.",
  },
];

export const DUNGEON_REGISTRY = new Map<string, DungeonDef>(
  DUNGEONS.map((dungeon) => [dungeon.id, dungeon])
);
