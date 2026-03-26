// ─── Seeded RNG (Mulberry32) ──────────────────────────────────────────────────
// Deterministic. No Math.random() allowed in core logic.

export interface RandomProvider {
  nextFloat(): number;
  nextInt(min: number, max: number): number;
  pick<T>(items: T[]): T;
  /** Fork a new RNG from the current state seeded with an extra integer. */
  fork(extra: number): RandomProvider;
}

/**
 * Mulberry32 — fast, small, good-enough quality for game content.
 * Pure function; no global state.
 */
export class SeededRandomProvider implements RandomProvider {
  private state: number;

  constructor(seed: number) {
    // Ensure the seed is a 32-bit unsigned integer
    this.state = seed >>> 0;
  }

  nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let z = this.state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    // inclusive on both ends
    return Math.floor(this.nextFloat() * (max - min + 1)) + min;
  }

  pick<T>(items: T[]): T {
    if (items.length === 0) throw new Error("pick() called on empty array");
    return items[this.nextInt(0, items.length - 1)];
  }

  fork(extra: number): RandomProvider {
    return new SeededRandomProvider((this.state ^ (extra >>> 0)) >>> 0);
  }

  /** Weighted pick: weights are parallel to items. */
  weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.nextFloat() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

/**
 * Derive a stable seed from a string key and a base seed.
 * Used to make trait/loot rolls reproducible when order of calls changes.
 */
export function deriveSeed(base: number, key: string): number {
  let h = base;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x9e3779b9);
    h = ((h << 13) | (h >>> 19)) >>> 0;
  }
  return h >>> 0;
}
