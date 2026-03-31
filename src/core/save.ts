import type { SaveFile } from "./types";

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
  const base = freshSave(
    typeof input.updatedAtUnixSec === "number" ? input.updatedAtUnixSec : 0
  );
  const meta: Record<string, unknown> = isRecord(input.meta) ? input.meta : {};

  return {
    version: SAVE_VERSION,
    updatedAtUnixSec:
      typeof input.updatedAtUnixSec === "number" ? input.updatedAtUnixSec : 0,
    meta: {
      unlockedDungeonIds: hasStringArray(meta.unlockedDungeonIds)
        ? [...new Set(meta.unlockedDungeonIds)]
        : base.meta.unlockedDungeonIds,
      unlockedJobIds: hasStringArray(meta.unlockedJobIds)
        ? [...new Set(meta.unlockedJobIds)]
        : base.meta.unlockedJobIds,
      discoveredTraitIds: hasStringArray(meta.discoveredTraitIds)
        ? [...new Set(meta.discoveredTraitIds)]
        : [],
      discoveredItemIds: hasStringArray(meta.discoveredItemIds)
        ? [...new Set(meta.discoveredItemIds)]
        : [],
      codexEntries: hasStringArray(meta.codexEntries)
        ? [...new Set(meta.codexEntries)]
        : [],
      legacyAsh: typeof meta.legacyAsh === "number" ? meta.legacyAsh : 0,
      totalRuns: typeof meta.totalRuns === "number" ? meta.totalRuns : 0,
    },
    currentRun: input.currentRun ?? null,
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
