# Ceremony Mini-Spec — The Shared Transformation Sequence

**Status:** Frozen (Wave 0 / F1)
**Owner:** Orchestrator
**Referenced by:** Alignment §6, Study §4 (breakthroughs), Avatar §6, Epitaph/Chronicle §3

All four identity systems invoke "the ceremony" but none defines it. This is the one definition. A ceremony is the loud, interactive beat that marks a **drastic event** — the same vocabulary that writes the chronicle and re-composites the avatar. One definition of "something happened to you," three mirrors.

---

## 1. What triggers a ceremony

Exactly the `DrasticEventKind` vocabulary frozen in [`src/core/types.ts`](../../src/core/types.ts):

| Kind | Scale | Source wave |
|---|---|---|
| `gateCrossed` | **major** | Alignment (Wave 1) |
| `breakthrough` | **major** | Study (Wave 2b) |
| `traitEvolved` | minor | existing trait system |
| `legendaryFound` | minor | existing loot |
| `bossFelled` | minor | existing dungeons |
| `jobTaken` | minor | existing jobs |
| `deepestDelve` | minor | existing dungeons |
| `death` | terminal | death reduction |

**Major** events play the full sequence (§3). **Minor** events play an abbreviated form (§4). `death` routes to the death screen, not a ceremony.

---

## 2. The contract between core and UI

Ceremonies are **never** driven by the UI inspecting state. The reducer emits a one-shot `DrasticEffect` into `SaveFile.transientEffects`; the UI drains the queue, plays each effect's ceremony, then clears it. This keeps the trigger deterministic and inside the pure state transition.

```ts
// core appends (in the reducer, during the relevant reduction):
transientEffects: [...(state.transientEffects ?? []), {
  kind: "gateCrossed",
  year,                 // in-game age, drives the chronicle line
  refId: "abyss_2",     // gateId | traitId | itemId | dungeonId | jobId | schoolId | artId
  detail: { alignmentAtCrossing, newCaps },  // kind-specific, frozen per wave
}]

// UI drains (once, after reducing), in order, then writes back transientEffects: []
```

Rules:
- **Core emits; UI consumes.** Core must never read DOM/Phaser; UI must never recompute *whether* a ceremony should fire — it only reads the queue.
- **Same reduction writes the chronicle.** Whenever a wave appends a `DrasticEffect`, it appends the matching `ChronicleEntry` (`{ year, kind, refId }`) to `run.chronicle` in the same reduction. The effect is transient (played once); the chronicle entry is permanent.
- **Offline-safe.** Effects accumulated during `reconcileOffline()` survive into the returned state and play on return (escalating the welcome-back). A gate crossed while away is a feature, not an edge case (Alignment §5).
- **Idempotent drain.** Playing a ceremony must not mutate game state beyond clearing the queue. Re-entering the scene after a drain shows nothing.

---

## 3. The major sequence (gate crossing, breakthrough)

Ordered beats. Timings are targets; the UI owns exact values.

1. **Pause / time-stop.** Freeze the idle simulation visually for the beat (~150 ms in).
2. **Avatar `spellcast` pose + flash.** The arms-raised transformation frame; re-composite the paperdoll *mid-flash* so the change is hidden then revealed (Avatar §6).
3. **Re-composite.** Recompute `composeAppearance(state, seed)`; if the selection hash changed, swap the cached texture. History persists (caps/gates → scars), so a redeemed character still shows the mark.
4. **Name card.** Centered: the identity line — gate flavor name ("You are now: Marked by the Abyss") or breakthrough ("Stage 3 — The Hollow Order").
5. **Trait reveal (if any).** Reveal traits whose threshold coincides with this event, stacked under the name card.
6. **Persistent tint shift (gates only).** UI theme tint moves toward the crossed pole; persists until death.
7. **Chronicle confirmation.** A subtle "recorded" beat — the entry is already in `run.chronicle`; this just acknowledges it.

Total felt duration: ~2–3 s, skippable on tap (skipping still leaves all state changes applied — the ceremony is presentation only).

---

## 4. The minor sequence

For `traitEvolved`, `legendaryFound`, `bossFelled`, `jobTaken`, `deepestDelve`:

1. Brief avatar pulse + re-composite if the selection hash changed (many minor events won't change it).
2. A single toast/banner line (no full-screen takeover, no time-stop).
3. Chronicle entry written (same reduction).

Minor ceremonies must not interrupt active play — they layer onto the HUD.

---

## 5. Pre-crossing confirmation (gates only)

When an **explicit player action** (equip item, take talent, choose dungeon, perform breakthrough) *would* fire a major ceremony that narrows future options, show a confirm first: *"This will change you permanently."* Passive drift (job ticks, offline reconciliation) fires silently — drifting into damnation by neglect is intended fiction (Alignment §6). The confirm is a UI concern; the reducer still applies the change deterministically once the action is dispatched.

---

## 6. What F1 froze vs. what waves own

- **F1 froze:** the `DrasticEventKind` vocabulary, the `DrasticEffect` container, the `transientEffects` queue, the `ChronicleEntry` shape, and this sequence contract.
- **Each wave owns:** *when* to append its effect + chronicle entry, and the `detail` payload for its kind.
- **The ceremony UI wave (Wave 4)** owns the actual rendering of §3–§4 against the queue. Until it ships, effects accumulate harmlessly and can be asserted in tests.
