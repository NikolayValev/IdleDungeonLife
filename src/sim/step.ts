import type { SaveFile } from "../core/types";
import { reduceGame } from "../core/reducer";

/**
 * Advance simulation by one logical step (tickSec seconds).
 * Returns the new save state.
 */
export function stepSim(save: SaveFile, nowUnixSec: number): SaveFile {
  if (!save.currentRun?.alive) return save;

  // Check if dungeon needs completing
  const dungeon = save.currentRun.currentDungeon;
  if (dungeon && nowUnixSec >= dungeon.completesAtUnixSec) {
    save = reduceGame(save, { type: "COMPLETE_DUNGEON", nowUnixSec });
  }

  // Tick time forward
  save = reduceGame(save, { type: "TICK", nowUnixSec });

  return save;
}

/**
 * Advance simulation by N seconds, in steps of stepSec.
 */
export function advanceSim(
  save: SaveFile,
  startUnixSec: number,
  durationSec: number,
  stepSec = 5
): SaveFile {
  let current = save;
  let now = startUnixSec;
  const end = startUnixSec + durationSec;

  while (now < end && current.currentRun?.alive) {
    now = Math.min(now + stepSec, end);
    current = stepSim(current, now);
  }

  return current;
}
