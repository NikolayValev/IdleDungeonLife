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
  | { type: "ageSecondsAtLeast"; value: number };

// ─── Unlock Requirements ──────────────────────────────────────────────────────

export interface UnlockRequirement {
  legacyAsh?: number;
  dungeonCleared?: string;
  traitDiscovered?: string;
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
}

export interface MetaProgress {
  unlockedDungeonIds: string[];
  unlockedJobIds: string[];
  discoveredTraitIds: string[];
  discoveredItemIds: string[];
  codexEntries: string[];
  legacyAsh: number;
  totalRuns: number;
}

export interface SaveFile {
  version: number;
  updatedAtUnixSec: number;
  meta: MetaProgress;
  currentRun: RunState | null;
}

// ─── Computed Stats ───────────────────────────────────────────────────────────

export type ComputedStats = Record<StatKey, number>;

export interface StatTrace {
  stat: StatKey;
  finalValue: number;
  contributions: Array<{ source: string; op: ModifierOp; value: number }>;
}
