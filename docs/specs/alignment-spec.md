# Alignment System Spec — Idle Dungeon Life

**Status:** Draft v1
**Scope:** Per-life alignment scalar, one-way gates (ratchets), events, UI feedback, trait/avatar hooks, balance targets for a ~10-minute life.
**Non-goals (v1):** Study-system integration, cross-life alignment inheritance, NPC reactions.

---

## 1. Design intent

Identity in IDL is emergent, not class-based. Alignment is the one axis where choices are **irreversible**: drifting toward the Abyss (or Holiness) closes doors permanently within that life. The player should *feel* a gate crossing as the most dramatic moment in the game.

Design rules:

1. Alignment moves freely inside the currently reachable range.
2. Crossing a gate **permanently narrows** the reachable range for this life. You can recover toward the middle, never to the opposite extreme.
3. Gate crossings are loud: avatar transformation, trait reveals, UI tint, chronicle entry.
4. Everything is deterministic and lives in the pure reducer — no randomness in alignment math itself.

---

## 2. Data model

Alignment is a single scalar:

```
alignment: number   // -100 (Abyss) .. +100 (Holy), 0 = neutral
```

Ratchet state is stored as a pair of caps, not as a list of flags:

```ts
interface AlignmentState {
  value: number;        // current alignment, clamped to [minCap, maxCap]
  minCap: number;       // starts -100, raised by crossing Holy gates
  maxCap: number;       // starts +100, lowered by crossing Abyss gates
  gatesCrossed: GateId[]; // ordered history, for epitaph/chronicle
}
```

Storing caps (rather than recomputing from gates) makes save migration and clamping trivial, and `gatesCrossed` preserves narrative history.

`AlignmentState` lives on the active run (per-life). On death, `gatesCrossed` is copied into the run summary for the epitaph/codex; caps reset on the next life.

---

## 3. Gates

Three tiers per side, symmetric:

| Gate ID | Threshold | Effect on opposite cap | Flavor name (working) |
|---|---|---|---|
| `abyss_1` | value ≤ −25 | maxCap → +50 | Shadowed |
| `abyss_2` | value ≤ −50 | maxCap → +15 | Marked by the Abyss |
| `abyss_3` | value ≤ −75 | maxCap → −25 | Forsaken |
| `holy_1`  | value ≥ +25 | minCap → −50 | Touched by Light |
| `holy_2`  | value ≥ +50 | minCap → −15 | Consecrated |
| `holy_3`  | value ≥ +75 | minCap → +25 | Sanctified |

Properties this table guarantees:

- **Tier 1 is forgiving:** you can still reach a strong mix of the other side (±50). Early experimentation isn't punished.
- **Tier 2 is the real lock:** the opposite side is reduced to a trace (±15) — "a mixture of good and evil" but never the opposite extreme. This matches the stated design: past a certain evil, your options are *more evil* or *mixed*.
- **Tier 3 means you can never be neutral again:** the cap crosses zero. A Forsaken character is evil-tinged forever, even at their most redeemed.
- Crossing a tier-3 gate on one side is mutually exclusive with crossing tier-1 on the other (caps make it unreachable), so no contradictory states exist.

All thresholds and cap values live in `src/content/balance.ts` as a single `ALIGNMENT_GATES` table so they're tunable without touching the reducer.

---

## 4. Events & reducer behavior

### Inputs that shift alignment

Alignment never changes on its own; it changes as a *side effect* of existing events. Add an `alignmentDelta` field to content definitions rather than new event types:

- **Dungeon/encounter outcomes** — each dungeon (and boss) defines an alignment delta or a choice of deltas.
- **Items** — equipping/using items with `holy`/`unholy` tags applies a one-time or per-delve delta.
- **Jobs** — each job tick can carry a small drift (e.g., Gravedigger drifts −0.1/yr, Acolyte +0.1/yr). Gives jobs identity weight without a new system.
- **Talents** — taking a Holy/Abyss branch talent applies an immediate delta.

### Reducer logic (pure)

On any event carrying an alignment delta:

```
1. next = clamp(value + delta, minCap, maxCap)
2. for each gate not yet crossed, in order of |threshold|:
     if next crosses its threshold → 
        record gate in gatesCrossed
        apply cap change
        append GateCrossed to transient effects
3. write next into state
```

Notes:

- A single large delta can cross multiple gates in one event (e.g., a legendary cursed item: −40). Process gates in ascending tier order so all fire, in order.
- Cap changes apply *after* the value update within the same reduction, so a crossing never retroactively blocks itself.
- `GateCrossed` is a **transient effect** (like `showWelcomeBack`), not a stored event — the UI consumes it once to play the transformation sequence.

### New types

```ts
type GateId = 'abyss_1' | 'abyss_2' | 'abyss_3' | 'holy_1' | 'holy_2' | 'holy_3';

interface GateCrossedEffect {
  type: 'gateCrossed';
  gate: GateId;
  alignmentAtCrossing: number;
  newCaps: { minCap: number; maxCap: number };
}
```

---

## 5. Offline reconciliation

Job drift means alignment can change while away. `reconcileOffline()` must apply drift through the same reducer path so gates fire deterministically. If one or more gates were crossed offline, the welcome-back toast escalates: instead of (or in addition to) the normal summary, the gate-crossing transformation sequence plays on return. Crossing a gate while away and being told about it ("While you slept, something changed in you") is strongly on-theme — treat it as a feature, not an edge case.

---

## 6. UI & feedback

**Always visible (HUD):**
- Alignment bar: horizontal, Abyss-dark left to Holy-light right, marker at current value.
- **Render the caps as burned-off regions.** Once `abyss_2` is crossed, the right side of the bar beyond +15 appears scorched/sealed. This makes irreversibility *visible at a glance* — the single most important UI element in the system.
- Gate thresholds shown as faint notches before crossing, so players see the cliff before walking off it. (First gate per side could be unmarked for discovery — see Open Questions.)

**Gate-crossing sequence (the loud moment):**
1. Brief pause / time-stop.
2. Full-screen avatar regeneration with transition (the avatar already derives from alignment — this is the forced re-render moment).
3. Gate name card: "You are now: Marked by the Abyss."
4. Reveal of any traits with `alignmentThreshold` triggers at this gate.
5. UI theme tint shifts (persistent until death).
6. Chronicle/epitaph entry recorded: "At 43, crossed into the Abyss."

**Pre-crossing warning:** when an *explicit player action* (equip item, take talent, choose dungeon) would cross a gate, show a confirm: "This will change you permanently." Passive drift (job ticks, offline) crosses silently — drifting into damnation by neglect is good fiction. Only deliberate choices get the warning.

---

## 7. System hooks

- **Traits:** existing `alignmentThreshold` triggers should be re-pointed at gate IDs rather than raw values, so trait reveals and gate ceremonies always coincide.
- **Avatar:** add `gatesCrossed` (or just current caps) as an input to avatar generation in addition to raw alignment — a redeemed Forsaken character should still *look* scarred. This is the Elden Ring principle: history shows on the body.
- **Legacy paths:** Holy/Abyss path perks may start the next life with a small alignment bias (e.g., ±10) or pre-narrowed caps as a *chosen* commitment. Flag for a later spec — keep v1 per-life only.
- **Epitaph (future):** `gatesCrossed` + crossing ages are the primary input to the generated epitaph.

---

## 8. Balance targets (10-minute / 60–80-year life)

- 10 real minutes ≈ 70 in-game years → **~7 years/min**.
- A player making consistently aligned choices should hit **tier 1 around year 15–20 (~2–3 min)**, **tier 2 around year 35–45 (~5–6 min)**, **tier 3 only with deliberate stacking by year 60+ (~8–9 min)**. Roughly: one gate ceremony per third of a life.
- Passive job drift alone should reach tier 1 by mid-life but never tier 3 — extremes must require active choices (items, talents, dungeon choices).
- Suggested starting magnitudes (tune via simulator): job drift ±0.1–0.2/yr; dungeon completion ±3–8; boss choice ±10–15; tagged item equip ±5–20; talent pick ±10.
- **Add gate-crossing milestones to the sim harness** (`gate_abyss_2_crossed`, etc.) and verify timing distributions across the existing strategy policies before shipping numbers.

---

## 9. Tests

Unit (reducer):
1. Delta applies and clamps to caps.
2. Crossing each gate sets correct caps and appends to `gatesCrossed`.
3. A gate never fires twice; caps never widen within a life.
4. Single large delta crosses multiple gates in order.
5. Post-`abyss_2`, no sequence of positive deltas exceeds +15.
6. Determinism: same seed + same events ⇒ identical alignment state.
7. Offline drift crosses gates identically to online play.
8. Save migration: legacy saves without `AlignmentState` get defaults (value preserved if present, caps full-range, empty history).

E2E (Playwright):
9. Gate-crossing sequence renders (name card visible, avatar re-render fired).
10. Confirm dialog appears for an explicit action that would cross a gate; not for drift.

---

## 10. Open questions

1. **Discovery vs. legibility:** show all gate notches up front, or hide tier 2/3 until first crossed (codex hint after)? Leaning: show tier 1, hide deeper tiers for first-time discovery.
2. **Neutral identity:** is staying near 0 a *path* (a "Balanced" identity with its own perks/traits) or just the absence of commitment? If neutrality is never rewarded, every build converges to an extreme.
3. **Knowledge path interaction:** Knowledge is the third legacy path but has no alignment pole. Does heavy Knowledge investment dampen alignment swings (scholarly detachment)? Nice synergy candidate, not v1.
4. **Cross-life scarring:** should crossing tier 3 leave a permanent mark on the *legacy* (bloodline) level — e.g., a codex flag, a tiny starting bias next life? Strong flavor, but defer until per-life loop feels right.
