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

// ─── Core State Interfaces ───────────────────────────────────────────────────

export interface AlignmentState {
  holyUnholy: number; // -100 to +100, negative = unholy, positive = holy
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
  lastTickUnixSec: number;
  deepestDungeonIndex: number;
  totalDungeonsCompleted: number;
  bossesCleared: string[];
  runLog: RunLogEntry[];
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
