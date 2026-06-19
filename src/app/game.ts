import Phaser from "phaser";
import type { SaveFile } from "../core/types";
import type { GameEvent } from "../core/events";
import { reduceGame, reconcileOffline } from "../core/reducer";
import { saveToDisk, loadFromDisk, freshSave } from "../core/save";
import { advanceSubCharacters } from "../sim/subRunner";
import { advanceRun } from "../sim/step";
import { LocalArrayAnalyticsSink, setAnalyticsSink } from "../core/analytics";

/**
 * Central game controller — owns save state and dispatches events to the reducer.
 * All scenes access state and dispatch through (game as GameController).
 */
export class GameController extends Phaser.Game {
  saveFile: SaveFile;
  demoActive = false;
  readonly isFreshInstall: boolean;
  private _demoSnapshot: SaveFile | null = null;

  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
    setAnalyticsSink(new LocalArrayAnalyticsSink());

    const now = Math.floor(Date.now() / 1000);
    const existing = loadFromDisk();
    this.isFreshInstall = existing === null;

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
      if (!this.demoActive) saveToDisk(this.saveFile);
    } catch (err) {
      console.error("[GameController] dispatch error for event", event.type, err);
      // Preserve current save state — do not corrupt disk on reducer failure
    }
  }

  /**
   * Advance all sub-character lives up to `nowUnixSec`, persisting if changed.
   * Returns true when any sub state changed, so callers can skip redundant redraws.
   */
  advanceSubs(nowUnixSec: number): boolean {
    const next = advanceSubCharacters(this.saveFile, nowUnixSec, 1);
    if (next === this.saveFile) return false;
    this.saveFile = next;
    if (!this.demoActive) saveToDisk(this.saveFile);
    return true;
  }

  unlockDungeon(dungeonId: string): void {
    this.dispatch({ type: "UNLOCK_DUNGEON", dungeonId });
  }

  unlockJob(jobId: string): void {
    this.dispatch({ type: "UNLOCK_JOB", jobId });
  }

  advanceTime(ms: number): SaveFile {
    const seconds = Math.max(1, Math.round(ms / 1000));
    const start =
      this.saveFile.currentRun?.lastTickUnixSec ?? this.saveFile.updatedAtUnixSec;
    const advanced = advanceRun(this.saveFile, start, seconds, 1);
    this.saveFile = advanceSubCharacters(advanced, start + seconds, 10);
    if (!this.demoActive) saveToDisk(this.saveFile);
    return this.saveFile;
  }

  enterDemo(nowUnixSec: number): void {
    if (this.demoActive) return;
    this._demoSnapshot = this.saveFile;
    this.demoActive = true;
    this.saveFile = freshSave(nowUnixSec);
  }

  exitDemo(): void {
    if (this._demoSnapshot) this.saveFile = this._demoSnapshot;
    this._demoSnapshot = null;
    this.demoActive = false;
    if (!this.isFreshInstall) saveToDisk(this.saveFile);
  }

  /** Auto-persist every 10 seconds in case of crash. */
  private _persistLoop(): void {
    setInterval(() => {
      if (!this.demoActive) saveToDisk(this.saveFile);
    }, 10_000);
  }
}
