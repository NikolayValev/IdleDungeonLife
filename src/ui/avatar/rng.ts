import { fnv1a32 } from "./hashing";

const MASK_64 = (1n << 64n) - 1n;
const PCG_MULTIPLIER = 6364136223846793005n;

function toUint64(value: bigint | number): bigint {
  return BigInt.asUintN(64, BigInt(value));
}

export class Pcg32 {
  private state: bigint;
  private increment: bigint;

  constructor(seed: bigint | number, sequence: bigint | number = 0xda3e39cb94b95bdbn) {
    this.state = 0n;
    this.increment = (toUint64(sequence) << 1n) | 1n;
    this.nextUint32();
    this.state = (this.state + toUint64(seed)) & MASK_64;
    this.nextUint32();
  }

  nextUint32(): number {
    const oldState = this.state;
    this.state = (oldState * PCG_MULTIPLIER + this.increment) & MASK_64;

    const xorshifted = Number((((oldState >> 18n) ^ oldState) >> 27n) & 0xffff_ffffn);
    const rotation = Number((oldState >> 59n) & 31n);

    return ((xorshifted >>> rotation) | (xorshifted << ((-rotation) & 31))) >>> 0;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`nextInt(maxExclusive) requires a positive integer, got ${maxExclusive}`);
    }

    const bound = 0x1_0000_0000 - (0x1_0000_0000 % maxExclusive);
    let value = this.nextUint32();

    while (value >= bound) {
      value = this.nextUint32();
    }

    return value % maxExclusive;
  }
}

export function pickVariant(seed: string, slotKey: string, count: number, salt = ""): number {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`pickVariant(count) requires a positive integer, got ${count}`);
  }

  const base = `${seed}::${slotKey}::${salt}`;
  const state = (BigInt(fnv1a32(base)) << 32n) | BigInt(fnv1a32(`${base}::state`));
  const sequence = BigInt(fnv1a32(`${base}::sequence`));
  const rng = new Pcg32(state, sequence);

  return rng.nextInt(count);
}
