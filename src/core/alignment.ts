import type { AlignmentState, GateId } from "./types";
import { ALIGNMENT_GATES } from "../content/balance";

export interface GateCrossing {
  gate: GateId;
  alignmentAtCrossing: number;
  newCaps: { minCap: number; maxCap: number };
}

export interface AlignmentDeltaResult {
  alignment: AlignmentState;
  crossings: GateCrossing[];
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/**
 * Apply a signed alignment delta through the gate ratchet (pure, deterministic).
 *
 * 1. Move the value, clamped to the *current* caps.
 * 2. Fire any not-yet-crossed gate the new value reaches, in table order
 *    (ascending tier per side), narrowing the opposite cap as each fires.
 * 3. A single large delta can cross several gates in one call.
 *
 * Caps only ever narrow, so the moved value always stays within them — the
 * opposite cap is on the far side of the pole we moved toward.
 */
export function applyAlignmentDelta(alignment: AlignmentState, delta: number): AlignmentDeltaResult {
  const next = clamp(alignment.holyUnholy + delta, alignment.minCap, alignment.maxCap);

  let minCap = alignment.minCap;
  let maxCap = alignment.maxCap;
  const gatesCrossed = [...alignment.gatesCrossed];
  const crossings: GateCrossing[] = [];

  for (const gate of ALIGNMENT_GATES) {
    if (gatesCrossed.includes(gate.id)) continue;
    const crosses = gate.side === "abyss" ? next <= gate.threshold : next >= gate.threshold;
    if (!crosses) continue;

    gatesCrossed.push(gate.id);
    if (gate.side === "abyss") {
      maxCap = Math.min(maxCap, gate.oppositeCap);
    } else {
      minCap = Math.max(minCap, gate.oppositeCap);
    }
    crossings.push({ gate: gate.id, alignmentAtCrossing: next, newCaps: { minCap, maxCap } });
  }

  return {
    alignment: { holyUnholy: next, minCap, maxCap, gatesCrossed },
    crossings,
  };
}
