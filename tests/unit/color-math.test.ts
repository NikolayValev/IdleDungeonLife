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
