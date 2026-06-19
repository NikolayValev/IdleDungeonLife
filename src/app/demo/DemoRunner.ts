import type { GameEvent } from "../../core/events";
import type { DemoBeat } from "./scenario";

export interface DemoHost {
  dispatch(event: GameEvent): void;
  advanceTime(ms: number): void;
  switchScene(sceneKey: string): void;
  setCaption(text: string): void;
  now(): number;
  isCancelled(): boolean;
}

export class DemoRunner {
  readonly beats: DemoBeat[];
  readonly host: DemoHost;

  constructor(beats: DemoBeat[], host: DemoHost) {
    this.beats = beats;
    this.host = host;
  }

  /** Execute the beat at `index`. Returns false when done or cancelled. */
  runBeat(index: number): boolean {
    if (this.host.isCancelled() || index < 0 || index >= this.beats.length) {
      return false;
    }
    const beat = this.beats[index];
    this.host.setCaption(beat.caption);
    switch (beat.kind) {
      case "dispatch":
        this.host.dispatch(beat.event(this.host.now()));
        break;
      case "advanceTime":
        this.host.advanceTime(beat.ms);
        break;
      case "switchScene":
        this.host.switchScene(beat.sceneKey);
        break;
    }
    return true;
  }
}
