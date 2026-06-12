import type {
  ActiveDungeonState,
  AchievementTracker,
  AlignmentState,
  BiologicalStage,
  ArcId,
  ChronicleEntry,
  DrasticEventKind,
  Epitaph,
  EquipmentState,
  FacetId,
  GateId,
  ItemInstance,
  LpcSelection,
  MetaProgress,
  PlaythroughArchive,
  PlaythroughLegacyAsh,
  PlaythroughRecord,
  PlaythroughScoreSummary,
  PlaythroughTimelineEvent,
  RunState,
  SaveFile,
  SchoolId,
  SchoolProgress,
  StudyState,
  SubCharacter,
} from "./types";
import { DUNGEON_REGISTRY, FINAL_DUNGEON } from "../content/dungeons";
import { ITEM_REGISTRY } from "../content/items";

const SAVE_KEY = "idledungeonlife_save";
export const SAVE_VERSION = 4;
export const PLAYTHROUGH_ARCHIVE_VERSION = 1;
export const PLAYTHROUGH_ARCHIVE_MAX_RECORDS = 100;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function uniqueStrings(value: unknown): string[] {
  return hasStringArray(value) ? [...new Set(value)] : [];
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return Math.max(0, finiteNumber(value, fallback));
}

function validStage(value: unknown): BiologicalStage {
  return value === "youth" || value === "prime" || value === "decline" || value === "terminal"
    ? value
    : "youth";
}

function migrateEquipment(value: unknown, inventoryItems: ItemInstance[]): EquipmentState {
  if (!isRecord(value)) return {};

  const inventoryByInstanceId = new Map(inventoryItems.map((item) => [item.instanceId, item]));

  const migrateSlot = (slot: keyof EquipmentState): string | undefined => {
    const instanceId = typeof value[slot] === "string" ? value[slot] : undefined;
    if (!instanceId) return undefined;

    const item = inventoryByInstanceId.get(instanceId);
    if (!item) return undefined;

    const def = ITEM_REGISTRY.get(item.itemId);
    return def?.slot === slot ? instanceId : undefined;
  };

  const weapon = migrateSlot("weapon");
  const armor = migrateSlot("armor");
  const artifact = migrateSlot("artifact");

  return {
    ...(weapon ? { weapon } : {}),
    ...(armor ? { armor } : {}),
    ...(artifact ? { artifact } : {}),
  };
}

function migrateInventoryItems(value: unknown): ItemInstance[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .filter((item) => typeof item.instanceId === "string" && typeof item.itemId === "string")
    .map((item) => ({
      instanceId: item.instanceId as string,
      itemId: item.itemId as string,
    }));
}

function validLegacyPath(value: unknown): "holy" | "abyss" | "knowledge" | null {
  return value === "holy" || value === "abyss" || value === "knowledge" ? value : null;
}

// ─── Identity-systems migration (F1) ─────────────────────────────────────────

const VALID_GATES: readonly string[] = [
  "abyss_1",
  "abyss_2",
  "abyss_3",
  "holy_1",
  "holy_2",
  "holy_3",
];
const VALID_SCHOOLS: readonly string[] = ["choir", "hollow_order", "archive"];
const VALID_DRASTIC_KINDS: readonly string[] = [
  "gateCrossed",
  "breakthrough",
  "traitEvolved",
  "legendaryFound",
  "bossFelled",
  "jobTaken",
  "deepestDelve",
  "death",
];

function clampNumber(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

function migrateAlignment(value: unknown): AlignmentState {
  const raw = isRecord(value) ? value : {};
  // Legacy saves carry only `holyUnholy`: value preserved, caps full-range, no history.
  const minCap = clampNumber(finiteNumber(raw.minCap, -100), -100, 100);
  const maxCap = clampNumber(finiteNumber(raw.maxCap, 100), minCap, 100);
  const holyUnholy = clampNumber(finiteNumber(raw.holyUnholy, 0), minCap, maxCap);
  const gatesCrossed = Array.isArray(raw.gatesCrossed)
    ? raw.gatesCrossed.filter((g): g is GateId => typeof g === "string" && VALID_GATES.includes(g))
    : [];
  return { holyUnholy, minCap, maxCap, gatesCrossed };
}

function migrateChronicle(value: unknown): ChronicleEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .filter((entry) => typeof entry.kind === "string" && VALID_DRASTIC_KINDS.includes(entry.kind))
    .map((entry) => ({
      year: Math.max(0, finiteNumber(entry.year, 0)),
      kind: entry.kind as DrasticEventKind,
      ...(typeof entry.refId === "string" ? { refId: entry.refId } : {}),
    }));
}

function migrateSchoolProgress(value: unknown): SchoolProgress {
  const raw = isRecord(value) ? value : {};
  return {
    stage: clampNumber(Math.floor(finiteNumber(raw.stage, 0)), 0, 5),
    refinement: clampNumber(finiteNumber(raw.refinement, 0), 0, 100),
    bottlenecked: raw.bottlenecked === true,
  };
}

function migrateStudy(value: unknown): StudyState {
  const raw = isRecord(value) ? value : {};
  const schoolsRaw = isRecord(raw.schools) ? raw.schools : {};
  return {
    enrolled:
      typeof raw.enrolled === "string" && VALID_SCHOOLS.includes(raw.enrolled)
        ? (raw.enrolled as SchoolId)
        : null,
    schools: {
      choir: migrateSchoolProgress(schoolsRaw.choir),
      hollow_order: migrateSchoolProgress(schoolsRaw.hollow_order),
      archive: migrateSchoolProgress(schoolsRaw.archive),
    },
    artsKnown: uniqueStrings(raw.artsKnown),
  };
}

function migrateAppearanceSelection(value: unknown): LpcSelection | undefined {
  if (!isRecord(value) || !Array.isArray(value.layers) || !Array.isArray(value.paletteOverrides)) {
    return undefined;
  }
  const layers = value.layers
    .filter(isRecord)
    .filter((l) => typeof l.sheetId === "string" && typeof l.variant === "string")
    .map((l) => ({
      sheetId: l.sheetId as string,
      variant: l.variant as string,
      zPos: finiteNumber(l.zPos, 0),
    }));
  const paletteOverrides = value.paletteOverrides
    .filter(isRecord)
    .filter((p) => typeof p.target === "string" && typeof p.variant === "string")
    .map((p) => ({ target: p.target as string, variant: p.variant as string }));
  return { layers, paletteOverrides };
}

const VALID_FACETS: readonly string[] = [
  "holy",
  "abyss",
  "knowledge",
  "wealth",
  "vitality",
  "decay",
  "fate",
  "delver",
  "toiler",
];
const VALID_ARCS: readonly string[] = [
  "redeemed",
  "fallen",
  "forsaken",
  "sanctified",
  "lateBloom",
  "cutShort",
  "unbroken",
  "ascensionDeath",
];

function migrateEpitaph(value: unknown): Epitaph | undefined {
  if (!isRecord(value)) return undefined;
  if (!hasStringArray(value.lines)) return undefined;
  if (typeof value.primaryFacet !== "string" || !VALID_FACETS.includes(value.primaryFacet)) {
    return undefined;
  }
  return {
    lines: value.lines,
    primaryFacet: value.primaryFacet as FacetId,
    ...(typeof value.secondaryFacet === "string" && VALID_FACETS.includes(value.secondaryFacet)
      ? { secondaryFacet: value.secondaryFacet as FacetId }
      : {}),
    ...(typeof value.arc === "string" && VALID_ARCS.includes(value.arc)
      ? { arc: value.arc as ArcId }
      : {}),
  };
}

export function emptyStudyState(): StudyState {
  return {
    enrolled: null,
    schools: {
      choir: { stage: 0, refinement: 0, bottlenecked: false },
      hollow_order: { stage: 0, refinement: 0, bottlenecked: false },
      archive: { stage: 0, refinement: 0, bottlenecked: false },
    },
    artsKnown: [],
  };
}

function emptyPlaythroughArchive(maxRecords = PLAYTHROUGH_ARCHIVE_MAX_RECORDS): PlaythroughArchive {
  return {
    version: PLAYTHROUGH_ARCHIVE_VERSION,
    maxRecords,
    records: [],
  };
}

function migrateMeta(value: unknown, fallback: MetaProgress): MetaProgress {
  const meta = isRecord(value) ? value : {};

  return {
    unlockedDungeonIds: hasStringArray(meta.unlockedDungeonIds)
      ? uniqueStrings(meta.unlockedDungeonIds)
      : fallback.unlockedDungeonIds,
    unlockedJobIds: hasStringArray(meta.unlockedJobIds)
      ? uniqueStrings(meta.unlockedJobIds)
      : fallback.unlockedJobIds,
    discoveredTraitIds: uniqueStrings(meta.discoveredTraitIds),
    discoveredItemIds: uniqueStrings(meta.discoveredItemIds),
    codexEntries: uniqueStrings(meta.codexEntries),
    legacyAsh: nonNegativeNumber(meta.legacyAsh, 0),
    totalRuns: nonNegativeNumber(meta.totalRuns, 0),
    legacyPath: validLegacyPath(meta.legacyPath),
    legacyPerks: uniqueStrings(meta.legacyPerks),
  };
}

function migrateTimelineEvent(value: unknown): PlaythroughTimelineEvent | null {
  if (!isRecord(value)) return null;
  if (typeof value.name !== "string") return null;
  if (!isRecord(value.payload)) return null;

  return {
    name: value.name,
    payload: value.payload,
    seq: Math.max(0, Math.floor(finiteNumber(value.seq, 0))),
  };
}

function migrateScoreSummary(value: unknown): PlaythroughScoreSummary {
  const raw = isRecord(value) ? value : {};

  return {
    total: finiteNumber(raw.total, 0),
    dungeonDepthScore: finiteNumber(raw.dungeonDepthScore, 0),
    legacyAshScore: finiteNumber(raw.legacyAshScore, 0),
    survivalScore: finiteNumber(raw.survivalScore, 0),
    discoveryScore: finiteNumber(raw.discoveryScore, 0),
    buildDiversityScore: finiteNumber(raw.buildDiversityScore, 0),
    dominancePenalty: finiteNumber(raw.dominancePenalty, 0),
  };
}

function migrateLegacyAsh(value: unknown): PlaythroughLegacyAsh {
  const raw = isRecord(value) ? value : {};
  const baseRaw = isRecord(raw.baseBreakdown) ? raw.baseBreakdown : {};

  return {
    earned: nonNegativeNumber(raw.earned, 0),
    baseBreakdown: {
      total: nonNegativeNumber(baseRaw.total, 0),
      depthBonus: nonNegativeNumber(baseRaw.depthBonus, 0),
      ageBonus: nonNegativeNumber(baseRaw.ageBonus, 0),
      bossBonus: nonNegativeNumber(baseRaw.bossBonus, 0),
      dungeonBonus: nonNegativeNumber(baseRaw.dungeonBonus, 0),
    },
    evolutionBonus: nonNegativeNumber(raw.evolutionBonus, 0),
    momentumBonus: nonNegativeNumber(raw.momentumBonus, 0),
  };
}

function migratePlaythroughRecord(
  value: unknown,
  fallbackNowUnixSec: number,
  metaFallback: MetaProgress
): PlaythroughRecord | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;

  const finalRun = migrateRun(value.finalRun, fallbackNowUnixSec);
  if (!finalRun) return null;

  const finalMeta = migrateMeta(value.finalMeta, metaFallback);
  const timeline = Array.isArray(value.timeline)
    ? value.timeline
        .map(migrateTimelineEvent)
        .filter((entry): entry is PlaythroughTimelineEvent => entry !== null)
    : [];

  const epitaph = migrateEpitaph(value.epitaph);
  const chronicle = migrateChronicle(value.chronicle);
  const appearanceSelection = migrateAppearanceSelection(value.appearanceSelection);

  return {
    id: value.id,
    recordVersion: Math.max(1, Math.floor(finiteNumber(value.recordVersion, 1))),
    recordedAtUnixSec: nonNegativeNumber(value.recordedAtUnixSec, fallbackNowUnixSec),
    seed: Math.floor(finiteNumber(value.seed, finalRun.seed)),
    outcome: value.outcome === "abandoned" ? "abandoned" : "death",
    finalRun,
    finalMeta,
    finalScore: migrateScoreSummary(value.finalScore),
    legacyAsh: migrateLegacyAsh(value.legacyAsh),
    timeline,
    ...(epitaph ? { epitaph } : {}),
    ...(chronicle.length > 0 ? { chronicle } : {}),
    ...(appearanceSelection ? { appearanceSelection } : {}),
    ...(value.notable === true ? { notable: true } : {}),
  };
}

function migratePlaythroughArchive(
  value: unknown,
  fallbackNowUnixSec: number,
  metaFallback: MetaProgress
): PlaythroughArchive {
  if (!isRecord(value)) {
    return emptyPlaythroughArchive();
  }

  const configuredMax = Math.max(
    1,
    Math.floor(nonNegativeNumber(value.maxRecords, PLAYTHROUGH_ARCHIVE_MAX_RECORDS))
  );
  const records = Array.isArray(value.records)
    ? value.records
        .map((entry) => migratePlaythroughRecord(entry, fallbackNowUnixSec, metaFallback))
        .filter((entry): entry is PlaythroughRecord => entry !== null)
    : [];

  return {
    version: Math.max(
      PLAYTHROUGH_ARCHIVE_VERSION,
      Math.floor(finiteNumber(value.version, PLAYTHROUGH_ARCHIVE_VERSION))
    ),
    maxRecords: configuredMax,
    records: records.slice(Math.max(0, records.length - configuredMax)),
  };
}

function migrateActiveDungeon(value: unknown): ActiveDungeonState | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  if (typeof value.dungeonId !== "string") return null;
  if (!DUNGEON_REGISTRY.has(value.dungeonId)) return null;

  const startedAtUnixSec = finiteNumber(value.startedAtUnixSec, 0);
  const completesAtUnixSec = finiteNumber(value.completesAtUnixSec, startedAtUnixSec);

  return {
    dungeonId: value.dungeonId,
    startedAtUnixSec,
    completesAtUnixSec: Math.max(startedAtUnixSec, completesAtUnixSec),
  };
}

function migrateRun(value: unknown, fallbackNowUnixSec: number): RunState | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  if (
    typeof value.seed !== "number" ||
    typeof value.alive !== "boolean" ||
    !isRecord(value.alignment) ||
    !isRecord(value.lifespan) ||
    !isRecord(value.inventory) ||
    !isRecord(value.resources)
  ) {
    return null;
  }

  const talents = isRecord(value.talents) ? value.talents : {};
  const inventoryItems = migrateInventoryItems(value.inventory.items);
  const appearanceSelection = migrateAppearanceSelection(value.appearanceSelection);

  return {
    seed: finiteNumber(value.seed, 0),
    alive: value.alive,
    alignment: migrateAlignment(value.alignment),
    lifespan: {
      ageSeconds: nonNegativeNumber(value.lifespan.ageSeconds, 0),
      vitality: Math.max(0, Math.min(100, finiteNumber(value.lifespan.vitality, 100))),
      stage: validStage(value.lifespan.stage),
    },
    visibleTraitIds: uniqueStrings(value.visibleTraitIds),
    hiddenTraitIds: uniqueStrings(value.hiddenTraitIds),
    evolvedTraitIds: uniqueStrings(value.evolvedTraitIds),
    discoveryMomentum: nonNegativeNumber(value.discoveryMomentum, 0),
    activeLegacyPerkIds: uniqueStrings(value.activeLegacyPerkIds),
    legacyPath: validLegacyPath(value.legacyPath),
    inventory: {
      items: inventoryItems,
    },
    equipment: migrateEquipment(value.equipment, inventoryItems),
    talents: {
      unlockedNodeIds: uniqueStrings(talents.unlockedNodeIds),
    },
    resources: {
      gold: nonNegativeNumber(value.resources.gold, 0),
      essence: nonNegativeNumber(value.resources.essence, 0),
    },
    currentDungeon: migrateActiveDungeon(value.currentDungeon),
    currentJobId: typeof value.currentJobId === "string" ? value.currentJobId : null,
    lastTickUnixSec: finiteNumber(value.lastTickUnixSec, fallbackNowUnixSec),
    deepestDungeonIndex: finiteNumber(value.deepestDungeonIndex, -1),
    totalDungeonsCompleted: nonNegativeNumber(value.totalDungeonsCompleted, 0),
    bossesCleared: uniqueStrings(value.bossesCleared),
    runLog: [],
    chronicle: migrateChronicle(value.chronicle),
    study: migrateStudy(value.study),
    ...(appearanceSelection ? { appearanceSelection } : {}),
  };
}

function migrateAchievements(value: unknown, fallback: AchievementTracker): AchievementTracker {
  if (!isRecord(value)) return fallback;
  const m = isRecord(value.milestoneProgress) ? value.milestoneProgress : {};
  return {
    unlockedIds: uniqueStrings(value.unlockedIds),
    milestoneProgress: {
      totalBossesFelled: nonNegativeNumber(m.totalBossesFelled, 0),
      totalSurvivalSeconds: nonNegativeNumber(m.totalSurvivalSeconds, 0),
      maxDepthEverReached: Math.max(0, finiteNumber(m.maxDepthEverReached, 0)),
      distinctPathsCompleted: uniqueStrings(m.distinctPathsCompleted),
    },
  };
}

function migrateSubCharacter(value: unknown, fallbackNowUnixSec: number): SubCharacter | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;

  const defaultMeta: MetaProgress = {
    unlockedDungeonIds: ["abandoned_chapel"],
    unlockedJobIds: ["porter"],
    discoveredTraitIds: [],
    discoveredItemIds: [],
    codexEntries: [],
    legacyAsh: 0,
    totalRuns: 0,
    legacyPath: null,
    legacyPerks: [],
  };

  const autoConf = isRecord(value.automationConfig) ? value.automationConfig : {};
  const stats = isRecord(value.stats) ? value.stats : {};

  return {
    id: value.id,
    name: value.name,
    path: validLegacyPath(value.path),
    meta: migrateMeta(value.meta, defaultMeta),
    currentRun: migrateRun(value.currentRun, fallbackNowUnixSec),
    automationConfig: {
      enabled: autoConf.enabled === true,
    },
    stats: {
      totalRunsCompleted: nonNegativeNumber(stats.totalRunsCompleted, 0),
      totalBossesDefeated: nonNegativeNumber(stats.totalBossesDefeated, 0),
      maxDepthReached: Math.max(0, finiteNumber(stats.maxDepthReached, 0)),
      totalSurvivalSeconds: nonNegativeNumber(stats.totalSurvivalSeconds, 0),
      ashEarned: nonNegativeNumber(stats.ashEarned, 0),
    },
    createdAtUnixSec: nonNegativeNumber(value.createdAtUnixSec, fallbackNowUnixSec),
  };
}

function migrateSubCharacters(value: unknown, fallbackNowUnixSec: number): SubCharacter[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => migrateSubCharacter(item, fallbackNowUnixSec))
    .filter((s): s is SubCharacter => s !== null)
    .slice(0, 5);
}

export function freshSave(nowUnixSec: number): SaveFile {
  return {
    version: SAVE_VERSION,
    updatedAtUnixSec: nowUnixSec,
    meta: {
      unlockedDungeonIds: ["abandoned_chapel"],
      unlockedJobIds: ["porter"],
      discoveredTraitIds: [],
      discoveredItemIds: [],
      codexEntries: [],
      legacyAsh: 0,
      totalRuns: 0,
      legacyPath: null,
      legacyPerks: [],
    },
    currentRun: null,
    playthroughArchive: emptyPlaythroughArchive(),
    subCharacters: [],
    subCharactersUnlocked: false,
    achievements: {
      unlockedIds: [],
      milestoneProgress: {
        totalBossesFelled: 0,
        totalSurvivalSeconds: 0,
        maxDepthEverReached: 0,
        distinctPathsCompleted: [],
      },
    },
  };
}

export function migrateSave(input: SaveFile): SaveFile {
  const updatedAtUnixSec = finiteNumber(input.updatedAtUnixSec, 0);
  const base = freshSave(updatedAtUnixSec);
  const inputRecord: Record<string, unknown> = isRecord(input) ? input : {};
  const meta = migrateMeta(input.meta, base.meta);
  const achievements = migrateAchievements(inputRecord.achievements, base.achievements);
  const subCharacters = migrateSubCharacters(inputRecord.subCharacters, updatedAtUnixSec);
  // Backfill the unlock for existing saves: a player who already reached the
  // final dungeon's depth, or who already created sub-characters, keeps access.
  const subCharactersUnlocked =
    inputRecord.subCharactersUnlocked === true ||
    subCharacters.length > 0 ||
    achievements.milestoneProgress.maxDepthEverReached >= FINAL_DUNGEON.depthIndex;

  return {
    version: SAVE_VERSION,
    updatedAtUnixSec,
    meta,
    currentRun: migrateRun(input.currentRun, updatedAtUnixSec),
    playthroughArchive: migratePlaythroughArchive(
      inputRecord.playthroughArchive,
      updatedAtUnixSec,
      base.meta
    ),
    subCharacters,
    subCharactersUnlocked,
    achievements,
  };
}

export function appendPlaythroughRecord(save: SaveFile, record: PlaythroughRecord): SaveFile {
  const currentArchive = save.playthroughArchive ?? emptyPlaythroughArchive();
  const maxRecords = Math.max(
    1,
    Math.floor(nonNegativeNumber(currentArchive.maxRecords, PLAYTHROUGH_ARCHIVE_MAX_RECORDS))
  );
  const nextRecords = [...currentArchive.records, record];

  return {
    ...save,
    playthroughArchive: {
      version: PLAYTHROUGH_ARCHIVE_VERSION,
      maxRecords,
      records: nextRecords.slice(Math.max(0, nextRecords.length - maxRecords)),
    },
  };
}

export function parseSave(raw: string): SaveFile | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const version = typeof parsed.version === "number" ? parsed.version : 0;
    if (version > SAVE_VERSION) {
      return null;
    }

    return migrateSave(parsed as unknown as SaveFile);
  } catch {
    return null;
  }
}

export function saveToStorage(storage: StorageLike, save: SaveFile): void {
  storage.setItem(
    SAVE_KEY,
    JSON.stringify({
      ...save,
      version: SAVE_VERSION,
      updatedAtUnixSec: Math.floor(Date.now() / 1000),
    })
  );
}

export function loadFromStorage(storage: StorageLike): SaveFile | null {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  return parseSave(raw);
}

export function saveToDisk(save: SaveFile): void {
  try {
    if (typeof localStorage === "undefined") return;
    saveToStorage(localStorage, save);
  } catch (e) {
    console.error("[save] Failed to write save:", e);
  }
}

export function loadFromDisk(): SaveFile | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return loadFromStorage(localStorage);
  } catch (e) {
    console.error("[save] Failed to read save:", e);
    return null;
  }
}

export function clearSave(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SAVE_KEY);
}
