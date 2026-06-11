interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clampByte(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function parseHex(hex: string): Rgb {
  let body = hex.replace("#", "").toLowerCase();
  if (body.length === 3) {
    body = body
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) => clampByte(value).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Linear interpolation between two hex colors. `t` is clamped to [0,1]. */
export function mix(a: string, b: string, t: number): string {
  const ratio = clamp01(t);
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex({
    r: ca.r + (cb.r - ca.r) * ratio,
    g: ca.g + (cb.g - ca.g) * ratio,
    b: ca.b + (cb.b - ca.b) * ratio,
  });
}

/** Move a color `amount` (0..1) toward black. */
export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

/** Move a color `amount` (0..1) toward white. */
export function lighten(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

/** Perceptual luminance in [0,1] (matches the app's existing readable-text math). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
