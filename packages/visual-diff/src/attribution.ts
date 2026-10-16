import type { TokenChange, TokenChangeSet } from './token-changes.js'

/**
 * Token attribution (TICKET-083/084): a changed token is put back to its base value in the
 * rendered head page; the elements whose computed style or box changes are its dependents, and
 * the changed pixels inside their boxes are explained by it.
 */

/** Where a token is declared in the project's CSS (structurally the same as `@dta/build`'s). */
export interface CssBinding {
  collection: string
  mode: string
  name: string
  variable: string
  selector: string
  value: string
}

/** A changed token that can explain pixels: `name (Collection · Mode)`. */
export interface TokenCause {
  id: string
  name: string
  collection: string
  mode: string
  kind: TokenChange['kind']
  before?: TokenChange['before']
  after?: TokenChange['after']
}

/** CSS that puts one or more tokens back to their base values; children refine a group. */
export interface RevertGroup {
  id: string
  css: string
  children?: RevertGroup[]
}

export const causeId = (change: Pick<TokenChange, 'name' | 'collection' | 'mode'>) =>
  `${change.name} (${change.collection} · ${change.mode})`

const key = (b: Pick<CssBinding, 'collection' | 'mode' | 'name'>) =>
  `${b.collection}\u0000${b.mode}\u0000${b.name}`

/**
 * Revert rules for a token change set. One leaf per changed, added or removed token: the token
 * itself plus every `affected` token it causes (so values a build wrote out resolved are put
 * back too). Leaves are grouped per collection · mode, so a page tries one group first and
 * refines only groups that change something. Tokens without CSS produce no rule.
 */
export function planReverts(
  set: TokenChangeSet,
  base: CssBinding[],
  head: CssBinding[],
): { causes: TokenCause[]; groups: RevertGroup[] } {
  const baseByKey = new Map(base.map((b) => [key(b), b]))
  const headByKey = new Map(head.map((b) => [key(b), b]))
  const rule = (change: TokenChange): string | null => {
    const before = baseByKey.get(key(change))
    if (before) return `${before.selector} { ${before.variable}: ${before.value} !important; }`
    // Added in the head: without it, var() falls back as it did in the base.
    const after = headByKey.get(key(change))
    return after ? `${after.selector} { ${after.variable}: initial !important; }` : null
  }

  const causes: TokenCause[] = []
  const leavesByLayer = new Map<string, RevertGroup[]>()
  for (const change of set.changes) {
    if (change.kind === 'affected') continue
    const members = [
      change,
      ...set.changes.filter((c) => c.kind === 'affected' && c.causes?.includes(change.name)),
    ]
    const css = [...new Set(members.map(rule).filter((r): r is string => r !== null))]
    if (css.length === 0) continue
    const id = causeId(change)
    causes.push({
      id,
      name: change.name,
      collection: change.collection,
      mode: change.mode,
      kind: change.kind,
      before: change.before,
      after: change.after,
    })
    const layer = `${change.collection} · ${change.mode}`
    const leaves = leavesByLayer.get(layer) ?? []
    leaves.push({ id, css: css.join('\n') })
    leavesByLayer.set(layer, leaves)
  }

  const groups = [...leavesByLayer].map(([layer, leaves]) =>
    leaves.length === 1
      ? leaves[0]
      : { id: `group: ${layer}`, css: leaves.map((l) => l.css).join('\n'), children: leaves },
  )
  return { causes, groups }
}

/** `[left, top, right, bottom]` in page pixels. */
export type Box = [number, number, number, number]

/** An element whose style or box changed when a token was reverted. */
export interface Dependent {
  /** e.g. `button.primary` */
  label: string
  /** Box in the head page. */
  box: Box
  /** Box with the token reverted (where the element was in the base). */
  baseBox: Box
}

/**
 * Runs in the browser, in the head page: `(groups) => { [leafId]: Dependent[] }`. Kept as a
 * string so bundlers cannot rewrite it; the CLI passes it to `page.evaluate`.
 */
export const DEPENDENTS_SCRIPT = `(groups) => {
  const elements = [...document.querySelectorAll('body, body *')]
  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).find((c) => c && !c.startsWith('astro-')) : ''
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '')
  }
  const snapshot = () => elements.map((el) => {
    let style = ''
    for (const pseudo of [null, '::before', '::after']) {
      const cs = getComputedStyle(el, pseudo)
      if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue
      for (let i = 0; i < cs.length; i++) {
        const name = cs[i]
        if (!name.startsWith('--')) style += name + ':' + cs.getPropertyValue(name) + ';'
      }
      style += '|'
    }
    const r = el.getBoundingClientRect()
    return { style, box: [r.left + scrollX, r.top + scrollY, r.right + scrollX, r.bottom + scrollY] }
  })
  const head = snapshot()
  const out = {}
  const run = (group) => {
    const tag = document.createElement('style')
    tag.textContent = group.css
    document.head.append(tag)
    const reverted = snapshot()
    tag.remove()
    const dependents = []
    for (let i = 0; i < elements.length; i++) {
      if (head[i].style !== reverted[i].style || head[i].box.join() !== reverted[i].box.join()) {
        dependents.push({ label: label(elements[i]), box: head[i].box, baseBox: reverted[i].box })
      }
    }
    return dependents
  }
  const visit = (group) => {
    const dependents = run(group)
    if (!group.children) { out[group.id] = dependents; return }
    if (dependents.length === 0) { for (const child of group.children) out[child.id] = []; return }
    for (const child of group.children) visit(child)
  }
  for (const group of groups) visit(group)
  return out
}`

/** A rectangle in page pixels. */
export interface Region {
  x: number
  y: number
  width: number
  height: number
}

export interface Attribution {
  /** Every changed pixel lies in a box of a changed token's dependents. */
  explained: boolean
  /** Tokens with dependents in this story; a pixel may count for several tokens. */
  tokens: Array<{ id: string; dependents: number; pixels: number; elements: string[] }>
  unexplainedPixels: number
  /** Bounding box of the unexplained pixels. */
  unexplainedRegion?: Region
  /** Time the attribution took, in ms. */
  ms?: number
}

/** Extra pixels around each box: anti-aliased edges, outlines and shadows next to it. */
export const BOX_TOLERANCE = 2

/**
 * Maps changed pixels (`mask`: 1 per changed pixel, row by row) to the dependents' boxes, in
 * the head and in the base position, `tolerance` px larger on every side.
 */
export function attributePixels(
  mask: Uint8Array,
  width: number,
  height: number,
  dependents: Record<string, Dependent[]>,
  tolerance = BOX_TOLERANCE,
): Attribution {
  const ids = Object.keys(dependents).filter((id) => dependents[id].length > 0)
  const coverage = ids.map((id) => {
    const map = new Uint8Array(width * height)
    for (const dependent of dependents[id]) {
      for (const [l, t, r, b] of [dependent.box, dependent.baseBox]) {
        const x0 = Math.max(0, Math.floor(l - tolerance))
        const x1 = Math.min(width, Math.ceil(r + tolerance))
        const y0 = Math.max(0, Math.floor(t - tolerance))
        const y1 = Math.min(height, Math.ceil(b + tolerance))
        for (let y = y0; y < y1; y++) map.fill(1, y * width + x0, y * width + x1)
      }
    }
    return map
  })

  const pixels = ids.map(() => 0)
  let unexplained = 0
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    let hit = false
    for (let t = 0; t < ids.length; t++) {
      if (coverage[t][i]) {
        pixels[t]++
        hit = true
      }
    }
    if (hit) continue
    unexplained++
    const x = i % width
    const y = (i - x) / width
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  return {
    explained: unexplained === 0,
    tokens: ids
      .map((id, t) => ({
        id,
        dependents: dependents[id].length,
        pixels: pixels[t],
        elements: [...new Set(dependents[id].map((d) => d.label))].slice(0, 5),
      }))
      .filter((token) => token.pixels > 0),
    unexplainedPixels: unexplained,
    ...(unexplained > 0
      ? {
          unexplainedRegion: {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          },
        }
      : {}),
  }
}
