import type { GameEvent } from "../../core/events";

export type DemoBeat =
  | { kind: "dispatch"; event: (nowUnixSec: number) => GameEvent; caption: string }
  | { kind: "advanceTime"; ms: number; caption: string }
  | { kind: "switchScene"; sceneKey: string; caption: string };

export const DEMO_HOLD_MS = 2600;

export function buildDemoScenario(): DemoBeat[] {
  return [
    { kind: "dispatch", event: (now) => ({ type: "START_NEW_RUN", nowUnixSec: now }), caption: "Every character lives once. A new life begins." },
    { kind: "switchScene", sceneKey: "MainScene", caption: "Born into the Abandoned Chapel." },
    { kind: "dispatch", event: () => ({ type: "ASSIGN_JOB", jobId: "porter" }), caption: "Honest work as a Porter funds the descent." },
    { kind: "advanceTime", ms: 120_000, caption: "Time passes. Gold accrues; the body ages." },
    { kind: "dispatch", event: (now) => ({ type: "START_DUNGEON", dungeonId: "abandoned_chapel", nowUnixSec: now }), caption: "Into the first dungeon." },
    { kind: "switchScene", sceneKey: "DungeonsScene", caption: "The Abandoned Chapel yields its secrets." },
    { kind: "advanceTime", ms: 90_000, caption: "Delving deeper..." },
    { kind: "switchScene", sceneKey: "CodexScene", caption: "Every discovery is recorded in the Codex." },
    { kind: "switchScene", sceneKey: "TalentsScene", caption: "Talents reshape the build across a lifetime." },
    { kind: "advanceTime", ms: 600_000, caption: "The years take their toll." },
    { kind: "dispatch", event: () => ({ type: "DEBUG_KILL_RUN" }), caption: "Lifespan spent." },
    { kind: "switchScene", sceneKey: "DeathScene", caption: "Death is progress — legacy ash endures." },
  ];
}
