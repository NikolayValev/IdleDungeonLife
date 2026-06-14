import type { GateId } from "../core/types";

// ─── Curated LPC manifest (Wave 3) ───────────────────────────────────────────
//
// This is the CURATION decision (Orchestrator-owned), not the vendored art. Each
// entry names a ULPC sheet we intend to ship and the z-order it composites at.
// The project is NON-COMMERCIAL, so any ULPC license is acceptable (no Option-A
// CC0/OGA-BY restriction). Attribution is still required for everything except
// CC0: `authors` is populated from ULPC's CREDITS.csv by
// scripts/build-avatar-atlas.ts when the real PNGs are vendored, and the build's
// credits gate fails if a non-CC0 sheet has no authors. The pure appearance
// logic and its tests do NOT depend on the PNGs or credits being resolved, only
// on these sheetIds + zPos.

export type LpcLicense = "CC0" | "CC-BY" | "CC-BY-SA" | "OGA-BY" | "GPL-3.0";

export interface AvatarSheet {
  sheetId: string;
  category: "body" | "hair" | "torso" | "overlay";
  zPos: number; // ULPC z-positioning; lower draws first (further back)
  file: string; // path under public/assets/lpc/ once vendored
  license: LpcLicense;
  authors: string[]; // filled from ULPC CREDITS.csv during vendoring; empty = unresolved
  sourceUrl: string;
}

const ULPC = "https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator";

const sheet = (
  sheetId: string,
  category: AvatarSheet["category"],
  zPos: number,
  license: LpcLicense
): AvatarSheet => ({
  sheetId,
  category,
  zPos,
  file: `${sheetId}.png`,
  license,
  authors: [],
  sourceUrl: ULPC,
});

export const AVATAR_SHEETS: readonly AvatarSheet[] = [
  // Base body — skin tone carried via palette override, so one sheet.
  sheet("body/adult", "body", 10, "CC0"),

  // Hair pool (seeded pick; colour via palette override).
  sheet("hair/plain/01", "hair", 80, "CC0"),
  sheet("hair/plain/02", "hair", 80, "CC0"),
  sheet("hair/plain/03", "hair", 80, "CC0"),
  sheet("hair/plain/04", "hair", 80, "CC0"),
  sheet("hair/plain/05", "hair", 80, "OGA-BY"),
  sheet("hair/plain/06", "hair", 80, "OGA-BY"),
  sheet("hair/plain/07", "hair", 80, "OGA-BY"),
  sheet("hair/plain/08", "hair", 80, "OGA-BY"),

  // Job-default outfits (fallback torso when no equipped torso item).
  sheet("torso/job/porter", "torso", 50, "CC0"),
  sheet("torso/job/scavenger", "torso", 50, "CC0"),
  sheet("torso/job/scribe", "torso", 50, "CC0"),
  sheet("torso/job/runecarver", "torso", 50, "CC0"),

  // School robes (worn while enrolled/studying).
  sheet("torso/school/choir", "torso", 50, "OGA-BY"),
  sheet("torso/school/hollow_order", "torso", 50, "OGA-BY"),
  sheet("torso/school/archive", "torso", 50, "OGA-BY"),

  // Tier-3 gate overlays — permanent marks of crossing the deepest gate.
  sheet("overlay/abyss_marks", "overlay", 55, "CC0"),
  sheet("overlay/holy_halo", "overlay", 150, "CC0"),
];

export const AVATAR_MANIFEST: ReadonlyMap<string, AvatarSheet> = new Map(
  AVATAR_SHEETS.map((s) => [s.sheetId, s])
);

// ─── State → sheet mappings (data, not logic) ─────────────────────────────────

export const HAIR_POOL: readonly string[] = AVATAR_SHEETS.filter(
  (s) => s.category === "hair"
).map((s) => s.sheetId);

export const JOB_TORSO: Readonly<Record<string, string>> = {
  porter: "torso/job/porter",
  scavenger: "torso/job/scavenger",
  scribe: "torso/job/scribe",
  runecarver: "torso/job/runecarver",
};

export const SCHOOL_TORSO: Readonly<Record<string, string>> = {
  choir: "torso/school/choir",
  hollow_order: "torso/school/hollow_order",
  archive: "torso/school/archive",
};

// Tier-3 gate → permanent overlay sheet (keyed to gate history, so a redeemed
// Forsaken still wears the marks).
export const TIER3_GATE_OVERLAY: Readonly<Partial<Record<GateId, string>>> = {
  abyss_3: "overlay/abyss_marks",
  holy_3: "overlay/holy_halo",
};

// Palette overrides keyed to alignment-cap history (tier-2 skin shift).
export const TIER2_SKIN_BY_GATE: Readonly<Partial<Record<GateId, { target: string; variant: string }>>> = {
  abyss_2: { target: "skin", variant: "ashen" },
  holy_2: { target: "skin", variant: "luminous" },
};

// Seeded base-colour pools (expressed as palette overrides, not extra layers).
export const SKIN_TONES: readonly string[] = ["fair", "olive", "tan", "dark", "wan"];
export const HAIR_COLORS: readonly string[] = ["black", "brown", "blonde", "auburn", "ash"];

// Age palette bands (in-game years) and the low-vitality desaturation threshold.
export const AVATAR_TUNING = {
  greyingAgeYears: 45, // TUNABLE — sim-verify
  silverAgeYears: 65, // TUNABLE — sim-verify
  lowVitality: 50, // TUNABLE — sim-verify
  frailVitality: 20, // TUNABLE — sim-verify
  maxLayers: 12, // hard budget from avatar-spec §3
} as const;
