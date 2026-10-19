/**
 * The gravity well: a polar mesh (spokes and log-spaced rings) lifted onto the surface
 * z(r) = −K(1/r − 1/R_far), seen tilted and with perspective, so the surface narrows to a
 * vanishing point below the mouth; the tube to infinity is the surface itself. Rings flow inward
 * at constant speed in log r, the spokes are logarithmic spirals that slowly turn, so the mesh
 * swirls into the hole. Cells are painted opaque, back to front, so the near wall hides the far
 * wall. Outside the well the view blends back to a flat plane before the mesh fades at the edges.
 *
 * Ported from the accepted prototype (docs/specs/landing-redesign/prototypes/gen15.py). Colours
 * come from the `well-*` tokens; nothing here is a literal.
 */

export interface WellSize {
  /** Board width: the well's reach, 2R. */
  w: number
  /** Inner and outer orbit ring radii, and the throat radius. */
  r1: number
  r2: number
  rmin: number
}

export const SIZES: Record<'S' | 'L', { m: WellSize; d: WellSize }> = {
  S: { m: { w: 300, r1: 66, r2: 116, rmin: 22 }, d: { w: 540, r1: 110, r2: 190, rmin: 36 } },
  L: { m: { w: 350, r1: 78, r2: 136, rmin: 26 }, d: { w: 640, r1: 130, r2: 226, rmin: 42 } },
}

export interface WellColors {
  line: string
  throat: string
  mouth: string
  glow: string
  bg: string
  ringOuter: string
  ringInner: string
}

export interface WellOptions {
  /** Fade the top of the canvas into the page colour (the hero does; a free-standing well may not). */
  wash?: boolean
  /** Draw the two dashed orbit rings. */
  rings?: boolean
  /** Line alpha multiplier. */
  dim?: number
}

interface Geometry {
  W: number
  H: number
  cx: number
  cy: number
  R: number
  r1: number
  r2: number
  rmin: number
  Rf: number
  th: number
  ct: number
  st: number
  K: number
  fade0: number
  fade1: number
  F: number
  flat0: number
  flat1: number
}

const SPOKES = 28
const RINGSTEP = Math.log(1.12)
/** Ring speed, in log-radius per second. */
const SPEED = 0.085
/** Spiral tightness of the spokes. */
const SWIRL = 0.32
/** One turn of the spokes in 120 s. */
const OMEGA = (Math.PI * 2) / 120

type RGB = [number, number, number]

function rgb(color: string): RGB {
  const m = color.match(/[\d.]+/g)
  if (color.startsWith('#')) {
    let h = color.slice(1)
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])]
  return [0, 0, 0]
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export class Well {
  private readonly ctx: CanvasRenderingContext2D
  private geo!: Geometry
  private colors!: WellColors
  private ink: RGB = [0, 0, 0]
  private throat: RGB = [0, 0, 0]
  private page: RGB = [255, 255, 255]
  private readonly opt: Required<WellOptions>

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: WellOptions = {},
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    this.ctx = ctx
    this.opt = { wash: options.wash ?? true, rings: options.rings ?? true, dim: options.dim ?? 1 }
  }

  setColors(colors: WellColors) {
    this.colors = colors
    this.ink = rgb(colors.line)
    this.throat = rgb(colors.throat)
    this.page = rgb(colors.bg)
  }

  /** Sizes the canvas to W×H CSS pixels at up to 2× device pixel ratio. */
  size(W: number, H: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(W * dpr)
    this.canvas.height = Math.round(H * dpr)
    this.canvas.style.width = `${W}px`
    this.canvas.style.height = `${H}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  /** The well's centre (cx, cy in canvas pixels), board size and tilt in degrees. */
  layout(W: number, H: number, cx: number, cy: number, size: WellSize, tilt: number): Geometry {
    const th = (tilt * Math.PI) / 180
    const R = size.w / 2
    const st = Math.sin(th)
    const g: Geometry = {
      W,
      H,
      cx,
      cy,
      R,
      r1: size.r1,
      r2: size.r2,
      rmin: size.rmin,
      Rf: Math.max(W, H) * 1.6,
      th,
      ct: Math.cos(th),
      st,
      // the mouth sits half a board-radius below the centre
      K: (0.5 * R) / (st * (1 / size.rmin - 1 / R)),
      fade0: R * 0.95,
      fade1: R * 2.6,
      F: R * 1.3,
      flat0: R * 0.9,
      flat1: R * 2.2,
    }
    this.geo = g
    return g
  }

  get geometry(): Geometry {
    return this.geo
  }

  /** Height of the surface at radius r (negative: below the plane). */
  z(r: number): number {
    return -this.geo.K * (1 / Math.max(r, 1.5) - 1 / this.geo.Rf)
  }

  /** Perspective scale at radius r. */
  scale(r: number): number {
    return this.geo.F / (this.geo.F - this.z(r))
  }

  /** Full 3D (tilt + perspective) inside the well, blending to a flat 2D plane before the fade. */
  private flat(r: number): number {
    return smooth((r - this.geo.flat0) / (this.geo.flat1 - this.geo.flat0))
  }

  private proj(x: number, y: number): [number, number] {
    const g = this.geo
    const r = Math.hypot(x, y)
    const zz = this.z(r)
    const s = g.F / (g.F - zz)
    const b = 1 - this.flat(r)
    return [g.cx + x * (1 - b + b * s), g.cy + (1 - b) * y + b * (y * g.ct - zz * g.st) * s]
  }

  private alpha(r: number): number {
    return 1 - smooth((r - this.geo.fade0) / (this.geo.fade1 - this.geo.fade0))
  }

  private tun(r: number): number {
    const g = this.geo
    return smooth((g.r1 * 2.2 - r) / (g.r1 * 2.2 - g.rmin * 0.3))
  }

  private inkAt(r: number): string {
    const k = this.tun(r)
    const a = this.ink
    const b = this.throat
    const mix = (i: number) => Math.round(a[i] + (b[i] - a[i]) * k)
    return `rgb(${mix(0)},${mix(1)},${mix(2)})`
  }

  private stroke(pts: Array<[number, number]>, a: number, w: number, r?: number) {
    if (pts.length < 2) return
    const c = this.ctx
    if (r !== undefined) {
      c.strokeStyle = this.inkAt(r)
      a = a + (1 - a) * this.tun(r) * this.opt.dim
    }
    c.globalAlpha = Math.min(1, a)
    c.lineWidth = w
    c.beginPath()
    c.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1])
    c.stroke()
  }

  private spoke(a0: number, r: number): number {
    return a0 + SWIRL * Math.log(this.geo.Rf / r)
  }

  private topFill(): CanvasGradient {
    const [r, g, b] = this.page
    const gr = this.ctx.createLinearGradient(0, 0, 0, this.geo.H * 0.42)
    gr.addColorStop(0, `rgba(${r},${g},${b},1)`)
    gr.addColorStop(0.45, `rgba(${r},${g},${b},.7)`)
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`)
    return gr
  }

  /** The screen y of the mouth's centre. */
  mouthY(): number {
    const g = this.geo
    const mr = g.rmin * 0.55
    return g.cy + -this.z(mr) * g.st * this.scale(mr)
  }

  /** Draws one frame at time T (seconds). */
  draw(T: number) {
    const g = this.geo
    const c = this.ctx
    const col = this.colors
    c.clearRect(0, 0, g.W, g.H)
    c.strokeStyle = col.line
    c.lineCap = 'round'
    c.lineJoin = 'round'
    const rmax = Math.hypot(Math.max(g.cx, g.W - g.cx), Math.max(g.cy, g.H - g.cy)) + 40
    const base = 0.16 * this.opt.dim
    const rin = g.rmin * 0.3
    const rot = T * OMEGA

    // the mouth: the other theme's ground at the bottom of the funnel, with a glow rim
    const mr = g.rmin * 0.55
    const ms = this.scale(mr)
    c.globalAlpha = 1
    c.fillStyle = col.mouth
    c.strokeStyle = col.glow
    c.lineWidth = 3
    c.beginPath()
    c.ellipse(g.cx, this.mouthY(), mr * ms, mr * ms * g.ct, 0, 0, Math.PI * 2)
    c.fill()
    c.stroke()
    c.strokeStyle = col.line

    // the surface as a surface: cells between neighbouring spokes and rings, filled with the
    // page colour and painted back to front, so the near wall hides the far wall and the tube
    const lo = Math.log(rin)
    const hi = Math.log(rmax)
    const ph0 = (T * SPEED) % RINGSTEP
    const radii: number[] = []
    for (let L = hi + RINGSTEP; L > lo; L -= RINGSTEP) {
      const rr = Math.exp(L - ph0)
      if (rr >= rin && rr <= rmax) radii.push(rr)
    }
    radii.sort((a, b) => a - b)
    interface Cell {
      d: number
      q: Array<[number, number]>
      r: number
      ra: number
    }
    const cells: Cell[] = []
    for (let i = 0; i < radii.length - 1; i++) {
      const ra = radii[i]
      const rb = radii[i + 1]
      for (let k = 0; k < SPOKES; k++) {
        const a1 = (k / SPOKES) * Math.PI * 2 + rot
        const a2 = ((k + 1) / SPOKES) * Math.PI * 2 + rot
        const p1 = this.spoke(a1, ra)
        const p2 = this.spoke(a2, ra)
        const p3 = this.spoke(a2, rb)
        const p4 = this.spoke(a1, rb)
        const ym =
          (Math.sin(p1) * ra + Math.sin(p2) * ra + Math.sin(p3) * rb + Math.sin(p4) * rb) / 4
        const zm = (this.z(ra) + this.z(rb)) / 2
        cells.push({
          d: ym * g.st + zm * g.ct,
          q: [
            this.proj(ra * Math.cos(p1), ra * Math.sin(p1)),
            this.proj(ra * Math.cos(p2), ra * Math.sin(p2)),
            this.proj(rb * Math.cos(p3), rb * Math.sin(p3)),
            this.proj(rb * Math.cos(p4), rb * Math.sin(p4)),
          ],
          r: (ra + rb) / 2,
          ra,
        })
      }
    }
    cells.sort((a, b) => a.d - b.d)
    const born = (r: number) => Math.min(1, (hi + RINGSTEP - Math.log(r) - ph0) / RINGSTEP)
    const die = (r: number) => Math.min(1, (Math.log(r) - lo) / (RINGSTEP * 2.5))
    for (const cell of cells) {
      const q = cell.q
      c.globalAlpha = 1
      c.fillStyle = col.bg
      c.beginPath()
      c.moveTo(q[0][0], q[0][1])
      c.lineTo(q[1][0], q[1][1])
      c.lineTo(q[2][0], q[2][1])
      c.lineTo(q[3][0], q[3][1])
      c.closePath()
      c.fill()
      // the cell's own edges: its inner ring (fading in at the edge, out at the bottom) and one spoke
      const al = this.alpha(cell.r) * base
      if (al <= 0.003 && this.tun(cell.r) <= 0) continue
      this.stroke([q[0], q[1]], al * 1.2 * born(cell.ra) * die(cell.ra), 1, cell.ra)
      this.stroke([q[0], q[3]], al, 1, cell.r)
    }
    if (this.opt.wash) {
      c.globalAlpha = 1
      c.fillStyle = this.topFill()
      c.fillRect(0, 0, g.W, g.H * 0.42)
    }
    if (this.opt.rings) {
      c.setLineDash([4, 4])
      for (const [radius, color] of [
        [g.r2, col.ringOuter],
        [g.r1, col.ringInner],
      ] as const) {
        const p: Array<[number, number]> = []
        for (let i = 0; i <= 90; i++) {
          const b = (i / 90) * Math.PI * 2
          p.push(this.proj(radius * Math.cos(b), radius * Math.sin(b)))
        }
        c.strokeStyle = color
        this.stroke(p, 1, 1.5)
      }
      c.setLineDash([])
    }
  }
}

/** Reads the well's colours from the tokens in effect on `el`. */
export function readWellColors(el: Element): WellColors {
  const s = getComputedStyle(el)
  const v = (name: string) => s.getPropertyValue(name).trim()
  return {
    line: v('--well-line'),
    throat: v('--well-throat'),
    mouth: v('--well-mouth'),
    glow: v('--well-glow'),
    bg: v('--bg-canvas'),
    ringOuter: v('--border-default'),
    ringInner: v('--well-glow'),
  }
}
