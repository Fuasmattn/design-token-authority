import { buildOutputs } from '@dta/build'
import type { OutputFile } from '@dta/build'
import { parseTokenFiles } from '@dta/core'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import type { Config } from '../config/schema.js'
import { formatDiagnostic, hasErrors } from '../io/diagnostics.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'
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
  const perBrand = brands.map((brand) => {
    const slug = brand.toLowerCase()
    return {
      brand,
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

  const { model, diagnostics: parseDiagnostics } = parseTokenFiles(tokenFiles)
  if (hasErrors(parseDiagnostics)) {
    for (const diagnostic of parseDiagnostics) ui.log.error(formatDiagnostic(diagnostic))
    ui.outro(pc.red('Build failed.'))
    return 1
  }

  if (context.options.verbose) {
    const names = model.collections
      .map((collection) => collection.name)
      .filter((name) => !config?.collections || config.collections.includes(name))
    const outputs = config?.outputs ? Object.keys(config.outputs).join(', ') : 'default'
    ui.log.message(
      `${pc.dim('Source:')} ${tokensDir}\n${pc.dim('Outputs:')} ${outputs}\n${pc.dim('Collections:')} ${names.join(', ') || 'none'}\n${pc.dim('Brands:')} ${brands.length ? brands.join(', ') : 'none'}`,
    )
  }

  const { files, diagnostics } = await buildOutputs(model, {
    brands,
    collections: config?.collections,
    css: { outDir: config?.outputs?.css?.outDir },
    tailwind: { outDir: config?.outputs?.tailwind?.outDir },
  })
  const problems = [...parseDiagnostics, ...diagnostics]
  for (const diagnostic of problems) {
    ;(diagnostic.severity === 'error' ? ui.log.error : ui.log.warn)(formatDiagnostic(diagnostic))
  }
  if (hasErrors(problems)) {
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
  for (const { brand, files: brandFiles } of order.perBrand) {
    if (brandFiles.length > 0) step(`Building brand: ${brand}...`, `Brand ${brand} complete`)
  }
  if (order.shared.length > 0) step('Building shared outputs...', 'Shared outputs complete')

  const generated = [
    ...order.base,
    ...order.perBrand.flatMap((entry) => entry.files),
    ...order.shared,
  ]
  ui.note(generated.map((path) => pc.dim(path)).join('\n'), 'Generated files')
  ui.outro(pc.green('Build complete!'))
  return 0
}
