import type { Color } from './color.js'
import type { ColorValue } from './types.js'

/**
 * DTCG 2025.10 colour spaces to sRGB, for what needs sRGB (the WCAG contrast check, Figma).
 * Conversions and matrices follow the sample code of CSS Color 4 and Björn Ottosson's OKLab.
 * Out-of-gamut colours are clipped to sRGB, and the result says so.
 */

type Vec = [number, number, number]
type Mat = [Vec, Vec, Vec]

const mul = (m: Mat, [a, b, c]: Vec): Vec => [
  m[0][0] * a + m[0][1] * b + m[0][2] * c,
  m[1][0] * a + m[1][1] * b + m[1][2] * c,
  m[2][0] * a + m[2][1] * b + m[2][2] * c,
]

const XYZ_TO_LIN_SRGB: Mat = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
]
const LIN_P3_TO_XYZ: Mat = [
  [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
  [35783 / 156275, 247089 / 357200, 198249 / 2500400],
  [0, 32229 / 714400, 5220557 / 5000800],
]
const LIN_A98_TO_XYZ: Mat = [
  [573536 / 994567, 263643 / 1420810, 187206 / 994567],
  [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
  [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
]
const LIN_PROPHOTO_TO_XYZ_D50: Mat = [
  [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
  [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
  [0, 0, 0.8251046025104602],
]
const LIN_2020_TO_XYZ: Mat = [
  [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
  [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
  [0, 19567812 / 697040785, 295819943 / 278816314],
]
/** Bradford chromatic adaptation, D50 to D65. */
const D50_TO_D65: Mat = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
]
const D50_WHITE: Vec = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585]

const signed = (c: number, f: (x: number) => number) => Math.sign(c) * f(Math.abs(c))
const srgbToLinear = (c: number) =>
  signed(c, (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4))
const linearToSrgb = (c: number) =>
  signed(c, (x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055))

function hslToSrgb(h: number, s: number, l: number): Vec {
  const sat = s / 100
  const light = l / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = sat * Math.min(light, 1 - light)
    return light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

function hwbToSrgb(h: number, w: number, b: number): Vec {
  const white = w / 100
  const black = b / 100
  if (white + black >= 1) {
    const grey = white / (white + black)
    return [grey, grey, grey]
  }
  return hslToSrgb(h, 100, 50).map((c) => c * (1 - white - black) + white) as Vec
}

function labToXyzD50(l: number, a: number, b: number): Vec {
  const kappa = 24389 / 27
  const epsilon = 216 / 24389
  const f1 = (l + 16) / 116
  const f0 = a / 500 + f1
  const f2 = f1 - b / 200
  const x = f0 ** 3 > epsilon ? f0 ** 3 : (116 * f0 - 16) / kappa
  const y = l > kappa * epsilon ? ((l + 16) / 116) ** 3 : l / kappa
  const z = f2 ** 3 > epsilon ? f2 ** 3 : (116 * f2 - 16) / kappa
  return [x * D50_WHITE[0], y * D50_WHITE[1], z * D50_WHITE[2]]
}

const polar = (c: number, h: number): [number, number] => [
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
]

function oklabToLinearSrgb(l: number, a: number, b: number): Vec {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
}

const fromXyzD65 = (xyz: Vec): Vec => mul(XYZ_TO_LIN_SRGB, xyz).map(linearToSrgb) as Vec
const fromXyzD50 = (xyz: Vec): Vec => fromXyzD65(mul(D50_TO_D65, xyz))

/** Gamma-encoded sRGB channels (may lie outside 0–1 for out-of-gamut colours). */
function srgbChannels(space: ColorValue['colorSpace'], [x, y, z]: Vec): Vec {
  switch (space) {
    case 'srgb':
      return [x, y, z]
    case 'srgb-linear':
      return [x, y, z].map(linearToSrgb) as Vec
    case 'hsl':
      return hslToSrgb(x, y, z)
    case 'hwb':
      return hwbToSrgb(x, y, z)
    case 'lab':
      return fromXyzD50(labToXyzD50(x, y, z))
    case 'lch':
      return fromXyzD50(labToXyzD50(x, ...polar(y, z)))
    case 'oklab':
      return oklabToLinearSrgb(x, y, z).map(linearToSrgb) as Vec
    case 'oklch':
      return oklabToLinearSrgb(x, ...polar(y, z)).map(linearToSrgb) as Vec
    case 'display-p3':
      return fromXyzD65(mul(LIN_P3_TO_XYZ, [x, y, z].map(srgbToLinear) as Vec))
    case 'a98-rgb':
      return fromXyzD65(
        mul(LIN_A98_TO_XYZ, [x, y, z].map((c) => signed(c, (v) => v ** (563 / 256))) as Vec),
      )
    case 'prophoto-rgb':
      return fromXyzD50(
        mul(
          LIN_PROPHOTO_TO_XYZ_D50,
          [x, y, z].map((c) => signed(c, (v) => (v <= 16 / 512 ? v / 16 : v ** 1.8))) as Vec,
        ),
      )
    case 'rec2020': {
      const alpha = 1.09929682680944
      const beta = 0.018053968510807
      const linear = (c: number) =>
        signed(c, (v) => (v < beta * 4.5 ? v / 4.5 : ((v + alpha - 1) / alpha) ** (1 / 0.45)))
      return fromXyzD65(mul(LIN_2020_TO_XYZ, [x, y, z].map(linear) as Vec))
    }
    case 'xyz-d65':
      return fromXyzD65([x, y, z])
    case 'xyz-d50':
      return fromXyzD50([x, y, z])
  }
}

/**
 * A DTCG colour as sRGB, clipped into the sRGB gamut; `clipped` says whether it had to be.
 * `"none"` components count as 0, as CSS does when it renders them.
 */
export function toSrgb(value: ColorValue): { color: Color; clipped: boolean } {
  const [x, y, z] = value.components.map((c) => (c === 'none' ? 0 : c)) as Vec
  const channels = srgbChannels(value.colorSpace, [x, y, z])
  const tolerance = 1e-4
  const clipped = channels.some((c) => c < -tolerance || c > 1 + tolerance)
  const [r, g, b] = channels.map((c) => Math.min(1, Math.max(0, c)))
  const alpha = value.alpha ?? 1
  return { color: { r, g, b, ...(alpha !== 1 ? { a: alpha } : {}) }, clipped }
}
