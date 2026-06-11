import type { AvatarPalette, VisualAlignment } from "./types";

export const PALETTES: Record<string, AvatarPalette> = {
  holy_0: { c0: "#d9c7a3", c1: "#3a4566", c2: "#f2d979" },
  holy_1: { c0: "#cdb993", c1: "#424d70", c2: "#ffe79a" },
  neutral_0: { c0: "#b3a48c", c1: "#33384a", c2: "#8fa6c9" },
  neutral_1: { c0: "#a89a86", c1: "#2e3340", c2: "#b58fd1" },
  unholy_0: { c0: "#a18a93", c1: "#3a2230", c2: "#d86fb0" },
  unholy_1: { c0: "#94838f", c1: "#311d2a", c2: "#b56fd1" },
};

export const PALETTE_FAMILIES: Record<VisualAlignment, readonly string[]> = {
  holy: ["holy_0", "holy_1"],
  neutral: ["neutral_0", "neutral_1"],
  unholy: ["unholy_0", "unholy_1"],
};
