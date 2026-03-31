import type { SaveFile } from "../core/types";
import type { GameEvent } from "../core/events";
import { reduceGame } from "../core/reducer";
import type { Policy } from "./policies";

function applyPolicyDecisions(
  save: SaveFile,
  nowUnixSec: number,
  policy?: Policy
): SaveFile {
  if (!policy || !save.currentRun?.alive) return save;

  let current = save;
  const seen = new Set<string>();

  while (current.currentRun?.alive) {
    const action = policy.decide(current, nowUnixSec);
    if (!action) break;

    const fingerprint = JSON.stringify(action);
    if (seen.has(fingerprint)) break;
    seen.add(fingerprint);

    current = reduceGame(current, action as GameEvent);
  }

  return current;
}

export function stepRun(
  state: SaveFile,
  nowUnixSec: number,
  policy?: Policy
): SaveFile {
  if (!state.currentRun?.alive) {
    return { ...state, updatedAtUnixSec: nowUnixSec };
  }

  let current = state;

  while (current.currentRun?.alive) {
    const completionAt = current.currentRun.currentDungeon?.completesAtUnixSec;
    if (
      completionAt == null ||
      completionAt > nowUnixSec ||
      completionAt <= current.currentRun.lastTickUnixSec
    ) {
      break;
    }

    current = reduceGame(current, { type: "TICK", nowUnixSec: completionAt });
    current = reduceGame(current, { type: "COMPLETE_DUNGEON", nowUnixSec: completionAt });
    current = applyPolicyDecisions(current, completionAt, policy);
  }

  if (current.currentRun?.alive && current.currentRun.lastTickUnixSec < nowUnixSec) {
    current = reduceGame(current, { type: "TICK", nowUnixSec });
  } else {
    current = { ...current, updatedAtUnixSec: nowUnixSec };
  }

  if (
    current.currentRun?.alive &&
    current.currentRun.currentDungeon &&
    nowUnixSec >= current.currentRun.currentDungeon.completesAtUnixSec
  ) {
    current = reduceGame(current, {
      type: "COMPLETE_DUNGEON",
      nowUnixSec: current.currentRun.currentDungeon.completesAtUnixSec,
    });
  }

  return applyPolicyDecisions(current, nowUnixSec, policy);
}

export function advanceRun(
  state: SaveFile,
  startUnixSec: number,
  durationSec: number,
  stepSec: number,
  policy?: Policy
): SaveFile {
  let current = state;
  let now = startUnixSec;
  const end = startUnixSec + durationSec;

  while (now < end && current.currentRun?.alive) {
    now = Math.min(now + stepSec, end);
    current = stepRun(current, now, policy);
  }

  return current;
}
