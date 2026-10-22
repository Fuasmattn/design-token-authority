import { aliasProblems, analyzeGraph, nameToDot, nameToSlash } from '@dta/core'
import type { Collection, Diagnostic, TokenModel } from '@dta/core'
import StyleDictionary from 'style-dictionary'
import type { DesignTokens, PlatformConfig } from 'style-dictionary/types'
import { CSS_TRANSFORM_GROUP, hooks } from './transforms.js'
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

/** The token types the build writes so far (Figma's variable types). */
const BUILT_TYPES: ReadonlySet<string> = new Set(['color', 'number', 'string', 'boolean'])

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
function sourceOf(collection: Collection, mode: string, skip: ReadonlySet<string>): Source {
  const origin = `${collection.name}.${mode}`
  return {
    origin,
    tokens: collection.tokens.flatMap((token) =>
      token.values[mode] === undefined || skip.has(`${origin}/${nameToSlash(token.name)}`)
        ? []
        : [{ token, value: token.values[mode] }],
    ),
  }
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

  const chosen: TokenModel = options.collections
    ? { collections: fullModel.collections.filter((c) => options.collections?.includes(c.name)) }
    : fullModel
  // DTCG types beyond Figma's four are read and checked, but not built yet: leave them out
  // with one warning instead of writing values Style Dictionary 4 cannot format.
  const notBuilt = new Map<string, string[]>()
  const model: TokenModel = {
    collections: chosen.collections.map((collection) => ({
      ...collection,
      tokens: collection.tokens.filter((token) => {
        if (BUILT_TYPES.has(token.type)) return true
        notBuilt.set(token.type, [...(notBuilt.get(token.type) ?? []), nameToDot(token.name)])
        return false
      }),
    })),
  }
  if (notBuilt.size > 0) {
    const count = [...notBuilt.values()].reduce((sum, names) => sum + names.length, 0)
    const types = [...notBuilt.keys()].sort().join(', ')
    diagnostics.push({
      severity: 'warning',
      code: 'not-built-yet',
      message: `${count} token${count === 1 ? '' : 's'} of type ${types} ${count === 1 ? 'is' : 'are'} not in the output yet: dta build writes color, number, string and boolean tokens so far.`,
    })
  }
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
  const source = (collection: Collection, mode: string) => sourceOf(collection, mode, unresolvable)

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
    c === breakpoints?.collection ? breakpoints.modes[0].mode : [...c.modes].sort()[0]
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
          transformGroup: 'js',
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

  for (const brand of options.brands ?? []) {
    const modeOf = (c: Collection) => c.modes.find((mode) => mode === brand)
    const brandCollections = multiMode.filter((c) => modeOf(c) && c !== breakpoints?.collection)
    if (brandCollections.length === 0) {
      diagnostics.push({
        severity: 'warning',
        code: 'unknown-brand',
        message: `"${brand}" is not a mode of any multi-mode collection, so no theme was built for it.`,
      })
      continue
    }

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
    const selector = `[data-brand="${brand.toLowerCase()}"]`
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
                destination: `themes/${brand.toLowerCase()}.css`,
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
              destination: `themes/${brand.toLowerCase()}.css`,
              format: 'css/variables',
              filter: (token) => inTheme(token.path.join('.')),
              options: {
                selector: `[data-brand="${brand.toLowerCase()}"]`,
                outputReferences: true,
              },
            },
          ],
        },
        'tailwind-v3-brand': {
          output: 'tailwind-v3',
          transformGroup: CSS_TRANSFORM_GROUP,
          buildPath: `${TAILWIND_DIR}${brand.toLowerCase()}/`,
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
          buildPath: `${TAILWIND_DIR}${brand.toLowerCase()}/`,
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

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { files, diagnostics: dedupe(diagnostics) }
}

const dedupe = (diagnostics: Diagnostic[]) => [
  ...new Map(diagnostics.map((d) => [`${d.code}|${d.message}|${d.file ?? ''}`, d])).values(),
]
