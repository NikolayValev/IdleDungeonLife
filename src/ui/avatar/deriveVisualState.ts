import { ITEM_REGISTRY } from "../../content/items";
import type { RunState } from "../../core/types";
import { PALETTE_FAMILIES, PALETTES } from "./palettes";
import { pickVariant } from "./rng";
import type { CharacterVisualInput, CharacterVisualState, VisualAlignment } from "./types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function makeSeed(input: CharacterVisualInput): string {
  return String(input.seed);
}

function hasAny(values: ReadonlySet<string>, ids: readonly string[]): boolean {
  return ids.some((id) => values.has(id));
}

function pickFromPool(seed: string, slotKey: string, pool: readonly number[], salt: string): number {
  return pool[pickVariant(seed, slotKey, pool.length, salt)];
}

function resolvePaletteFamily(
  alignment: VisualAlignment,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>
): VisualAlignment {
  if (alignment === "neutral" && (traits.has("marked_by_light") || tags.has("holy"))) {
    return "holy";
  }

  return alignment;
}

function resolvePosture(vitality01: number, traits: ReadonlySet<string>): {
  headOffsetY: number;
  armsOffsetY: number;
  effectiveVitality: number;
} {
  const frailtyPenalty = traits.has("frail_body") ? 0.15 : 0;
  const effectiveVitality = clamp01(vitality01 - frailtyPenalty);

  if (effectiveVitality >= 0.7) {
    return { headOffsetY: 0, armsOffsetY: 0, effectiveVitality };
  }

  if (effectiveVitality >= 0.3) {
    return { headOffsetY: 4, armsOffsetY: 0, effectiveVitality };
  }

  return { headOffsetY: 8, armsOffsetY: 4, effectiveVitality };
}

function resolvePaletteId(
  seed: string,
  alignment: VisualAlignment,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>
): string {
  const family = resolvePaletteFamily(alignment, traits, tags);
  const options = PALETTE_FAMILIES[family];
  const salt = sortedUnique([
    ...(traits.has("fated") ? ["fated"] : []),
    ...(tags.has("holy") ? ["holy_item"] : []),
    ...(tags.has("fate") ? ["fate_item"] : []),
    ...(tags.has("unholy") ? ["unholy_item"] : []),
  ]).join("|");

  return options[pickVariant(seed, "palette", options.length, salt)];
}

function resolveBody(seed: string, traits: ReadonlySet<string>, tags: ReadonlySet<string>): number {
  if (traits.has("frail_body")) {
    return 0;
  }

  if (hasAny(tags, ["vitality", "boss"])) {
    return 1;
  }

  return pickVariant(seed, "body", 2, sortedUnique([...traits, ...tags]).join("|"));
}

function resolveHead(seed: string, traits: ReadonlySet<string>, tags: ReadonlySet<string>): number {
  if (traits.has("lucid_mind")) {
    return 1;
  }

  if (tags.has("holy")) {
    return 0;
  }

  return pickVariant(seed, "head", 2, sortedUnique([...traits, ...tags]).join("|"));
}

function resolveTorso(seed: string, traits: ReadonlySet<string>, tags: ReadonlySet<string>): number {
  if (traits.has("consecrated_blood") || hasAny(tags, ["holy", "relic", "shrine", "boss"])) {
    return 1;
  }

  if (traits.has("grave_touched") || hasAny(tags, ["unholy", "decay", "abyss", "knowledge"])) {
    return 2;
  }

  if (hasAny(tags, ["wealth", "neutral"])) {
    return 0;
  }

  return pickVariant(seed, "torso", 3, sortedUnique([...traits, ...tags]).join("|"));
}

function resolveHoodHair(
  seed: string,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>,
  torso: number
): number {
  if (torso === 2 || traits.has("grave_touched") || hasAny(tags, ["holy", "shrine", "knowledge"])) {
    return 0;
  }

  if (traits.has("lucid_mind")) {
    return 2;
  }

  return pickVariant(seed, "hoodHair", 3, sortedUnique([...traits, ...tags, `torso:${torso}`]).join("|"));
}

function resolveArms(
  seed: string,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>,
  torso: number
): number {
  if (traits.has("frail_body")) {
    return 0;
  }

  if (torso === 1 || hasAny(tags, ["vitality", "boss"])) {
    return 1;
  }

  return pickVariant(seed, "arms", 2, sortedUnique([...traits, ...tags, `torso:${torso}`]).join("|"));
}

function resolveLegs(
  seed: string,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>,
  torso: number
): number {
  if (torso === 2 || traits.has("grave_touched") || hasAny(tags, ["decay", "abyss"])) {
    return 1;
  }

  return pickVariant(seed, "legs", 2, sortedUnique([...traits, ...tags, `torso:${torso}`]).join("|"));
}

function resolveEyes(seed: string, alignment: VisualAlignment, traits: ReadonlySet<string>): number {
  if (traits.has("lucid_mind")) {
    return 1;
  }

  if (alignment === "holy") {
    return 2;
  }

  return pickVariant(seed, "eyes", 3, sortedUnique([...traits, alignment]).join("|"));
}

function resolveHorns(
  seed: string,
  alignment: VisualAlignment,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>
): number {
  if (alignment === "holy" || traits.has("marked_by_light") || traits.has("consecrated_blood")) {
    return 0;
  }

  if (traits.has("abyss_drawn")) {
    return alignment === "unholy" ? 2 : 1;
  }

  if (alignment === "neutral") {
    return pickFromPool(seed, "horns", [0, 0, 0, 1, 2], sortedUnique([...traits, ...tags]).join("|"));
  }

  return pickFromPool(seed, "horns", [0, 1, 1, 2, 2], sortedUnique([...traits, ...tags]).join("|"));
}

function resolveMarkings(
  seed: string,
  alignment: VisualAlignment,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>
): number {
  if (traits.has("consecrated_blood")) {
    return 1;
  }

  if (traits.has("obsessive")) {
    return 2;
  }

  if (traits.has("fated")) {
    return pickFromPool(seed, "markings", [3, 3, 0, 1], "fated");
  }

  if (alignment === "holy") {
    return pickFromPool(seed, "markings", [0, 0, 0, 1], sortedUnique([...traits, ...tags]).join("|"));
  }

  if (alignment === "neutral") {
    return pickFromPool(seed, "markings", [0, 0, 1, 2, 3], sortedUnique([...traits, ...tags]).join("|"));
  }

  return pickFromPool(seed, "markings", [0, 1, 2, 3, 3], sortedUnique([...traits, ...tags]).join("|"));
}

function resolveOverlays(
  seed: string,
  alignment: VisualAlignment,
  vitality01: number,
  traits: ReadonlySet<string>,
  tags: ReadonlySet<string>
): number {
  if (vitality01 >= 0.7) {
    return 0;
  }

  if (vitality01 < 0.3) {
    if (traits.has("abyss_drawn") || (alignment === "unholy" && tags.has("abyss"))) {
      return 1;
    }

    return 2;
  }

  if (traits.has("grave_touched")) {
    return 2;
  }

  if (traits.has("abyss_drawn") || alignment === "unholy") {
    return 1;
  }

  return pickFromPool(seed, "overlays", [0, 0, 1], sortedUnique([...traits, ...tags]).join("|"));
}

export function alignmentFromScore(holyUnholy: number): VisualAlignment {
  if (holyUnholy > 20) {
    return "holy";
  }

  if (holyUnholy < -20) {
    return "unholy";
  }

  return "neutral";
}

export function buildCharacterVisualInputFromRun(run: RunState): CharacterVisualInput {
  const equippedItemTags = run.inventory.items
    .filter((item) =>
      item.instanceId === run.equipment.weapon ||
      item.instanceId === run.equipment.armor ||
      item.instanceId === run.equipment.artifact
    )
    .flatMap((item) => ITEM_REGISTRY.get(item.itemId)?.tags ?? []);

  return {
    seed: run.seed,
    alignment: alignmentFromScore(run.alignment.holyUnholy),
    vitality01: clamp01(run.lifespan.vitality / 100),
    visibleTraitIds: [...run.visibleTraitIds],
    hiddenTraitIds: [...run.hiddenTraitIds],
    equippedItemTags,
  };
}

export function deriveCharacterVisualState(input: CharacterVisualInput): CharacterVisualState {
  const seed = makeSeed(input);
  const traits = new Set(sortedUnique([...input.visibleTraitIds, ...input.hiddenTraitIds]));
  const tags = new Set(sortedUnique(input.equippedItemTags));
  const { headOffsetY, armsOffsetY, effectiveVitality } = resolvePosture(clamp01(input.vitality01), traits);
  const paletteId = resolvePaletteId(seed, input.alignment, traits, tags);
  const palette = PALETTES[paletteId];
  const torso = resolveTorso(seed, traits, tags);

  return {
    paletteId,
    c0: palette.c0,
    c1: palette.c1,
    c2: palette.c2,
    body: resolveBody(seed, traits, tags),
    head: resolveHead(seed, traits, tags),
    hoodHair: resolveHoodHair(seed, traits, tags, torso),
    torso,
    arms: resolveArms(seed, traits, tags, torso),
    legs: resolveLegs(seed, traits, tags, torso),
    eyes: resolveEyes(seed, input.alignment, traits),
    horns: resolveHorns(seed, input.alignment, traits, tags),
    markings: resolveMarkings(seed, input.alignment, traits, tags),
    overlays: resolveOverlays(seed, input.alignment, effectiveVitality, traits, tags),
    headOffsetY,
    armsOffsetY,
  };
}
