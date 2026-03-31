import type { AvatarPalette, VisualAlignment } from "./types";

export const PALETTES: Record<string, AvatarPalette> = {
  holy_0: { c0: "#101010", c1: "#2A2A2A", c2: "#B9B2A6" },
  holy_1: { c0: "#0E0E0E", c1: "#262626", c2: "#C8C1B3" },
  neutral_0: { c0: "#101010", c1: "#2A2A2A", c2: "#6A5A7A" },
  neutral_1: { c0: "#0F0F0F", c1: "#2B2B2B", c2: "#5E6E7A" },
  unholy_0: { c0: "#0B0B0D", c1: "#24242A", c2: "#7A4E62" },
  unholy_1: { c0: "#0A0A0C", c1: "#1F1F26", c2: "#6E3F5A" },
};

export const PALETTE_FAMILIES: Record<VisualAlignment, readonly string[]> = {
  holy: ["holy_0", "holy_1"],
  neutral: ["neutral_0", "neutral_1"],
  unholy: ["unholy_0", "unholy_1"],
};
