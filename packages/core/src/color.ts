/** Channels are 0–1, like Figma. `a` is omitted for opaque colors. */
export interface Color {
  r: number
  g: number
  b: number
  a?: number
}

export type ParsedColor = { ok: true; color: Color } | { ok: false; error: string }

const HEX = /^#([A-Fa-f0-9]{6})([A-Fa-f0-9]{2})?$/
const HEX_SHORT = /^#([A-Fa-f0-9]{3})([A-Fa-f0-9])?$/

/** Parses `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`. Returns a failure result for anything else. */
export function parseColor(input: string): ParsedColor {
  const text = input.trim()
  if (!HEX.test(text) && !HEX_SHORT.test(text)) {
    return { ok: false, error: `Invalid color format: ${JSON.stringify(input)}` }
  }
  const digits = text.slice(1)
  const full =
    digits.length === 3 || digits.length === 4
      ? digits
          .split('')
          .map((char) => char + char)
          .join('')
      : digits
  const channel = (start: number) => parseInt(full.slice(start, start + 2), 16) / 255
  return {
    ok: true,
    color: {
      r: channel(0),
      g: channel(2),
      b: channel(4),
      ...(full.length === 8 ? { a: channel(6) } : {}),
    },
  }
}

/** `#rrggbb`, or `#rrggbbaa` when the color is not fully opaque. */
export function toHex({ r, g, b, a = 1 }: Color): string {
  const byte = (value: number) =>
    Math.round(value * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${byte(r)}${byte(g)}${byte(b)}${a !== 1 ? byte(a) : ''}`
}

/**
 * Compares two colors by hex value, since converting between Figma's 0–1 floats and hex
 * introduces tiny differences.
 */
export function colorsApproximatelyEqual(a: Color, b: Color): boolean {
  return toHex(a) === toHex(b)
}

/** Relative luminance, WCAG 2.1. */
function luminance({ r, g, b }: Color): number {
  const [rs, gs, bs] = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** WCAG 2.1 contrast ratio between two colors (1–21). Alpha is ignored. */
export function contrastRatio(a: Color, b: Color): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
