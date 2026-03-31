export type VisualAlignment = "holy" | "neutral" | "unholy";

export interface CharacterVisualInput {
  seed: string | number;
  alignment: VisualAlignment;
  vitality01: number;
  visibleTraitIds: string[];
  hiddenTraitIds: string[];
  equippedItemTags: string[];
}

export interface CharacterVisualState {
  paletteId: string;
  c0: string;
  c1: string;
  c2: string;
  body: number;
  head: number;
  hoodHair: number;
  torso: number;
  arms: number;
  legs: number;
  eyes: number;
  horns: number;
  markings: number;
  overlays: number;
  headOffsetY: number;
  armsOffsetY: number;
}

export interface AvatarPalette {
  c0: string;
  c1: string;
  c2: string;
}

export interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AtlasPage {
  png: Buffer;
  frames: Record<string, AtlasFrame>;
}

export interface AtlasOptions {
  cellSize?: number;
  cols?: number;
  paddingPx?: number;
}

export interface DebugAvatarSample {
  key: string;
  input: CharacterVisualInput;
  state: CharacterVisualState;
  svg: string;
}
