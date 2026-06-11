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
