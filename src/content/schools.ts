import type { ArtId, GateId, SchoolId, Tag } from "../core/types";

// ─── Tunable constants ────────────────────────────────────────────────────────

/** Base refinement points gained per study-year (no bonuses). */
export const BASE_REFINEMENT_RATE = 16; // TUNABLE — sim-verify

/** Per-school refinement rate multipliers. */
export const SCHOOL_RATE_MODIFIER: Record<SchoolId, number> = {
  choir: 1.0, // TUNABLE — sim-verify
  hollow_order: 1.4, // TUNABLE — sim-verify
  archive: 1.0, // TUNABLE — sim-verify
};

/**
 * Study-years needed per stage (index = stage-1, so index 0 = cost to reach stage 1,
 * … index 4 = cost to reach stage 5). Stored as study-years × BASE_REFINEMENT_RATE
 * equivalent; the refinement meter always goes 0→100, so these correspond to
 * 100/BASE_REFINEMENT_RATE × stageCostMultiplier years.
 *
 * Spec §8 first-pass numbers: 6 / 9 / 13 / 18 / 24 study-years.
 * Each stage costs those study-years at base rate → we bake these as the
 * per-stage "refinement rate divisor" relative to the default 6-year stage.
 * Simpler: we just track that stageCostMultiplier[i] = stageCost[i] / 6.
 * But the cleanest approach is to track effective base rates per stage:
 * refinement per year = BASE_REFINEMENT_RATE × schoolMod × manualBonus × (6/stageCost)
 * so the meter always runs to 100 in the expected years at base.
 */
export const STAGE_STUDY_YEAR_COSTS: readonly number[] = [6, 9, 13, 18, 24]; // TUNABLE — sim-verify

/** Gold upkeep per study-year. */
export const STUDY_UPKEEP_PER_YEAR = 45; // TUNABLE — sim-verify

/** Alignment drift per study-year contributed by each school (delta to holyUnholy). */
export const SCHOOL_DRIFT_PER_YEAR: Record<SchoolId, number> = {
  choir: 3.0, // TUNABLE — sim-verify (positive = toward Holy)
  hollow_order: -3.0, // TUNABLE — sim-verify (negative = toward Abyss)
  archive: 0, // TUNABLE — sim-verify (neutral)
};

/** Archive dampens ALL drift from external sources by this factor (0–1). */
export const ARCHIVE_DRIFT_DAMPEN_FACTOR = 0.5; // TUNABLE — sim-verify

/** Vitality toll (% of max vitality) paid on each breakthrough, indexed by
 *  destination stage (so index 1 = breakthrough to stage 1, etc.). */
export const BREAKTHROUGH_VITALITY_TOLL_PCT: readonly number[] = [
  5, // → stage 1   TUNABLE — sim-verify
  8, // → stage 2   TUNABLE — sim-verify
  12, // → stage 3  TUNABLE — sim-verify
  18, // → stage 4  TUNABLE — sim-verify
  25, // → stage 5  TUNABLE — sim-verify
];

/** Lifespan granted (years) on breakthrough to each stage (index = destination stage - 1). */
export const BREAKTHROUGH_LIFESPAN_GRANT_YEARS: readonly number[] = [
  0, // → stage 1: no bonus
  4, // → stage 2  TUNABLE — sim-verify
  8, // → stage 3  TUNABLE — sim-verify
  14, // → stage 4 TUNABLE — sim-verify
  24, // → stage 5 TUNABLE — sim-verify
];

// ─── Art definitions ──────────────────────────────────────────────────────────

export interface ArtDef {
  id: ArtId;
  name: string;
  school: SchoolId;
  stage: number; // unlocked upon breakthrough to this stage
  tags: Tag[];
  description: string;
}

const art = (def: ArtDef): ArtDef => def;

export const ARTS: ArtDef[] = [
  // ── Choir (holy school) ──────────────────────────────────────────────────
  art({
    id: "choir_ward_1",
    name: "Novice Ward",
    school: "choir",
    stage: 1,
    tags: ["holy", "vitality"],
    description: "A basic protective ward. Slightly reduces vitality loss in dungeons.",
  }),
  art({
    id: "choir_restoration_1",
    name: "Penitent's Mending",
    school: "choir",
    stage: 1,
    tags: ["holy", "vitality"],
    description: "Slow but steady vitality restoration between delves.",
  }),
  art({
    id: "choir_ward_2",
    name: "Sanctified Barrier",
    school: "choir",
    stage: 2,
    tags: ["holy", "vitality"],
    description: "A refined ward that noticeably reduces dungeon wear.",
  }),
  art({
    id: "choir_light_2",
    name: "Candlelight Hymn",
    school: "choir",
    stage: 2,
    tags: ["holy", "shrine"],
    description: "Increases discovery chance slightly; lights the way.",
  }),
  art({
    id: "choir_restoration_3",
    name: "Anointed Recovery",
    school: "choir",
    stage: 3,
    tags: ["holy", "vitality"],
    description: "Meaningful vitality recovery; the choir's first major healing art.",
  }),
  art({
    id: "choir_affinity_3",
    name: "Holy Resonance",
    school: "choir",
    stage: 3,
    tags: ["holy", "shrine"],
    description: "Boosts holy affinity; shrine rewards improved.",
  }),
  art({
    id: "choir_bulwark_4",
    name: "Sacred Bulwark",
    school: "choir",
    stage: 4,
    tags: ["holy", "vitality", "relic"],
    description: "A powerful ward that can negate a portion of boss wear.",
  }),
  art({
    id: "choir_grace_4",
    name: "Undying Grace",
    school: "choir",
    stage: 4,
    tags: ["holy", "fate"],
    description: "Slows age-related vitality decay during study years.",
  }),
  art({
    id: "choir_absolution_5",
    name: "Absolution",
    school: "choir",
    stage: 5,
    tags: ["holy", "vitality", "fate"],
    description: "Transcendent restoration: huge vitality recovery once per life.",
  }),
  art({
    id: "choir_sainthood_5",
    name: "Mantle of the Saint",
    school: "choir",
    stage: 5,
    tags: ["holy", "shrine", "relic"],
    description: "All holy-tagged item bonuses are amplified.",
  }),

  // ── Hollow Order (abyss school) ──────────────────────────────────────────
  art({
    id: "hollow_strike_1",
    name: "Hungry Strike",
    school: "hollow_order",
    stage: 1,
    tags: ["abyss", "decay"],
    description: "Raw power boost to dungeon success rate.",
  }),
  art({
    id: "hollow_decay_1",
    name: "Decay Touch",
    school: "hollow_order",
    stage: 1,
    tags: ["abyss", "decay"],
    description: "Leeches essence from cleared dungeons.",
  }),
  art({
    id: "hollow_hunger_2",
    name: "Void Hunger",
    school: "hollow_order",
    stage: 2,
    tags: ["abyss", "decay"],
    description: "Increases gold yield from dungeons at a mild vitality cost.",
  }),
  art({
    id: "hollow_pact_2",
    name: "Minor Pact",
    school: "hollow_order",
    stage: 2,
    tags: ["abyss", "fate"],
    description: "Improves legendary drop rate; faint cost to bossWear.",
  }),
  art({
    id: "hollow_sacrifice_3",
    name: "Willing Sacrifice",
    school: "hollow_order",
    stage: 3,
    tags: ["abyss", "decay"],
    description: "Sacrifice vitality for a burst of power on entering a dungeon.",
  }),
  art({
    id: "hollow_unholiness_3",
    name: "Unholy Affinity",
    school: "hollow_order",
    stage: 3,
    tags: ["abyss", "unholy"],
    description: "Boosts unholy affinity; unholy dungeon rewards improved.",
  }),
  art({
    id: "hollow_consumption_4",
    name: "Total Consumption",
    school: "hollow_order",
    stage: 4,
    tags: ["abyss", "decay", "boss"],
    description: "Boss kills restore a slice of vitality.",
  }),
  art({
    id: "hollow_dread_4",
    name: "Dread Presence",
    school: "hollow_order",
    stage: 4,
    tags: ["abyss", "unholy"],
    description: "Significantly raises dungeon success rate; aura of menace.",
  }),
  art({
    id: "hollow_ascension_5",
    name: "Hollow Ascension",
    school: "hollow_order",
    stage: 5,
    tags: ["abyss", "decay", "fate"],
    description: "Transcendent power: massive dungeon success bonus for one life.",
  }),
  art({
    id: "hollow_liche_5",
    name: "Liche's Reprieve",
    school: "hollow_order",
    stage: 5,
    tags: ["abyss", "decay", "relic"],
    description: "Reduces the vitality toll of all future breakthroughs this life.",
  }),

  // ── Archive (knowledge school) ────────────────────────────────────────────
  art({
    id: "archive_eye_1",
    name: "Seeker's Eye",
    school: "archive",
    stage: 1,
    tags: ["knowledge", "neutral"],
    description: "Improves discovery rate; codex placeholders fill faster.",
  }),
  art({
    id: "archive_codex_1",
    name: "Codex Fluency",
    school: "archive",
    stage: 1,
    tags: ["knowledge", "neutral"],
    description: "Increases essence yield from all sources.",
  }),
  art({
    id: "archive_survey_2",
    name: "Survey Rite",
    school: "archive",
    stage: 2,
    tags: ["knowledge", "neutral"],
    description: "Reveals one hidden dungeon tag before entering.",
  }),
  art({
    id: "archive_efficiency_2",
    name: "Scholar's Efficiency",
    school: "archive",
    stage: 2,
    tags: ["knowledge", "wealth"],
    description: "Gold upkeep for study is reduced by 15%.",
  }),
  art({
    id: "archive_momentum_3",
    name: "Discovery Momentum",
    school: "archive",
    stage: 3,
    tags: ["knowledge", "neutral"],
    description: "Each dungeon cleared grants additional discovery momentum.",
  }),
  art({
    id: "archive_clarity_3",
    name: "Warding Clarity",
    school: "archive",
    stage: 3,
    tags: ["knowledge", "neutral"],
    description: "The archive's drift dampening strengthens; factor improves.",
  }),
  art({
    id: "archive_cartography_4",
    name: "Cartography",
    school: "archive",
    stage: 4,
    tags: ["knowledge", "neutral"],
    description: "Dungeon success rate improved via foreknowledge.",
  }),
  art({
    id: "archive_chronicle_4",
    name: "Living Chronicle",
    school: "archive",
    stage: 4,
    tags: ["knowledge", "fate"],
    description: "Every drastic event adds a small discovery momentum bonus.",
  }),
  art({
    id: "archive_omniscience_5",
    name: "Omniscience",
    school: "archive",
    stage: 5,
    tags: ["knowledge", "neutral", "fate"],
    description: "Dramatically boosts all discovery rates; near-complete codex by end of life.",
  }),
  art({
    id: "archive_timeless_5",
    name: "Timeless Study",
    school: "archive",
    stage: 5,
    tags: ["knowledge", "neutral"],
    description: "Refinement ticks at 25% rate even while delving.",
  }),
];

export const ART_REGISTRY = new Map<ArtId, ArtDef>(ARTS.map((a) => [a.id, a]));

// ─── Manual definitions ───────────────────────────────────────────────────────

export interface ManualDef {
  id: string;
  name: string;
  school: SchoolId;
  tags: Tag[];
  /** If set, owning this manual is REQUIRED for the named breakthrough condition. */
  requiredForBreakthrough?: { schoolId: SchoolId; toStage: number };
  /** Refinement rate bonus multiplier when owned (stacks multiplicatively). */
  refinementBonusMul: number;
  description: string;
}

const manual = (def: ManualDef): ManualDef => def;

export const MANUALS: ManualDef[] = [
  // ── Choir manuals ─────────────────────────────────────────────────────────
  manual({
    id: "manual_choir_hymnal",
    name: "The Penitent Hymnal",
    school: "choir",
    tags: ["holy"],
    refinementBonusMul: 1.1, // TUNABLE — sim-verify
    description: "An old prayer-book; accelerates choir refinement slightly.",
  }),
  manual({
    id: "manual_choir_codex_holy",
    name: "Codex of the Saint",
    school: "choir",
    tags: ["holy", "relic"],
    refinementBonusMul: 1.2, // TUNABLE — sim-verify
    requiredForBreakthrough: { schoolId: "choir", toStage: 4 },
    description: "Required to understand the Sanctified Bulwark stage; found in mid dungeons.",
  }),
  manual({
    id: "manual_choir_transcendence",
    name: "Scroll of Absolution",
    school: "choir",
    tags: ["holy", "fate"],
    refinementBonusMul: 1.15, // TUNABLE — sim-verify
    requiredForBreakthrough: { schoolId: "choir", toStage: 5 },
    description: "The lost rites of stage 5. Only the deepest chapels hold this.",
  }),

  // ── Hollow Order manuals ──────────────────────────────────────────────────
  manual({
    id: "manual_hollow_flesh",
    name: "The Meat Psalter",
    school: "hollow_order",
    tags: ["abyss", "decay"],
    refinementBonusMul: 1.2, // TUNABLE — sim-verify
    requiredForBreakthrough: { schoolId: "hollow_order", toStage: 4 },
    description: "Grim reading. Required for stage 4. Found past dungeon 9.",
  }),
  manual({
    id: "manual_hollow_void",
    name: "Void Concordance",
    school: "hollow_order",
    tags: ["abyss"],
    refinementBonusMul: 1.1, // TUNABLE — sim-verify
    description: "Accelerates hollow refinement; smells of decay.",
  }),
  manual({
    id: "manual_hollow_ascension",
    name: "Liche's Final Notes",
    school: "hollow_order",
    tags: ["abyss", "fate"],
    refinementBonusMul: 1.15, // TUNABLE — sim-verify
    requiredForBreakthrough: { schoolId: "hollow_order", toStage: 5 },
    description: "Stage 5 requires this. The liche's own hand; nearly illegible.",
  }),

  // ── Archive manuals ───────────────────────────────────────────────────────
  manual({
    id: "manual_archive_index",
    name: "Grand Index",
    school: "archive",
    tags: ["knowledge"],
    refinementBonusMul: 1.1, // TUNABLE — sim-verify
    description: "Catalogue of the Archive's contents; useful for orientation.",
  }),
  manual({
    id: "manual_archive_deep",
    name: "Treatise on the Deep",
    school: "archive",
    tags: ["knowledge", "neutral"],
    refinementBonusMul: 1.2, // TUNABLE — sim-verify
    requiredForBreakthrough: { schoolId: "archive", toStage: 4 },
    description: "Required for stage 4 of the Archive. Found in deep dungeons.",
  }),
  manual({
    id: "manual_archive_omniscience",
    name: "The Closed Eye",
    school: "archive",
    tags: ["knowledge", "fate"],
    refinementBonusMul: 1.15, // TUNABLE — sim-verify
    requiredForBreakthrough: { schoolId: "archive", toStage: 5 },
    description: "Stage 5 rites. Required to grasp omniscience.",
  }),
];

export const MANUAL_REGISTRY = new Map<string, ManualDef>(MANUALS.map((m) => [m.id, m]));

// ─── School definition ────────────────────────────────────────────────────────

export interface BreakthroughCondition {
  /** Refinement must be at 100 (always implied). */
  minRefinement: 100;
  /** Manual ID required in inventory (optional). */
  manualRequired?: string;
  /** Alignment range (inclusive). */
  alignmentRange?: { min: number; max: number };
  /** Boss ID that must have been felled this life. */
  bossRequired?: string;
  /** Minimum age in years. */
  minAgeYears?: number;
}

export interface SchoolDef {
  id: SchoolId;
  name: string;
  description: string;
  /** Gates that bar enrollment. Empty = never barred. */
  barredByGates: GateId[];
  /** Per-stage breakthrough conditions (index 0 = conditions for breakthrough to stage 1). */
  breakthroughConditions: BreakthroughCondition[];
  /** Arts granted on breakthrough to each stage (index 0 = arts granted at stage 1). */
  artsAtStage: ArtId[][];
}

const school = (def: SchoolDef): SchoolDef => def;

export const SCHOOL_DEFS: SchoolDef[] = [
  school({
    id: "choir",
    name: "The Choir",
    description: "A holy school teaching warding, vitality, and restoration arts. Slow but steadfast.",
    barredByGates: ["abyss_2"],
    breakthroughConditions: [
      { minRefinement: 100 }, // → stage 1: refinement only
      { minRefinement: 100, alignmentRange: { min: -30, max: 100 } }, // → stage 2
      { minRefinement: 100, alignmentRange: { min: -10, max: 100 }, minAgeYears: 15 }, // → stage 3
      {
        minRefinement: 100,
        alignmentRange: { min: 10, max: 100 },
        manualRequired: "manual_choir_codex_holy",
        bossRequired: "the_silent_prelate",
      }, // → stage 4
      {
        minRefinement: 100,
        alignmentRange: { min: 25, max: 100 },
        manualRequired: "manual_choir_transcendence",
        minAgeYears: 40,
      }, // → stage 5
    ],
    artsAtStage: [
      ["choir_ward_1", "choir_restoration_1"],
      ["choir_ward_2", "choir_light_2"],
      ["choir_restoration_3", "choir_affinity_3"],
      ["choir_bulwark_4", "choir_grace_4"],
      ["choir_absolution_5", "choir_sainthood_5"],
    ],
  }),

  school({
    id: "hollow_order",
    name: "The Hollow Order",
    description:
      "An abyss school teaching power, decay, and sacrifice arts. Fast refinement — at a cost.",
    barredByGates: ["holy_2"],
    breakthroughConditions: [
      { minRefinement: 100 }, // → stage 1
      { minRefinement: 100, alignmentRange: { min: -100, max: 30 } }, // → stage 2
      {
        minRefinement: 100,
        alignmentRange: { min: -100, max: 10 },
        bossRequired: "molting_god_pit",
        minAgeYears: 10,
      }, // → stage 3
      {
        minRefinement: 100,
        alignmentRange: { min: -100, max: -10 },
        manualRequired: "manual_hollow_flesh",
      }, // → stage 4
      {
        minRefinement: 100,
        alignmentRange: { min: -100, max: -25 },
        manualRequired: "manual_hollow_ascension",
        bossRequired: "the_eclipsed_saint",
      }, // → stage 5
    ],
    artsAtStage: [
      ["hollow_strike_1", "hollow_decay_1"],
      ["hollow_hunger_2", "hollow_pact_2"],
      ["hollow_sacrifice_3", "hollow_unholiness_3"],
      ["hollow_consumption_4", "hollow_dread_4"],
      ["hollow_ascension_5", "hollow_liche_5"],
    ],
  }),

  school({
    id: "archive",
    name: "The Archive",
    description:
      "A knowledge school teaching utility, discovery, and perception arts. Neutral; never bars anyone.",
    barredByGates: [],
    breakthroughConditions: [
      { minRefinement: 100 }, // → stage 1
      { minRefinement: 100, minAgeYears: 8 }, // → stage 2
      { minRefinement: 100, minAgeYears: 20, bossRequired: "sunken_archive" }, // → stage 3
      {
        minRefinement: 100,
        minAgeYears: 30,
        manualRequired: "manual_archive_deep",
      }, // → stage 4
      {
        minRefinement: 100,
        minAgeYears: 45,
        manualRequired: "manual_archive_omniscience",
      }, // → stage 5
    ],
    artsAtStage: [
      ["archive_eye_1", "archive_codex_1"],
      ["archive_survey_2", "archive_efficiency_2"],
      ["archive_momentum_3", "archive_clarity_3"],
      ["archive_cartography_4", "archive_chronicle_4"],
      ["archive_omniscience_5", "archive_timeless_5"],
    ],
  }),
];

export const SCHOOL_REGISTRY = new Map<SchoolId, SchoolDef>(
  SCHOOL_DEFS.map((s) => [s.id, s])
);
