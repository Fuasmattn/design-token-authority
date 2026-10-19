import type { Collection, Diagnostic, TokenModel } from '@dta/core'
import StyleDictionary from 'style-dictionary'
import type { DesignTokens, PlatformConfig } from 'style-dictionary/types'
import { CSS_TRANSFORM_GROUP, hooks } from './transforms.js'
import { brokenReferences, mergeSources } from './tree.js'
import type { Source } from './tree.js'

/**
 * The outputs `buildOutputs` can write, in the order the config reference lists them:
 * CSS custom properties, Tailwind v4 `@theme` CSS, the Tailwind v3 theme object, the JS palette.
 */
export const OUTPUT_FORMATS = ['css', 'tailwind-v4', 'tailwind-v3', 'js'] as const
export type OutputFormat = (typeof OUTPUT_FORMATS)[number]

export interface BuildOptions {
  /** Which outputs to write (default: all of {@link OUTPUT_FORMATS}). */
  formats?: readonly OutputFormat[]
  /** Brands to build themes for: modes of the multi-mode collections. None means no themes. */
  brands?: string[]
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

/** One source per (collection, mode), holding the tokens that have a value in that mode. */
function sourceOf(collection: Collection, mode: string): Source {
  return {
    origin: `${collection.name}.${mode}`,
    tokens: collection.tokens.flatMap((token) =>
      token.values[mode] === undefined ? [] : [{ token, value: token.values[mode] }],
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

  if (singleMode.length > 0) {
    // Base layer: emit the single-mode collections; the first mode (alphabetically) of each
    // multi-mode collection is only there so that aliases into it resolve.
    const sources = [
      ...singleMode.map((c) => sourceOf(c, c.modes[0])),
      ...multiMode.map((c) => sourceOf(c, [...c.modes].sort()[0])),
    ]
    const merged = mergeSources(sources)
    const singleOrigins = new Set(singleMode.map((c) => `${c.name}.${c.modes[0]}`))
    const emitted = (dotPath: string) => singleOrigins.has(merged.origins.get(dotPath) ?? '')

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
          files: [{ destination: 'tailwind.css', format: 'tailwind/v4', filter }],
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

  for (const brand of options.brands ?? []) {
    const modeOf = (c: Collection) => c.modes.find((mode) => mode === brand)
    const brandCollections = multiMode.filter((c) => modeOf(c))
    if (brandCollections.length === 0) {
      diagnostics.push({
        severity: 'warning',
        code: 'unknown-brand',
        message: `"${brand}" is not a mode of any multi-mode collection, so no theme was built for it.`,
      })
      continue
    }

    // Theme: emit the brand's mode of every multi-mode collection; the single-mode
    // collections are only there so that aliases into them resolve.
    const merged = mergeSources([
      ...singleMode.map((c) => sourceOf(c, c.modes[0])),
      ...brandCollections.map((c) => sourceOf(c, brand)),
    ])
    const brandOrigins = new Set(brandCollections.map((c) => `${c.name}.${brand}`))
    const emitted = (dotPath: string) => brandOrigins.has(merged.origins.get(dotPath) ?? '')

    diagnostics.push(...brokenReferences(merged, emitted))
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
              filter: (token) => emitted(token.path.join('.')),
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
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  return { files, diagnostics: dedupe(diagnostics) }
}

const dedupe = (diagnostics: Diagnostic[]) => [
  ...new Map(diagnostics.map((d) => [`${d.code}|${d.message}`, d])).values(),
]
