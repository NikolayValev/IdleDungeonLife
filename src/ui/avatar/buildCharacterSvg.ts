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
