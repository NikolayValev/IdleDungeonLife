// ─── Epitaph Composition — PURE, no Phaser/DOM/canvas/window ─────────────────
// All randomness via SeededRandomProvider. No Math.random(). No Date.now().
// Deterministic: same RunSummary + seed ⇒ identical Epitaph.

import type { RunSummary, Epitaph, FacetId, ArcId, ChronicleEntry } from "./types";
import { SeededRandomProvider, deriveSeed } from "./rng";
import {
  CHRONICLE_CAP,
  CHRONICLE_DROP_ORDER,
  PRIMARY_THRESHOLD,
  SECONDARY_THRESHOLD,
  MID_TIER,
  HIGH_TIER,
  EPITAPH_CHAR_CAP,
  REDEEMED_ALIGNMENT_THRESHOLD,
  FALLEN_ALIGNMENT_THRESHOLD,
  LATE_BLOOM_FRACTION,
  CUT_SHORT_FRACTION,
  WEALTH_GOLD_CAP,
  DELVER_DEPTH_WEIGHT,
  DELVER_BOSS_WEIGHT,
  TOILER_MAX_FRACTION,
  KNOWLEDGE_ART_WEIGHT,
  KNOWLEDGE_STAGE_WEIGHT,
  KNOWLEDGE_DISCOVERY_WEIGHT,
  KNOWLEDGE_CAP,
  ALIGN_VALUE_WEIGHT,
  ALIGN_GATE_WEIGHT,
  ALIGN_TAG_WEIGHT,
  ALIGN_TAG_CAP,
  TAG_FACET_CAP,
  DEATH_STATEMENTS,
  FACET_PHRASES,
  ARC_PHRASES,
  FAINT_PHRASES,
} from "../content/epitaphs";

// ─── Chronicle trim ────────────────────────────────────────────────────────────

/**
 * Enforce the chronicle cap by dropping lowest-priority kinds first.
 * Priority order defined in CHRONICLE_DROP_ORDER (lower index = dropped first).
 * Does not mutate the input array.
 */
export function trimChronicle(entries: ChronicleEntry[], cap: number): ChronicleEntry[] {
  if (entries.length <= cap) return entries.slice();

  // Work with a mutable copy
  let working = entries.slice();

  for (const kind of CHRONICLE_DROP_ORDER) {
    if (working.length <= cap) break;
    // Drop entries of this kind until we're at or below cap
    const toKeep = working.filter((e) => e.kind !== kind);
    const dropped = working.length - toKeep.length;
    const needToDrop = working.length - cap;
    if (dropped > 0) {
      if (dropped <= needToDrop) {
        // Drop all of this kind
        working = toKeep;
      } else {
        // Drop only as many as needed (from the end, preserving earlier entries)
        const ofKind = working.filter((e) => e.kind === kind);
        const keepOfKind = ofKind.slice(0, ofKind.length - needToDrop);
        working = working.filter((e) => e.kind !== kind).concat(keepOfKind);
        // Re-sort to original order (by index in original)
        const keepSet = new Set<ChronicleEntry>(keepOfKind);
        const notKind = working.filter((e) => e.kind !== kind);
        // Rebuild preserving original order
        working = entries.filter(
          (e) => notKind.includes(e) || keepSet.has(e)
        );
      }
    }
  }

  return working.slice(0, cap);
}

// ─── Facet scoring ─────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scoreHoly(summary: RunSummary): number {
  const { finalAlignment, gatesCrossed, tagCounts } = summary;
  const holySide = finalAlignment > 0 ? finalAlignment : 0;
  const alignScore = ALIGN_VALUE_WEIGHT * (holySide / 100) * 100;

  const holyGateCount = gatesCrossed.filter((g) => g.startsWith("holy_")).length;
  const gateScore = ALIGN_GATE_WEIGHT * (holyGateCount / 3) * 100;

  const tagCount = (tagCounts["holy"] ?? 0);
  const tagScore = ALIGN_TAG_WEIGHT * (Math.min(tagCount, ALIGN_TAG_CAP) / ALIGN_TAG_CAP) * 100;

  return clamp(Math.round(alignScore + gateScore + tagScore), 0, 100);
}

function scoreAbyss(summary: RunSummary): number {
  const { finalAlignment, gatesCrossed, tagCounts } = summary;
  const abyssSide = finalAlignment < 0 ? -finalAlignment : 0;
  const alignScore = ALIGN_VALUE_WEIGHT * (abyssSide / 100) * 100;

  const abyssGateCount = gatesCrossed.filter((g) => g.startsWith("abyss_")).length;
  const gateScore = ALIGN_GATE_WEIGHT * (abyssGateCount / 3) * 100;

  const tagCount = (tagCounts["abyss"] ?? 0) + (tagCounts["unholy"] ?? 0);
  const tagScore = ALIGN_TAG_WEIGHT * (Math.min(tagCount, ALIGN_TAG_CAP) / ALIGN_TAG_CAP) * 100;

  return clamp(Math.round(alignScore + gateScore + tagScore), 0, 100);
}

function scoreKnowledge(summary: RunSummary): number {
  const { studyArtsKnown, studyTopStage, codexDiscoveriesThisLife } = summary;
  const raw =
    studyArtsKnown * KNOWLEDGE_ART_WEIGHT +
    studyTopStage * KNOWLEDGE_STAGE_WEIGHT +
    codexDiscoveriesThisLife * KNOWLEDGE_DISCOVERY_WEIGHT;
  return clamp(Math.round((raw / KNOWLEDGE_CAP) * 100), 0, 100);
}

function scoreWealth(summary: RunSummary): number {
  return clamp(Math.round((summary.peakGold / WEALTH_GOLD_CAP) * 100), 0, 100);
}

function scoreVitality(summary: RunSummary): number {
  const count = summary.tagCounts["vitality"] ?? 0;
  return clamp(Math.round((Math.min(count, TAG_FACET_CAP) / TAG_FACET_CAP) * 100), 0, 100);
}

function scoreDecay(summary: RunSummary): number {
  const count = summary.tagCounts["decay"] ?? 0;
  return clamp(Math.round((Math.min(count, TAG_FACET_CAP) / TAG_FACET_CAP) * 100), 0, 100);
}

function scoreFate(summary: RunSummary): number {
  const count = summary.tagCounts["fate"] ?? 0;
  return clamp(Math.round((Math.min(count, TAG_FACET_CAP) / TAG_FACET_CAP) * 100), 0, 100);
}

function scoreDelver(summary: RunSummary): number {
  const { deepestDungeonIndex, dungeonLadderSize, bossesFelled } = summary;
  const depthScore =
    dungeonLadderSize > 0
      ? DELVER_DEPTH_WEIGHT * (deepestDungeonIndex / (dungeonLadderSize - 1)) * 100
      : 0;
  // Cap bosses at a reasonable ceiling (16 total dungeons → assume ≤16 bosses matters)
  const bossScore = DELVER_BOSS_WEIGHT * Math.min(bossesFelled / dungeonLadderSize, 1) * 100;
  return clamp(Math.round(depthScore + bossScore), 0, 100);
}

function scoreToiler(summary: RunSummary): number {
  const { jobYears, delveYears } = summary;
  const totalYears = jobYears + delveYears;
  if (totalYears <= 0) return 0;
  const fraction = jobYears / totalYears;
  return clamp(Math.round((fraction / TOILER_MAX_FRACTION) * 100), 0, 100);
}

/**
 * Score all facets for a given RunSummary.
 * Returns a record of scores 0–100 per FacetId.
 */
function scoreFacets(summary: RunSummary): Record<FacetId, number> {
  return {
    holy: scoreHoly(summary),
    abyss: scoreAbyss(summary),
    knowledge: scoreKnowledge(summary),
    wealth: scoreWealth(summary),
    vitality: scoreVitality(summary),
    decay: scoreDecay(summary),
    fate: scoreFate(summary),
    delver: scoreDelver(summary),
    toiler: scoreToiler(summary),
  };
}

// ─── Arc detection ─────────────────────────────────────────────────────────────

/**
 * Detect narrative arc for a run. Returns the highest-priority matching arc, or
 * undefined if none match. Priority: redeemed > fallen > forsaken > sanctified >
 * lateBloom > cutShort > unbroken.
 */
function detectArc(summary: RunSummary): ArcId | undefined {
  const {
    gatesCrossed,
    finalAlignment,
    ageAtDeathYears,
    expectedLifespanYears,
    firstNotableEventYear,
  } = summary;

  const crossedAbyss = gatesCrossed.some((g) => g.startsWith("abyss_"));
  const crossedHoly = gatesCrossed.some((g) => g.startsWith("holy_"));
  const crossedAbyssTier3 = gatesCrossed.includes("abyss_3");
  const crossedHolyTier3 = gatesCrossed.includes("holy_3");

  // redeemed: crossed abyss gate, died with alignment > +15
  if (crossedAbyss && finalAlignment > REDEEMED_ALIGNMENT_THRESHOLD) return "redeemed";

  // fallen: crossed holy gate, died with alignment < -15
  if (crossedHoly && finalAlignment < FALLEN_ALIGNMENT_THRESHOLD) return "fallen";

  // forsaken: crossed abyss tier 3
  if (crossedAbyssTier3) return "forsaken";

  // sanctified: crossed holy tier 3
  if (crossedHolyTier3) return "sanctified";

  // lateBloom: first notable event (gate/legendary/boss) after 75% of lifespan
  if (
    firstNotableEventYear !== null &&
    expectedLifespanYears > 0 &&
    firstNotableEventYear > expectedLifespanYears * LATE_BLOOM_FRACTION
  ) {
    return "lateBloom";
  }

  // cutShort: died before 40% of expected lifespan
  if (expectedLifespanYears > 0 && ageAtDeathYears < expectedLifespanYears * CUT_SHORT_FRACTION) {
    return "cutShort";
  }

  // unbroken: survived to max lifespan, no tier-2+ gate
  const crossedTier2Plus = gatesCrossed.some((g) => {
    const tier = parseInt(g.split("_")[1] ?? "0", 10);
    return tier >= 2;
  });
  if (
    expectedLifespanYears > 0 &&
    ageAtDeathYears >= expectedLifespanYears &&
    !crossedTier2Plus
  ) {
    return "unbroken";
  }

  return undefined;
}

// ─── Phrase selection ──────────────────────────────────────────────────────────

type Tier = "low" | "mid" | "high";

function scoreTier(score: number): Tier {
  if (score >= HIGH_TIER) return "high";
  if (score >= MID_TIER) return "mid";
  return "low";
}

function pickPhrase(phrases: string[], rng: SeededRandomProvider): string {
  return rng.pick(phrases);
}

// ─── Composition ───────────────────────────────────────────────────────────────

/**
 * Compose a deterministic Epitaph from a RunSummary and run seed.
 * Pure function — no side effects, no mutation of inputs.
 */
export function composeEpitaph(summary: RunSummary, seed: number): Epitaph {
  // Trim chronicle defensively (if somehow over cap coming in)
  const chronicle = trimChronicle(summary.chronicle, CHRONICLE_CAP);

  // Score all facets
  const scores = scoreFacets(summary);

  // Find primary facet: highest score >= PRIMARY_THRESHOLD
  const facetIds = Object.keys(scores) as FacetId[];
  const eligible = facetIds
    .map((id) => ({ id, score: scores[id] }))
    .filter((f) => f.score >= PRIMARY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  // Detect arc
  const arc = detectArc(summary);

  // ── Faint life path ────────────────────────────────────────────────────────
  if (eligible.length === 0) {
    const rng = new SeededRandomProvider(deriveSeed(seed, "faint"));
    const deathStatements = DEATH_STATEMENTS[summary.cause] ?? DEATH_STATEMENTS["vitality"];
    const line1 = pickPhrase(deathStatements, rng)
      .replace("{age}", String(summary.ageAtDeathYears));
    const faintRng = new SeededRandomProvider(deriveSeed(seed, "faint_phrase"));
    const line2 = pickPhrase(FAINT_PHRASES, faintRng);

    const rawLines = [line1, line2];
    const joined = rawLines.join(" ");
    // If combined would overflow, just use line1 + shortened faint phrase
    const lines = joined.length <= EPITAPH_CHAR_CAP ? rawLines : [line1];

    return {
      lines,
      // Faint lives still need a primaryFacet — pick the highest-scoring facet
      // even if it didn't clear the threshold, so the interface is satisfied.
      primaryFacet: facetIds.reduce((best, id) =>
        scores[id] > scores[best] ? id : best
      ),
      arc,
    };
  }

  const primary = eligible[0];
  const secondary = eligible.find((f) => f.id !== primary.id && f.score >= SECONDARY_THRESHOLD);

  // ── Line 1: death statement ────────────────────────────────────────────────
  const rng1 = new SeededRandomProvider(deriveSeed(seed, "line1"));
  const deathStatements = DEATH_STATEMENTS[summary.cause] ?? DEATH_STATEMENTS["vitality"];
  const line1Raw = pickPhrase(deathStatements, rng1)
    .replace("{age}", String(summary.ageAtDeathYears));

  // ── Line 2: identity clause — primary facet, intensity-tiered ─────────────
  const tier = scoreTier(primary.score);
  const rng2 = new SeededRandomProvider(deriveSeed(seed, `line2_${primary.id}_${tier}`));
  const primaryPhrases = FACET_PHRASES[primary.id][tier];
  const line2Raw = pickPhrase(primaryPhrases, rng2);

  // ── Line 3: arc clause OR secondary facet clause OR best chronicle deed ──
  let line3Raw: string | undefined;

  if (arc !== undefined) {
    const rng3 = new SeededRandomProvider(deriveSeed(seed, `line3_arc_${arc}`));
    line3Raw = pickPhrase(ARC_PHRASES[arc], rng3);
  } else if (secondary !== undefined) {
    const secTier = scoreTier(secondary.score);
    const rng3 = new SeededRandomProvider(
      deriveSeed(seed, `line3_sec_${secondary.id}_${secTier}`)
    );
    const secPhrases = FACET_PHRASES[secondary.id][secTier];
    line3Raw = pickPhrase(secPhrases, rng3);
  } else {
    // Best chronicle deed: prefer gates > legendaries > bosses
    const deed = chronicle.find((e) => e.kind === "gateCrossed") ??
      chronicle.find((e) => e.kind === "legendaryFound") ??
      chronicle.find((e) => e.kind === "bossFelled");
    if (deed) {
      // Generic deed line — keep it short
      line3Raw = buildDeedLine(deed);
    }
  }

  // ── Assemble lines within char cap ────────────────────────────────────────
  const rawLines = line3Raw !== undefined
    ? [line1Raw, line2Raw, line3Raw]
    : [line1Raw, line2Raw];

  const lines = fitWithinCap(rawLines, EPITAPH_CHAR_CAP);

  return {
    lines,
    primaryFacet: primary.id,
    secondaryFacet: secondary?.id,
    arc,
  };
}

/** Build a generic chronicle deed line from a chronicle entry. */
function buildDeedLine(entry: ChronicleEntry): string {
  switch (entry.kind) {
    case "gateCrossed":
      return entry.refId ? `Crossed ${entry.refId.replace("_", " ")} at ${entry.year}.` : `Crossed a gate at ${entry.year}.`;
    case "legendaryFound":
      return entry.refId ? `Found the ${entry.refId} at ${entry.year}.` : `Found a legendary item at ${entry.year}.`;
    case "bossFelled":
      return entry.refId ? `Felled the ${entry.refId} at ${entry.year}.` : `Felled a great enemy at ${entry.year}.`;
    default:
      return "";
  }
}

/**
 * Fit lines within the char cap. If 3 lines don't fit, try 2. If 2 don't fit,
 * truncate the last line to fit.
 */
function fitWithinCap(lines: string[], cap: number): string[] {
  const joined3 = lines.join(" ");
  if (joined3.length <= cap) return lines;

  if (lines.length >= 3) {
    const twoLines = lines.slice(0, 2);
    const joined2 = twoLines.join(" ");
    if (joined2.length <= cap) return twoLines;
  }

  // Truncate: just return line1 + as much of line2 as fits
  const line1 = lines[0];
  const separator = " ";
  const available = cap - line1.length - separator.length;
  if (available > 0 && lines.length >= 2) {
    const truncated = lines[1].slice(0, available);
    return [line1, truncated];
  }
  return [line1.slice(0, cap)];
}
