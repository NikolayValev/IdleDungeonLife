import type { SaveFile } from "./types";

const SAVE_KEY = "idledungeonlife_save";
export const SAVE_VERSION = 1;

/** Persist save file to localStorage. */
export function saveToDisk(save: SaveFile): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...save, updatedAtUnixSec: Math.floor(Date.now() / 1000) }));
  } catch (e) {
    console.error("[save] Failed to write save:", e);
  }
}

/** Load save file from localStorage. Returns null if not found or invalid. */
export function loadFromDisk(): SaveFile | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveFile;
    if (typeof parsed.version !== "number") return null;
    return parsed;
  } catch (e) {
    console.error("[save] Failed to read save:", e);
    return null;
  }
}

/** Clear the save slot. */
export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/** Build a fresh empty save. */
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
