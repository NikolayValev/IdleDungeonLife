"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SAVE_VERSION = void 0;
exports.freshSave = freshSave;
exports.migrateSave = migrateSave;
exports.parseSave = parseSave;
exports.saveToStorage = saveToStorage;
exports.loadFromStorage = loadFromStorage;
exports.saveToDisk = saveToDisk;
exports.loadFromDisk = loadFromDisk;
exports.clearSave = clearSave;
const SAVE_KEY = "idledungeonlife_save";
exports.SAVE_VERSION = 3;
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function hasStringArray(value) {
    return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function uniqueStrings(value) {
    return hasStringArray(value) ? [...new Set(value)] : [];
}
function finiteNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function nonNegativeNumber(value, fallback) {
    return Math.max(0, finiteNumber(value, fallback));
}
function validStage(value) {
    return value === "youth" ||
        value === "prime" ||
        value === "decline" ||
        value === "terminal"
        ? value
        : "youth";
}
function migrateEquipment(value) {
    if (!isRecord(value))
        return {};
    return {
        ...(typeof value.weapon === "string" ? { weapon: value.weapon } : {}),
        ...(typeof value.armor === "string" ? { armor: value.armor } : {}),
        ...(typeof value.artifact === "string" ? { artifact: value.artifact } : {}),
    };
}
function migrateInventoryItems(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter(isRecord)
        .filter((item) => typeof item.instanceId === "string" && typeof item.itemId === "string")
        .map((item) => ({
        instanceId: item.instanceId,
        itemId: item.itemId,
    }));
}
function validLegacyPath(value) {
    return value === "holy" || value === "abyss" || value === "knowledge" ? value : null;
}
function migrateActiveDungeon(value) {
    if (value === null || value === undefined)
        return null;
    if (!isRecord(value))
        return null;
    if (typeof value.dungeonId !== "string")
        return null;
    const startedAtUnixSec = finiteNumber(value.startedAtUnixSec, 0);
    const completesAtUnixSec = finiteNumber(value.completesAtUnixSec, startedAtUnixSec);
    return {
        dungeonId: value.dungeonId,
        startedAtUnixSec,
        completesAtUnixSec: Math.max(startedAtUnixSec, completesAtUnixSec),
    };
}
function migrateRun(value, fallbackNowUnixSec) {
    if (value === null || value === undefined)
        return null;
    if (!isRecord(value))
        return null;
    if (typeof value.seed !== "number" ||
        typeof value.alive !== "boolean" ||
        !isRecord(value.alignment) ||
        !isRecord(value.lifespan) ||
        !isRecord(value.inventory) ||
        !isRecord(value.resources)) {
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
        evolvedTraitIds: uniqueStrings(value.evolvedTraitIds),
        discoveryMomentum: nonNegativeNumber(value.discoveryMomentum, 0),
        activeLegacyPerkIds: uniqueStrings(value.activeLegacyPerkIds),
        legacyPath: validLegacyPath(value.legacyPath),
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
        runLog: [],
    };
}
function freshSave(nowUnixSec) {
    return {
        version: exports.SAVE_VERSION,
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
    };
}
function migrateSave(input) {
    const updatedAtUnixSec = finiteNumber(input.updatedAtUnixSec, 0);
    const base = freshSave(updatedAtUnixSec);
    const meta = isRecord(input.meta) ? input.meta : {};
    return {
        version: exports.SAVE_VERSION,
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
            legacyPath: validLegacyPath(meta.legacyPath),
            legacyPerks: uniqueStrings(meta.legacyPerks),
        },
        currentRun: migrateRun(input.currentRun, updatedAtUnixSec),
    };
}
function parseSave(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed))
            return null;
        const version = typeof parsed.version === "number" ? parsed.version : 0;
        if (version > exports.SAVE_VERSION) {
            return null;
        }
        return migrateSave(parsed);
    }
    catch {
        return null;
    }
}
function saveToStorage(storage, save) {
    storage.setItem(SAVE_KEY, JSON.stringify({
        ...save,
        version: exports.SAVE_VERSION,
        updatedAtUnixSec: Math.floor(Date.now() / 1000),
    }));
}
function loadFromStorage(storage) {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw)
        return null;
    return parseSave(raw);
}
function saveToDisk(save) {
    try {
        if (typeof localStorage === "undefined")
            return;
        saveToStorage(localStorage, save);
    }
    catch (e) {
        console.error("[save] Failed to write save:", e);
    }
}
function loadFromDisk() {
    try {
        if (typeof localStorage === "undefined")
            return null;
        return loadFromStorage(localStorage);
    }
    catch (e) {
        console.error("[save] Failed to read save:", e);
        return null;
    }
}
function clearSave() {
    if (typeof localStorage === "undefined")
        return;
    localStorage.removeItem(SAVE_KEY);
}
