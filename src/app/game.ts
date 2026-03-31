import Phaser from "phaser";
import type { SaveFile } from "../core/types";
import type { GameEvent } from "../core/events";
import { reduceGame, reconcileOffline } from "../core/reducer";
import { saveToDisk, loadFromDisk, freshSave } from "../core/save";

/**
 * Central game controller — owns save state and dispatches events to the reducer.
 * All scenes access state and dispatch through (game as GameController).
 */
export class GameController extends Phaser.Game {
  saveFile: SaveFile;

  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
    const now = Math.floor(Date.now() / 1000);
    const existing = loadFromDisk();

    if (existing) {
      // Reconcile offline progression
      this.saveFile = reconcileOffline(existing, now);
    } else {
      this.saveFile = freshSave(now);
    }

    this._persistLoop();
  }

  dispatch(event: GameEvent): void {
    this.saveFile = reduceGame(this.saveFile, event);
    saveToDisk(this.saveFile);
  }

  unlockDungeon(dungeonId: string): void {
    this.dispatch({ type: "UNLOCK_DUNGEON", dungeonId });
  }

  unlockJob(jobId: string): void {
    this.dispatch({ type: "UNLOCK_JOB", jobId });
  }

  /** Auto-persist every 10 seconds in case of crash. */
  private _persistLoop(): void {
    setInterval(() => saveToDisk(this.saveFile), 10_000);
  }
}
