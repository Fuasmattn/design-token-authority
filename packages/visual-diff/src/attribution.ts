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

/**
 * A rule in a rendered page that declares a custom property (from `PAGE_DECLARATIONS_SCRIPT`).
 * `context` holds the preludes it is nested in, outermost first: `@media (…)`, `@layer name`,
 * `@supports (…)`, `@container …`, `@scope (…)` or a parent rule's selector (CSS nesting).
 */
export interface PageDeclaration {
  variable: string
  value: string
  selector: string
  context: string[]
}

/** What to put back for one custom property of a changed token. */
interface Revert {
  variable: string
  /** The rule `dta build` declares it in. */
  selector: string
  /** The value to put back: the base value, or `initial` for a token added in the head. */
  value: string
  /** The head value as the build writes it. */
  head?: string
  /** The same variable for other collection · modes in the head build (e.g. other brands). */
  siblings: Array<{ selector: string; value: string }>
}

/**
 * Revert rules for a token change set, planned once and scoped per page: `groups` puts the
 * tokens back under the selectors `dta build` writes; `groupsFor(page)` also puts them back
 * wherever the rendered page itself declares their variables (re-scoped CSS, TICKET-111).
 */
export interface RevertPlan {
  causes: TokenCause[]
  /** Every custom property a revert touches: what to look for in the page's stylesheets. */
  variables: string[]
  groups: RevertGroup[]
  groupsFor(page: PageDeclaration[]): RevertGroup[]
}

export const causeId = (change: Pick<TokenChange, 'name' | 'collection' | 'mode'>) =>
  `${change.name} (${change.collection} · ${change.mode})`

const key = (b: Pick<CssBinding, 'collection' | 'mode' | 'name'>) =>
  `${b.collection}\u0000${b.mode}\u0000${b.name}`

const sameValue = (a: string, b: string) =>
  a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase()

/** `selector { variable: value !important; }`, nested in the page rule's context. */
function ruleIn(context: string[], selector: string, variable: string, value: string): string {
  return context.reduceRight(
    (inner, prelude) => `${prelude} { ${inner} }`,
    `${selector} { ${variable}: ${value} !important; }`,
  )
}

/**
 * Whether a page rule declares this revert's token (and so gets the revert too):
 * - the build's own selector: yes inside an at-rule or nesting (the plain rule is already
 *   covered by the build rule);
 * - the build selector of another mode of the variable (another brand): no;
 * - any other selector (re-scoped CSS): yes when the build declares the variable for one
 *   collection · mode only; otherwise only when its value is this mode's head value and no
 *   other mode's, so a re-scoped brand is not put back to another brand's base value.
 */
function declares(revert: Revert, page: PageDeclaration): boolean {
  if (page.variable !== revert.variable) return false
  if (page.selector === revert.selector) return page.context.length > 0
  if (revert.siblings.some((s) => s.selector === page.selector)) return false
  if (revert.siblings.length === 0) return true
  if (revert.head === undefined || !sameValue(page.value, revert.head)) return false
  return !revert.siblings.some((s) => sameValue(s.value, page.value))
}

function revertCss(reverts: Revert[], page: PageDeclaration[]): string {
  const rules = reverts.flatMap((r) => [
    ruleIn([], r.selector, r.variable, r.value),
    ...page
      .filter((p) => declares(r, p))
      .map((p) => ruleIn(p.context, p.selector, r.variable, r.value)),
  ])
  return [...new Set(rules)].join('\n')
}

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
): RevertPlan {
  const baseByKey = new Map(base.map((b) => [key(b), b]))
  const headByKey = new Map(head.map((b) => [key(b), b]))
  const headByVariable = new Map<string, CssBinding[]>()
  for (const b of head)
    headByVariable.set(b.variable, [...(headByVariable.get(b.variable) ?? []), b])
  const siblings = (b: CssBinding) =>
    (headByVariable.get(b.variable) ?? [])
      .filter((other) => key(other) !== key(b))
      .map(({ selector, value }) => ({ selector, value }))
  const revertOf = (change: TokenChange): Revert | null => {
    const before = baseByKey.get(key(change))
    const after = headByKey.get(key(change))
    if (before) {
      return {
        variable: before.variable,
        selector: before.selector,
        value: before.value,
        head: after?.value,
        siblings: siblings(after ?? before),
      }
    }
    // Added in the head: without it, var() falls back as it did in the base.
    return after
      ? {
          variable: after.variable,
          selector: after.selector,
          value: 'initial',
          head: after.value,
          siblings: siblings(after),
        }
      : null
  }

  const causes: TokenCause[] = []
  const leavesByLayer = new Map<string, Array<{ id: string; reverts: Revert[] }>>()
  for (const change of set.changes) {
    if (change.kind === 'affected') continue
    const members = [
      change,
      ...set.changes.filter((c) => c.kind === 'affected' && c.causes?.includes(change.name)),
    ]
    const reverts = members.map(revertOf).filter((r): r is Revert => r !== null)
    if (reverts.length === 0) continue
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
    leaves.push({ id, reverts })
    leavesByLayer.set(layer, leaves)
  }

  const groupsFor = (page: PageDeclaration[]): RevertGroup[] =>
    [...leavesByLayer].map(([layer, leaves]) => {
      const children = leaves.map((leaf) => ({ id: leaf.id, css: revertCss(leaf.reverts, page) }))
      return children.length === 1
        ? children[0]
        : { id: `group: ${layer}`, css: children.map((l) => l.css).join('\n'), children }
    })
  const variables = [
    ...new Set(
      [...leavesByLayer.values()].flat().flatMap((leaf) => leaf.reverts.map((r) => r.variable)),
    ),
  ]
  return { causes, variables, groups: groupsFor([]), groupsFor }
}

/**
 * Runs in the browser: `(variables) => PageDeclaration[]`, every rule in the page's stylesheets
 * (`document.styleSheets`, adopted sheets, `@import`s) that declares one of `variables`,
 * through `@media`, `@supports`, `@layer`, `@container`, `@scope` and CSS nesting. Sheets the
 * page may not read (cross-origin) are skipped. A string, like `DEPENDENTS_SCRIPT`.
 */
export const PAGE_DECLARATIONS_SCRIPT = `(variables) => {
  const wanted = new Set(variables)
  const out = []
  const GROUPS = ['@media', '@supports', '@layer', '@container', '@scope', '@starting-style']
  const prelude = (rule) => {
    const text = String(rule.cssText || '')
    const brace = text.indexOf('{')
    return (brace < 0 ? text : text.slice(0, brace)).trim()
  }
  const collect = (style, selector, context) => {
    if (!style) return
    for (let i = 0; i < style.length; i++) {
      const name = style[i]
      if (wanted.has(name)) {
        out.push({ variable: name, value: String(style.getPropertyValue(name)).trim(), selector, context })
      }
    }
  }
  const walk = (rules, context, inStyle) => {
    for (const rule of rules) {
      if (rule.styleSheet) {
        const wrap = [...context]
        if (rule.layerName) wrap.push('@layer ' + rule.layerName)
        if (rule.supportsText) wrap.push('@supports ' + rule.supportsText)
        if (rule.media && rule.media.mediaText) wrap.push('@media ' + rule.media.mediaText)
        read(rule.styleSheet, wrap)
        continue
      }
      if (typeof rule.selectorText === 'string') {
        collect(rule.style, rule.selectorText, context)
        if (rule.cssRules && rule.cssRules.length) walk(rule.cssRules, [...context, rule.selectorText], true)
        continue
      }
      // Declarations between nested rules (CSSNestedDeclarations) belong to the parent rule.
      if (inStyle && rule.style && !rule.cssRules) {
        collect(rule.style, '&', context)
        continue
      }
      const head = prelude(rule)
      const at = head.split(/[\\s(]/)[0]
      if (!GROUPS.includes(at) || !rule.cssRules) continue
      // An anonymous layer cannot be named again: its declarations are put back unlayered.
      walk(rule.cssRules, head === '@layer' ? context : [...context, head], inStyle || at === '@scope')
    }
  }
  const read = (sheet, context) => {
    if (!sheet || sheet.disabled) return
    let rules
    try {
      rules = sheet.cssRules
    } catch (error) {
      return
    }
    if (!rules) return
    const media = sheet.media && sheet.media.mediaText
    walk(rules, media && !context.length ? ['@media ' + media] : context, false)
  }
  for (const sheet of document.styleSheets) read(sheet, [])
  for (const sheet of document.adoptedStyleSheets || []) read(sheet, [])
  return out
}`

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
  tokens: Array<{
    id: string
    dependents: number
    pixels: number
    elements: string[]
    /** Up to five dependent boxes in the head image (largest first), for labels in the report. */
    regions: Region[]
  }>
  unexplainedPixels: number
  /** Bounding box of the unexplained pixels. */
  unexplainedRegion?: Region
  /** Size of the compared image the regions refer to. */
  canvas: { width: number; height: number }
  /** Time the attribution took, in ms. */
  ms?: number
}

/** The largest distinct head boxes, clipped to the image, at most `max`. */
function topRegions(dependents: Dependent[], width: number, height: number, max = 5): Region[] {
  const seen = new Set<string>()
  const regions: Region[] = []
  for (const { box } of dependents) {
    const x = Math.max(0, Math.round(box[0]))
    const y = Math.max(0, Math.round(box[1]))
    const region = {
      x,
      y,
      width: Math.min(width, Math.round(box[2])) - x,
      height: Math.min(height, Math.round(box[3])) - y,
    }
    const id = `${region.x},${region.y},${region.width},${region.height}`
    if (region.width <= 0 || region.height <= 0 || seen.has(id)) continue
    seen.add(id)
    regions.push(region)
  }
  return regions.sort((a, b) => b.width * b.height - a.width * a.height).slice(0, max)
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
        regions: topRegions(dependents[id], width, height),
      }))
      .filter((token) => token.pixels > 0),
    unexplainedPixels: unexplained,
    canvas: { width, height },
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
