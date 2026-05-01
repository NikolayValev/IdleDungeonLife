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
  evolvedTraitIds: string[];        // trait IDs that have reached their evolved stage
  discoveryMomentum: number;        // accumulates from dungeon clears + discoveryRate; drives momentum reveals
  activeLegacyPerkIds: string[];    // snapshot of meta.legacyPerks at run start
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

export interface SaveFile {
  version: number;
  updatedAtUnixSec: number;
  meta: MetaProgress;
  currentRun: RunState | null;
  showWelcomeBack?: boolean; // transient: set by reconcileOffline, cleared after display
}

// ─── Computed Stats ───────────────────────────────────────────────────────────

export type ComputedStats = Record<StatKey, number>;

export interface StatTrace {
  stat: StatKey;
  finalValue: number;
  contributions: Array<{ source: string; op: ModifierOp; value: number }>;
}
