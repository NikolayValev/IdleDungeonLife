import type { Modifier } from "../core/types";

export type LegacyPath = "holy" | "abyss" | "knowledge";

export interface LegacyPerkDef {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  path: LegacyPath;
  rank: 1 | 2 | 3;       // rank 2 requires rank 1; rank 3 requires rank 2
  costAsh: number;
  startingGold?: number;  // bonus gold at run start
  startingEssence?: number; // bonus essence at run start
  modifiers?: Modifier[]; // permanent run modifiers injected at run start
}

const perk = (definition: LegacyPerkDef): LegacyPerkDef => definition;

export const LEGACY_PERKS: LegacyPerkDef[] = [
  // ─── Holy Path ───────────────────────────────────────────────────────────────
  perk({
    id: "holy_veteran_tithe",
    name: "Veteran's Tithe",
    description: "The holy lineage begins with something in the coffers. Runs start with a head start.",
    flavorText: "The temple remembers its own.",
    path: "holy",
    rank: 1,
    costAsh: 10,
    startingGold: 25,
  }),
  perk({
    id: "holy_sanctum_memory",
    name: "Sanctum Memory",
    description: "Your bloodline carries the echo of holy ground. Shrines and holy dungeons yield a little more.",
    flavorText: "The stone remembers what the body forgets.",
    path: "holy",
    rank: 2,
    costAsh: 18,
    modifiers: [
      {
        stat: "holyAffinity",
        op: "add",
        value: 8,
        source: "legacy_holy_sanctum_memory",
      },
      {
        stat: "dungeonSuccessRate",
        op: "add",
        value: 0.04,
        source: "legacy_holy_sanctum_memory",
        condition: { type: "dungeonHasTag", tag: "holy" },
      },
    ],
  }),
  perk({
    id: "holy_white_scar",
    name: "White Scar",
    description: "Generations of holy service have conditioned the body. Vitality holds a fraction longer every run.",
    flavorText: "Each scar is a kept promise.",
    path: "holy",
    rank: 3,
    costAsh: 30,
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.88, source: "legacy_holy_white_scar" },
      { stat: "survivability", op: "add", value: 4, source: "legacy_holy_white_scar" },
    ],
  }),

  // ─── Abyss Path ──────────────────────────────────────────────────────────────
  perk({
    id: "abyss_void_familiarity",
    name: "Void Familiarity",
    description: "The abyss already knows you. You start each run with the first few shadows already mapped.",
    flavorText: "Darkness is not the absence of light. It is a different kind of home.",
    path: "abyss",
    rank: 1,
    costAsh: 10,
    modifiers: [
      { stat: "unholyAffinity", op: "add", value: 10, source: "legacy_abyss_void_familiarity" },
      { stat: "alignmentDriftUnholy", op: "mul", value: 1.2, source: "legacy_abyss_void_familiarity" },
    ],
  }),
  perk({
    id: "abyss_marrow_pact",
    name: "Marrow Pact",
    description: "Something in your ancestry made a deal that slows your dissolution. Every run starts tougher.",
    flavorText: "The bones remember the price paid.",
    path: "abyss",
    rank: 2,
    costAsh: 18,
    modifiers: [
      { stat: "vitalityDecayRate", op: "mul", value: 0.92, source: "legacy_abyss_marrow_pact" },
      { stat: "bossWearMultiplier", op: "mul", value: 0.9, source: "legacy_abyss_marrow_pact" },
    ],
  }),
  perk({
    id: "abyss_echoed_hunger",
    name: "Echoed Hunger",
    description: "The void rewards sustained devotion with essence. Your runs generate more of the deep currency.",
    flavorText: "The abyss pays back what it takes, eventually.",
    path: "abyss",
    rank: 3,
    costAsh: 30,
    modifiers: [
      { stat: "essenceRate", op: "mul", value: 1.18, source: "legacy_abyss_echoed_hunger" },
      { stat: "legendaryDropRate", op: "add", value: 0.015, source: "legacy_abyss_echoed_hunger" },
    ],
  }),

  // ─── Knowledge Path ──────────────────────────────────────────────────────────
  perk({
    id: "knowledge_scholar_notes",
    name: "Scholar's Notes",
    description: "The lineage left written records. Runs begin with a small pool of accumulated essence.",
    flavorText: "You do not start from nothing. You start from their notes.",
    path: "knowledge",
    rank: 1,
    costAsh: 10,
    startingEssence: 12,
  }),
  perk({
    id: "knowledge_pattern_sight",
    name: "Pattern Sight",
    description: "Generations of study sharpened the family eye for hidden things. Discovery comes faster.",
    flavorText: "They saw it before you did. Now you see it first.",
    path: "knowledge",
    rank: 2,
    costAsh: 18,
    modifiers: [
      { stat: "discoveryRate", op: "mul", value: 1.25, source: "legacy_knowledge_pattern_sight" },
      { stat: "essenceRate", op: "mul", value: 1.1, source: "legacy_knowledge_pattern_sight" },
    ],
  }),
  perk({
    id: "knowledge_worn_calculus",
    name: "Worn Calculus",
    description: "Talent comes easier to those who inherit the method. Talent costs are modestly reduced.",
    flavorText: "The derivation was done by someone who is gone. The answer remains.",
    path: "knowledge",
    rank: 3,
    costAsh: 30,
    modifiers: [
      { stat: "talentCostMultiplier", op: "mul", value: 0.82, source: "legacy_knowledge_worn_calculus" },
      { stat: "discoveryRate", op: "mul", value: 1.15, source: "legacy_knowledge_worn_calculus" },
    ],
  }),
];

export const LEGACY_PERK_REGISTRY = new Map<string, LegacyPerkDef>(
  LEGACY_PERKS.map((perk) => [perk.id, perk])
);

/** Return the rank-1 prerequisite ID for a given perk, if any. */
export function getPerkPrerequisite(perk: LegacyPerkDef): string | null {
  if (perk.rank === 1) return null;
  const lowerRank = (perk.rank - 1) as 1 | 2;
  const prereq = LEGACY_PERKS.find((p) => p.path === perk.path && p.rank === lowerRank);
  return prereq?.id ?? null;
}

/** Return whether a perk can be purchased given the meta state. */
export function canPurchasePerk(
  perkId: string,
  legacyPath: LegacyPath | null,
  legacyPerks: string[],
  legacyAsh: number
): boolean {
  const def = LEGACY_PERK_REGISTRY.get(perkId);
  if (!def) return false;
  if (def.path !== legacyPath) return false;
  if (legacyPerks.includes(perkId)) return false;
  if (legacyAsh < def.costAsh) return false;
  const prereq = getPerkPrerequisite(def);
  if (prereq && !legacyPerks.includes(prereq)) return false;
  return true;
}
