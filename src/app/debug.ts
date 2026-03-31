import type { SaveFile } from "../core/types";
import type { GameEvent } from "../core/events";
import { JOB_REGISTRY } from "../content/jobs";
import { clearSave, freshSave } from "../core/save";

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
  _getSave: () => SaveFile,
  dispatch: (event: GameEvent) => void,
  replaceSave: (save: SaveFile) => void,
  onRefresh: () => void
): DebugActions {
  const now = () => Math.floor(Date.now() / 1000);

  const dispatchAndRefresh = (event: GameEvent): void => {
    dispatch(event);
    onRefresh();
  };

  return {
    addGold(amount) {
      dispatchAndRefresh({ type: "DEBUG_ADD_RESOURCES", gold: amount });
    },

    addEssence(amount) {
      dispatchAndRefresh({ type: "DEBUG_ADD_RESOURCES", essence: amount });
    },

    grantItem(itemId) {
      dispatchAndRefresh({ type: "DEBUG_GRANT_ITEM", itemId });
    },

    unlockDungeon(dungeonId) {
      dispatchAndRefresh({ type: "DEBUG_UNLOCK_DUNGEON", dungeonId });
    },

    unlockAllJobs() {
      for (const jobId of JOB_REGISTRY.keys()) {
        dispatch({ type: "DEBUG_UNLOCK_JOB", jobId });
      }
      onRefresh();
    },

    killRun() {
      dispatchAndRefresh({ type: "DEBUG_KILL_RUN" });
    },

    simulateSeconds(seconds) {
      dispatchAndRefresh({
        type: "RECONCILE_OFFLINE",
        nowUnixSec: now() + seconds,
      });
    },

    resetSave() {
      clearSave();
      replaceSave(freshSave(now()));
      onRefresh();
    },
  };
}

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
