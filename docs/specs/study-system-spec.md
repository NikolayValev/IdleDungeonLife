# Study System Spec — Schools & Refinement

**Status:** Draft v1
**Depends on:** Alignment spec (gates, drift), Epitaph spec (`studyMastered` chronicle kind)
**Scope:** Schools, refinement tracks, breakthroughs, arts, the time-allocation economy, lifespan extension, offline behavior.
**Non-goals (v1):** Study automation, school questlines/NPCs, a fourth legacy path, pill/elixir crafting.

---

## 1. Design intent

The model is xianxia cultivation: you enroll at a **school**, spend years in **refinement**, and advance through discrete **breakthroughs** that permanently change what you are. But IDL's identity rule still holds — **schools are places you study, not classes you are.** What you carry away is **arts**: techniques that stay with you like Elden Ring spells, mixable across schools. Two characters who studied at the same school can end the life as completely different people.

The three loops finally close into one economy:

```
Jobs → gold → fund refinement → Study → arts + lifespan → deeper delves
  ↑                                                            ↓
  └────────────── Dungeons → manuals & insights ───────────────┘
```

Core tension: **study spends years to earn years.** Refinement consumes lifetime; breakthroughs extend it. Cultivation is a bet on your own future.

---

## 2. Occupation model (the time economy)

A character has one occupation slot:

```ts
type Occupation =
  | { type: 'job'; jobId: JobId }       // earns gold
  | { type: 'study'; schoolId: SchoolId } // earns refinement
  | null;                                // idle (drifting)
```

- Job years earn gold (existing system, unchanged).
- Study years earn refinement at the enrolled school and **consume gold upkeep** (incense, materials, tuition — the gold sink that makes jobs matter).
- Delving pauses the occupation (you can't refine in a dungeon — v1).
- Switching occupation is free but resets nothing; refinement progress is never lost.

This single slot is the central per-life decision: every year is worked, studied, or delved.

---

## 3. Schools

Three in v1, mapped to the existing alignment poles and trait tags:

| School (working name) | Lean | Teaches | Refinement style |
|---|---|---|---|
| **The Choir** | Holy | warding, vitality, restoration arts | slow, stable, +alignment drift while studying |
| **The Hollow Order** | Abyss | power, decay, sacrifice arts | **fast** (≈1.4× rate), −alignment drift per study year |
| **The Archive** | Knowledge | utility, discovery, perception arts | neutral; dampens all alignment drift while enrolled (resolves Alignment spec Open Q3) |

Rules:

- **Enrollment** is required to refine at a school; one enrollment at a time. Re-enrolling elsewhere keeps all prior progress frozen.
- **Alignment gates lock doors, not knowledge.** Crossing `abyss_2` bars enrollment at the Choir (they cast you out); crossing `holy_2` bars the Hollow Order. **Arts already known are never taken away** — a Forsaken character still carries Choir wards learned before the fall. History stays on the body.
- The Archive never bars anyone. The neutral path always has a home.
- Demonic-style speed trade: the Hollow Order refines fastest but its drift pushes you toward the very gates that lock other schools — speed-running power costs future options. The ratchet does the balancing.

---

## 4. Refinement & stages

Each school is a track of **5 stages**. Within a stage, study-years fill a refinement meter; at 100% the character is **bottlenecked** until a breakthrough is performed.

```ts
interface StudyState {
  enrolled: SchoolId | null;
  schools: Record<SchoolId, {
    stage: number;          // 0–5; 0 = never studied
    refinement: number;     // 0–100 toward next stage
    bottlenecked: boolean;
  }>;
  artsKnown: ArtId[];
}
```

Refinement rate (per study-year) = base rate × school modifier × manual bonuses × legacy perks. All rates in `balance.ts` (`STUDY_RATES`).

### Breakthroughs

Advancing a stage is a deliberate, discrete act — never automatic:

- **Conditions, not dice.** A breakthrough succeeds if its requirements are met: refinement at 100%, plus stage-specific conditions (a manual owned, an alignment range, a boss felled, a minimum age). No RNG failure — bottlenecks are puzzles ("what am I missing?"), not slot machines. Unmet conditions are shown as hints, codex-style.
- **The Toll.** Every breakthrough costs **vitality** (e.g., stage 2→3 costs 12% of max). Breaking through late in life can kill you. Dying mid-breakthrough is a legitimate, chronicle-worthy end — add arc `ascensionDeath` to the epitaph spec: *"Died at 77, reaching for the next stage."*
- Stage milestones grant **lifespan**: +4 years at stage 2, +8 at stage 3, +14 at stage 4, +24 at stage 5 (per school, stacking — tune in sim). This is the compounding engine: early lives barely afford stage 2; legacy-boosted lives chain breakthroughs and live to see content a 60-year life never could.
- A breakthrough is a **drastic event**: forced avatar re-render, chronicle entry (`studyMastered` → rename kind to `breakthrough`), name card, the works — same ceremony grammar as gate crossings, smaller scale.

### Arts

Stages unlock **arts** — the takeaway:

- ~2 arts per stage per school (≈30 arts v1). Passive modifiers in v1 (delve speed, vitality regen, gold yield, discovery chance, alignment-drift shaping); active abilities later.
- Arts carry **trait tags** (`holy`, `decay`, `knowledge`...) and feed the avatar generator and epitaph facet scoring exactly like items do. A character's look and epitaph reflect the arts they carry — which is how studying changes "how you look and who you are" without any class label.
- Arts are per-life by default; the **Knowledge legacy path** sells "Inherited Memory" ash unlocks — start the next life already knowing one chosen art. (Bloodline transmission of techniques: pure xianxia, pure roguelite.)

---

## 5. Manuals & insights (the dungeon bridge)

Dungeons drop **manuals** — items tagged to a school/art:

- A manual is an *accelerant or key*, never busywork: either +refinement rate for its school, or a required condition for a specific breakthrough (e.g., stage 4 of the Hollow Order needs *The Meat Psalter*, found past dungeon 9).
- Higher stages need manuals from deeper dungeons → study power gates delve depth, delve depth gates study power. The loop interlocks instead of running parallel.
- Manuals are codex items; "unknown manual" placeholders telegraph where to look, matching the existing discovery design.

---

## 6. Offline behavior

- Study refinement accrues offline through `reconcileOffline()` like job income, including gold upkeep (if gold runs out offline, study idles from that point — no debt).
- **Refinement caps at the bottleneck offline. Breakthroughs never auto-fire.** The player returns to "Refinement complete — breakthrough awaits," performs it manually, and gets the ceremony live. Loud moments stay interactive; the welcome-back toast gains a "breakthrough ready" line.

---

## 7. UI

- **Occupation switcher** on the home dashboard: Work / Study / (Delve as today). Study shows enrolled school, stage, refinement %, gold upkeep per year.
- **School screen** per school: stage ladder, current refinement, breakthrough button (disabled with condition hints when unmet), arts learned/locked, drift indicator ("Studying here pulls you toward the Abyss: −0.3/yr").
- Bottleneck state is loud on the HUD (pulsing meter) — it's the call-to-action that brings idle players back.
- Locked enrollment (gate-barred) renders the school door visually sealed, mirroring the burned alignment bar.

---

## 8. Balance targets (10-min / 60–80-year life)

- An early life splitting time evenly should reach **stage 2 in one school** (~first lifespan bonus) — proof of the "study to live longer" loop within life #1–2.
- A life *dedicated* to one school: stage 3 by death. Stages 4–5 require legacy lifespan boosts + deep-dungeon manuals — they are the mid/late-game ladder.
- Suggested first-pass numbers (tune via sim): stage costs 6 / 9 / 13 / 18 / 24 study-years; Hollow ×1.4 rate; upkeep ~30–60% of an average job's income (working *then* studying must beat doing neither, but pure study without savings should stall).
- **Sim harness additions:** a `StudyFocused` policy; milestones `stage2_reached`, `breakthrough_toll_death`, `art_count_at_death`. Assert: study-focused lives live measurably longer and produce `knowledge`-primary epitaphs — wiring the diversity check (Epitaph §8) to the new system.

---

## 9. Tests

Unit:
1. Refinement accrues only while occupation = study at the enrolled school; gold upkeep deducted; stalls at zero gold.
2. Bottleneck clamps at 100; no auto-breakthrough online or offline.
3. Breakthrough: succeeds only with all conditions; applies vitality toll; grants stage, arts, lifespan; emits drastic-event effect + chronicle entry.
4. Vitality toll can kill; death mid-breakthrough produces `ascensionDeath` arc inputs.
5. Gate-barred enrollment rejected; previously learned arts retained after gate crossing.
6. Archive enrollment dampens drift from all sources while enrolled.
7. Determinism: same seed + events ⇒ identical StudyState.
8. Offline: 10h away with study assigned ⇒ refinement capped at bottleneck, upkeep accounting correct.
9. Migration: saves without `StudyState` get empty defaults.

E2E:
10. Enroll → study → bottleneck → breakthrough ceremony renders → art appears on character.
11. Welcome-back shows "breakthrough ready" after offline bottleneck.

---

## 10. Open questions

1. **Flavor skin.** Mechanics are xianxia; IDL's world is gothic (chapels, the Wound). Keep translated terms (Schools / Refinement / Breakthrough / the Toll) or lean fully into cultivation language (Sects / Qi / Tribulation)? Working names above assume the gothic skin — mechanics don't change either way.
2. **Multi-school dabbling.** Any penalty for spreading across schools, or is the time economy + per-school manual gating enough natural pressure? Leaning: no explicit penalty in v1; let scarcity of years do it.
3. **Stage 5 fantasy.** Should stage 5 of any school be a per-life *transcendence* with a unique ending-style death (feeding a special epitaph), rather than just bigger numbers? Strong candidate for the long-horizon goal.
4. **Study while delving.** A late Archive art ("Walking Meditation") that lets refinement tick at 25% during delves would be a beloved automation-style unlock — v1.5.
5. **Sub-characters.** Do the five sub-characters share the manual codex? (Probably yes — manuals are knowledge, knowledge is the bloodline's.)
