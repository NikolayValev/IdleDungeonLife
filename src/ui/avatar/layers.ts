import type { CharacterVisualState } from "./types";

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

function group(children: string, transform?: string): string {
  if (transform) {
    return `<g transform="${transform}">${children}</g>`;
  }

  return `<g>${children}</g>`;
}

function bodyMetrics(state: CharacterVisualState): {
  shoulderLeft: number;
  shoulderRight: number;
  waistLeft: number;
  waistRight: number;
  hipLeft: number;
  hipRight: number;
  armLeft: number;
  armRight: number;
  legLeft: number;
  legRight: number;
  legWidth: number;
} {
  if (state.body === 0) {
    return {
      shoulderLeft: 200,
      shoulderRight: 312,
      waistLeft: 222,
      waistRight: 290,
      hipLeft: 206,
      hipRight: 306,
      armLeft: 170,
      armRight: 316,
      legLeft: 214,
      legRight: 264,
      legWidth: 34,
    };
  }

  return {
    shoulderLeft: 188,
    shoulderRight: 324,
    waistLeft: 212,
    waistRight: 300,
    hipLeft: 194,
    hipRight: 318,
    armLeft: 156,
    armRight: 312,
    legLeft: 204,
    legRight: 258,
    legWidth: 42,
  };
}

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

function renderLegs(state: CharacterVisualState, ctx: RenderContext): string {
  const metrics = bodyMetrics(state);

  if (state.legs === 1) {
    return group(
      [
        polygon(
          [
            [metrics.hipLeft + 12, 332],
            [metrics.hipRight - 12, 332],
            [metrics.hipRight - 22, 430],
            [metrics.hipLeft + 22, 430],
          ],
          ctx.fillC0,
          ctx.outline
        ),
        rect(224, 430, 30, 20, ctx.fillC0, ctx.outline),
        rect(258, 430, 30, 20, ctx.fillC0, ctx.outline),
      ].join("")
    );
  }

  return group(
    [
      rect(metrics.legLeft, 334, metrics.legWidth, 108, ctx.fillC0, ctx.outline),
      rect(metrics.legRight, 334, metrics.legWidth, 108, ctx.fillC0, ctx.outline),
      rect(metrics.legLeft - 4, 438, metrics.legWidth + 8, 18, ctx.fillC0, ctx.outline),
      rect(metrics.legRight - 4, 438, metrics.legWidth + 8, 18, ctx.fillC0, ctx.outline),
    ].join("")
  );
}

function renderArms(state: CharacterVisualState, ctx: RenderContext): string {
  const metrics = bodyMetrics(state);
  const width = state.arms === 0 ? 26 : 40;
  const leftX = state.arms === 0 ? metrics.armLeft : metrics.armLeft - 8;
  const rightX = state.arms === 0 ? metrics.armRight : metrics.armRight - 2;
  const bottomRadius = state.arms === 0 ? 12 : 16;

  return group(
    [
      rect(leftX, 220, width, 118, ctx.fillC0, ctx.outline),
      rect(rightX, 220, width, 118, ctx.fillC0, ctx.outline),
      circle(leftX + (width / 2), 344, bottomRadius, ctx.fillC0, ctx.outline),
      circle(rightX + (width / 2), 344, bottomRadius, ctx.fillC0, ctx.outline),
    ].join(""),
    `translate(0 ${state.armsOffsetY})`
  );
}

function renderTorso(state: CharacterVisualState, ctx: RenderContext): string {
  const metrics = bodyMetrics(state);

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
      )
    );
  }

  if (state.torso === 1) {
    return group(
      [
        rect(metrics.waistLeft - 8, 216, metrics.waistRight - metrics.waistLeft + 16, 132, ctx.fillC1, ctx.outline),
        polygon(
          [
            [metrics.shoulderLeft, 220],
            [metrics.waistLeft - 8, 220],
            [metrics.waistLeft - 8, 256],
            [metrics.shoulderLeft + 12, 278],
          ],
          ctx.fillC1,
          ctx.outline
        ),
        polygon(
          [
            [metrics.shoulderRight, 220],
            [metrics.waistRight + 8, 220],
            [metrics.waistRight + 8, 256],
            [metrics.shoulderRight - 12, 278],
          ],
          ctx.fillC1,
          ctx.outline
        ),
        rect(metrics.waistLeft, 348, metrics.waistRight - metrics.waistLeft, 44, ctx.fillC1, ctx.outline),
      ].join("")
    );
  }

  return group(
    polygon(
      [
        [metrics.shoulderLeft - 8, 208],
        [metrics.shoulderRight + 8, 208],
        [metrics.hipRight + 12, 382],
        [metrics.hipLeft - 12, 382],
      ],
      ctx.fillC1,
      ctx.outline
    )
  );
}

function renderHead(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.head === 0) {
    return group(circle(256, 148, 58, ctx.fillC0, ctx.outline), `translate(0 ${state.headOffsetY})`);
  }

  return group(
    [
      rect(204, 94, 104, 108, ctx.fillC0, ctx.outline),
      rect(214, 84, 84, 20, ctx.fillC0, ctx.outline),
    ].join(""),
    `translate(0 ${state.headOffsetY})`
  );
}

function renderHoodHair(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.hoodHair === 2) {
    return group("", `translate(0 ${state.headOffsetY})`);
  }

  if (state.hoodHair === 1) {
    return group(
      [
        rect(214, 90, 84, 18, ctx.fillC1, ctx.outline),
        rect(206, 104, 18, 38, ctx.fillC1, ctx.outline),
        rect(288, 104, 18, 38, ctx.fillC1, ctx.outline),
      ].join(""),
      `translate(0 ${state.headOffsetY})`
    );
  }

  return group(
    [
      polygon(
        [
          [194, 188],
          [218, 104],
          [256, 74],
          [294, 104],
          [318, 188],
          [286, 212],
          [226, 212],
        ],
        ctx.fillC1,
        ctx.outline
      ),
      rect(208, 188, 96, 22, ctx.fillC1, ctx.outline),
    ].join(""),
    `translate(0 ${state.headOffsetY})`
  );
}

function renderHorns(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.horns === 0) {
    return group("", `translate(0 ${state.headOffsetY})`);
  }

  if (state.horns === 1) {
    return group(
      [
        polygon(
          [
            [208, 110],
            [194, 76],
            [218, 92],
          ],
          ctx.fillC1,
          ctx.outline
        ),
        polygon(
          [
            [304, 110],
            [318, 76],
            [294, 92],
          ],
          ctx.fillC1,
          ctx.outline
        ),
      ].join(""),
      `translate(0 ${state.headOffsetY})`
    );
  }

  return group(
    [
      polygon(
        [
          [210, 118],
          [178, 72],
          [184, 42],
          [204, 58],
          [220, 94],
        ],
        ctx.fillC1,
        ctx.outline
      ),
      polygon(
        [
          [302, 118],
          [334, 72],
          [328, 42],
          [308, 58],
          [292, 94],
        ],
        ctx.fillC1,
        ctx.outline
      ),
    ].join(""),
    `translate(0 ${state.headOffsetY})`
  );
}

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

function renderMarkings(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.markings === 0) {
    return group("");
  }

  if (state.markings === 1) {
    return group(
      [
        polygon(
          [
            [256, 252],
            [274, 270],
            [256, 288],
            [238, 270],
          ],
          ctx.fillC2
        ),
        rect(252, 286, 8, 34, ctx.fillC2),
      ].join("")
    );
  }

  if (state.markings === 2) {
    return group(
      [
        rect(252, 126 + state.headOffsetY, 8, 52, ctx.fillC2),
        rect(236, 146 + state.headOffsetY, 16, 8, ctx.fillC2),
      ].join("")
    );
  }

  return group(
    [
      rect(176, 228, 22, 40, ctx.fillC2),
      rect(314, 228, 22, 40, ctx.fillC2),
      rect(182, 238, 10, 20, ctx.fillC1),
      rect(320, 238, 10, 20, ctx.fillC1),
    ].join("")
  );
}

function renderOverlays(state: CharacterVisualState, ctx: RenderContext): string {
  if (state.overlays === 0) {
    return group("");
  }

  if (state.overlays === 1) {
    return group(
      [
        circle(214, 264, 8, ctx.fillC2),
        circle(286, 246, 10, ctx.fillC2),
        circle(238, 344, 7, ctx.fillC2),
        circle(292, 364, 9, ctx.fillC2),
      ].join("")
    );
  }

  return group(
    [
      polygon(
        [
          [230, 120 + state.headOffsetY],
          [238, 120 + state.headOffsetY],
          [246, 148 + state.headOffsetY],
          [238, 148 + state.headOffsetY],
        ],
        ctx.fillC2
      ),
      polygon(
        [
          [278, 150 + state.headOffsetY],
          [286, 150 + state.headOffsetY],
          [296, 184 + state.headOffsetY],
          [288, 184 + state.headOffsetY],
        ],
        ctx.fillC2
      ),
      polygon(
        [
          [244, 246],
          [252, 246],
          [266, 304],
          [258, 304],
        ],
        ctx.fillC2
      ),
      polygon(
        [
          [284, 286],
          [292, 286],
          [304, 354],
          [296, 354],
        ],
        ctx.fillC2
      ),
    ].join("")
  );
}

export const LAYER_ORDER = [
  "body",
  "legs",
  "arms",
  "torso",
  "head",
  "hoodHair",
  "horns",
  "eyes",
  "markings",
  "overlays",
] as const;

export const VARIANT_COUNTS = {
  body: 2,
  head: 2,
  hoodHair: 3,
  torso: 3,
  arms: 2,
  legs: 2,
  eyes: 3,
  horns: 3,
  markings: 4,
  overlays: 3,
} as const;

export function renderLayer(
  layer: (typeof LAYER_ORDER)[number],
  state: CharacterVisualState,
  ctx: RenderContext
): string {
  switch (layer) {
    case "body":
      return renderBody(state, ctx);
    case "legs":
      return renderLegs(state, ctx);
    case "arms":
      return renderArms(state, ctx);
    case "torso":
      return renderTorso(state, ctx);
    case "head":
      return renderHead(state, ctx);
    case "hoodHair":
      return renderHoodHair(state, ctx);
    case "horns":
      return renderHorns(state, ctx);
    case "eyes":
      return renderEyes(state, ctx);
    case "markings":
      return renderMarkings(state, ctx);
    case "overlays":
      return renderOverlays(state, ctx);
  }
}
