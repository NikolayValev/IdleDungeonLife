import type Phaser from "phaser";
import { buildCharacterSvg } from "./buildCharacterSvg";
import { buildCharacterVisualInputFromRun, deriveCharacterVisualState } from "./deriveVisualState";
import { drawSvgToCanvas, svgToPngBufferWithFallback } from "./rasterizeSvg";
import type {
  AtlasOptions,
  AtlasPage,
  CharacterVisualInput,
  DebugAvatarSample,
  VisualAlignment,
} from "./types";

function clampPositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Expected a positive integer, received ${value}`);
  }

  return value;
}

function buildAtlasSvg(
  items: { key: string; svg: string }[],
  cellSize: number,
  cols: number,
  paddingPx: number
): { svg: string; frames: AtlasPage["frames"] } {
  const step = cellSize + paddingPx * 2;
  const rows = Math.max(1, Math.ceil(items.length / cols));
  const width = cols * step;
  const height = rows * step;
  const frames: AtlasPage["frames"] = {};
  const nodes: string[] = [];

  items.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * step + paddingPx;
    const y = row * step + paddingPx;
    frames[item.key] = { x, y, w: cellSize, h: cellSize };
    nodes.push(`<g transform="translate(${x} ${y})">${item.svg}</g>`);
  });

  return {
    svg: [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      nodes.join(""),
      "</svg>",
    ].join(""),
    frames,
  };
}

export async function exportAvatarAtlas(
  items: { key: string; svg: string }[],
  options: AtlasOptions = {}
): Promise<AtlasPage[]> {
  if (items.length === 0) {
    return [];
  }

  const cellSize = clampPositiveInteger(options.cellSize, 512);
  const cols = clampPositiveInteger(options.cols, 4);
  const paddingPx = clampPositiveInteger(options.paddingPx, 2);
  const { svg, frames } = buildAtlasSvg(items, cellSize, cols, paddingPx);
  const png = await svgToPngBufferWithFallback(svg, cols * (cellSize + paddingPx * 2));

  return [{ png, frames }];
}

export async function createAvatarTextureKey(
  scene: Phaser.Scene,
  key: string,
  input: CharacterVisualInput
): Promise<string> {
  if (scene.textures.exists(key)) {
    return key;
  }

  const state = deriveCharacterVisualState(input);
  const svg = buildCharacterSvg(state);
  const canvas = await drawSvgToCanvas(svg, 512);

  if (!scene.textures.exists(key)) {
    scene.textures.addCanvas(key, canvas);
  }

  return key;
}

export function generateAvatarDebugSamples(): DebugAvatarSample[] {
  const seeds = ["1001", "1002", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1010"];
  const alignments: readonly VisualAlignment[] = ["holy", "neutral", "unholy"];
  const vitalityValues = [0.85, 0.5, 0.15];
  const traitSets = [
    [] as string[],
    ["marked_by_light"],
    ["abyss_drawn"],
    ["grave_touched", "frail_body"],
    ["consecrated_blood", "fated"],
  ];
  const samples: DebugAvatarSample[] = [];

  for (const seed of seeds) {
    for (const alignment of alignments) {
      for (const vitality01 of vitalityValues) {
        for (const forcedTraits of traitSets) {
          const traitKey = forcedTraits.length > 0 ? forcedTraits.join("+") : "base";
          const key = `${seed}_${alignment}_${Math.round(vitality01 * 100)}_${traitKey}`;
          const input: CharacterVisualInput = {
            seed,
            alignment,
            vitality01,
            visibleTraitIds: [...forcedTraits],
            hiddenTraitIds: [],
            equippedItemTags:
              alignment === "holy"
                ? ["holy", "shrine"]
                : alignment === "unholy"
                ? ["unholy", "abyss"]
                : ["neutral", "fate"],
          };
          const state = deriveCharacterVisualState(input);
          const svg = buildCharacterSvg(state);
          samples.push({ key, input, state, svg });
        }
      }
    }
  }

  return samples;
}

export async function exportAvatarDebugAtlas(options?: AtlasOptions): Promise<AtlasPage[]> {
  const items = generateAvatarDebugSamples().map((sample) => ({
    key: sample.key,
    svg: sample.svg,
  }));

  return exportAvatarAtlas(items, options);
}

export { buildCharacterVisualInputFromRun };
