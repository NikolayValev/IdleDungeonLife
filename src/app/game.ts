import Phaser from "phaser";
import type { SaveFile } from "../core/types";
import type { GameEvent } from "../core/events";
import { reduceGame, reconcileOffline } from "../core/reducer";
import { saveToDisk, loadFromDisk, freshSave } from "../core/save";
import { DUNGEON_REGISTRY } from "../content/dungeons";
import { JOB_REGISTRY } from "../content/jobs";

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
    const save = this.saveFile;
    if (save.meta.unlockedDungeonIds.includes(dungeonId)) return;
    const dungeon = DUNGEON_REGISTRY.get(dungeonId);
    if (!dungeon) return;
    const cost = dungeon.unlockRequirement?.legacyAsh ?? 0;
    if (save.meta.legacyAsh < cost) return;

    this.saveFile = {
      ...save,
      meta: {
        ...save.meta,
        legacyAsh: save.meta.legacyAsh - cost,
        unlockedDungeonIds: [...save.meta.unlockedDungeonIds, dungeonId],
      },
    };
    saveToDisk(this.saveFile);
  }

  unlockJob(jobId: string): void {
    const save = this.saveFile;
    if (save.meta.unlockedJobIds.includes(jobId)) return;
    const job = JOB_REGISTRY.get(jobId);
    const cost = job?.unlockRequirement?.legacyAsh ?? 0;
    if (save.meta.legacyAsh < cost) return;

    this.saveFile = {
      ...save,
      meta: {
        ...save.meta,
        legacyAsh: save.meta.legacyAsh - cost,
        unlockedJobIds: [...save.meta.unlockedJobIds, jobId],
      },
    };
    saveToDisk(this.saveFile);
  }

  /** Auto-persist every 10 seconds in case of crash. */
  private _persistLoop(): void {
    setInterval(() => saveToDisk(this.saveFile), 10_000);
  }
}
