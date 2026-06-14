// ─── Avatar appearance — PURE (state + seed → LpcSelection) ──────────────────
// No Phaser/DOM/canvas. Deterministic: same RunState + seed ⇒ identical selection.
// History shows on the body: alignment scars/palette key off the permanent gate
// history (gatesCrossed / caps), NOT the current alignment value, so a redeemed
// Forsaken still looks scarred. The renderer never decides appearance — it only
// draws what this returns.

import type { RunState, LpcSelection, LpcLayer, PaletteOverride } from "./types";
import { SeededRandomProvider, deriveSeed } from "./rng";
import { ageToYears } from "./lifespan";
import {
  AVATAR_MANIFEST,
  HAIR_POOL,
  JOB_TORSO,
  SCHOOL_TORSO,
  TIER3_GATE_OVERLAY,
  TIER2_SKIN_BY_GATE,
  SKIN_TONES,
  HAIR_COLORS,
  AVATAR_TUNING,
} from "../content/avatarManifest";

function layer(sheetId: string, variant: string): LpcLayer {
  const def = AVATAR_MANIFEST.get(sheetId);
  // zPos 0 for an unknown sheet would surface in the manifest-resolution test;
  // every sheetId emitted here is expected to exist in the manifest.
  return { sheetId, variant, zPos: def ? def.zPos : 0 };
}

function seededPick<T>(pool: readonly T[], seed: number, salt: string): T {
  const rng = new SeededRandomProvider(deriveSeed(seed, salt));
  return pool[rng.nextInt(0, pool.length - 1)];
}

export function composeAppearance(state: RunState, seed: number): LpcSelection {
  const layers: LpcLayer[] = [];
  const paletteOverrides: PaletteOverride[] = [];

  const gates = state.alignment.gatesCrossed;

  // ── Body (always) ──────────────────────────────────────────────────────────
  layers.push(layer("body/adult", "base"));

  // ── Skin palette: tier-2 gate shift wins over the seeded base tone ──────────
  const abyssSkin = gates.includes("abyss_2") ? TIER2_SKIN_BY_GATE.abyss_2 : undefined;
  const holySkin = gates.includes("holy_2") ? TIER2_SKIN_BY_GATE.holy_2 : undefined;
  const skinShift = abyssSkin ?? holySkin;
  paletteOverrides.push(
    skinShift ?? { target: "skin", variant: seededPick(SKIN_TONES, seed, "skin") }
  );

  // ── Tier-3 overlays: permanent marks of the deepest gate crossed ────────────
  for (const gate of gates) {
    const overlaySheet = TIER3_GATE_OVERLAY[gate];
    if (overlaySheet) layers.push(layer(overlaySheet, "base"));
  }

  // ── Hair: seeded style; colour greys with age, else seeded base colour ──────
  layers.push(layer(seededPick(HAIR_POOL, seed, "hairStyle"), "base"));
  const ageYears = ageToYears(state.lifespan.ageSeconds);
  const hairColor =
    ageYears >= AVATAR_TUNING.silverAgeYears
      ? "silver"
      : ageYears >= AVATAR_TUNING.greyingAgeYears
        ? "greying"
        : seededPick(HAIR_COLORS, seed, "hairColor");
  paletteOverrides.push({ target: "hair", variant: hairColor });

  // ── Torso: school robe while studying, else job-default outfit ──────────────
  const torsoSheet =
    state.occupation === "study" && state.study.enrolled
      ? SCHOOL_TORSO[state.study.enrolled]
      : state.currentJobId
        ? JOB_TORSO[state.currentJobId]
        : undefined;
  if (torsoSheet) layers.push(layer(torsoSheet, "base"));

  // ── Vitality: desaturation pass at low/frail thresholds (no extra layers) ───
  if (state.lifespan.vitality < AVATAR_TUNING.frailVitality) {
    paletteOverrides.push({ target: "global", variant: "frail" });
  } else if (state.lifespan.vitality < AVATAR_TUNING.lowVitality) {
    paletteOverrides.push({ target: "global", variant: "desaturated" });
  }

  // Order by zPos (stable), then enforce the hard layer budget.
  layers.sort((a, b) => a.zPos - b.zPos);
  const budgeted = layers.slice(0, AVATAR_TUNING.maxLayers);

  return { layers: budgeted, paletteOverrides };
}
