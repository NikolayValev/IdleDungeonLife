import type { SaveFile } from "../core/types";
import { reduceGame } from "../core/reducer";
import { ITEM_REGISTRY } from "../content/items";
import { JOB_REGISTRY } from "../content/jobs";
import { clearSave, freshSave } from "../core/save";

/**
 * Debug action dispatcher. All actions are safe for development only.
 * In production builds, these are no-ops.
 */
export interface DebugActions {
  addGold(amount: number): void;
  addEssence(amount: number): void;
  grantItem(itemId: string): void;
  unlockDungeon(dungeonId: string): void;
  unlockAllJobs(): void;
  killRun(): void;
  simulateSeconds(seconds: number): void;
  resetSave(): void;
}

export function createDebugActions(
  getSave: () => SaveFile,
  setSave: (save: SaveFile) => void,
  onRefresh: () => void
): DebugActions {
  const now = () => Math.floor(Date.now() / 1000);

  return {
    addGold(amount) {
      const save = getSave();
      if (!save.currentRun) return;
      setSave({
        ...save,
        currentRun: {
          ...save.currentRun,
          resources: {
            ...save.currentRun.resources,
            gold: save.currentRun.resources.gold + amount,
          },
        },
      });
      onRefresh();
    },

    addEssence(amount) {
      const save = getSave();
      if (!save.currentRun) return;
      setSave({
        ...save,
        currentRun: {
          ...save.currentRun,
          resources: {
            ...save.currentRun.resources,
            essence: save.currentRun.resources.essence + amount,
          },
        },
      });
      onRefresh();
    },

    grantItem(itemId) {
      const save = getSave();
      if (!save.currentRun) return;
      const def = ITEM_REGISTRY.get(itemId);
      if (!def) {
        console.warn(`[debug] Unknown itemId: ${itemId}`);
        return;
      }
      const inst = { instanceId: `debug_${itemId}_${Date.now()}`, itemId };
      setSave({
        ...save,
        currentRun: {
          ...save.currentRun,
          inventory: {
            items: [...save.currentRun.inventory.items, inst],
          },
        },
      });
      onRefresh();
    },

    unlockDungeon(dungeonId) {
      const save = getSave();
      if (save.meta.unlockedDungeonIds.includes(dungeonId)) return;
      setSave({
        ...save,
        meta: {
          ...save.meta,
          unlockedDungeonIds: [...save.meta.unlockedDungeonIds, dungeonId],
        },
      });
      onRefresh();
    },

    unlockAllJobs() {
      const save = getSave();
      const allJobIds = [...JOB_REGISTRY.keys()];
      setSave({
        ...save,
        meta: {
          ...save.meta,
          unlockedJobIds: [...new Set([...save.meta.unlockedJobIds, ...allJobIds])],
        },
      });
      onRefresh();
    },

    killRun() {
      const save = getSave();
      if (!save.currentRun) return;
      setSave({
        ...save,
        currentRun: {
          ...save.currentRun,
          alive: false,
          lifespan: { ...save.currentRun.lifespan, vitality: 0 },
        },
      });
      onRefresh();
    },

    simulateSeconds(seconds) {
      let save = getSave();
      const futureNow = now() + seconds;
      save = reduceGame(save, { type: "RECONCILE_OFFLINE", nowUnixSec: futureNow });
      // Update the persisted timestamp so future ticks are correct
      save = { ...save, updatedAtUnixSec: now() };
      if (save.currentRun) {
        save = {
          ...save,
          currentRun: { ...save.currentRun, lastTickUnixSec: now() },
        };
      }
      setSave(save);
      onRefresh();
    },

    resetSave() {
      clearSave();
      setSave(freshSave(now()));
      onRefresh();
    },
  };
}

/**
 * Register debug keyboard shortcuts for web development.
 * Only called in dev builds.
 */
export function registerDebugKeys(actions: DebugActions): void {
  if (typeof window === "undefined") return;

  (window as any).__debug = actions;

  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey && !e.altKey) return;
    switch (e.key) {
      case "g": actions.addGold(500); break;
      case "e": actions.addEssence(50); break;
      case "k": actions.killRun(); break;
      case "r": {
        if (confirm("Reset all save data?")) actions.resetSave();
        break;
      }
      case "1": actions.simulateSeconds(60); break;
      case "2": actions.simulateSeconds(3600); break;
      case "3": actions.simulateSeconds(28800); break;
    }
  });

  console.info(
    "[debug] Keys: Ctrl+G=gold, Ctrl+E=essence, Ctrl+K=kill, Ctrl+1=+60s, Ctrl+2=+1h, Ctrl+3=+8h, Ctrl+R=reset\n" +
    "Access all debug actions via window.__debug"
  );
}
