# Avatar Readable Glow-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the flat near-black avatar silhouette into a readable, higher-definition figure — contrasting palettes, derived outline/shade tones, gradient shading, a few detail shapes — and stop the in-app flicker.

**Architecture:** Keep the procedural SVG approach. Palettes get real contrast. A new pure `colorMath` module derives outline/shade/highlight tones from the three base colors. `buildCharacterSvg` emits literal fills + `<defs>` gradients (no more CSS `var()`), and threads a `RenderContext` to the layer renderers, which stroke outer-boundary shapes and fill body/garment with the gradients. MainScene adds the cached avatar texture synchronously to kill per-tick flicker.

**Tech Stack:** TypeScript, SVG, resvg (`svgToPngBuffer`) + browser `createImageBitmap`, Phaser 3, Vitest.

---

## Reference facts (verify by reading)

- `src/ui/avatar/buildCharacterSvg.ts` currently wraps layers in an `<svg>` with a `<style>` block mapping `.c0/.c1/.c2` classes to `var(--cN)` with literal fallback.
- `src/ui/avatar/layers.ts`: primitives `rect/circle/polygon` take `fill: FillToken` (`"c0"|"c1"|"c2"`) and emit `class="${fill}"`. `renderLayer(layer, state)` dispatches to per-layer renderers. `LAYER_ORDER` = body, legs, arms, torso, head, hoodHair, horns, eyes, markings, overlays.
- `src/ui/avatar/types.ts`: `CharacterVisualState` has `c0/c1/c2` (hex strings) plus variant indices. **Unchanged by this plan.**
- `src/ui/avatar/hashing.ts` exports `fnv1a32(str: string): number`.
- `tests/unit/avatar-generator.test.ts` line ~87-88 asserts `svg.includes("<path")` is `false` and `svg.includes("var(--c0)")` is `true`. The `var(--c0)` assertion MUST be updated (we remove it). The atlas test only checks frame geometry + png length.
- `src/ui/scenes/MainScene.ts` `drawAvatarPanel` builds `state`/`svg`/`textureKey`, then `void createAvatarTextureKey(this, textureKey, input).then(add image).catch(show "No image")`. `createAvatarTextureKey` (atlas.ts) returns early (cached) if `scene.textures.exists(key)`, else draws the canvas.
- The avatar sits on a panel screen rect `0x202036` (perceptual luminance ≈ 0.14). The body must read clearly above that.

---

## Task 1: colorMath module

**Files:**
- Create: `src/ui/avatar/colorMath.ts`
- Test: `tests/unit/color-math.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/color-math.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { darken, lighten, mix, relativeLuminance } from "../../src/ui/avatar/colorMath";

describe("colorMath", () => {
  it("mix interpolates channels and clamps t", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", -1)).toBe("#000000"); // clamped
    expect(mix("#000000", "#ffffff", 2)).toBe("#ffffff"); // clamped
  });

  it("darken moves toward black, lighten toward white", () => {
    expect(darken("#808080", 0.5)).toBe("#404040");
    expect(lighten("#808080", 0.5)).toBe("#c0c0c0");
    expect(darken("#abcdef", 0)).toBe("#abcdef");
  });

  it("accepts 3- and 6-digit hex and is case-insensitive", () => {
    expect(darken("#FFF", 0)).toBe("#ffffff");
    expect(mix("#FFF", "#000", 0.5)).toBe("#808080");
  });

  it("relativeLuminance returns 0..1, ordered by brightness", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#d9c7a3")).toBeGreaterThan(relativeLuminance("#3a4566"));
  });

  it("is deterministic", () => {
    expect(darken("#3a2230", 0.6)).toBe(darken("#3a2230", 0.6));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/color-math.test.ts`
Expected: FAIL — cannot find module `colorMath`.

- [ ] **Step 3: Implement `src/ui/avatar/colorMath.ts`**

```ts
interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function parseHex(hex: string): Rgb {
  let body = hex.replace("#", "").toLowerCase();
  if (body.length === 3) {
    body = body
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) => clampByte(value).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Linear interpolation between two hex colors. `t` is clamped to [0,1]. */
export function mix(a: string, b: string, t: number): string {
  const ratio = clamp01(t);
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex({
    r: ca.r + (cb.r - ca.r) * ratio,
    g: ca.g + (cb.g - ca.g) * ratio,
    b: ca.b + (cb.b - ca.b) * ratio,
  });
}

/** Move a color `amount` (0..1) toward black. */
export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

/** Move a color `amount` (0..1) toward white. */
export function lighten(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

/** Perceptual luminance in [0,1] (matches the app's existing readable-text math). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/color-math.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` (clean)
Run: `npx eslint src/ui/avatar/colorMath.ts tests/unit/color-math.test.ts` (clean)

- [ ] **Step 6: Commit**

```bash
git add src/ui/avatar/colorMath.ts tests/unit/color-math.test.ts
git commit -m "feat: add colorMath hex tone helpers for avatar"
```
(End commit messages with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`)

---

## Task 2: Contrasting palettes

**Files:**
- Modify: `src/ui/avatar/palettes.ts`
- Test: `tests/unit/avatar-palettes.test.ts`

- [ ] **Step 1: Write the failing contrast test**

Create `tests/unit/avatar-palettes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PALETTES, PALETTE_FAMILIES } from "../../src/ui/avatar/palettes";
import { relativeLuminance } from "../../src/ui/avatar/colorMath";

const PANEL_LUM = relativeLuminance("#202036"); // avatar screen background

describe("avatar palettes", () => {
  it("every palette has a readable body and real layer contrast", () => {
    for (const [id, p] of Object.entries(PALETTES)) {
      const lum0 = relativeLuminance(p.c0);
      const lum1 = relativeLuminance(p.c1);
      // Body (c0) is clearly lighter than the panel and the garment (c1).
      expect(lum0, `${id} c0 must read on panel`).toBeGreaterThan(0.45);
      expect(lum0 - PANEL_LUM, `${id} c0 vs panel`).toBeGreaterThan(0.2);
      expect(lum0 - lum1, `${id} c0 vs c1`).toBeGreaterThan(0.25);
      // The three tones are all distinct.
      expect(new Set([p.c0, p.c1, p.c2]).size, `${id} tones distinct`).toBe(3);
    }
  });

  it("every family references existing palettes", () => {
    for (const ids of Object.values(PALETTE_FAMILIES)) {
      for (const id of ids) {
        expect(PALETTES[id], id).toBeTruthy();
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/avatar-palettes.test.ts`
Expected: FAIL — current near-black `c0` values give `lum0` ≈ 0.06, failing `> 0.45`.

- [ ] **Step 3: Replace the palette values**

In `src/ui/avatar/palettes.ts`, replace the `PALETTES` object (keep `PALETTE_FAMILIES` and the imports/types unchanged):

```ts
export const PALETTES: Record<string, AvatarPalette> = {
  holy_0: { c0: "#d9c7a3", c1: "#3a4566", c2: "#f2d979" },
  holy_1: { c0: "#cdb993", c1: "#424d70", c2: "#ffe79a" },
  neutral_0: { c0: "#b3a48c", c1: "#33384a", c2: "#8fa6c9" },
  neutral_1: { c0: "#a89a86", c1: "#2e3340", c2: "#b58fd1" },
  unholy_0: { c0: "#a18a93", c1: "#3a2230", c2: "#d86fb0" },
  unholy_1: { c0: "#94838f", c1: "#311d2a", c2: "#b56fd1" },
};
```

- [ ] **Step 4: Run the palette + full unit suite**

Run: `npx vitest run tests/unit/avatar-palettes.test.ts` → PASS.
Run: `npx vitest run` → the existing avatar-generator test `holy.paletteId !== worn.paletteId` and determinism still pass (palette IDs unchanged, only values changed). All green.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` (clean); `npx eslint src/ui/avatar/palettes.ts tests/unit/avatar-palettes.test.ts` (clean)

- [ ] **Step 6: Commit**

```bash
git add src/ui/avatar/palettes.ts tests/unit/avatar-palettes.test.ts
git commit -m "feat: give avatar palettes real layer contrast"
```

---

## Task 3: Literal fills, gradient shading, outlines

**Files:**
- Modify: `src/ui/avatar/layers.ts`
- Modify: `src/ui/avatar/buildCharacterSvg.ts`
- Modify: `tests/unit/avatar-generator.test.ts`

This task removes the CSS-`var` indirection, threads a `RenderContext` of resolved fills through the layer renderers, fills body/garment shapes with vertical gradients, and strokes the outer-boundary layers with a derived outline color.

- [ ] **Step 1: Update the avatar-generator test expectations first (red)**

In `tests/unit/avatar-generator.test.ts`, in the test `"svg rasterization is deterministic and transparent-friendly"`, replace the assertion block:

```ts
  expect(first.equals(second)).toBe(true);
  expect(svg.includes("viewBox=\"0 0 512 512\"")).toBe(true);
  expect(svg.includes("<path")).toBe(false);
  expect(svg.includes("var(--c0)")).toBe(true);
```

with:

```ts
  expect(first.equals(second)).toBe(true);
  expect(svg.includes("viewBox=\"0 0 512 512\"")).toBe(true);
  expect(svg.includes("<path")).toBe(false);
  expect(svg.includes("var(--c0)")).toBe(false);
  expect(svg.includes("<linearGradient")).toBe(true);
  expect(svg.includes("stroke=")).toBe(true);
```

Run: `npx vitest run tests/unit/avatar-generator.test.ts`
Expected: FAIL — current SVG still contains `var(--c0)` and no `<linearGradient`.

- [ ] **Step 2: Replace the primitives + add `RenderContext` in `layers.ts`**

At the top of `src/ui/avatar/layers.ts`, replace the `FillToken` type and the `rect`/`circle`/`polygon` helpers with:

```ts
export interface RenderContext {
  fillC0: string; // body / skin fill (gradient url ref)
  fillC1: string; // garment fill (gradient url ref)
  fillC2: string; // accent (flat)
  outline: string; // stroke color for outer-boundary layers
}

function strokeAttr(stroke?: string, strokeWidth = 3): string {
  return stroke
    ? ` stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"`
    : "";
}

function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke?: string
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"${strokeAttr(stroke)}/>`;
}

function circle(cx: number, cy: number, radius: number, fill: string, stroke?: string): string {
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}"${strokeAttr(stroke)}/>`;
}

function polygon(
  points: ReadonlyArray<readonly [number, number]>,
  fill: string,
  stroke?: string
): string {
  const serialized = points.map(([x, y]) => `${x},${y}`).join(" ");
  return `<polygon points="${serialized}" fill="${fill}"${strokeAttr(stroke)}/>`;
}
```

- [ ] **Step 3: Thread `ctx` through every renderer and apply fills/strokes**

Change `renderLayer` and every `renderX(state)` function to also accept `ctx: RenderContext`:

```ts
export function renderLayer(
  layer: (typeof LAYER_ORDER)[number],
  state: CharacterVisualState,
  ctx: RenderContext
): string {
  switch (layer) {
    case "body": return renderBody(state, ctx);
    case "legs": return renderLegs(state, ctx);
    case "arms": return renderArms(state, ctx);
    case "torso": return renderTorso(state, ctx);
    case "head": return renderHead(state, ctx);
    case "hoodHair": return renderHoodHair(state, ctx);
    case "horns": return renderHorns(state, ctx);
    case "eyes": return renderEyes(state, ctx);
    case "markings": return renderMarkings(state, ctx);
    case "overlays": return renderOverlays(state, ctx);
  }
}
```

Then apply this MECHANICAL mapping inside each `renderX` body:

- Replace every fill argument `"c0"` → `ctx.fillC0`, `"c1"` → `ctx.fillC1`, `"c2"` → `ctx.fillC2`.
- Add `, ctx.outline` (the stroke arg) to EVERY shape call in the **outer-boundary** renderers: `renderBody`, `renderLegs`, `renderArms`, `renderTorso`, `renderHead`, `renderHoodHair`, `renderHorns`.
- Do NOT add a stroke to shapes in `renderEyes`, `renderMarkings`, `renderOverlays` (accents stay crisp/unstroked).
- `bodyMetrics(state)` is unchanged.

Worked example — `renderBody` becomes:

```ts
function renderBody(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.body === 0) {
    return group(
      [
        rect(240, 184, 32, 20, ctx.fillC0, ctx.outline),
        polygon(
          [
            [206, 212],
            [306, 212],
            [292, 330],
            [220, 330],
          ],
          ctx.fillC0,
          ctx.outline
        ),
      ].join("")
    );
  }

  return group(
    [
      rect(232, 182, 48, 22, ctx.fillC0, ctx.outline),
      polygon(
        [
          [194, 210],
          [318, 210],
          [302, 338],
          [210, 338],
        ],
        ctx.fillC0,
        ctx.outline
      ),
    ].join("")
  );
}
```

Worked example — `renderEyes` (accent layer, NO stroke):

```ts
function renderEyes(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.eyes === 0) {
    return group(
      [circle(232, 150, 8, ctx.fillC2), circle(280, 150, 8, ctx.fillC2)].join(""),
      `translate(0 ${state.headOffsetY})`
    );
  }
  if (state.eyes === 1) {
    return group(
      [rect(222, 146, 20, 6, ctx.fillC2), rect(270, 146, 20, 6, ctx.fillC2)].join(""),
      `translate(0 ${state.headOffsetY})`
    );
  }
  return group(
    [circle(228, 150, 10, ctx.fillC2), circle(284, 150, 10, ctx.fillC2)].join(""),
    `translate(0 ${state.headOffsetY})`
  );
}
```

Apply the same mapping to `renderLegs`, `renderArms`, `renderTorso`, `renderHead`, `renderHoodHair`, `renderHorns` (all get `ctx.outline` strokes) and `renderMarkings`, `renderOverlays` (no stroke; `"c2"` → `ctx.fillC2`, any `"c1"` → `ctx.fillC1`).

- [ ] **Step 4: Rewrite `buildCharacterSvg.ts` with literal fills + gradient defs**

Replace `src/ui/avatar/buildCharacterSvg.ts` with:

```ts
import { LAYER_ORDER, renderLayer, type RenderContext } from "./layers";
import { darken, lighten } from "./colorMath";
import { fnv1a32 } from "./hashing";
import type { CharacterVisualState } from "./types";

export function buildCharacterSvg(state: CharacterVisualState): string {
  // Unique-but-deterministic gradient ids so nested atlas SVGs don't collide.
  const sfx = fnv1a32(`${state.c0}|${state.c1}|${state.c2}`).toString(36);
  const g0 = `g0_${sfx}`;
  const g1 = `g1_${sfx}`;

  const ctx: RenderContext = {
    fillC0: `url(#${g0})`,
    fillC1: `url(#${g1})`,
    fillC2: state.c2,
    outline: darken(state.c1, 0.6),
  };

  const gradient = (id: string, base: string, hi: number, lo: number): string =>
    [
      `<linearGradient id="${id}" x1="0" y1="80" x2="0" y2="456" gradientUnits="userSpaceOnUse">`,
      `<stop offset="0" stop-color="${lighten(base, hi)}"/>`,
      `<stop offset="0.5" stop-color="${base}"/>`,
      `<stop offset="1" stop-color="${darken(base, lo)}"/>`,
      `</linearGradient>`,
    ].join("");

  const defs = gradient(g0, state.c0, 0.16, 0.24) + gradient(g1, state.c1, 0.14, 0.22);
  const layers = LAYER_ORDER.map((layer) => renderLayer(layer, state, ctx)).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">`,
    `<defs>${defs}</defs>`,
    `<g>${layers}</g>`,
    "</svg>",
  ].join("");
}
```

- [ ] **Step 5: Run the avatar tests**

Run: `npx vitest run tests/unit/avatar-generator.test.ts` → PASS (determinism holds; `var(--c0)` gone; `<linearGradient` and `stroke=` present; no `<path>`).
Run: `npx vitest run` → all unit tests pass.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit` (clean)
Run: `npx eslint src/ui/avatar/layers.ts src/ui/avatar/buildCharacterSvg.ts` (clean)

- [ ] **Step 7: Commit**

```bash
git add src/ui/avatar/layers.ts src/ui/avatar/buildCharacterSvg.ts tests/unit/avatar-generator.test.ts
git commit -m "feat: render avatar with literal fills, gradient shading, and outlines"
```

---

## Task 4: Detail shapes (face, belt, collar)

**Files:**
- Modify: `src/ui/avatar/layers.ts`

Adds a brow ridge to the head and a belt + collar accent to the torso. Driven by the existing shapes; no new state.

- [ ] **Step 1: Add a brow ridge to `renderHead`**

In `renderHead`, add a brow shape (outline-colored, unstroked so it reads as a feature line) just below the head top, in BOTH `state.head === 0` and the default branch. For `head === 0` (round head, center 256, r 58):

```ts
function renderHead(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.head === 0) {
    return group(
      [
        circle(256, 148, 58, ctx.fillC0, ctx.outline),
        rect(226, 138, 60, 7, ctx.outline), // brow ridge
      ].join(""),
      `translate(0 ${state.headOffsetY})`
    );
  }

  return group(
    [
      rect(204, 94, 104, 108, ctx.fillC0, ctx.outline),
      rect(214, 84, 84, 20, ctx.fillC0, ctx.outline),
      rect(220, 138, 72, 7, ctx.outline), // brow ridge
    ].join(""),
    `translate(0 ${state.headOffsetY})`
  );
}
```

- [ ] **Step 2: Add a belt + collar to `renderTorso`**

At the end of each branch of `renderTorso`, include a waist belt (accent fill, outlined) and a collar accent line. Factor a small helper inside the file and append its output to every branch's group. Add this helper above `renderTorso`:

```ts
function torsoTrim(metrics: ReturnType<typeof bodyMetrics>, ctx: RenderContext): string {
  const beltLeft = metrics.waistLeft - 6;
  const beltWidth = metrics.waistRight - metrics.waistLeft + 12;
  return [
    rect(beltLeft, 318, beltWidth, 16, ctx.fillC2, ctx.outline), // belt
    rect(metrics.shoulderLeft + 14, 212, metrics.shoulderRight - metrics.shoulderLeft - 28, 8, ctx.fillC2), // collar accent
  ].join("");
}
```

Then in `renderTorso`, append `torsoTrim(metrics, ctx)` to the children of each returned `group(...)`. `metrics` is already computed at the top of `renderTorso` via `bodyMetrics(state)` — confirm it is; if a branch doesn't compute `metrics`, add `const metrics = bodyMetrics(state);` at the top of `renderTorso`. Example for the `torso === 0` branch:

```ts
  if (state.torso === 0) {
    return group(
      polygon(
        [
          [metrics.shoulderLeft, 210],
          [metrics.shoulderRight, 210],
          [metrics.waistRight, 300],
          [metrics.hipRight - 8, 392],
          [metrics.hipLeft + 8, 392],
          [metrics.waistLeft, 300],
        ],
        ctx.fillC1,
        ctx.outline
      ) + torsoTrim(metrics, ctx)
    );
  }
```

Apply the same `+ torsoTrim(metrics, ctx)` to the `torso === 1` and default branches (append to the joined children string before closing `group(...)`).

- [ ] **Step 3: Run tests + typecheck**

Run: `npx vitest run` → all green (determinism test still passes; output is still deterministic).
Run: `npx tsc --noEmit` (clean); `npx eslint src/ui/avatar/layers.ts` (clean)

- [ ] **Step 4: Commit**

```bash
git add src/ui/avatar/layers.ts
git commit -m "feat: add brow, belt, and collar detail to avatar"
```

---

## Task 5: MainScene flicker fix

**Files:**
- Modify: `src/ui/scenes/MainScene.ts`

Add the cached avatar texture synchronously so the per-tick scene restart doesn't drop a frame.

- [ ] **Step 1: Make the cached-texture add synchronous**

In `drawAvatarPanel`, replace this block:

```ts
    const input = buildCharacterVisualInputFromRun(run);
    const state = deriveCharacterVisualState(input);
    const svg = buildCharacterSvg(state);
    const textureKey = ["avatar", run.seed, fnv1a32(svg).toString(16)].join("_");
    const requestId = ++this.avatarRequestId;

    void createAvatarTextureKey(this, textureKey, input)
      .then((resolvedKey) => {
```

with:

```ts
    const input = buildCharacterVisualInputFromRun(run);
    const state = deriveCharacterVisualState(input);
    const svg = buildCharacterSvg(state);
    const textureKey = ["avatar", run.seed, fnv1a32(svg).toString(16)].join("_");

    // Fast path: the texture is already cached, so add it this frame — no async
    // hop — which prevents a flicker when the HUD restarts this scene each tick.
    if (this.textures.exists(textureKey)) {
      this.add.image(panelCenterX, avatarCY, textureKey).setDisplaySize(92, 92);
      return;
    }

    const requestId = ++this.avatarRequestId;

    void createAvatarTextureKey(this, textureKey, input)
      .then((resolvedKey) => {
```

(The `.then`/`.catch` body and the rest of the method stay as-is. `return` exits `drawAvatarPanel` after the synchronous add.)

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit` (clean)
Run: `npx eslint src/ui/scenes/MainScene.ts` (clean — no new warnings beyond pre-existing `any`)

- [ ] **Step 3: Verify the existing run-flow e2e still renders the avatar without errors**

Run: `npx playwright test playability`
Expected: PASS (MainScene activates and renders without browser errors).

- [ ] **Step 4: Commit**

```bash
git add src/ui/scenes/MainScene.ts
git commit -m "fix: add cached avatar texture synchronously to stop flicker"
```

---

## Task 6: Visual verification + finish

**Files:**
- Temporary: `tests/unit/_avatarshot.test.ts` (created then deleted)

- [ ] **Step 1: Render a before/after sample strip**

Create `tests/unit/_avatarshot.test.ts`:

```ts
import { it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { generateAvatarDebugSamples, exportAvatarAtlas } from "../../src/ui/avatar/atlas";

it("render avatar samples", async () => {
  const all = generateAvatarDebugSamples();
  const pick = all.filter(
    (s) => s.key.startsWith("1001_") && (s.key.includes("_85_") || s.key.includes("_15_"))
  );
  const items = pick.map((s) => ({ key: s.key, svg: s.svg }));
  const pages = await exportAvatarAtlas(items, { cellSize: 256, cols: 6, paddingPx: 6 });
  mkdirSync(".runtime", { recursive: true });
  writeFileSync(".runtime/avatars-after.png", pages[0].png);
});
```

Run: `npx vitest run tests/unit/_avatarshot.test.ts`
Then READ `.runtime/avatars-after.png`. Confirm: bodies read as a mid-tone (not black), garments are a distinct darker color, outlines define the silhouette, gradient shading gives depth, and brow/belt/collar details are visible. If a palette looks off, tune the hexes in `palettes.ts` (the contrast test still gates the hard failure) and re-render.

- [ ] **Step 2: In-app screenshot on the Vessel panel**

Create a temporary `tests/e2e/_avatarshot.spec.ts`:

```ts
import { test } from "@playwright/test";
import { resetApp } from "./helpers";

test("capture vessel", async ({ page }) => {
  await resetApp(page);
  await page.evaluate(() => (window as any).__test.startScene("MainScene"));
  await page.waitForTimeout(500);
  await page.locator("canvas").first().screenshot({ path: ".runtime/vessel.png" });
});
```

Run: `npx playwright test _avatarshot`
READ `.runtime/vessel.png`. Confirm the avatar reads clearly on the dark panel and there is no "No image" fallback.

- [ ] **Step 3: Remove the temporary harnesses**

```bash
rm tests/unit/_avatarshot.test.ts tests/e2e/_avatarshot.spec.ts .runtime/avatars-after.png .runtime/vessel.png
```

- [ ] **Step 4: Full verification**

Run: `npx vitest run` → all unit tests pass.
Run: `npx tsc --noEmit` → clean.
Run: `npx eslint src` → no new errors (pre-existing `any` warnings only).

- [ ] **Step 5: Commit any palette tuning**

```bash
git add -A
git commit -m "chore: tune avatar palette values from visual review"
```
(Skip if no tuning was needed.)

---

## Self-Review notes

- **Spec coverage:** colorMath ✓ (Task 1); contrasting palettes + contrast assertion ✓ (Task 2); literal fills / drop `var()` ✓, gradient shading ✓, outlines ✓ (Task 3); detail shapes ✓ (Task 4); flicker fix ✓ (Task 5); visual verification ✓ (Task 6). Decode-robustness via literal fills is delivered in Task 3.
- **Type consistency:** `RenderContext { fillC0, fillC1, fillC2, outline }` is defined in Task 3 (layers.ts) and consumed by `buildCharacterSvg`; `renderLayer(layer, state, ctx)` signature matches its caller. `colorMath` exports `darken/lighten/mix/relativeLuminance`, used by palettes test, buildCharacterSvg, and the contrast test.
- **Test stability:** determinism is preserved — gradient ids derive from palette colors via `fnv1a32`, so identical inputs yield identical SVG. The atlas test is unaffected (geometry only). The `Math.random` guard test still passes (colorMath uses no RNG).
- **Known latitude:** exact palette hexes may be tuned in Task 6; the contrast test (`lum0 > 0.45`, `lum0 - lum1 > 0.25`) guards the only hard requirement.
