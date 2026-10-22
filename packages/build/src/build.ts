import {
  aliasProblems,
  analyzeGraph,
  FONT_WEIGHT_KEYWORDS,
  formatColor,
  nameToSlash,
  referenceOf,
  referencesIn,
  resolve,
} from '@dta/core'
import type { Collection, ColorValue, Diagnostic, Token, TokenModel, TokenValue } from '@dta/core'
import StyleDictionary from 'style-dictionary'
import type { DesignTokens, PlatformConfig } from 'style-dictionary/types'
import { CSS_TRANSFORM_GROUP, cssVariableName, hooks, JS_TRANSFORMS } from './transforms.js'
import { aliasesInto, brokenReferences, mergeSources } from './tree.js'
import type { MergedTokens, Source } from './tree.js'

/**
 * The outputs `buildOutputs` can write, in the order the config reference lists them:
 * CSS custom properties, Tailwind v4 `@theme` CSS, the Tailwind v3 theme object, the JS palette.
 */
export const OUTPUT_FORMATS = ['css', 'tailwind-v4', 'tailwind-v3', 'js'] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

/**
 * A collection whose modes are breakpoints (TICKET-091): its default mode is written on `:root`,
 * every other mode inside its media query, in this order (later blocks win where several
 * queries match, as in any stylesheet).
 */
export interface Breakpoints {
  collection: string
  /** The mode that applies without a media query. */
  default: string
  /** The other modes with their media query (what follows `@media`), in cascade order. */
  media: ReadonlyArray<{ mode: string; query: string }>
}

export interface BuildOptions {
  /** Which outputs to write (default: all of {@link OUTPUT_FORMATS}). */
  formats?: readonly OutputFormat[]
  /** Brands to build themes for: modes of the multi-mode collections. None means no themes. */
  brands?: string[]
  /** The breakpoint collection and the media query of each of its modes. */
  breakpoints?: Breakpoints
  /** Only build from these collections (default: all). */
  collections?: string[]
  /** Output directories relative to the project root. */
  css?: { outDir?: string }
  tailwind?: { outDir?: string }
}

export interface OutputFile {
  /** Relative to the project root, with forward slashes. */
  path: string
  content: string
  /**
   * The output it belongs to (`tailwind-v4` for `tailwind.css`, `tailwind-v3` for
   * `tailwind.tokens.ts`). Set on every file `buildOutputs` returns; files made elsewhere (a
   * config next to them in a zip) have none.
   */
  format?: OutputFormat
}

export interface BuildResult {
  files: OutputFile[]
  diagnostics: Diagnostic[]
}

const DEFAULT_CSS_DIR = 'output/css'
const DEFAULT_TAILWIND_DIR = 'output/tailwind'
const JS_DIR = 'output/js/'

/** `output/css` and `output/css/` both become `output/css/`; blank values are reported. */
function directory(value: string | undefined, fallback: string, name: string, into: Diagnostic[]) {
  if (value === undefined) return `${fallback}/`
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed === '') {
    into.push({
      severity: 'warning',
      code: 'invalid-option',
      message: `${name} is empty; using "${fallback}" instead.`,
    })
    return `${fallback}/`
  }
  return `${trimmed}/`
}

/**
 * One source per (collection, mode), holding the tokens that have a value in that mode, except
 * the ones in `skip` (graph node ids, `Collection.Mode/Group/Token`): aliases that never reach a
 * value.
 */
function sourceOf(
  model: TokenModel,
  collection: Collection,
  mode: string,
  skip: ReadonlySet<string>,
): Source {
  const origin = `${collection.name}.${mode}`
  return {
    origin,
    tokens: collection.tokens.flatMap((token) => {
      const value = token.values[mode]
      if (value === undefined || skip.has(`${origin}/${nameToSlash(token.name)}`)) return []
      return [{ token, value: prepareValue(model, collection, mode, token, value) }]
    }),
  }
}

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * A DTCG 2025.10 value as Style Dictionary 5 reads it, keeping what we decide ourselves:
 * colour objects (also inside composites) become CSS text in their own colour space; a `$ref`
 * to a whole token becomes an alias, so variables keep their `var()` references; a token that
 * points into another token's value is written resolved.
 */
function prepareValue(
  model: TokenModel,
  collection: Collection,
  mode: string,
  token: Token,
  value: TokenValue,
): TokenValue {
  const references = referencesIn(value)
  if (references.some((reference) => reference.part.length > 0)) {
    const resolved = resolve(model, token.name, { [collection.name]: mode })
    if (resolved.ok) return cssColors(resolved.value) as TokenValue
  }
  const asAlias = (node: unknown): unknown => {
    const reference = referenceOf(node)
    if (reference?.kind === 'ref' && reference.part.length === 0)
      return `{${reference.target.join('.')}}`
    if (Array.isArray(node)) return node.map(asAlias)
    if (isObject(node))
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, asAlias(v)]))
    return node
  }
  return cssShapes(token, cssColors(references.length > 0 ? asAlias(value) : value))
}

/** Parts CSS writes differently: weight keywords as numbers, gradients as colour-stop lists. */
function cssShapes(token: Token, value: unknown): TokenValue {
  const weight = (w: unknown) =>
    typeof w === 'string' && w in FONT_WEIGHT_KEYWORDS ? FONT_WEIGHT_KEYWORDS[w] : w
  if (token.type === 'fontWeight') return weight(value) as TokenValue
  if (token.type === 'typography' && isObject(value))
    return { ...value, fontWeight: weight(value.fontWeight) } as TokenValue
  if (token.type === 'gradient' && Array.isArray(value)) {
    // A colour-stop list: `linear-gradient(to right, var(--brand-gradient))` in CSS.
    return value
      .map((stop) =>
        isObject(stop)
          ? `${String(stop.color)} ${Number((Number(stop.position) * 100).toFixed(2))}%`
          : String(stop),
      )
      .join(', ')
  }
  return value as TokenValue
}

/** Colour objects anywhere in a value as CSS text: hex for sRGB, else oklch(), color(…), … */
function cssColors(node: unknown): unknown {
  if (isObject(node) && 'colorSpace' in node) return formatColor(node as unknown as ColorValue)
  if (Array.isArray(node)) return node.map(cssColors)
  if (isObject(node))
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, cssColors(v)]))
  return node
}

/**
 * Runs Style Dictionary on a token tree and returns what it would write, without writing.
 * `emit` decides which tokens (by origin) end up in the files.
 */
async function format(
  tree: Record<string, unknown>,
  platforms: Record<string, PlatformConfig>,
  outputOf: Readonly<Record<string, OutputFormat>>,
): Promise<OutputFile[]> {
  const dictionary = new StyleDictionary({
    tokens: tree as DesignTokens,
    hooks,
    log: { verbosity: 'silent', errors: { brokenReferences: 'console' } },
    platforms,
  })
  const outputs = (await dictionary.formatAllPlatforms()) as Record<
    string,
    Array<{ output: unknown; destination?: string }>
  >
  return Object.entries(outputs).flatMap(([platform, platformOutputs]) =>
    platformOutputs.map(({ output, destination }) => ({
      path: destination as string,
      content: output as string,
      format: outputOf[platform],
    })),
  )
}

/** One mode of the breakpoint collection: `query` is undefined for the default mode. */
interface BreakpointMode {
  mode: string
  query?: string
}

/**
 * The configured breakpoint collection and its modes, default first, or undefined (with a
 * warning) when the configuration does not fit the tokens. Modes without a query are reported
 * and left out.
 */
function breakpointModes(
  model: TokenModel,
  breakpoints: Breakpoints | undefined,
  into: Diagnostic[],
): { collection: Collection; modes: BreakpointMode[] } | undefined {
  if (!breakpoints) return undefined
  const warn = (code: string, message: string) => into.push({ severity: 'warning', code, message })
  const collection = model.collections.find((c) => c.name === breakpoints.collection)
  if (!collection || collection.modes.length < 2) {
    warn(
      'unknown-breakpoint-collection',
      collection
        ? `The breakpoint collection "${breakpoints.collection}" has one mode only, so no breakpoint CSS was built.`
        : `The breakpoint collection "${breakpoints.collection}" is not in the built tokens, so no breakpoint CSS was built.`,
    )
    return undefined
  }
  if (!collection.modes.includes(breakpoints.default)) {
    warn(
      'unknown-breakpoint-mode',
      `"${breakpoints.default}" (breakpoints.default) is not a mode of "${collection.name}", so no breakpoint CSS was built.`,
    )
    return undefined
  }
  const modes: BreakpointMode[] = [{ mode: breakpoints.default }]
  for (const { mode, query } of breakpoints.media) {
    if (mode === breakpoints.default) continue
    if (!collection.modes.includes(mode)) {
      warn(
        'unknown-breakpoint-mode',
        `"${mode}" (breakpoints.modes) is not a mode of "${collection.name}"; its media query is not used.`,
      )
      continue
    }
    modes.push({ mode, query })
  }
  for (const mode of collection.modes) {
    if (!modes.some((m) => m.mode === mode)) {
      warn(
        'breakpoint-mode-without-query',
        `The mode "${mode}" of "${collection.name}" has no media query in breakpoints.modes, so its tokens are not written.`,
      )
    }
  }
  return { collection, modes }
}

/** `/* ScreenType · Tablet *\/`: names the block that follows in a file. */
const blockComment = (collection: string, mode: string, query?: string) =>
  `/* ${collection} · ${mode}${query === undefined ? ' (default)' : ''} */`.replace(
    /\*\/(?=.)/g,
    '* /',
  )

/** The file headers Style Dictionary (`css/variables`) and the Tailwind v4 formatter write. */
const HEADER =
  /^(\/\*\*\n \* Do not edit directly[^\n]*\n \*\/\n\n|\/\* Auto-generated by [^\n]*\*\/\n)/

/**
 * Adds a block to the file with the same path, after a blank line and a comment naming it; a
 * file that does not exist yet starts with the block (and keeps its header).
 */
function appendBlock(files: OutputFile[], part: OutputFile, comment: string) {
  const header = HEADER.exec(part.content)?.[0] ?? ''
  const body = `${comment}\n${part.content.slice(header.length)}`
  const existing = files.find((f) => f.path === part.path)
  if (existing) existing.content = `${existing.content}\n${body}`
  else files.push({ ...part, content: `${header}${body}` })
}

/** The platforms whose output is one of `formats` (each platform belongs to one output). */
function only(
  platforms: Record<string, PlatformConfig & { output: OutputFormat }>,
  formats: ReadonlySet<OutputFormat>,
): Record<string, PlatformConfig> {
  return Object.fromEntries(
    Object.entries(platforms)
      .filter(([, platform]) => formats.has(platform.output))
      .map(([name, { output: _output, ...platform }]) => [name, platform]),
  )
}

/**
 * Turns a token model into output files (CSS, JS, Tailwind). Nothing is read or written:
 * the caller writes the returned files. Data problems come back as diagnostics.
 *
 * Dangling and circular aliases are errors (`dangling-alias`, `circular-alias`, worded as
 * `dta lint` words them, TICKET-119). The tokens they leave without a value, and every alias that
 * runs into one, are left out of every file, so no file holds a `var()` that points back at
 * itself or an unresolved `{…}`. The other files are still returned (`dta diff` reads the CSS of
 * a base that has such an error); a caller that writes files writes none while there are errors,
 * as `dta build` does.
 */
export async function buildOutputs(
  fullModel: TokenModel,
  options: BuildOptions,
): Promise<BuildResult> {
  const diagnostics: Diagnostic[] = []
  const CSS_DIR = directory(options.css?.outDir, DEFAULT_CSS_DIR, 'css.outDir', diagnostics)
  const TAILWIND_DIR = directory(
    options.tailwind?.outDir,
    DEFAULT_TAILWIND_DIR,
    'tailwind.outDir',
    diagnostics,
  )

  const model: TokenModel = options.collections
    ? { collections: fullModel.collections.filter((c) => options.collections?.includes(c.name)) }
    : fullModel
  for (const name of options.collections ?? []) {
    if (!fullModel.collections.some((c) => c.name === name)) {
      diagnostics.push({
        severity: 'warning',
        code: 'unknown-collection',
        message: `The collection "${name}" does not exist in the tokens.`,
      })
    }
  }

  // Aliases that cannot resolve, in the collections this build reads (the graph is of the whole
  // model, so an alias into a collection left out by `collections` is not counted as dangling).
  const built = new Set(model.collections.map((c) => c.name))
  const { diagnostics: aliasErrors, unresolvable } = aliasProblems(
    analyzeGraph(fullModel),
    (node) => built.has(node.collection),
  )
  diagnostics.push(...aliasErrors)
  const source = (collection: Collection, mode: string) =>
    sourceOf(fullModel, collection, mode, unresolvable)

  const formats = new Set<OutputFormat>(options.formats ?? OUTPUT_FORMATS)
  const formatted = async (
    tree: Record<string, unknown>,
    platforms: Record<string, PlatformConfig & { output: OutputFormat }>,
  ) => {
    const chosen = only(platforms, formats)
    const outputOf = Object.fromEntries(
      Object.entries(platforms).map(([name, platform]) => [name, platform.output]),
    )
    return Object.keys(chosen).length === 0 ? [] : format(tree, chosen, outputOf)
  }

  const singleMode = model.collections.filter((c) => c.modes.length === 1)
  const multiMode = model.collections.filter((c) => c.modes.length > 1)
  const files: OutputFile[] = []
  const breakpoints = breakpointModes(model, options.breakpoints, diagnostics)
  const singleOrigins = new Set(singleMode.map((c) => `${c.name}.${c.modes[0]}`))
  const breakpointOrigin = (mode: string) => `${breakpoints?.collection.name}.${mode}`
  /** The mode a multi-mode collection resolves aliases through where none is chosen. */
  const referenceMode = (c: Collection) =>
    c === breakpoints?.collection
      ? breakpoints.modes[0].mode
      : (c.defaultMode ?? [...c.modes].sort()[0])
  /** Single-mode tokens that alias a breakpoint token (set by the base layer). */
  let responsive = new Set<string>()

  if (singleMode.length > 0) {
    // Base layer: emit the single-mode collections; the first mode (alphabetically) of each
    // multi-mode collection is only there so that aliases into it resolve (the default mode of
    // the breakpoint collection, when one is configured).
    const sources = [
      ...singleMode.map((c) => source(c, c.modes[0])),
      ...multiMode.map((c) => source(c, referenceMode(c))),
    ]
    const merged = mergeSources(sources)
    const emitted = (dotPath: string) => singleOrigins.has(merged.origins.get(dotPath) ?? '')
    // Single-mode tokens whose alias chain reaches a breakpoint token switch with it; Tailwind v4
    // writes non-colour values resolved, so they move to the `@theme inline` block (TICKET-091).
    responsive = breakpoints
      ? aliasesInto(
          merged,
          (origin) => origin === breakpointOrigin(breakpoints.modes[0].mode),
          (origin) => singleOrigins.has(origin),
        )
      : new Set()

    const filter = (token: { path: string[] }) => emitted(token.path.join('.'))

    diagnostics.push(...brokenReferences(merged, emitted))
    files.push(
      ...(await formatted(merged.tree, {
        'css-base': {
          output: 'css',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: CSS_DIR,
          files: [
            {
              destination: 'base.css',
              format: 'css/variables',
              filter,
              options: { selector: ':root', outputReferences: false },
            },
          ],
        },
        css: {
          output: 'css',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: CSS_DIR,
          files: [
            {
              destination: 'variables.css',
              format: 'css/variables',
              filter,
              options: { outputReferences: true },
            },
          ],
        },
        'tailwind-v3': {
          output: 'tailwind-v3',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: TAILWIND_DIR,
          files: [{ destination: 'tailwind.tokens.ts', format: 'tailwind/v3', filter }],
        },
        'tailwind-v4': {
          output: 'tailwind-v4',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: TAILWIND_DIR,
          files: [
            {
              destination: 'tailwind.css',
              format: 'tailwind/v4',
              filter: (token) => filter(token) && !responsive.has(token.path.join('.')),
            },
          ],
        },
        js: {
          output: 'js',
          // Style Dictionary's js group, plus the DTCG 2025.10 shorthands, so composite values
          // are one string like in CSS.
          transforms: JS_TRANSFORMS,
          buildPath: JS_DIR,
          files: [{ destination: 'colorpalette.js', format: 'javascript/es6', filter }],
        },
      })),
    )
  }

  if (breakpoints) {
    // Breakpoint blocks (TICKET-091), after the :root block of variables.css: the default mode
    // on :root, every other mode inside its media query, in the configured order. The other
    // multi-mode collections take part as in the base layer, so aliases into them resolve.
    const { collection } = breakpoints
    for (const { mode, query } of breakpoints.modes) {
      const merged = mergeSources([
        ...singleMode.map((c) => source(c, c.modes[0])),
        ...multiMode.filter((c) => c !== collection).map((c) => source(c, referenceMode(c))),
        source(collection, mode),
      ])
      const origin = breakpointOrigin(mode)
      const emitted = (dotPath: string) => merged.origins.get(dotPath) === origin
      if (![...merged.origins.values()].includes(origin)) continue
      diagnostics.push(...brokenReferences(merged, emitted))
      const filter = (token: { path: string[] }) => emitted(token.path.join('.'))
      const parts = await formatted(merged.tree, {
        'css-breakpoint': {
          output: 'css',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: CSS_DIR,
          files: [
            {
              destination: 'variables.css',
              format: 'css/variables',
              filter,
              options: {
                selector: query === undefined ? ':root' : [`@media ${query}`, ':root'],
                outputReferences: true,
                showFileHeader: false,
              },
            },
          ],
        },
        // Tailwind v4: theme variables that read the switching custom properties (`@theme
        // inline`, so utilities use them where they are applied), from the default mode's names.
        ...(query === undefined
          ? {
              'tailwind-v4-breakpoint': {
                output: 'tailwind-v4' as const,
                transformGroup: CSS_TRANSFORM_GROUP,
                buildPath: TAILWIND_DIR,
                files: [
                  {
                    destination: 'tailwind.css',
                    format: 'tailwind/v4',
                    filter: (token: { path: string[] }) =>
                      filter(token) || responsive.has(token.path.join('.')),
                    options: { inline: true },
                  },
                ],
              },
            }
          : {}),
      })
      for (const part of parts) {
        const comment =
          part.format === 'css'
            ? blockComment(collection.name, mode, query)
            : `/* ${collection.name}: theme variables that switch with the media queries of variables.css */`
        appendBlock(files, part, comment)
      }
    }
  }

  // Themes: one per brand ([data-brand], the brand's mode of every multi-mode collection) and one
  // per context of each resolver modifier no brand names ([data-theme="dark"], TICKET-137).
  const themes: Theme[] = []
  const brandModes = new Set(options.brands ?? [])
  const switchable = multiMode.filter((c) => c !== breakpoints?.collection && !c.axes)
  for (const brand of options.brands ?? []) {
    const collections = switchable.filter((c) => c.modes.includes(brand))
    if (collections.length === 0) {
      diagnostics.push({
        severity: 'warning',
        code: 'unknown-brand',
        message: `"${brand}" is not a mode of any multi-mode collection, so no theme was built for it.`,
      })
      continue
    }
    themes.push({
      stem: brand.toLowerCase(),
      selector: `[data-brand="${brand.toLowerCase()}"]`,
      collections,
      mode: brand,
    })
  }
  /** The theme a context of a resolver modifier is switched by. */
  const contextTheme = (modifier: Collection, context: string): Theme =>
    modifier.modes.some((mode) => brandModes.has(mode))
      ? {
          stem: context.toLowerCase(),
          selector: `[data-brand="${context.toLowerCase()}"]`,
          collections: [],
          mode: context,
        }
      : {
          stem: `${cssVariableName([modifier.name])}-${cssVariableName([context])}`,
          selector: `[data-${cssVariableName([modifier.name])}="${context.toLowerCase()}"]`,
          collections: [modifier],
          mode: context,
        }
  for (const modifier of switchable.filter((c) => c.modifier)) {
    if (modifier.modes.some((mode) => brandModes.has(mode))) continue
    for (const context of modifier.modes) themes.push(contextTheme(modifier, context))
  }

  for (const { stem, selector, collections: brandCollections, mode: brand } of themes) {
    // Theme: emit the brand's mode of every multi-mode collection; the single-mode
    // collections (and the breakpoint collection in a mode) are only there so that aliases into
    // them resolve.
    const brandOrigins = new Set(brandCollections.map((c) => `${c.name}.${brand}`))
    const themeTree = (breakpointMode?: string) =>
      mergeSources([
        ...singleMode.map((c) => source(c, c.modes[0])),
        ...(breakpoints && breakpointMode !== undefined
          ? [source(breakpoints.collection, breakpointMode)]
          : []),
        ...brandCollections.map((c) => source(c, brand)),
      ])
    // The theme CSS also repeats the tokens whose alias chain reaches this brand through
    // single-mode tokens (a component tier, TICKET-093) or breakpoint tokens (TICKET-091), so
    // they follow the nearest [data-brand]. CSS resolves var() where the property is declared.
    const reachesBrand = (merged: MergedTokens, mode?: string) =>
      aliasesInto(
        merged,
        (origin) => brandOrigins.has(origin),
        (origin) =>
          singleOrigins.has(origin) || (mode !== undefined && origin === breakpointOrigin(mode)),
      )
    const trees = (breakpoints?.modes ?? [{ mode: undefined, query: undefined }]).map(
      ({ mode, query }) => {
        const merged = themeTree(mode)
        return { mode, query, merged, dependents: reachesBrand(merged, mode) }
      },
    )
    const merged = trees[0].merged
    const emitted = (dotPath: string) => brandOrigins.has(merged.origins.get(dotPath) ?? '')
    const singleDependents = new Set(
      trees.flatMap(({ merged: tree, dependents }) =>
        [...dependents].filter((p) => singleOrigins.has(tree.origins.get(p) ?? '')),
      ),
    )
    // A breakpoint token that reaches the brand in any mode is repeated in every mode: a theme
    // block without a media query would otherwise hold one mode's value at every width.
    const breakpointDependents = new Set(
      trees.flatMap(({ mode, merged: tree, dependents }) =>
        [...dependents].filter(
          (p) => mode !== undefined && tree.origins.get(p) === breakpointOrigin(mode),
        ),
      ),
    )
    const inTheme = (dotPath: string) => emitted(dotPath) || singleDependents.has(dotPath)

    diagnostics.push(...brokenReferences(merged, emitted))
    const themeBlocks: Array<{ part: OutputFile; comment: string }> = []
    if (breakpoints && breakpointDependents.size > 0) {
      for (const { mode, query, merged: tree } of trees) {
        if (mode === undefined) continue
        const origin = breakpointOrigin(mode)
        const parts = await formatted(tree.tree, {
          'css-theme-breakpoint': {
            output: 'css',
            transformGroup: CSS_TRANSFORM_GROUP,
            buildPath: CSS_DIR,
            files: [
              {
                destination: `themes/${stem}.css`,
                format: 'css/variables',
                filter: (token) => {
                  const dotPath = token.path.join('.')
                  return breakpointDependents.has(dotPath) && tree.origins.get(dotPath) === origin
                },
                options: {
                  selector: query === undefined ? selector : [`@media ${query}`, selector],
                  outputReferences: true,
                },
              },
            ],
          },
        })
        for (const part of parts) {
          themeBlocks.push({
            part,
            comment: blockComment(breakpoints.collection.name, mode, query),
          })
        }
      }
    }
    files.push(
      ...(await formatted(merged.tree, {
        'css-theme': {
          output: 'css',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: CSS_DIR,
          files: [
            {
              destination: `themes/${stem}.css`,
              format: 'css/variables',
              filter: (token) => inTheme(token.path.join('.')),
              options: { selector, outputReferences: true },
            },
          ],
        },
        'tailwind-v3-brand': {
          output: 'tailwind-v3',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: `${TAILWIND_DIR}${stem}/`,
          files: [
            {
              destination: 'tailwind.tokens.ts',
              format: 'tailwind/v3',
              filter: (token) => emitted(token.path.join('.')),
              options: { resolvedValues: true },
            },
          ],
        },
        'tailwind-v4-brand': {
          output: 'tailwind-v4',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: `${TAILWIND_DIR}${stem}/`,
          files: [
            {
              destination: 'tailwind.css',
              format: 'tailwind/v4',
              filter: (token) => emitted(token.path.join('.')),
              options: { resolvedValues: true },
            },
          ],
        },
      })),
    )
    for (const { part, comment } of themeBlocks) appendBlock(files, part, comment)
  }

  if (formats.has('css')) {
    for (const collection of multiMode.filter((c) => c.axes)) {
      const blocks = await combinedCss(collection, {
        model,
        source,
        singleMode,
        multiMode,
        referenceMode,
        singleOrigins,
        unresolvable,
        selectorOf: (axis, context) => {
          const modifier = model.collections.find((c) => c.name === axis)
          return modifier ? contextTheme(modifier, context) : undefined
        },
        formatted,
        cssDir: CSS_DIR,
      })
      for (const block of blocks) appendBlock(files, block.part, block.comment)
    }
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { files, diagnostics: dedupe(diagnostics) }
}

interface CombinedContext {
  model: TokenModel
  source: (collection: Collection, mode: string) => Source
  singleMode: Collection[]
  multiMode: Collection[]
  referenceMode: (collection: Collection) => string
  singleOrigins: ReadonlySet<string>
  unresolvable: ReadonlySet<string>
  selectorOf: (axis: string, context: string) => Theme | undefined
  formatted: (
    tree: Record<string, unknown>,
    platforms: Record<string, PlatformConfig & { output: OutputFormat }>,
  ) => Promise<OutputFile[]>
  cssDir: string
}

/**
 * CSS for the tokens several resolver modifiers change (TICKET-137), so the modifiers combine
 * freely and nest: each token gets a custom property per layer (`--surface-dta-base` from the
 * sets, `--surface-dta-theme` from the theme's context, …) and reads the last one that is set,
 * in resolution order: `--surface: var(--surface-dta-brand, var(--surface-dta-theme, …))`.
 * `:root` (in variables.css) holds the sets' layer; each context's rule (in its theme file) sets
 * its layer (`initial` where the context leaves the token alone, so a nested context resets it)
 * and declares the token again, with the single-mode tokens that alias it, because CSS resolves
 * `var()` where a property is declared.
 */
async function combinedCss(
  collection: Collection,
  context: CombinedContext,
): Promise<Array<{ part: OutputFile; comment: string }>> {
  const axes = collection.axes ?? []
  const tokens = collection.tokens.filter(
    (token) =>
      token.layers &&
      !collection.modes.some((mode) =>
        context.unresolvable.has(`${collection.name}.${mode}/${nameToSlash(token.name)}`),
      ),
  )
  if (tokens.length === 0) return []
  const layerPath = (name: readonly string[], layer: string) => [
    ...name.slice(0, -1),
    `${name[name.length - 1]}-dta-${layer}`,
  ]
  const variable = (path: readonly string[]) => `--${cssVariableName(path)}`

  // One tree for every layer value, with the other tokens there so that aliases resolve.
  const defaultOrigin = `${collection.name}.${context.referenceMode(collection)}`
  const merged = mergeSources([
    ...context.singleMode.map((c) => context.source(c, c.modes[0])),
    ...context.multiMode.map((c) => context.source(c, context.referenceMode(c))),
    {
      origin: 'dta-layers',
      tokens: tokens.flatMap((token) => {
        const layers = token.layers
        if (!layers) return []
        const prepare = (value: TokenValue) =>
          prepareValue(context.model, collection, context.referenceMode(collection), token, value)
        const name = (path: string[]) => ({ ...token, name: path, description: undefined })
        return [
          ...(layers.base !== undefined
            ? [{ token: name(layerPath(token.name, 'base')), value: prepare(layers.base) }]
            : []),
          ...layers.axes.flatMap(({ axis, contexts }) =>
            Object.entries(contexts).map(([ctx, value]) => ({
              token: name(layerPath(token.name, `${axis}-${ctx}`)),
              value: prepare(value),
            })),
          ),
        ]
      }),
    },
  ])
  const dependents = aliasesInto(
    merged,
    (origin) => origin === defaultOrigin,
    (origin) => context.singleOrigins.has(origin),
  )
  const parts = await context.formatted(merged.tree, {
    'css-layers': {
      output: 'css',
      transformGroup: CSS_TRANSFORM_GROUP,
      buildPath: context.cssDir,
      files: [
        {
          destination: 'layers.css',
          format: 'css/variables',
          filter: (token) => {
            const origin = merged.origins.get(token.path.join('.'))
            return origin === 'dta-layers' || dependents.has(token.path.join('.'))
          },
          options: { selector: ':root', outputReferences: true, showFileHeader: false },
        },
      ],
    },
  })
  // `  --name: value;` by name (a declaration of css/variables is one line).
  const declarations = new Map<string, string>()
  for (const line of (parts[0]?.content ?? '').split('\n')) {
    const match = /^\s*(--[a-z0-9-]+):\s.*;/.exec(line)
    if (match) declarations.set(match[1], line.trim())
  }
  const layerVariable = (name: readonly string[], axis: string, ctx: string) =>
    variable(layerPath(name, `${axis}-${ctx}`))
  const slot = (name: readonly string[], layer: string) => variable(layerPath(name, layer))
  const reading = (token: Token) => {
    // The last modifier in resolution order wins, so it is read first.
    const chain = [
      ...(token.layers?.base !== undefined ? [slot(token.name, 'base')] : []),
      ...axes.map((axis) => slot(token.name, axis)),
    ]
    const value = chain.reduce(
      (inner, name) => (inner ? `var(${name}, ${inner})` : `var(${name})`),
      '',
    )
    return `${variable(token.name)}: ${value};`
  }
  const dependentLines = [...dependents]
    .map((dotPath) => declarations.get(variable(dotPath.split('.'))))
    .filter((line): line is string => line !== undefined)
  const rule = (selector: string, lines: string[]) =>
    `${selector} {\n${lines.map((line) => `  ${line}`).join('\n')}\n}\n`
  const dir = context.cssDir.endsWith('/') ? context.cssDir : `${context.cssDir}/`
  const css = (path: string, content: string): OutputFile => ({
    path: `${dir}${path}`,
    content,
    format: 'css',
  })
  const label = collection.name.replace(/\*\//g, '* /')

  const blocks: Array<{ part: OutputFile; comment: string }> = []
  const rootLines = tokens.flatMap((token) => [
    ...(token.layers?.base !== undefined
      ? [
          (declarations.get(slot(token.name, 'base')) ?? '').replace(
            /^--[a-z0-9-]+:/,
            `${slot(token.name, 'base')}:`,
          ),
        ]
      : []),
    reading(token),
  ])
  blocks.push({
    part: css('variables.css', rule(':root', rootLines)),
    comment: `/* ${label}: the sets' values; ${axes.map((a) => `[data-${cssVariableName([a])}]`).join(' and ')} choose the rest */`,
  })
  for (const axis of axes) {
    const modifier = context.model.collections.find((c) => c.name === axis)
    for (const ctx of modifier?.modes ?? []) {
      const theme = context.selectorOf(axis, ctx)
      if (!theme) continue
      const lines = tokens.flatMap((token) => {
        const own = token.layers?.axes.find((layer) => layer.axis === axis)
        const declared =
          own && ctx in own.contexts
            ? declarations.get(layerVariable(token.name, axis, ctx))
            : undefined
        const value = declared ? declared.replace(/^--[a-z0-9-]+:\s*/, '') : 'initial;'
        return [`${slot(token.name, axis)}: ${value}`, reading(token)]
      })
      blocks.push({
        part: css(`themes/${theme.stem}.css`, rule(theme.selector, [...lines, ...dependentLines])),
        comment: `/* ${label}: ${axis} · ${ctx} */`,
      })
    }
  }
  return blocks
}

/** A `[data-…]` theme: the mode of each collection it switches, written to `themes/<stem>.css`. */
interface Theme {
  stem: string
  selector: string
  collections: Collection[]
  mode: string
}

const dedupe = (diagnostics: Diagnostic[]) => [
  ...new Map(diagnostics.map((d) => [`${d.code}|${d.message}|${d.file ?? ''}`, d])).values(),
]
