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
  flavor?: {
    success: string[];
    partial: string[];
    failure: string[];
  };
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
    flavor: {
      success: ["The altar still holds. You leave with more than you brought.", "Pale light filters down as you depart. A benediction, perhaps."],
      partial: ["The chapel gives what it can spare. That is not much.", "Something watches you leave. You choose not to look back."],
      failure: ["The dust settles behind you. You found only ghosts.", "The pews creak. Nothing here wanted to be found."],
    },
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
    flavor: {
      success: ["The hollow rewards its trespassers. Only barely.", "You walk out heavier than you walked in. Mostly with dread."],
      partial: ["The graves gave up a few secrets but kept the rest.", "Half-answers and old bones. You take what you can carry."],
      failure: ["The hollow wanted you to stay. You refused. Barely.", "Nothing gained. The waiting dead seem satisfied."],
    },
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
    flavor: {
      success: ["Knowledge salvaged from the deep. Worth the soaking.", "The water gives up its pages. You dry them on the way out."],
      partial: ["Some pages survive. Many are pulp. You take the rest.", "The archive reveals a chapter but buries the index."],
      failure: ["The water won this round. You leave with nothing dry.", "Ink blooms like smoke in the black water. The words are gone."],
    },
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
    flavor: {
      success: ["The vault yields. Gold and old grudges, well worth the entry fee.", "Tribute chests cracked open. The ledgers would not approve."],
      partial: ["Some chests were already looted. You take what remains.", "Gold-scent lingers. You leave with a fraction of what was here."],
      failure: ["Every chest was trapped. You leave with scars and empty hands.", "The warehouse laughs at you. Not literally. Mostly."],
    },
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
    flavor: {
      success: ["The ossuary feeds you. You do not ask how.", "Bone-dust clings to your armor but your pockets are full."],
      partial: ["The roots resist. You pull free with less than planned.", "The ossuary gives up something. Not the thing you wanted."],
      failure: ["The roots hold everything fast. You escape empty.", "Something in the ossuary woke. You ran. It let you."],
    },
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
    flavor: {
      success: ["The vault opens for those bold enough to ask. You asked loudly.", "Century-old relics see light for the first time. A fair trade."],
      partial: ["The vault yields half its secrets. The rest stay buried.", "Not everything sealed here was treasure. You took the treasure."],
      failure: ["The seals hold. You leave with a headache and nothing else.", "A century of silence preserved. You did not break it today."],
    },
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
    flavor: {
      success: ["You shed what needed shedding. The pit is satisfied.", "The molting god demanded tribute. You paid with skin and gained more."],
      partial: ["The pit takes its tithe. You take what you can reach.", "A partial molt. The god is neither pleased nor displeased."],
      failure: ["The pit only takes. You leave diminished.", "The god molts. You just bled."],
    },
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
    flavor: {
      success: ["The abyss gives back what it took. In different form.", "Deeper than before. The reward matches the descent."],
      partial: ["Each step costs something. You stopped before the full price.", "The stair returns half of what the climb demanded."],
      failure: ["The cost was total. The stair took and did not give.", "You descended too far for too little. The abyss does not apologize."],
    },
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
    flavor: {
      success: ["The Prelate acknowledges you with silence. That is enough.", "Its blessing is cold and absolute. You accept it."],
      partial: ["The Prelate considers. Half a blessing is still a blessing.", "It does not refuse you entirely. It rarely does."],
      failure: ["Three hundred years of silence, and it still rejects you.", "The Prelate turns away. Some defeats are formal."],
    },
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
    flavor: {
      success: ["The Saint's contradiction resolves in your favor. Briefly.", "Half halo cracked open. You carry the light and the wound."],
      partial: ["The Saint splits its verdict. Half punishment, half reward.", "Eclipsed divinity spills on you. Some of it was good."],
      failure: ["It punishes every faith equally. You have learned this firsthand.", "The Saint's wound opens. Nothing for you here but pain."],
    },
  },
  {
    id: "resonance_cavern",
    name: "Resonance Cavern",
    tags: ["knowledge", "fate", "relic"],
    depthIndex: 3,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.resonance_cavern, traitDiscovered: "obsessive" },
    ...tuned("resonance_cavern"),
    lootTableId: "loot_resonance",
    flavorText: "The walls here have absorbed centuries of scholarship. They reflect it back distorted.",
    flavor: {
      success: ["The cavern harmonizes with you. Knowledge flows like sound.", "Centuries of learning, briefly yours. The echoes clear."],
      partial: ["Some resonances align. Others cancel out. You leave partially wiser.", "The cavern gives what it can. The rest is static."],
      failure: ["Cacophony. The scholarship here has curdled into noise.", "The walls reflect nothing useful back. You leave unchanged."],
    },
  },
  {
    id: "carrion_fields",
    name: "Carrion Fields",
    tags: ["decay", "unholy", "vitality"],
    depthIndex: 4,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.carrion_fields, traitDiscovered: "grave_touched" },
    ...tuned("carrion_fields"),
    lootTableId: "loot_carrion",
    alignmentShiftHolyUnholy: -10,
    flavorText: "Something feeds here. It has been feeding for a very long time.",
    flavor: {
      success: ["You fed it something else. It let you take your share.", "The fields are sated. You walk out with the spoils."],
      partial: ["It took something while you were distracted. You kept the rest.", "A trade of sorts. The fields never negotiate fairly."],
      failure: ["It fed on you. You got nothing in return.", "The feeder is thorough. You leave hungry and empty."],
    },
  },
  {
    id: "bone_cathedral",
    name: "Bone Cathedral",
    tags: ["knowledge", "fate", "relic"],
    depthIndex: 10,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.bone_cathedral },
    ...tuned("bone_cathedral"),
    lootTableId: "loot_bone_cathedral",
    flavorText: "The arches are load-bearing vertebrae. No one knows whose.",
    flavor: {
      success: ["The cathedral opens its archives. You leave knowing too much.", "Its knowledge is complete and terrible. You carry a piece of it."],
      partial: ["The cathedral gives chapter summaries. The full text stays sealed.", "Half the archive, fully understood. You accept the compromise."],
      failure: ["The cathedral does not share with the unworthy. You qualify.", "Bone and silence. It was not impressed."],
    },
  },
  {
    id: "deep_vault",
    name: "Deep Vault",
    tags: ["wealth", "relic", "abyss"],
    depthIndex: 11,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.deep_vault },
    ...tuned("deep_vault"),
    lootTableId: "loot_deep_vault",
    alignmentShiftHolyUnholy: -8,
    flavorText: "The deepest accounting office ever built. The numbers are wrong. They are also correct.",
    flavor: {
      success: ["The vault yields. Whatever this cost, it was worth it.", "Relics from the absolute bottom. Worth every descent."],
      partial: ["The deep vault shares what it can spare. Barely enough.", "Some relics surface. The rest stay buried under abstraction."],
      failure: ["The deep vault is patient. You were not. Nothing gained.", "The numbers added up to nothing in your favor."],
    },
  },
  {
    id: "the_wound",
    name: "The Wound",
    tags: ["boss", "holy", "unholy", "fate"],
    depthIndex: 12,
    unlockRequirement: { legacyAsh: BALANCE.unlockCost.the_wound },
    ...tuned("the_wound"),
    lootTableId: "loot_the_wound",
    alignmentShiftHolyUnholy: 0,
    flavorText: "It does not heal. It does not close. It asks only that you enter.",
    flavor: {
      success: ["The Wound has been witnessed. It recognizes you now.", "You survived the impossible thing. Whether that is good is unclear."],
      partial: ["The Wound took its pound. You kept the rest and ran.", "A partial reckoning. The Wound is satisfied for now."],
      failure: ["The Wound is patient. You bled for nothing today.", "The impossible thing did not see fit to reward you."],
    },
  },
];

export const DUNGEON_REGISTRY = new Map<string, DungeonDef>(
  DUNGEONS.map((dungeon) => [dungeon.id, dungeon])
);
