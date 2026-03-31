import type { MetaProgress, RunState } from "../core/types";
import type { RunScore } from "../core/scoring";
import { scoreRun } from "../core/scoring";

export function evaluateRun(
  run: RunState,
  meta?: Pick<MetaProgress, "discoveredItemIds" | "discoveredTraitIds">
): RunScore {
  const discoveryCount =
    (meta?.discoveredItemIds.length ?? 0) + (meta?.discoveredTraitIds.length ?? 0);

  return scoreRun(run, discoveryCount);
}
