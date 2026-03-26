import Phaser from "phaser";
import type { SaveFile } from "../../core/types";
import type { GameEvent } from "../../core/events";

/**
 * Base scene class that all game scenes extend.
 * Provides access to global game state and dispatch.
 */
export abstract class BaseScene extends Phaser.Scene {
  protected get saveFile(): SaveFile {
    return (this.game as any).saveFile as SaveFile;
  }

  protected dispatch(event: GameEvent): void {
    (this.game as any).dispatch(event);
  }

  protected get nowUnixSec(): number {
    return Math.floor(Date.now() / 1000);
  }

  /** Shorthand to refresh this scene's display. Called after dispatch. */
  protected refresh(): void {
    this.scene.restart();
  }

  /** Navigate to a named scene tab. */
  protected showTab(sceneKey: string): void {
    this.scene.start(sceneKey);
  }
}
