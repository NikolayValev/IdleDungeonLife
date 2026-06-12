# Avatar System Spec — LPC Paperdoll

**Status:** Draft v1
**Depends on:** Alignment spec (gates, caps), Study spec (arts, tags), Epitaph spec (drastic-event vocabulary)
**Reference:** [Universal LPC Spritesheet Character Generator](https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator) (ULPC)
**Scope:** Replace the procedural SVG avatar with an LPC layered-sprite paperdoll; state→appearance mapping; rendering pipeline; licensing/credits compliance; animation usage.
**Non-goals (v1):** Custom-drawn IDL-original sprite assets, player-facing character customization UI, NPC sprites.

---

## 1. Design intent

The LPC model is a **paperdoll**: a character is an ordered stack of layer images (body, hair, scars, torso, legs, weapon...) composited into one spritesheet. That is *exactly* the Elden Ring identity principle in image form — **the character's appearance is the literal sum of what they've gathered, studied, and become.** No "class skins"; just layers accumulating on a body.

Rules carried over from earlier specs:

1. Appearance is a **pure, deterministic function of game state** (`state + seed → layer selection`). Same life, same look.
2. The avatar **re-composites only on drastic events** (gate crossed, breakthrough, legendary equipped, job taken, trait evolved) — changes get noticed because they happen at ceremonies, not by drift.
3. **History shows on the body.** Gate scars and palette shifts persist even if alignment recovers.

---

## 2. The two halves

### Half 1 — `composeAppearance` (pure, in core)

```ts
// src/core/appearance.ts — no Phaser, no canvas, fully unit-testable
composeAppearance(state: RunState, seed: number): LpcSelection

interface LpcSelection {
  layers: LpcLayer[];        // ordered by zPos
  paletteOverrides: PaletteOverride[]; // body tone, hair color, tint passes
}

interface LpcLayer {
  sheetId: string;           // e.g. 'torso/robes/hollow_initiate'
  variant: string;           // palette/color variant
  zPos: number;              // from ULPC z-positioning data
}
```

This is the identity logic. It lives beside the reducer, is covered by unit tests, and is the single source of truth for "what do I look like." The renderer never decides appearance; it only draws selections.

### Half 2 — the compositor (UI layer)

A Phaser-side module that takes an `LpcSelection`, draws each layer's spritesheet in z-order onto a `RenderTexture`, and snapshots it into **one texture per character**. Animations then play from that single composited sheet (one draw call per character, cheap on mobile).

- Composite is **cached by a hash of the selection**; re-composite fires only when a drastic event changes the hash.
- ULPC's standard sheet: 64×64 frames, rows per direction, with the classic animation set — **spellcast, thrust, walk, slash, shoot, hurt** (plus LPC Expanded's run/jump/climb where assets exist). Phaser must run with `pixelArt: true` (nearest-neighbor) and integer zoom scaling.

---

## 3. State → layer mapping (the heart)

| Game state | Appearance effect | Mechanism |
|---|---|---|
| Body / base | adult base body | base layer; **palette** carries alignment-cap history (see below) |
| Alignment caps (gate history) | tier 2: skin palette shifts (ashen for Abyss, luminous for Holy); tier 3: permanent overlay layer (markings/scarring/horn-or-halo-class accessory from curated set) | palette override + overlay layer; **keyed to caps, not current value** — a redeemed Forsaken still looks scarred |
| Age | hair/beard palette grays in bands (young→silver); optional elderly base swap at high age *if* curated coverage allows | palette override; LPC Expanded has an elderly base but coverage across clothing layers is incomplete — treat as stretch |
| Equipped items | torso/legs/feet/head/weapon/shield layers | each item definition gains an `lpc` field: `{ sheetId, variant }[]` |
| Arts known | school-tagged accents: trim recolors, subtle glow/aura-class overlays per dominant school | palette accent + at most 1 overlay; arts must read as *seasoning*, not costume |
| Job | job-flavored default outfit when no torso item equipped (porter's wraps, gravedigger's apron) | fallback torso layer per job |
| Vitality | desaturation tiers at <50% / <20%; `hurt` pose on the death screen | palette pass, no extra layers |
| Seed | picks hair style, face details from allowed pools | seeded choice within curated pools |

Budget: **≤ 12 layers per character.** Identity must stay readable at 64px; the mapping above caps at roughly body + hair + 1 gate overlay + 4 equipment + 1 art accent.

The avatar, the chronicle, and the epitaph now all consume the **same drastic-event vocabulary** — one definition of "something happened to you," three mirrors.

---

## 4. Asset pipeline & curation

Do **not** vendor the full ULPC asset tree (thousands of sheets). Instead:

1. **Curate** a subset matched to IDL's content: bodies, ~8 hair styles, job outfits, one armor line per item tier, school robes, gate overlays, weapon classes actually in the 50-item list. Target ≲ 150 sheets.
2. A build script (`scripts/build-avatar-atlas.ts`) copies curated sheets from a pinned ULPC checkout into `public/assets/lpc/`, emits a **manifest** (sheetId → file, zPos from ULPC's z-positioning data, license, authors, source URL), and packs preview thumbnails.
3. **Designer workflow:** the ULPC web generator supports *export-to-JSON* of a character's selections. Authoring an item's look = dress a mannequin in the generator → export JSON → paste into the item's `lpc` field. No hand-editing layer IDs.

---

## 5. Licensing & credits (read this twice)

ULPC art is per-asset licensed under **CC0, CC-BY, CC-BY-SA, OGA-BY, or GPL 3.0**. Everything except CC0 **requires author attribution**, and the repo's CREDITS.csv maps every sheet to its authors/licenses/URLs. Compliance plan:

1. **In-game Credits screen** (new, required): renders the generated credits manifest for every vendored sheet — authors, licenses, links. The README's recommended pattern is to ship the composed credits list and make it discoverable in-app.
2. The build script **fails CI** if any curated sheet lacks a credits entry — compliance becomes a build guarantee, not a memory.
3. **Share-alike:** palette recolors and any pixel edits of CC-BY-SA/GPL sheets are derivative artwork and must be published under the same license. Since the IDL repo is public, committing modified sheets + palette files with a license note satisfies this cheaply. Keep *code* licensing separate from *asset* licensing.
4. **⚠️ The iOS/DRM trap.** ULPC's own README flags that CC-BY-SA (and CC-BY as listed there) carry an anti-DRM/"may not encrypt or protect" clause of unclear reach for DRM'd storefronts, and explicitly recommends **CC0 and/or OGA-BY assets only** for platforms like the iOS App Store — which IDL targets via Capacitor. Two options:
   - **Option A (recommended): curate CC0 + OGA-BY only.** Smaller pool, zero legal ambiguity, one asset set for web and stores.
   - **Option B: dual asset packs** — full set for web, CC0/OGA-BY-only for store builds. More flexibility, double curation cost.
   Filter by license *first*, then curate by looks — discovering a load-bearing CC-BY-SA robe after building around it is the expensive mistake. The manifest already carries per-sheet licenses, so the build script can enforce the chosen policy per build target.

---

## 6. Animation usage in scenes

| Moment | Animation |
|---|---|
| Home dashboard idle | `walk` cycle in place (or stand frame), facing camera |
| Delve in progress | `walk` / `thrust` vignette loop |
| Gate-crossing & breakthrough ceremonies | `spellcast` — the arms-raised transformation beat, then re-composite mid-flash |
| Low vitality | desaturated palette; `hurt` first frame as the "frail" stance |
| Death screen | `hurt` final frame, fading; epitaph below |
| Codex past lives | static composited portrait (south-facing stand frame) |

Oversize weapon frames (the ULPC additions beyond 64×64) are **out of scope for v1** — curate weapons with standard-frame coverage to keep the compositor simple.

---

## 7. Storage & past lives

- **Never store rendered PNGs.** Store the `LpcSelection` (or just the state hash + seed — selection is recomputable). Past-life records in the epitaph archive keep their selection so the Codex can lazily re-render portraits on view.
- Save impact: a selection is ~15 small strings; negligible.
- Migration: existing saves' SVG-avatar parameters are dropped; first load after the update recomputes appearance from current state via `composeAppearance`. One-way, no data loss (state was always the source of truth — this change just makes it official).
- The SVG pipeline (`@resvg/resvg-js`) and its build steps are removed once parity ships.

---

## 8. Tests

Unit (core):
1. Determinism: same state + seed ⇒ identical `LpcSelection`.
2. Gate mapping keys off **caps**, not current alignment (redeemed-Forsaken case keeps scars).
3. Layer budget never exceeded across property-tested random states.
4. Item/art/job mappings resolve to sheets that exist in the manifest (no dangling sheetIds — run against the real manifest in CI).
5. zPos ordering matches ULPC z-positioning data for every emitted selection.

Build/CI:
6. Every curated sheet has a credits entry; build fails otherwise.
7. License policy check per build target (store builds contain only CC0/OGA-BY when Option A/B policy says so).

E2E:
8. Gate-crossing ceremony triggers exactly one re-composite; texture hash changes.
9. Equipping a legendary changes the avatar; unequipping reverts.
10. Credits screen lists authors and is reachable from settings.

---

## 9. Open questions

1. **Art direction collision.** Stock LPC reads bright-fantasy; IDL's world is gothic (chapels, the Wound, ash). Mitigation: a global palette pass (desaturate + cool shadows) applied at composite time — needs a visual spike before committing. If stock palettes fight the tone too hard, this is the strongest argument for Option A's smaller, fully-recolorable (CC0/OGA-BY) pool.
2. **Elderly base.** LPC Expanded includes an elderly body but clothing coverage is partial. Ship age as palette-only in v1, adopt the elderly base later if curation gaps close?
3. **Portrait vs sprite.** Keep a larger stylized portrait (the old SVG's role) alongside the 64px sprite, or let the sprite carry all identity display? Leaning: sprite-only v1; scale 4× with nearest-neighbor for the dashboard.
4. **Sub-characters.** Five sub-characters × cached composites is trivial perf-wise, but do they share the curated wardrobe or get distinct silhouettes (one curated signature item each)?
5. **Contributing upstream.** If IDL commissions gothic recolors/overlays (gate scars, ash palettes), contributing them back to ULPC under CC-BY-SA/OGA-BY is good citizenship and free visibility for a portfolio project.
