import { LAYER_ORDER, renderLayer } from "./layers";
import type { CharacterVisualState } from "./types";

export function buildCharacterSvg(state: CharacterVisualState): string {
  const layers = LAYER_ORDER.map((layer) => renderLayer(layer, state)).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" style="--c0:${state.c0};--c1:${state.c1};--c2:${state.c2};">`,
    `<style>.c0{fill:${state.c0};fill:var(--c0)}.c1{fill:${state.c1};fill:var(--c1)}.c2{fill:${state.c2};fill:var(--c2)}</style>`,
    `<g>${layers}</g>`,
    "</svg>",
  ].join("");
}
