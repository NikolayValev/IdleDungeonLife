import type { SaveFile, SubCharacter } from "../core/types";
import { reduceGame } from "../core/reducer";
import { BALANCE } from "../content/balance";
import { advanceRun } from "./step";
import { BaselinePolicy } from "./policies";

const POLICY = new BaselinePolicy();

/**
 * Advance every sub-character's parallel life up to `nowUnixSec`.
 *
 * A running sub is advanced by running the normal run machinery
 * (`advanceRun` + policy) on a per-sub view of the save, writing back only the
 * sub's own `meta` + `currentRun` — the main run is never touched. When automation
 * is enabled, a fallen run is claimed and restarted, and an idle sub is started;
 * claiming (`CLAIM_SUBCHARACTER_DEATH`) intentionally credits global achievement
 * milestones, the one deliberate way a sub's life affects shared state.
 *
 * Pure: `(SaveFile, number) -> SaveFile`. Returns the same reference when nothing
 * changes so callers can skip persistence cheaply.
 */
export function advanceSubCharacters(
  save: SaveFile,
  nowUnixSec: number,
  stepSec = 1
): SaveFile {
  if (save.subCharacters.length === 0) return save;

  let working = save;
  const ids = save.subCharacters.map((s) => s.id);

  for (const id of ids) {
    // 1. Advance a live run.
    const sub = working.subCharacters.find((s) => s.id === id);
    if (!sub) continue;

    if (sub.currentRun?.alive) {
      const start = sub.currentRun.lastTickUnixSec;
      // Cap per call; any overflow beyond maxOfflineSec is not forfeited (unlike
      // the main run) — the sub stays behind and catches up via live ticks, but
      // in practice the run dies inside the window and claim/restart resets it.
      const elapsed = Math.min(nowUnixSec - start, BALANCE.maxOfflineSec);
      if (elapsed > 0) {
        const view: SaveFile = { ...working, meta: sub.meta, currentRun: sub.currentRun };
        const advanced = advanceRun(view, start, elapsed, stepSec, POLICY);
        working = replaceSub(working, id, {
          ...sub,
          meta: advanced.meta,
          currentRun: advanced.currentRun,
        });
      }
    }

    // 2/3. Automation: claim+restart a fallen run, or start an idle one.
    const after = working.subCharacters.find((s) => s.id === id);
    if (!after || !after.automationConfig.enabled) continue;

    if (after.currentRun && !after.currentRun.alive) {
      working = reduceGame(working, {
        type: "CLAIM_SUBCHARACTER_DEATH",
        subCharId: id,
        nowUnixSec,
      });
    }
    const claimed = working.subCharacters.find((s) => s.id === id);
    if (claimed && !claimed.currentRun) {
      working = reduceGame(working, {
        type: "START_SUBCHARACTER_RUN",
        subCharId: id,
        nowUnixSec,
      });
    }
  }

  return working;
}

function replaceSub(save: SaveFile, subId: string, updated: SubCharacter): SaveFile {
  return {
    ...save,
    subCharacters: save.subCharacters.map((s) => (s.id === subId ? updated : s)),
  };
}
