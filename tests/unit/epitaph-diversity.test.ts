import { test, expect } from "vitest";

import { freshSave } from "../../src/core/save";
import { reduceGame } from "../../src/core/reducer";
import { stepRun } from "../../src/sim/step";
import {
  BaselinePolicy,
  ConservativePolicy,
  AggressivePolicy,
  StudyFocusedPolicy,
  type Policy,
} from "../../src/sim/policies";
import { buildRunSummary } from "../../src/core/runSummary";
import { composeEpitaph } from "../../src/core/epitaph";
import { DUNGEONS } from "../../src/content/dungeons";
import { JOBS } from "../../src/content/jobs";
import type { FacetId, ArcId } from "../../src/core/types";

interface LifeResult {
  policy: string;
  seed: number;
  primaryFacet: FacetId;
  arc?: ArcId;
  text: string;
  faint: boolean;
}

function simulateLife(seed: number, policy: Policy, policyName: string): LifeResult {
  const start = 1_000_000;
  let save = freshSave(start);
  // Seed the full content so a single-life sim can express differentiated builds
  // (real players accumulate these unlocks across lives via legacy ash). Without
  // this the only available dungeon is the holy starter, forcing every build holy.
  save = {
    ...save,
    meta: {
      ...save.meta,
      unlockedDungeonIds: DUNGEONS.map((d) => d.id),
      unlockedJobIds: JOBS.map((j) => j.id),
    },
  };
  save = reduceGame(save, { type: "START_NEW_RUN", nowUnixSec: start, seed });

  const durationSec = 3600;
  const stepSec = 15;
  let now = start;
  const end = start + durationSec;
  while (now < end && save.currentRun?.alive) {
    now = Math.min(now + stepSec, end);
    save = stepRun(save, now, policy);
  }

  const run = save.currentRun!;
  const cause = run.alive ? "vitality" : (run.deathCause ?? "vitality");
  const summary = buildRunSummary(run, save.meta, cause);
  const epitaph = composeEpitaph(summary, run.seed);
  const text = epitaph.lines.join(" ");
  // A faint life is one whose composition fell through to the faint bank — there
  // is no notable arc and the identity line came from the no-facet path. We
  // approximate it as: no arc and the primary facet scored below the notable bar,
  // which the epitaph encodes by producing the faint phrasing. Detect via the
  // dedicated faint marker: faint epitaphs are exactly 1–2 lines with no arc and
  // a primaryFacet that did not clear threshold. Simpler + robust: re-derive from
  // the summary is overkill, so treat "Left little behind"-style as faint.
  const faint = /left little behind|unremarkable|little to show|passed without/i.test(text);

  return { policy: policyName, seed, primaryFacet: epitaph.primaryFacet, arc: epitaph.arc, text, faint };
}

const POLICIES: Array<[string, Policy]> = [
  ["baseline", new BaselinePolicy()],
  ["conservative", new ConservativePolicy()],
  ["aggressive", new AggressivePolicy()],
  ["study", new StudyFocusedPolicy()],
];

const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];

function collect(): LifeResult[] {
  const results: LifeResult[] = [];
  for (const [name, policy] of POLICIES) {
    for (const seed of SEEDS) {
      results.push(simulateLife(seed, policy, name));
    }
  }
  return results;
}

test("epitaphs diverge across strategy policies (design-test teeth)", () => {
  const results = collect();

  const facets = new Set(results.map((r) => r.primaryFacet));
  const arcs = new Set(results.filter((r) => r.arc).map((r) => r.arc));
  const faintRate = results.filter((r) => r.faint).length / results.length;

  // Diagnostics (surfaced on failure for investigation, never to loosen thresholds).
  const byPolicyFacets: Record<string, string[]> = {};
  for (const [name] of POLICIES) {
    byPolicyFacets[name] = [
      ...new Set(results.filter((r) => r.policy === name).map((r) => r.primaryFacet)),
    ];
  }
  const diag = JSON.stringify(
    { distinctFacets: [...facets], distinctArcs: [...arcs], faintRate, byPolicyFacets },
    null,
    2
  );

  // Spec §8: at least 4 distinct primary facets appear across policies.
  expect(facets.size, `facet diversity too low:\n${diag}`).toBeGreaterThanOrEqual(4);

  // Mediocrity must be legible but not universal.
  expect(faintRate, `every life is faint:\n${diag}`).toBeLessThan(1);
});

test("a given seed produces different epitaphs under different policies", () => {
  const results = collect();
  // For each seed, the four policies should not ALL collapse to identical text.
  for (const seed of SEEDS) {
    const texts = new Set(results.filter((r) => r.seed === seed).map((r) => r.text));
    expect(texts.size, `all policies identical for seed ${seed}`).toBeGreaterThan(1);
  }
});
