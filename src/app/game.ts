import Phaser from "phaser";
import type { SaveFile } from "../core/types";
import type { GameEvent } from "../core/events";
import { reduceGame, reconcileOffline } from "../core/reducer";
import { saveToDisk, loadFromDisk, freshSave } from "../core/save";
import { advanceSubCharacters } from "../sim/subRunner";
import { LocalArrayAnalyticsSink, setAnalyticsSink } from "../core/analytics";

/**
 * Central game controller — owns save state and dispatches events to the reducer.
 * All scenes access state and dispatch through (game as GameController).
 */
export class GameController extends Phaser.Game {
  saveFile: SaveFile;

  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
    setAnalyticsSink(new LocalArrayAnalyticsSink());

    const now = Math.floor(Date.now() / 1000);
    const existing = loadFromDisk();

    if (existing) {
      // Reconcile offline progression (main run), then auto-play subs offline.
      const reconciled = reconcileOffline(existing, now);
      this.saveFile = advanceSubCharacters(reconciled, now, 10);
    } else {
      this.saveFile = freshSave(now);
    }

    this._persistLoop();
  }

  dispatch(event: GameEvent): void {
    try {
      this.saveFile = reduceGame(this.saveFile, event);
      saveToDisk(this.saveFile);
    } catch (err) {
      console.error("[GameController] dispatch error for event", event.type, err);
      // Preserve current save state — do not corrupt disk on reducer failure
    }
  }

  /** Advance all sub-character lives up to `nowUnixSec`, persisting if changed. */
  advanceSubs(nowUnixSec: number): void {
    const next = advanceSubCharacters(this.saveFile, nowUnixSec, 1);
    if (next !== this.saveFile) {
      this.saveFile = next;
      saveToDisk(this.saveFile);
    }
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
