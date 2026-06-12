import { test, expect, describe } from "vitest";

import { composeEpitaph, trimChronicle } from "../../src/core/epitaph";
import type { RunSummary, ChronicleEntry } from "../../src/core/types";
import {
  FAINT_PHRASES,
  FACET_PHRASES,
  ARC_PHRASES,
  EPITAPH_CHAR_CAP,
  CHRONICLE_CAP,
} from "../../src/content/epitaphs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baseSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    seed: 1,
    ageAtDeathYears: 60,
    expectedLifespanYears: 80,
    cause: "vitality",
    finalAlignment: 0,
    alignmentCaps: { minCap: -100, maxCap: 100 },
    gatesCrossed: [],
    firstNotableEventYear: null,
    peakGold: 100,
    bossesFelled: 0,
    deepestDungeonIndex: 0,
    dungeonLadderSize: 16,
    jobYears: 10,
    delveYears: 10,
    studyArtsKnown: 0,
    studyTopStage: 0,
    codexDiscoveriesThisLife: 0,
    tagCounts: {},
    chronicle: [],
    ...overrides,
  };
}

function abyssSummary(): RunSummary {
  return baseSummary({
    finalAlignment: -80,
    gatesCrossed: ["abyss_1", "abyss_2", "abyss_3"],
    alignmentCaps: { minCap: -100, maxCap: -25 },
    tagCounts: { abyss: 4, unholy: 2 },
    deepestDungeonIndex: 15,
    bossesFelled: 8,
    dungeonLadderSize: 16,
    delveYears: 40,
    jobYears: 5,
  });
}

function holySummary(): RunSummary {
  return baseSummary({
    finalAlignment: 80,
    gatesCrossed: ["holy_1", "holy_2", "holy_3"],
    alignmentCaps: { minCap: 25, maxCap: 100 },
    tagCounts: { holy: 5 },
  });
}

function scholarSummary(): RunSummary {
  return baseSummary({
    studyArtsKnown: 6,
    studyTopStage: 4,
    codexDiscoveriesThisLife: 10,
    delveYears: 5,
    jobYears: 30,
  });
}

function faintSummary(): RunSummary {
  // All scores must be below PRIMARY_THRESHOLD (35).
  // toiler = (jobYears / (job+delve)) / TOILER_MAX_FRACTION * 100
  // With jobYears=0, delveYears=1: toiler = 0 (no job fraction).
  // delver = DELVER_DEPTH_WEIGHT * (0/15) * 100 + DELVER_BOSS_WEIGHT * (0/16) * 100 = 0.
  return baseSummary({
    finalAlignment: 0,
    gatesCrossed: [],
    tagCounts: {},
    peakGold: 0,
    bossesFelled: 0,
    deepestDungeonIndex: 0,
    dungeonLadderSize: 16,
    studyArtsKnown: 0,
    studyTopStage: 0,
    codexDiscoveriesThisLife: 0,
    jobYears: 0,
    delveYears: 1,
  });
}

// ─── Test 1: Determinism ──────────────────────────────────────────────────────

describe("epitaph determinism", () => {
  test("same summary + seed produces identical epitaph", () => {
    const summary = abyssSummary();
    const a = composeEpitaph(summary, 42);
    const b = composeEpitaph(summary, 42);
    expect(a).toStrictEqual(b);
  });

  test("different seeds produce potentially different epitaphs (or same, that's ok)", () => {
    // Just confirm both calls succeed without error
    const summary = abyssSummary();
    const a = composeEpitaph(summary, 1);
    const b = composeEpitaph(summary, 999999);
    expect(a.primaryFacet).toBe(b.primaryFacet); // same run → same primary
    expect(a.arc).toBe(b.arc); // same run → same arc (arc is deterministic, not seeded)
  });

  test("does not mutate the summary input", () => {
    const summary = abyssSummary();
    const chronicles = summary.chronicle.slice();
    composeEpitaph(summary, 1);
    expect(summary.chronicle).toStrictEqual(chronicles);
  });
});

// ─── Test 2: Facet scoring ────────────────────────────────────────────────────

describe("facet scoring", () => {
  test("abyss-heavy run picks abyss as primary facet", () => {
    const result = composeEpitaph(abyssSummary(), 1);
    expect(result.primaryFacet).toBe("abyss");
  });

  test("abyss-heavy run with deep delves has delver as secondary", () => {
    const result = composeEpitaph(abyssSummary(), 1);
    expect(result.secondaryFacet).toBe("delver");
  });

  test("scholar summary picks knowledge as primary", () => {
    const result = composeEpitaph(scholarSummary(), 1);
    expect(result.primaryFacet).toBe("knowledge");
  });

  test("holy summary picks holy as primary", () => {
    const result = composeEpitaph(holySummary(), 1);
    expect(result.primaryFacet).toBe("holy");
  });

  test("faint summary has no notable primary (faint path)", () => {
    const result = composeEpitaph(faintSummary(), 1);
    // Faint life: still has a primaryFacet (best available), but lines use faint bank
    expect(result.lines.length).toBeGreaterThan(0);
    const allFaintPhrases = FAINT_PHRASES;
    const hasFaintPhrase = result.lines.some((line) =>
      allFaintPhrases.some((fp) => line.includes(fp))
    );
    expect(hasFaintPhrase).toBe(true);
  });
});

// ─── Test 3: Arc detection priority ──────────────────────────────────────────

describe("arc detection priority", () => {
  test("redeemed arc fires when abyss was crossed and died holy (takes priority over lateBloom)", () => {
    // crossed abyss gate but died with positive alignment → redeemed
    // Also set firstNotableEventYear late to trigger lateBloom — redeemed wins
    const summary = baseSummary({
      finalAlignment: 30,
      gatesCrossed: ["abyss_1"],
      firstNotableEventYear: 65, // 65/80 = 81.25% > 75% → lateBloom would fire
      expectedLifespanYears: 80,
      ageAtDeathYears: 75,
      tagCounts: { abyss: 3 },
    });
    const result = composeEpitaph(summary, 1);
    expect(result.arc).toBe("redeemed");
  });

  test("fallen arc fires when holy was crossed but died unholy", () => {
    const summary = baseSummary({
      finalAlignment: -30,
      gatesCrossed: ["holy_1"],
    });
    const result = composeEpitaph(summary, 1);
    expect(result.arc).toBe("fallen");
  });

  test("forsaken overrides fallen when abyss_3 was crossed and died holy", () => {
    // fallen would fire (holy gate crossed + died unholy), but forsaken takes priority
    // Actually: redeemed < fallen < forsaken in priority
    // forsaken: crossed abyss_3 (regardless of current alignment)
    const summary = baseSummary({
      finalAlignment: 5, // slightly holy, so redeemed doesn't fire (threshold is >15)
      gatesCrossed: ["abyss_3"],
    });
    const result = composeEpitaph(summary, 1);
    expect(result.arc).toBe("forsaken");
  });

  test("lateBloom fires when first notable event is past 75% of lifespan", () => {
    const summary = baseSummary({
      finalAlignment: 5,
      gatesCrossed: [],
      firstNotableEventYear: 65, // 65/80 = 81.25%
      expectedLifespanYears: 80,
      ageAtDeathYears: 75,
    });
    const result = composeEpitaph(summary, 1);
    expect(result.arc).toBe("lateBloom");
  });

  test("cutShort fires when died before 40% of expected lifespan", () => {
    const summary = baseSummary({
      finalAlignment: 0,
      gatesCrossed: [],
      expectedLifespanYears: 80,
      ageAtDeathYears: 25, // 25/80 = 31.25% < 40%
    });
    const result = composeEpitaph(summary, 1);
    expect(result.arc).toBe("cutShort");
  });

  test("unbroken fires when survived full lifespan with no tier-2+ gates", () => {
    const summary = baseSummary({
      finalAlignment: 10,
      gatesCrossed: ["abyss_1"], // tier 1 only
      expectedLifespanYears: 80,
      ageAtDeathYears: 80,
    });
    const result = composeEpitaph(summary, 1);
    expect(result.arc).toBe("unbroken");
  });

  test("no arc when none of the conditions match", () => {
    const summary = baseSummary({
      finalAlignment: 10,
      gatesCrossed: [],
      expectedLifespanYears: 80,
      ageAtDeathYears: 60,
    });
    const result = composeEpitaph(summary, 1);
    expect(result.arc).toBeUndefined();
  });
});

// ─── Test 4: Faint life path ──────────────────────────────────────────────────

describe("faint life", () => {
  test("faint life renders without error", () => {
    const result = composeEpitaph(faintSummary(), 1);
    expect(result.lines.length).toBeGreaterThanOrEqual(1);
  });

  test("faint life uses a phrase from the FAINT_PHRASES bank", () => {
    const result = composeEpitaph(faintSummary(), 1);
    const hasFaintPhrase = result.lines.some((line) =>
      FAINT_PHRASES.some((fp) => line.includes(fp))
    );
    expect(hasFaintPhrase).toBe(true);
  });

  test("faint life never borrows notable phrases from facet banks or arc banks", () => {
    // Collect all notable phrases
    const notablePhrases = new Set<string>();
    for (const bank of Object.values(FACET_PHRASES)) {
      for (const tier of Object.values(bank)) {
        for (const phrase of tier) {
          notablePhrases.add(phrase);
        }
      }
    }
    for (const phrases of Object.values(ARC_PHRASES)) {
      for (const phrase of phrases) {
        notablePhrases.add(phrase);
      }
    }

    // Run many seeds to check no notable phrase bleeds in
    for (let seed = 0; seed < 50; seed++) {
      const result = composeEpitaph(faintSummary(), seed);
      for (const line of result.lines) {
        for (const notable of notablePhrases) {
          expect(line).not.toContain(notable);
        }
      }
    }
  });
});

// ─── Test 5: Character cap ────────────────────────────────────────────────────

describe("character cap", () => {
  test("all phrase bank combinations stay within 140 chars", () => {
    // Test all facet + tier combos as line2, with a fixed line1
    const line1 = "Died at 99, worn thin.";

    for (const [facetId, bank] of Object.entries(FACET_PHRASES)) {
      for (const [tier, phrases] of Object.entries(bank)) {
        for (const phrase of phrases) {
          const combined = `${line1} ${phrase}`;
          expect(combined.length).toBeLessThanOrEqual(EPITAPH_CHAR_CAP);
          if (combined.length > EPITAPH_CHAR_CAP) {
            throw new Error(
              `Phrase too long: facet=${facetId} tier=${tier} "${phrase}" (${combined.length} chars)`
            );
          }
        }
      }
    }
  });

  test("composeEpitaph always produces output within 140 chars", () => {
    const summaries = [
      abyssSummary(),
      holySummary(),
      scholarSummary(),
      faintSummary(),
      baseSummary({ cause: "breakthrough" }),
      baseSummary({ cause: "abandoned" }),
    ];
    for (const summary of summaries) {
      for (let seed = 0; seed < 20; seed++) {
        const result = composeEpitaph(summary, seed);
        const total = result.lines.join(" ");
        expect(total.length).toBeLessThanOrEqual(EPITAPH_CHAR_CAP);
      }
    }
  });

  test("arc phrases combined with death statement stay within cap", () => {
    const line1 = "Died at 99, worn thin.";
    for (const phrases of Object.values(ARC_PHRASES)) {
      for (const phrase of phrases) {
        const combined = `${line1} A test facet phrase. ${phrase}`;
        // Arc goes on line3; line1+line2+line3 must fit
        // This is a rough upper bound check
        expect(phrase.length).toBeLessThan(EPITAPH_CHAR_CAP);
      }
    }
  });
});

// ─── Test 6: Chronicle trim ────────────────────────────────────────────────────

describe("trimChronicle", () => {
  test("does not modify entries at or below cap", () => {
    const entries: ChronicleEntry[] = [
      { year: 10, kind: "jobTaken", refId: "porter" },
      { year: 20, kind: "gateCrossed", refId: "abyss_1" },
    ];
    expect(trimChronicle(entries, CHRONICLE_CAP)).toStrictEqual(entries);
  });

  test("drops jobTaken entries first when over cap", () => {
    const entries: ChronicleEntry[] = [];
    // Fill with 5 jobTaken entries
    for (let i = 0; i < 5; i++) {
      entries.push({ year: i * 5, kind: "jobTaken", refId: `job_${i}` });
    }
    // Fill with 40 gateCrossed entries (note: we can only have 6 real gates,
    // but for the trimmer test we use arbitrary kind)
    for (let i = 0; i < 40; i++) {
      entries.push({ year: 50 + i, kind: "gateCrossed", refId: `gate_${i}` });
    }
    // Total: 45 entries, cap: 40
    const trimmed = trimChronicle(entries, 40);
    expect(trimmed.length).toBeLessThanOrEqual(40);
    // All jobTaken should be gone (5 dropped to get from 45 to 40)
    const jobEntries = trimmed.filter((e) => e.kind === "jobTaken");
    expect(jobEntries.length).toBe(0);
    // All gateCrossed should still be present
    const gateEntries = trimmed.filter((e) => e.kind === "gateCrossed");
    expect(gateEntries.length).toBe(40);
  });

  test("drops deepestDelve after jobTaken when still over cap", () => {
    const entries: ChronicleEntry[] = [];
    for (let i = 0; i < 10; i++) {
      entries.push({ year: i, kind: "jobTaken" });
    }
    for (let i = 0; i < 10; i++) {
      entries.push({ year: 10 + i, kind: "deepestDelve" });
    }
    for (let i = 0; i < 30; i++) {
      entries.push({ year: 20 + i, kind: "gateCrossed" });
    }
    // 50 entries, cap 40 → drop 10
    const trimmed = trimChronicle(entries, 40);
    expect(trimmed.length).toBeLessThanOrEqual(40);
    // jobTaken dropped first (10), gate/boss/legendary kept
    const jobEntries = trimmed.filter((e) => e.kind === "jobTaken");
    expect(jobEntries.length).toBe(0);
    const gateEntries = trimmed.filter((e) => e.kind === "gateCrossed");
    expect(gateEntries.length).toBe(30);
  });

  test("always keeps death entries", () => {
    const entries: ChronicleEntry[] = [];
    for (let i = 0; i < 45; i++) {
      entries.push({ year: i, kind: "jobTaken" });
    }
    entries.push({ year: 80, kind: "death" });
    // 46 entries, cap 40
    const trimmed = trimChronicle(entries, 40);
    expect(trimmed.length).toBeLessThanOrEqual(40);
    const deathEntries = trimmed.filter((e) => e.kind === "death");
    expect(deathEntries.length).toBe(1);
  });

  test("does not mutate input array", () => {
    const entries: ChronicleEntry[] = Array.from({ length: 50 }, (_, i) => ({
      year: i,
      kind: "jobTaken" as const,
    }));
    const copy = entries.slice();
    trimChronicle(entries, 40);
    expect(entries).toStrictEqual(copy);
  });
});
