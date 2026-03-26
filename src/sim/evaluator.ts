import type { SaveFile } from "../core/types";
import type { RunScore } from "../core/scoring";
import { scoreRun } from "../core/scoring";

/**
 * Evaluate a completed save file (after run ends) and produce a run score.
 */
export function evaluateRun(save: SaveFile): RunScore {
  const run = save.currentRun;
  if (!run) {
    return {
      total: 0,
      dungeonDepthScore: 0,
      legacyAshScore: 0,
      survivalScore: 0,
      discoveryScore: 0,
      buildDiversityScore: 0,
      dominancePenalty: 0,
    };
  }

  const discoveryCount =
    save.meta.discoveredItemIds.length + save.meta.discoveredTraitIds.length;

  return scoreRun(run, discoveryCount);
}
