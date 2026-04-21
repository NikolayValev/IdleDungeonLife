import type {
  ActiveDungeonState,
  BiologicalStage,
  EquipmentState,
  ItemInstance,
  RunState,
  SaveFile,
} from "./types";

const SAVE_KEY = "idledungeonlife_save";
export const SAVE_VERSION = 2;

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
  return value === "youth" ||
    value === "prime" ||
    value === "decline" ||
    value === "terminal"
    ? value
    : "youth";
}

function migrateEquipment(value: unknown): EquipmentState {
  if (!isRecord(value)) return {};

  return {
    ...(typeof value.weapon === "string" ? { weapon: value.weapon } : {}),
    ...(typeof value.armor === "string" ? { armor: value.armor } : {}),
    ...(typeof value.artifact === "string" ? { artifact: value.artifact } : {}),
  };
}

function migrateInventoryItems(value: unknown): ItemInstance[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(isRecord)
    .filter(
      (item) =>
        typeof item.instanceId === "string" && typeof item.itemId === "string"
    )
    .map((item) => ({
      instanceId: item.instanceId as string,
      itemId: item.itemId as string,
    }));
}

function migrateActiveDungeon(value: unknown): ActiveDungeonState | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) return null;
  if (typeof value.dungeonId !== "string") return null;

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

  return {
    seed: finiteNumber(value.seed, 0),
    alive: value.alive,
    alignment: {
      holyUnholy: finiteNumber(value.alignment.holyUnholy, 0),
    },
    lifespan: {
      ageSeconds: nonNegativeNumber(value.lifespan.ageSeconds, 0),
      vitality: Math.max(0, Math.min(100, finiteNumber(value.lifespan.vitality, 100))),
      stage: validStage(value.lifespan.stage),
    },
    visibleTraitIds: uniqueStrings(value.visibleTraitIds),
    hiddenTraitIds: uniqueStrings(value.hiddenTraitIds),
    inventory: {
      items: migrateInventoryItems(value.inventory.items),
    },
    equipment: migrateEquipment(value.equipment),
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
  };
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
    },
    currentRun: null,
  };
}

export function migrateSave(input: SaveFile): SaveFile {
  const updatedAtUnixSec = finiteNumber(input.updatedAtUnixSec, 0);
  const base = freshSave(updatedAtUnixSec);
  const meta: Record<string, unknown> = isRecord(input.meta) ? input.meta : {};

  return {
    version: SAVE_VERSION,
    updatedAtUnixSec,
    meta: {
      unlockedDungeonIds: hasStringArray(meta.unlockedDungeonIds)
        ? uniqueStrings(meta.unlockedDungeonIds)
        : base.meta.unlockedDungeonIds,
      unlockedJobIds: hasStringArray(meta.unlockedJobIds)
        ? uniqueStrings(meta.unlockedJobIds)
        : base.meta.unlockedJobIds,
      discoveredTraitIds: uniqueStrings(meta.discoveredTraitIds),
      discoveredItemIds: uniqueStrings(meta.discoveredItemIds),
      codexEntries: uniqueStrings(meta.codexEntries),
      legacyAsh: nonNegativeNumber(meta.legacyAsh, 0),
      totalRuns: nonNegativeNumber(meta.totalRuns, 0),
    },
    currentRun: migrateRun(input.currentRun, updatedAtUnixSec),
  };
}

export function parseSave(raw: string): SaveFile | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const version =
      typeof parsed.version === "number" ? parsed.version : 0;
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
