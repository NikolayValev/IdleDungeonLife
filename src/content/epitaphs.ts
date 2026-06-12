import type { FacetId, ArcId, DrasticEventKind } from "../core/types";

// ─── Chronicle cap ─────────────────────────────────────────────────────────────

/** Maximum chronicle entries per life before trimming fires. */
export const CHRONICLE_CAP = 40; // TUNABLE — sim-verify

/** Priority order for trimming: lower index = dropped first. */
export const CHRONICLE_DROP_ORDER: DrasticEventKind[] = [
  "jobTaken",
  "deepestDelve",
  "traitEvolved",
  "breakthrough",
  "bossFelled",
  "legendaryFound",
  "gateCrossed",
  "death",
];

// ─── Facet scoring thresholds ──────────────────────────────────────────────────

/** Minimum score a facet needs to be considered "primary". */
export const PRIMARY_THRESHOLD = 35; // TUNABLE — sim-verify

/** Minimum score for a "secondary" facet (must differ from primary). */
export const SECONDARY_THRESHOLD = 25; // TUNABLE — sim-verify

// ─── Intensity tier boundaries ─────────────────────────────────────────────────
// score ranges: [PRIMARY_THRESHOLD, MID_TIER) | [MID_TIER, HIGH_TIER) | [HIGH_TIER, 100]

export const MID_TIER = 55; // TUNABLE — sim-verify
export const HIGH_TIER = 80; // TUNABLE — sim-verify

// ─── Hard character cap ────────────────────────────────────────────────────────

export const EPITAPH_CHAR_CAP = 140; // TUNABLE — sim-verify

// ─── Arc detection thresholds ──────────────────────────────────────────────────

/** finalAlignment > this → redeemed arc possible */
export const REDEEMED_ALIGNMENT_THRESHOLD = 15; // TUNABLE — sim-verify
/** finalAlignment < this → fallen arc possible */
export const FALLEN_ALIGNMENT_THRESHOLD = -15; // TUNABLE — sim-verify
/** Arc fires if first notable event was after this fraction of expected lifespan */
export const LATE_BLOOM_FRACTION = 0.75; // TUNABLE — sim-verify
/** Arc fires if died before this fraction of expected lifespan */
export const CUT_SHORT_FRACTION = 0.4; // TUNABLE — sim-verify

// ─── Facet weights ─────────────────────────────────────────────────────────────
// Each weight entry: [alignmentComponent, gateDepthComponent, tagComponent]
// Used in per-facet scoring formulas in epitaph.ts.

/** Gold-to-score curve: score = min(100, peakGold / WEALTH_GOLD_CAP * 100) */
export const WEALTH_GOLD_CAP = 2000; // TUNABLE — sim-verify

/** Delver: dungeonIndex score weight vs boss score weight */
export const DELVER_DEPTH_WEIGHT = 0.6; // TUNABLE — sim-verify
export const DELVER_BOSS_WEIGHT = 0.4; // TUNABLE — sim-verify

/** Toiler: jobYears fraction that maps to score 100 */
export const TOILER_MAX_FRACTION = 0.7; // TUNABLE — sim-verify

/** Knowledge: per-art contribution, per-stage contribution, per-discovery contribution */
export const KNOWLEDGE_ART_WEIGHT = 6; // TUNABLE — sim-verify
export const KNOWLEDGE_STAGE_WEIGHT = 14; // TUNABLE — sim-verify
export const KNOWLEDGE_DISCOVERY_WEIGHT = 2; // TUNABLE — sim-verify
export const KNOWLEDGE_CAP = 100; // TUNABLE — sim-verify

/**
 * Alignment facets: score = clamp(0, 100,
 *   ALIGN_VALUE_WEIGHT * |finalAlignment| / 100 * 100
 *   + ALIGN_GATE_WEIGHT * (gateCountOnSide / 3) * 100
 *   + ALIGN_TAG_WEIGHT * (relevantTagCount / ALIGN_TAG_CAP) * 100
 * )
 */
export const ALIGN_VALUE_WEIGHT = 0.4; // TUNABLE — sim-verify
export const ALIGN_GATE_WEIGHT = 0.4; // TUNABLE — sim-verify
export const ALIGN_TAG_WEIGHT = 0.2; // TUNABLE — sim-verify
export const ALIGN_TAG_CAP = 5; // TUNABLE — sim-verify

/** Vitality / decay / fate: score = min(100, tagCount / TAG_FACET_CAP * 100) */
export const TAG_FACET_CAP = 5; // TUNABLE — sim-verify

// ─── Death-statement flavor banks ─────────────────────────────────────────────

/** Line 1 by cause of death. "{age}" is replaced with the age number. */
export const DEATH_STATEMENTS: Record<string, string[]> = {
  vitality: [
    "Died at {age}, worn thin.",
    "Died at {age}, their body giving out at last.",
    "Died at {age}, spent.",
    "Died at {age}, the vitality finally gone.",
    "Died at {age}, flesh surrendered.",
  ],
  breakthrough: [
    "Died at {age}, in the moment of knowing.",
    "Died at {age}, undone by revelation.",
    "Died at {age}, the study consuming them.",
    "Died at {age}, at the threshold of mastery.",
  ],
  abandoned: [
    "Died at {age}, forsaken.",
    "Died at {age}, alone at the end.",
    "Died at {age}, left behind.",
  ],
};

// ─── Facet phrase banks ────────────────────────────────────────────────────────
// Three tiers per facet: low (35–54), mid (55–79), high (80+)

export type PhraseBank = {
  low: string[];
  mid: string[];
  high: string[];
};

export const FACET_PHRASES: Record<FacetId, PhraseBank> = {
  holy: {
    low: [
      "Touched by the light, briefly.",
      "Drawn toward holiness, however faintly.",
      "Walked a path edged with grace.",
    ],
    mid: [
      "A servant of the holy rites.",
      "Consecrated by deed if not by vow.",
      "The sacred left its mark.",
    ],
    high: [
      "A vessel of holy power.",
      "Touched by the divine, and changed.",
      "One who carried the light to the end.",
    ],
  },

  abyss: {
    low: [
      "Marked by the Abyss, however faintly.",
      "Drifted toward the dark.",
      "Touched by corruption, lightly.",
    ],
    mid: [
      "Marked by the Abyss, and proud of it.",
      "The Abyss left something behind.",
      "Deep-stained, not easily washed.",
    ],
    high: [
      "Consumed by the Abyss, willingly.",
      "The Abyss was not a place, but a destination.",
      "One who stared into the dark and became it.",
    ],
  },

  knowledge: {
    low: [
      "A curious mind.",
      "Always asking, rarely satisfied.",
      "Gathered more questions than answers.",
    ],
    mid: [
      "A scholar, well-read and sharp.",
      "Knew what others overlooked.",
      "The archive held fewer secrets by the end.",
    ],
    high: [
      "One who knew too much.",
      "Knowledge was the only god they served.",
      "The scholars will argue over what they discovered.",
    ],
  },

  wealth: {
    low: [
      "Earned their keep.",
      "Never went hungry.",
      "Gold passed through their hands.",
    ],
    mid: [
      "Built a small fortune.",
      "Wealthier than most who delved as deep.",
      "Gold followed their footsteps.",
    ],
    high: [
      "Richer than the dungeons they emptied.",
      "Wealth accumulated long after the need for it passed.",
      "A fortune left without an heir.",
    ],
  },

  vitality: {
    low: [
      "Tougher than they looked.",
      "Kept moving when others stopped.",
      "Vital to the last.",
    ],
    mid: [
      "Resilient beyond reason.",
      "Endured what would have broken another.",
      "The body outlasted the will.",
    ],
    high: [
      "Unkillable, until they weren't.",
      "A force of life that bent fate.",
      "Vitality like a burning torch — bright, then nothing.",
    ],
  },

  decay: {
    low: [
      "Something rotted beneath the surface.",
      "Carried the taint lightly.",
      "Decay found a foothold, and held it.",
    ],
    mid: [
      "The Decay took root.",
      "Rot was their companion.",
      "What they touched did not stay whole.",
    ],
    high: [
      "Entropy given form.",
      "Decay was not a curse but a craft.",
      "They became what they carried.",
    ],
  },

  fate: {
    low: [
      "Fortune guided them, now and then.",
      "Chance favored them more than most.",
      "Luck was a factor; they'd deny it.",
    ],
    mid: [
      "Fate-touched, and aware of it.",
      "The threads of chance bent their way.",
      "Destiny or luck — the distinction seemed moot.",
    ],
    high: [
      "The fates had a plan for them.",
      "Nothing happened by accident.",
      "Woven into the pattern of things.",
    ],
  },

  delver: {
    low: [
      "Went deeper than comfort allowed.",
      "Descended where most refused.",
      "The dungeons knew their footstep.",
    ],
    mid: [
      "A delver of serious intent.",
      "Descended further than most dared.",
      "The deep places feared their passage.",
    ],
    high: [
      "None delved deeper.",
      "The abyss had no floor they hadn't found.",
      "Went where light gave up.",
    ],
  },

  toiler: {
    low: [
      "Worked more than they wandered.",
      "Kept at it.",
      "The grind suited them.",
    ],
    mid: [
      "A worker to the bone.",
      "Jobs were a life, not a stage.",
      "Put in the years and showed it.",
    ],
    high: [
      "Defined by the labor, not the treasure.",
      "Toiled past the point others quit.",
      "The work was the whole of it.",
    ],
  },
};

// ─── Arc clause phrase banks ───────────────────────────────────────────────────

export const ARC_PHRASES: Record<ArcId, string[]> = {
  redeemed: [
    "Touched the Abyss and walked back.",
    "Who touched the Abyss and walked back.",
    "Found their way back from the dark.",
  ],
  fallen: [
    "Consecrated once, and lost.",
    "The light abandoned them, or they it.",
    "Sanctified at the start; darkness claimed the rest.",
  ],
  forsaken: [
    "The Abyss claimed them, tier by tier.",
    "Fell past every threshold and kept going.",
    "The Abyss was not a wound — it was a home.",
  ],
  sanctified: [
    "Ascended toward the light, step by step.",
    "Holy beyond the reckoning of ordinary gates.",
    "The divine did not merely touch them — it consumed them.",
  ],
  lateBloom: [
    "Only at the end did the greatness show.",
    "Slow to start; the final act rewrote the rest.",
    "Took long to bloom, but bloom they did.",
  ],
  cutShort: [
    "A life ended early.",
    "The story had more pages left.",
    "Cut down before the full shape emerged.",
  ],
  unbroken: [
    "Steady to the last.",
    "Walked the whole road without breaking.",
    "Neither Abyss nor light swayed them — they simply endured.",
  ],
  ascensionDeath: [
    "Died in the moment of transcendence.",
    "The ascension was the end.",
    "Undone by their own apotheosis.",
  ],
};

// ─── Faint-life phrase bank ────────────────────────────────────────────────────
// Used ONLY when no facet clears PRIMARY_THRESHOLD. Must NEVER overlap with any
// phrase in FACET_PHRASES or ARC_PHRASES — that is enforced by a test.

export const FAINT_PHRASES: string[] = [
  "Left little behind.",
  "Passed through without leaving a mark.",
  "The world noticed only briefly.",
  "Neither remarkable nor forgotten — just gone.",
  "Lived quietly, died the same.",
  "No legend followed.",
];
