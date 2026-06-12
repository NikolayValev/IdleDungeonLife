# Epitaph & Chronicle Spec — Idle Dungeon Life

**Status:** Draft v1
**Depends on:** Alignment spec (gates, `gatesCrossed` history)
**Scope:** Per-life chronicle log, generated death epitaph, Codex "Past Lives" archive, sim-harness diversity check.
**Non-goals (v1):** Gameplay bonuses from epitaphs, character naming, social sharing/export, localization.

---

## 1. Design intent

IDL has no classes — identity is the accumulated residue of jobs worked, skills studied, items carried, and gates crossed. The epitaph is the **mirror**: a generated 1–3 line description of who this character turned out to be, shown at death and archived forever.

Rules:

1. **Descriptive, never prescriptive.** The game observes; it does not assign. No epitaph text should read like a class name.
2. **Deterministic.** Same life ⇒ same epitaph. Composition is a pure function of the run summary + run seed.
3. **It doubles as a design test.** If two different playstyles generate the same epitaph, the underlying systems aren't differentiating builds yet. This is measurable (see §8).
4. **History over snapshot.** A character who fell to the Abyss and clawed back reads differently from one who was always mixed — even if they die at the same alignment value.

---

## 2. Two artifacts

**Chronicle** — an ordered event log written *during* the life. The raw material.
**Epitaph** — 1–3 generated lines composed *at death* from the chronicle + final state. The summary.

The death screen shows the epitaph (with the chronicle expandable below it). The Codex gains a **Past Lives** tab listing archived epitaphs; tapping one opens its chronicle.

---

## 3. Chronicle

### What gets recorded

Only **drastic events** — the same vocabulary as forced avatar re-renders. The chronicle and the avatar system share one definition of "drastic," keeping fiction and visuals in sync:

| Kind | Trigger | Example rendered line |
|---|---|---|
| `gateCrossed` | alignment gate fires | "At 43, crossed into the Abyss." |
| `traitEvolved` | trait reveal/evolution | "At 51, the Decay took root." |
| `legendaryFound` | legendary item acquired | "At 38, claimed the Hollow Crown." |
| `bossFelled` | boss cleared | "At 29, felled the Chapel Warden." |
| `jobTaken` | job change | "At 19, took up grave-digging." |
| `studyMastered` | study track milestone (future) | "At 33, mastered the old tongues." |
| `deepestDelve` | new personal-best depth | "At 56, walked deeper than any before." |
| `death` | terminal entry | "Died at 74, spent." |

### Data model

```ts
interface ChronicleEntry {
  year: number;          // in-game age at the event
  kind: ChronicleKind;
  refId?: string;        // gateId, itemId, traitId, dungeonId, jobId...
}
```

Entries store **references, not rendered strings** — text is rendered from templates at display time. This keeps saves small, lets copy be improved later without migrating saves, and leaves the door open for localization.

Cap: **40 entries per life.** If exceeded, drop the lowest-priority kinds first (`jobTaken`, `deepestDelve`) and keep gates/legendaries/bosses. A 10-minute life should rarely hit 15.

The chronicle lives on the active run; on death it moves into the past-life record.

---

## 4. Facet scoring

The epitaph's identity clause comes from **facets** — reuse the existing trait-tag vocabulary so no new taxonomy is invented:

`holy, unholy (abyss), knowledge, wealth, vitality, decay, fate` + two derived facets: `delver` (depth/bosses) and `toiler` (job time).

At death, score each facet 0–100 from the run summary:

- **holy / abyss:** weighted blend of final alignment, deepest gate crossed on that side, and count of tagged items/talents/traits.
- **knowledge:** study levels (future), Knowledge-path investment, codex discoveries this life.
- **wealth:** peak gold relative to a balance-defined curve for age at death.
- **vitality / decay / fate:** counts of tagged traits and items held at death.
- **delver:** deepest dungeon reached vs. the 16-dungeon ladder; bosses felled.
- **toiler:** share of life-years spent in jobs vs. delving.

Weights live in `src/content/balance.ts` (`EPITAPH_FACET_WEIGHTS`). Pick the **primary facet** (highest score ≥ 35) and an optional **secondary** (second-highest ≥ 25, must differ in kind). If nothing clears 35, the life was unremarkable — and the epitaph should *say so* (see Faint lives, §6).

---

## 5. Arc detection

Arcs are the difference between a snapshot and a story. Checked in priority order; at most one arc per life:

| Arc | Detection | Effect on epitaph |
|---|---|---|
| `redeemed` | crossed an Abyss gate, died with alignment > +15 | "...who touched the Abyss and walked back." |
| `fallen` | crossed a Holy gate, died with alignment < −15 | "...consecrated once, and lost." |
| `forsaken` / `sanctified` | crossed tier 3 either side | overrides facet clause — tier 3 *is* the identity |
| `lateBloom` | first gate/legendary/boss after 75% of lifespan | "Only at the end did..." |
| `cutShort` | died before 40% of expected lifespan | "...a life ended early." |
| `unbroken` | survived to max lifespan, no tier-2+ gate | "...steady to the last." (the neutral path's reward — see alignment spec Open Q2) |

Arc templates take precedence over the secondary facet clause when both compete for line 2.

---

## 6. Composition

A small grammar, not free generation:

```
Line 1 (always):   death statement — age + cause/flavor
Line 2 (always):   identity clause — primary facet phrase, intensity-tiered
Line 3 (optional): arc clause OR secondary facet clause OR best chronicle deed
```

- Each facet has a phrase bank with **3 intensity tiers** (score 35–55 / 55–80 / 80+), e.g. knowledge: "a curious mind" → "a scholar" → "one who knew too much."
- Phrase selection within a tier is seeded by the run seed → deterministic but varied across lives.
- **Faint lives:** if no facet clears threshold, use the dedicated bank: "Died at 62. Left little behind." Mediocrity being legible is what makes strong epitaphs feel earned — do not pad faint lives into sounding notable.
- Hard cap ~140 characters total (fits the death screen and a Codex list row).

Worked examples:

> *Abyss-heavy delver:* "Died at 71, deep in The Wound. Marked by the Abyss, and proud of it. None delved deeper."
>
> *Redeemed scholar:* "Died at 68, at peace. A scholar who touched the Abyss and walked back."
>
> *Faint life:* "Died at 59 at the desk of a porter. Left little behind."

### Architecture

```ts
// src/core/epitaph.ts — pure, no Phaser imports
composeEpitaph(summary: RunSummary, seed: number): Epitaph

interface Epitaph {
  lines: string[];            // rendered at compose time for the archive
  primaryFacet: FacetId;
  secondaryFacet?: FacetId;
  arc?: ArcId;
}
```

Phrase banks and templates live in `src/content/epitaphs.ts`. Composition runs inside the death reduction so the epitaph is part of the deterministic state transition, not a UI afterthought.

---

## 7. Storage & Codex

```ts
interface PastLife {
  lifeIndex: number;
  epitaph: Epitaph;
  chronicle: ChronicleEntry[];
  ashEarned: number;
  ageAtDeath: number;
  seed: number;
}
```

- Append to `saveFile.pastLives` on death.
- **Retention:** keep the most recent 30 + pin any life that crossed a tier-3 gate or earned a top-3 ash total ("notable lives"). Bound: ≤ 50 records. Prevents unbounded save growth over hundreds of lives.
- Codex → Past Lives tab: reverse-chronological list of epitaph line 1 + primary facet icon; detail view shows full epitaph + chronicle. Sub-characters get their own filter.
- Migration: old saves get `pastLives: []`.

---

## 8. The diversity check (sim harness)

This is the design-test teeth. Extend the existing balance simulator:

1. After each simulated life, run `composeEpitaph` and record `(primaryFacet, arc)`.
2. **Assertions across the 5 strategy policies (same seed set):**
   - ≥ 4 distinct primary facets appear across policies.
   - No two *different* policies produce identical epitaph text for the same seed.
   - Faint-life rate per policy stays within a tuned band (e.g., 5–25%) — too high means facet thresholds are unreachable; zero means thresholds are too loose to mean anything.
3. Add facet/arc distribution charts to the existing HTML report.

If these assertions fail, the problem is upstream (builds aren't differentiating), and that's exactly what the system is for.

---

## 9. Tests

Unit:
1. Determinism: same summary + seed ⇒ identical epitaph.
2. Facet scoring: handcrafted summaries hit expected primary/secondary.
3. Arc detection priority (a redeemed + lateBloom life picks `redeemed`).
4. Faint-life path renders and never borrows notable phrases.
5. Character cap respected for every phrase-bank combination (property test across banks).
6. Chronicle cap drops low-priority kinds first.
7. `pastLives` retention: cap at 50, notable lives pinned.
8. Migration: missing `pastLives`/chronicle fields get defaults.

E2E:
9. Death screen shows epitaph; chronicle expands.
10. Codex Past Lives tab lists archived lives after two deaths.

---

## 10. Open questions

1. **Should notable lives pay out?** A small ash bonus for first-time arcs (first `redeemed`, first `forsaken`) would make the epitaph system feed progression, at the cost of players gaming arcs. Leaning: tiny one-time codex-style bonuses, mirroring discovery rewards.
2. **Character names.** Generated names would make epitaphs land harder ("Maren died at 74...") — cheap via seeded name banks, but adds attachment the death loop may not want yet.
3. **Lineage view.** Once sub-characters exist alongside many past lives, is the archive a flat list or a family tree? Flat list for v1.
4. **Export.** "Copy epitaph" (text first, image card later) is a free virality/portfolio hook. Probably v1.5.
