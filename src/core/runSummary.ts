// ─── RunSummary derivation — PURE (RunState → RunSummary) ────────────────────
// Lives in the reducer/death-hook layer, not in epitaph.ts: composeEpitaph reads
// ONLY a RunSummary so it stays decoupled from RunState. This is where the dead
// run is flattened into that summary.

import type { RunState, MetaProgress, RunSummary, Tag } from "./types";
import { ageToYears } from "./lifespan";
import { ITEM_REGISTRY } from "../content/items";
import { TRAIT_REGISTRY } from "../content/traits";
import { DUNGEON_REGISTRY } from "../content/dungeons";
import { BALANCE } from "../content/balance";

const NOTABLE_KINDS = new Set(["gateCrossed", "legendaryFound", "bossFelled"]);

export function buildRunSummary(
  run: RunState,
  _meta: MetaProgress,
  cause: RunSummary["cause"]
): RunSummary {
  const ageYears = ageToYears(run.lifespan.ageSeconds);

  // Tag counts from carried items + all traits (visible + hidden, deduped).
  // NOTE: arts/talents tags are not yet folded in — instrument in Wave 4.
  const tagCounts: Partial<Record<Tag, number>> = {};
  const bump = (tags: Tag[]): void => {
    for (const t of tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  };
  for (const inst of run.inventory.items) {
    const def = ITEM_REGISTRY.get(inst.itemId);
    if (def) bump(def.tags);
  }
  for (const traitId of new Set([...run.visibleTraitIds, ...run.hiddenTraitIds])) {
    const def = TRAIT_REGISTRY.get(traitId);
    if (def) bump(def.tags);
  }

  const notable = run.chronicle.filter((c) => NOTABLE_KINDS.has(c.kind));
  const firstNotableEventYear =
    notable.length > 0 ? Math.min(...notable.map((c) => c.year)) : null;

  const studyTopStage = Math.max(0, ...Object.values(run.study.schools).map((s) => s.stage));

  return {
    seed: run.seed,
    ageAtDeathYears: ageYears,
    expectedLifespanYears: BALANCE.expectedLifespanYears,
    cause,
    finalAlignment: run.alignment.holyUnholy,
    alignmentCaps: { minCap: run.alignment.minCap, maxCap: run.alignment.maxCap },
    gatesCrossed: run.alignment.gatesCrossed,
    firstNotableEventYear,
    // PROXY (final gold) — peak-gold tracking to be instrumented in Wave 4 sim.
    peakGold: run.resources.gold,
    bossesFelled: run.bossesCleared.length,
    deepestDungeonIndex: run.deepestDungeonIndex,
    dungeonLadderSize: DUNGEON_REGISTRY.size,
    // PROXIES — time-in-occupation and per-life codex delta to be instrumented in Wave 4.
    jobYears: run.currentJobId ? ageYears : 0,
    delveYears: run.totalDungeonsCompleted,
    studyArtsKnown: run.study.artsKnown.length,
    studyTopStage,
    codexDiscoveriesThisLife: 0,
    tagCounts,
    chronicle: run.chronicle,
  };
}
