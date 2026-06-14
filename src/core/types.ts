// ─── Tag Taxonomy ────────────────────────────────────────────────────────────

export type Tag =
  | "holy"
  | "unholy"
  | "neutral"
  | "wealth"
  | "knowledge"
  | "vitality"
  | "decay"
  | "fate"
  | "relic"
  | "shrine"
  | "abyss"
  | "boss";

// ─── Stat Keys ───────────────────────────────────────────────────────────────

export type StatKey =
  | "power"
  | "survivability"
  | "goldRate"
  | "essenceRate"
  | "legendaryDropRate"
  | "holyAffinity"
  | "unholyAffinity"
  | "vitalityDecayRate"
  | "dungeonSuccessRate"
  | "itemFindRate"
  | "bossWearMultiplier"
  | "dungeonWearMultiplier"
  | "alignmentDriftHoly"
  | "alignmentDriftUnholy"
  | "talentCostMultiplier"
  | "jobOutputMultiplier"
  | "discoveryRate";

// ─── Modifier System ─────────────────────────────────────────────────────────

export type ModifierOp = "add" | "mul" | "setMin" | "setMax";

export interface Modifier {
  stat: StatKey;
  op: ModifierOp;
  value: number;
  source: string;
  condition?: Condition;
}

// ─── Condition System ─────────────────────────────────────────────────────────

export type BiologicalStage = "youth" | "prime" | "decline" | "terminal";

export type Condition =
  | { type: "alignmentBelow"; axis: "holyUnholy"; value: number }
  | { type: "alignmentAbove"; axis: "holyUnholy"; value: number }
  | { type: "hasTrait"; traitId: string }
  | { type: "runHasTag"; tag: Tag }
  | { type: "dungeonHasTag"; tag: Tag }
  | { type: "equippedItemHasTag"; tag: Tag }
  | { type: "biologicalStageIs"; stage: BiologicalStage }
  | { type: "ageSecondsAtLeast"; value: number }
  | { type: "traitEvolved"; traitId: string }
  | { type: "legacyPathIs"; path: "holy" | "abyss" | "knowledge" }
  | { type: "discoveryMomentumAtLeast"; value: number };

// ─── Unlock Requirements ──────────────────────────────────────────────────────

export interface UnlockRequirement {
  legacyAsh?: number;
  dungeonCleared?: string;
  traitDiscovered?: string;
  legacyPathChosen?: boolean; // requires any legacy path to have been chosen
}

// ─── Run Log ─────────────────────────────────────────────────────────────────

export type RunLogKind =
  | "dungeon"
  | "trait_reveal"
  | "trait_evolved"
  | "legendary"
  | "boss"
  | "milestone"
  | "death_warning"
  | "alignment";

export interface RunLogEntry {
  kind: RunLogKind;
  message: string;
  timestampSec: number;
}

// ─── Identity Systems Vocabulary (F1 foundation) ─────────────────────────────
// Shared, frozen vocabulary consumed by the Alignment, Epitaph/Chronicle, Study,
// and Avatar systems. One definition of "something happened to you" — three
// mirrors (a transient ceremony effect, a chronicle entry, an avatar re-render).

export type GateId = "abyss_1" | "abyss_2" | "abyss_3" | "holy_1" | "holy_2" | "holy_3";

/** One alignment ratchet. Abyss gates fire when value ≤ threshold and lower the
 *  opposite (max) cap; Holy gates fire when value ≥ threshold and raise the
 *  opposite (min) cap. Listed per side in ascending tier order in balance.ts. */
export interface AlignmentGate {
  id: GateId;
  side: "abyss" | "holy";
  threshold: number; // value ≤ threshold (abyss) or ≥ threshold (holy) to cross
  oppositeCap: number; // abyss → new maxCap; holy → new minCap (caps only narrow)
}

/** The drastic-event vocabulary: the only things loud enough to be chronicled,
 *  ceremonied, and re-render the avatar. `breakthrough` supersedes the older
 *  `studyMastered` working name from the epitaph spec. */
export type DrasticEventKind =
  | "gateCrossed"
  | "breakthrough"
  | "traitEvolved"
  | "legendaryFound"
  | "bossFelled"
  | "jobTaken"
  | "deepestDelve"
  | "death";

/** A one-shot effect the UI consumes once to play a ceremony, then clears.
 *  Successor to the ad-hoc `showWelcomeBack` boolean. `detail` carries
 *  kind-specific payload frozen by each downstream wave (e.g. the alignment
 *  wave stores `{ alignmentAtCrossing, newCaps }` for a `gateCrossed` effect). */
export interface DrasticEffect {
  kind: DrasticEventKind;
  year: number; // in-game age (years) when it fired; drives the chronicle entry
  refId?: string; // gateId | traitId | itemId | dungeonId | jobId | schoolId | artId
  detail?: Record<string, unknown>;
}

/** Reference-based log written during a life; persists into the death record.
 *  Distinct from `runLog` (verbose rendered strings, reset on load). Text is
 *  rendered from templates at display time, keeping saves small. */
export interface ChronicleEntry {
  year: number;
  kind: DrasticEventKind;
  refId?: string;
}

// ─── Study System ────────────────────────────────────────────────────────────

export type SchoolId = "choir" | "hollow_order" | "archive";
export type ArtId = string;

export interface SchoolProgress {
  stage: number; // 0–5; 0 = never studied
  refinement: number; // 0–100 toward next stage
  bottlenecked: boolean;
}

export interface StudyState {
  enrolled: SchoolId | null;
  schools: Record<SchoolId, SchoolProgress>;
  artsKnown: ArtId[];
}

// ─── Epitaph & Chronicle ─────────────────────────────────────────────────────

export type FacetId =
  | "holy"
  | "abyss"
  | "knowledge"
  | "wealth"
  | "vitality"
  | "decay"
  | "fate"
  | "delver"
  | "toiler";

export type ArcId =
  | "redeemed"
  | "fallen"
  | "forsaken"
  | "sanctified"
  | "lateBloom"
  | "cutShort"
  | "unbroken"
  | "ascensionDeath";

export interface Epitaph {
  lines: string[]; // rendered at compose time for the archive
  primaryFacet: FacetId;
  secondaryFacet?: FacetId;
  arc?: ArcId;
}

/** Frozen input to `composeEpitaph` — a flat, pure snapshot derived from the
 *  dead RunState by the death reduction. The epitaph module reads ONLY this
 *  (never RunState directly), so composition stays a pure function of summary
 *  + seed. The reducer death-hook (Orchestrator-owned) populates every field. */
export interface RunSummary {
  seed: number;
  ageAtDeathYears: number;
  expectedLifespanYears: number; // nominal; drives cutShort/lateBloom/unbroken arcs
  cause: "vitality" | "breakthrough" | "abandoned";
  finalAlignment: number; // alignment.holyUnholy at death
  alignmentCaps: { minCap: number; maxCap: number };
  gatesCrossed: GateId[];
  firstNotableEventYear: number | null; // earliest gate/legendary/boss age (lateBloom)
  peakGold: number;
  bossesFelled: number;
  deepestDungeonIndex: number;
  dungeonLadderSize: number; // total dungeons in the ladder (delver scoring)
  jobYears: number; // life-years spent working a job
  delveYears: number; // life-years spent delving
  studyArtsKnown: number;
  studyTopStage: number; // highest study stage reached this life (knowledge facet)
  codexDiscoveriesThisLife: number;
  tagCounts: Partial<Record<Tag, number>>; // tagged items/talents/traits/arts held at death
  chronicle: ChronicleEntry[];
}

// ─── Avatar (LPC paperdoll) ──────────────────────────────────────────────────

export interface LpcLayer {
  sheetId: string; // e.g. 'torso/robes/hollow_initiate'
  variant: string; // palette/color variant
  zPos: number; // from ULPC z-positioning data
}

export interface PaletteOverride {
  target: string; // layer/region key the override applies to
  variant: string;
}

export interface LpcSelection {
  layers: LpcLayer[]; // ordered by zPos
  paletteOverrides: PaletteOverride[];
}

// ─── Core State Interfaces ───────────────────────────────────────────────────

export interface AlignmentState {
  holyUnholy: number; // current value (spec "value"), -100 (Abyss)..+100 (Holy)
  minCap: number; // reachable floor; starts -100, raised by crossing Holy gates
  maxCap: number; // reachable ceiling; starts +100, lowered by crossing Abyss gates
  gatesCrossed: GateId[]; // ordered crossing history, for chronicle/epitaph/avatar
}

export interface LifespanState {
  ageSeconds: number;
  vitality: number; // 0..100
  stage: BiologicalStage;
}

export interface ResourceState {
  gold: number;
  essence: number;
}

export interface ItemInstance {
  instanceId: string;
  itemId: string;
}

export interface InventoryState {
  items: ItemInstance[];
}

export interface EquipmentState {
  weapon?: string; // instanceId
  armor?: string;
  artifact?: string;
}

export interface TalentState {
  unlockedNodeIds: string[];
}

export interface ActiveDungeonState {
  dungeonId: string;
  startedAtUnixSec: number;
  completesAtUnixSec: number;
}

export interface RunState {
  seed: number;
  alive: boolean;
  alignment: AlignmentState;
  lifespan: LifespanState;
  visibleTraitIds: string[];
  hiddenTraitIds: string[];
  evolvedTraitIds: string[]; // trait IDs that have reached their evolved stage
  discoveryMomentum: number; // accumulates from dungeon clears + discoveryRate; drives momentum reveals
  activeLegacyPerkIds: string[]; // snapshot of meta.legacyPerks at run start
  legacyPath: "holy" | "abyss" | "knowledge" | null; // snapshot of meta.legacyPath at run start
  inventory: InventoryState;
  equipment: EquipmentState;
  talents: TalentState;
  resources: ResourceState;
  currentDungeon: ActiveDungeonState | null;
  currentJobId: string | null;
  occupation: "job" | "study" | "idle"; // the one occupation slot; currentJobId is the job detail
  deathCause?: "vitality" | "breakthrough"; // set at death; "breakthrough" → ascensionDeath epitaph arc
  lastTickUnixSec: number;
  deepestDungeonIndex: number;
  totalDungeonsCompleted: number;
  bossesCleared: string[];
  runLog: RunLogEntry[];
  // ─── Identity systems (F1 shells; behavior added in later waves) ───
  chronicle: ChronicleEntry[]; // reference-based drastic-event log; persists into the death record
  study: StudyState; // occupation runs alongside currentJobId (study pauses job income — Wave 2b)
  appearanceSelection?: LpcSelection; // recomputable avatar cache; omitted until Wave 3 populates it
}

export interface MetaProgress {
  unlockedDungeonIds: string[];
  unlockedJobIds: string[];
  discoveredTraitIds: string[];
  discoveredItemIds: string[];
  codexEntries: string[];
  legacyAsh: number;
  totalRuns: number;
  legacyPath: "holy" | "abyss" | "knowledge" | null; // chosen once per save, shapes prestige perks
  legacyPerks: string[]; // IDs of purchased permanent perks
}

// ─── Achievement & Sub-Character Types ───────────────────────────────────────

export interface AchievementDef {
  id: string; // "boss_50", "survive_1000", "depth_20", etc.
  title: string; // "Monster Slayer"
  description: string; // "Defeat 50 bosses across all runs"
  category: "milestone" | "challenge" | "path";
  triggerType: "bossCount" | "survivalTime" | "depthReached" | "pathCompleted";
  triggerValue: number; // e.g., 50 for boss_50
  reward?: {
    vitalityBoost?: number; // e.g., 0.05 for +5%
    essenceRateBoost?: number;
    goldRateBoost?: number;
    discoveryRateBoost?: number;
  };
}

export interface AchievementTracker {
  unlockedIds: string[]; // One-time; IDs of achievements player has earned
  milestoneProgress: {
    totalBossesFelled: number; // Global across all runs + subs
    totalSurvivalSeconds: number; // Global cumulative
    maxDepthEverReached: number; // Global single-run record
    distinctPathsCompleted: string[]; // "holy", "abyss", "knowledge" completed by any char
  };
}

export interface SubCharacterAutomationConfig {
  enabled: boolean; // when true, auto-restart this sub's life on death
}

export interface SubCharacterStats {
  totalRunsCompleted: number;
  totalBossesDefeated: number;
  maxDepthReached: number;
  totalSurvivalSeconds: number;
  ashEarned: number; // Cumulative lifetime ash earned from all deaths
}

export interface SubCharacter {
  id: string; // "sub_0", "sub_1", etc.
  name: string; // Player-assigned name
  path: "holy" | "abyss" | "knowledge" | null;
  meta: MetaProgress; // Own legacy progression, independent from main
  currentRun: RunState | null; // Own active run
  automationConfig: SubCharacterAutomationConfig;
  stats: SubCharacterStats;
  createdAtUnixSec: number;
}

export interface SaveFile {
  version: number;
  updatedAtUnixSec: number;
  meta: MetaProgress;
  currentRun: RunState | null;
  playthroughArchive: PlaythroughArchive;
  subCharacters: SubCharacter[]; // Max 5
  subCharactersUnlocked: boolean; // true once the first character clears the final dungeon
  achievements: AchievementTracker;
  showWelcomeBack?: boolean; // transient: set by reconcileOffline, cleared after display
  transientEffects?: DrasticEffect[]; // transient: drastic-event ceremony queue, drained by the UI
}

export interface PlaythroughTimelineEvent {
  name: string;
  payload: Record<string, unknown>;
  seq: number;
}

export interface PlaythroughScoreSummary {
  total: number;
  dungeonDepthScore: number;
  legacyAshScore: number;
  survivalScore: number;
  discoveryScore: number;
  buildDiversityScore: number;
  dominancePenalty: number;
}

export interface PlaythroughLegacyAsh {
  earned: number;
  baseBreakdown: {
    total: number;
    depthBonus: number;
    ageBonus: number;
    bossBonus: number;
    dungeonBonus: number;
  };
  evolutionBonus: number;
  momentumBonus: number;
}

export interface PlaythroughRecord {
  id: string;
  recordVersion: number;
  recordedAtUnixSec: number;
  seed: number;
  outcome: "death" | "abandoned";
  finalRun: RunState;
  finalMeta: MetaProgress;
  finalScore: PlaythroughScoreSummary;
  legacyAsh: PlaythroughLegacyAsh;
  timeline: PlaythroughTimelineEvent[];
  // ─── Past-life identity (F1 shells; populated at death by later waves) ───
  epitaph?: Epitaph; // generated death epitaph (Wave 2a)
  chronicle?: ChronicleEntry[]; // snapshot of the run's chronicle at death
  appearanceSelection?: LpcSelection; // avatar selection, for lazy Codex portrait re-render
  notable?: boolean; // pinned against retention pruning (tier-3 gate or top-3 ash)
}

export interface PlaythroughArchive {
  version: number;
  maxRecords: number;
  records: PlaythroughRecord[];
}

// ─── Computed Stats ───────────────────────────────────────────────────────────

export type ComputedStats = Record<StatKey, number>;

export interface StatTrace {
  stat: StatKey;
  finalValue: number;
  contributions: Array<{ source: string; op: ModifierOp; value: number }>;
}
