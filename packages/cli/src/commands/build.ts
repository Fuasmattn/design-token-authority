import { buildOutputs, OUTPUT_FORMATS } from '@dta/build'
import type { Breakpoints, OutputFile } from '@dta/build'
import { formatDiagnostic, hasErrors, parseTokenFiles } from '@dta/core'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { ContextConflictError, planContext, writeContext } from '../context/write.js'
import type { Config } from '../config/schema.js'
import { readTokenDir, TokenDirError, tokenParseOptions } from '../io/token-dir.js'
import { writeFiles } from '../io/write-files.js'
import { banner, createUi } from '../ui.js'

const withSlash = (dir: string | undefined, fallback: string) =>
  dir ? `${dir.replace(/\/+$/, '')}/` : fallback

/** Files in the order the build reports them: base, each brand, shared outputs. */
function reportOrder(files: readonly OutputFile[], brands: string[], config: Config | null) {
  const css = withSlash(config?.outputs?.css?.outDir, 'output/css/')
  const tailwind = withSlash(config?.outputs?.tailwind?.outDir, 'output/tailwind/')
  const byPath = new Map(files.map((file) => [file.path, file]))
  const take = (...paths: string[]) => paths.filter((path) => byPath.has(path))

  const base = take(`${css}base.css`)
  // Brands, then the themes of resolver modifiers no brand names (themes/theme-dark.css).
  const slugs = brands.map((brand) => brand.toLowerCase())
  const modifierThemes = files
    .map((file) => file.path.startsWith(`${css}themes/`) && file.path.slice(`${css}themes/`.length))
    .filter((name): name is string => typeof name === 'string' && name.endsWith('.css'))
    .map((name) => name.slice(0, -'.css'.length))
    .filter((slug) => !slugs.includes(slug))
  const perBrand = [...brands, ...modifierThemes].map((brand) => {
    const slug = brand.toLowerCase()
    return {
      brand,
      theme: !brands.includes(brand),
      files: take(
        `${css}themes/${slug}.css`,
        `${tailwind}${slug}/tailwind.tokens.ts`,
        `${tailwind}${slug}/tailwind.css`,
      ),
    }
  })
  const shared = take(
    `${css}variables.css`,
    'output/js/colorpalette.js',
    `${tailwind}tailwind.tokens.ts`,
    `${tailwind}tailwind.css`,
  )
  return { base, perBrand, shared }
}

/** The config's `breakpoints` section as `@dta/build` takes it (modes in the order written). */
export function breakpointOptions(config: Config | null): Breakpoints | undefined {
  const breakpoints = config?.breakpoints
  if (!breakpoints) return undefined
  return {
    collection: breakpoints.collection,
    default: breakpoints.default,
    media: Object.entries(breakpoints.modes).map(([mode, query]) => ({ mode, query })),
  }
}

export async function runBuild(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout)
  const config = context.config
  const tokensDir = config?.tokens.dir ?? 'tokens'
  const brands = config?.brands ?? []
  ui.intro(banner('build'))

  let tokenFiles
  try {
    tokenFiles = readTokenDir(tokensDir, context.cwd)
  } catch (error) {
    if (error instanceof TokenDirError) {
      ui.log.error(error.message)
      return 1
    }
    throw error
  }

  const { model, diagnostics: parseDiagnostics } = parseTokenFiles(
    tokenFiles,
    tokenParseOptions(context.config),
  )
  if (hasErrors(parseDiagnostics)) {
    for (const diagnostic of parseDiagnostics) ui.log.error(formatDiagnostic(diagnostic))
    ui.outro(pc.red('Build failed.'))
    return 1
  }

  if (context.options.verbose) {
    const names = model.collections
      .map((collection) => collection.name)
      .filter((name) => !config?.collections || config.collections.includes(name))
    const outputs = (config?.outputs?.formats ?? OUTPUT_FORMATS).join(', ')
    ui.log.message(
      `${pc.dim('Source:')} ${tokensDir}\n${pc.dim('Outputs:')} ${outputs}\n${pc.dim('Collections:')} ${names.join(', ') || 'none'}\n${pc.dim('Brands:')} ${brands.length ? brands.join(', ') : 'none'}`,
    )
  }

  const { files, diagnostics } = await buildOutputs(model, {
    formats: config?.outputs?.formats,
    brands,
    breakpoints: breakpointOptions(config),
    collections: config?.collections,
    css: { outDir: config?.outputs?.css?.outDir },
    tailwind: { outDir: config?.outputs?.tailwind?.outDir },
  })
  const problems = [...parseDiagnostics, ...diagnostics]
  for (const diagnostic of problems) {
    ;(diagnostic.severity === 'error' ? ui.log.error : ui.log.warn)(formatDiagnostic(diagnostic))
  }
  if (hasErrors(problems)) {
    // All or nothing (TICKET-119): a folder with some files rebuilt and others left from an
    // earlier build would look fine and be wrong, so nothing is written until the errors are fixed.
    ui.log.message('Nothing was written: fix the errors above and build again.')
    ui.outro(pc.red('Build failed.'))
    return 1
  }

  writeFiles(context.cwd, files)

  // The package builds everything in one go; the steps are reported in the v1 order.
  const order = reportOrder(files, brands, config)
  const step = (start: string, done: string) => {
    const spinner = ui.spinner()
    spinner.start(start)
    spinner.stop(done)
  }
  if (order.base.length > 0) step('Building base layer...', 'Base layer complete')
  for (const { brand, theme, files: brandFiles } of order.perBrand) {
    if (brandFiles.length === 0) continue
    if (theme) step(`Building theme: ${brand}...`, `Theme ${brand} complete`)
    else step(`Building brand: ${brand}...`, `Brand ${brand} complete`)
  }
  if (order.shared.length > 0) step('Building shared outputs...', 'Shared outputs complete')

  const generated = [
    ...order.base,
    ...order.perBrand.flatMap((entry) => entry.files),
    ...order.shared,
  ]
  if (config?.context) {
    try {
      const plan = planContext(context.cwd, model, config, config.context.out)
      generated.push(...writeContext(context.cwd, plan))
    } catch (error) {
      if (!(error instanceof ContextConflictError)) throw error
      ui.log.error(error.message)
      ui.outro(pc.red('Build failed.'))
      return 1
    }
  }
  ui.note(generated.map((path) => pc.dim(path)).join('\n'), 'Generated files')
  ui.outro(pc.green('Build complete!'))
  return 0
}
