# Avatar readable glow-up

**Date:** 2026-06-09
**Status:** Approved (design)

## Problem

The procedural character avatar ([src/ui/avatar/](src/ui/avatar/)) renders as a flat,
near-black silhouette with no internal definition. Root cause: all three palette
colors are near-black (`c0 #101010`, `c1 #2A2A2A`, accent `c2` only on tiny
eyes/markings), so every layer collapses into one blob. On the dark Vessel panel
the player sees an outline and nothing else. The shapes themselves
([layers.ts](src/ui/avatar/layers.ts)) are acceptable silhouettes; the colors are
the failure.

Secondarily, the avatar is "flaky" in-app: MainScene now restarts every tick, and
the avatar re-adds *asynchronously* each restart, dropping a frame (flicker); decode
relies on CSS-variable resolution during SVG-as-image rasterization, which is a
fragile path.

## Goal

A readable, higher-definition avatar that keeps the procedural, seed-driven approach:
real color contrast, outlines, simple shading, a handful of detail shapes, and a
stable (non-flickering) in-app render. Out of scope: more layers / per-alignment
motifs / extra palette colors / new rendering tech (those were the larger options the
user declined).

## 1. Color model

Keep the three semantic colors and their meaning:
- `c0` = skin / base body (head, body, arms, legs)
- `c1` = garment (torso, hood, horns)
- `c2` = accent / glow (eyes, markings, overlays)

Two changes:

**(a) New, contrasting palette values** ([palettes.ts](src/ui/avatar/palettes.ts)),
alignment-tinted, replacing the near-black set:

| family | c0 (body) | c1 (garment) | c2 (accent) |
|--------|-----------|--------------|-------------|
| holy   | warm pale (`#d8c6a8`-ish) | deep slate/indigo | gold (`#f0d878`) |
| neutral| ashen tan/grey (`#b3a892`) | charcoal-blue | cyan/violet |
| unholy | cold sickly grey-mauve (`#9c8a96`) | dark plum/maroon | magenta/violet glow |

Exact hexes are tuned during implementation; the binding requirement is a **real
luminance spread**: `c0` clearly lighter than the panel, `c1` distinctly darker than
`c0`, `c2` bright. Two variants per family are retained (`*_0`, `*_1`).

**(b) Derived depth tones** instead of expanding the palette data. Small pure hex-math
helpers compute, from any base color:
- `outline` = `c1` darkened to ~40% (tinted near-black)
- `shade` = region color × ~0.78
- `highlight` = region color × ~1.18 (clamped to 255)

Rationale: deriving tones from three colors keeps palette data small and preserves
seed variety for the same visual payoff (vs. authoring 5 explicit colors per palette).

**New unit:** `src/ui/avatar/colorMath.ts` — `darken(hex, factor)`, `lighten(hex,
factor)`, `mix(hexA, hexB, t)`. Pure, deterministic, unit-tested. One clear
responsibility (hex tone math), no deps.

## 2. Outline + shading

**Outline:** the outer-boundary layers (body, head, torso, arms, legs, hoodHair,
horns) are stroked with the derived `outline` color at ~3px (in the 512 viewBox).
Small accents (eyes, markings, overlays) are left unstroked. The `rect`/`circle`/
`polygon` helpers in [layers.ts](src/ui/avatar/layers.ts) gain optional
`stroke`/`strokeWidth` params; a layer opts in by passing them.

**Shading:** body / torso / head fills become a vertical `linearGradient`
(highlight at top → base → shade at bottom) rather than a flat fill. One gradient def
per region color, emitted in `<defs>`. Smooth depth with no extra polygons. Both
resvg and browser `createImageBitmap` render gradients reliably.

## 3. Detail shapes (the handful)

Driven by existing variant indices, kept minimal:
- **Face:** a brow ridge (thin dark shape above the eyes) and a small nose/cheek shade
  hint. Subtle, not cartoonish.
- **Belt:** a band at the waist in `c1`/accent.
- **Hands / feet:** the existing end-circles and foot rects gain the outline plus a
  small shade for a finger/toe read.
- **Collar / shoulder trim:** a short accent line at the torso top.

## 4. Flakiness fix

**Flicker:** in [MainScene.ts](src/ui/scenes/MainScene.ts) `drawAvatarPanel`, when the
texture is already cached (`scene.textures.exists(textureKey)`), add the image
**synchronously** within `create()` instead of going through the async
`createAvatarTextureKey().then(...)`. Only first-ever generation for a given state
stays async (keeping the existing "No image" fallback). This removes the per-tick
1-frame drop.

**Decode robustness:** in [buildCharacterSvg.ts](src/ui/avatar/buildCharacterSvg.ts),
drop the `<style>` + `var(--cN)` indirection and emit **literal fills + gradient
defs**. SVG-as-image decoding then never depends on CSS-variable resolution.

## 5. File structure

- **New** `src/ui/avatar/colorMath.ts` — hex tone helpers (pure).
- **Modify** `src/ui/avatar/palettes.ts` — new contrasting palette values.
- **Modify** `src/ui/avatar/buildCharacterSvg.ts` — literal fills, `<defs>` gradients,
  pass derived tones to layers.
- **Modify** `src/ui/avatar/layers.ts` — stroke params on primitives, gradient fills on
  body/torso/head, new detail shapes. (Already ~490 lines; watch growth, but it remains
  one cohesive "shape rendering" unit, so keep it together.)
- **Modify** `src/ui/scenes/MainScene.ts` — synchronous cached-texture add.
- `src/ui/avatar/types.ts` is **unchanged**: derived tones (outline/shade/highlight)
  are computed in `buildCharacterSvg` from `c0`/`c1`/`c2` at render time, not stored on
  `CharacterVisualState`. This keeps the state minimal and the derivation in one place.

## 6. Testing / verification

**Unit:**
- `colorMath.test.ts`: `darken`/`lighten`/`mix` produce expected, clamped, deterministic
  results.
- Extend `avatar-generator.test.ts`: derived-color determinism (same input → same SVG);
  a **contrast assertion** — for each palette the three tones have a real luminance
  spread (e.g. `lum(c0) - panelLum > T` and `lum(c0) - lum(c1) > T`); output contains
  the expected outline `stroke` and a `linearGradient`.
- Keep all existing avatar tests green.

**Visual:**
- A throwaway render harness (a temp vitest that calls `exportAvatarAtlas` over curated
  `generateAvatarDebugSamples`) writes a before/after strip to `.runtime/`; inspect it,
  then delete the harness.
- In-app screenshot of the Home/Vessel panel to confirm on-dark-panel readability and
  no flicker.

## Risks

- **Palette tuning is subjective.** The contrast assertion guards the hard failure
  (collapse to one value); final hexes are dialed in against the rendered strip.
- **Outline seams** between adjacent shapes may show as internal lines. Acceptable for a
  cel/blocky style; if ugly, restrict strokes to the outermost layers.
- **Gradient/stroke support in `createImageBitmap`**: both are core SVG and widely
  supported; the literal-fill change also removes the riskier CSS-var path.
- No save/data changes — purely presentational.
