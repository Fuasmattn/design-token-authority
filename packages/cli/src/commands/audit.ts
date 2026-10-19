import fs from 'node:fs'
import path from 'node:path'
import { formatDiagnostic, hasErrors, parseTokenFiles } from '@dta/core'
import {
  auditFiles,
  auditProject,
  baselineOf,
  BaselineError,
  DEFAULT_AUDIT_PATHS,
  DEFAULT_BASELINE,
  formatConsole,
  formatJson,
  formatMarkdown,
  newFindings,
  readBaseline,
} from '../audit/audit.js'
import type { CommandContext } from '../commands.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'

/** Invalid input: token files, options, the baseline. */
const EXIT_INVALID = 2
const FORMATS = ['console', 'markdown', 'json'] as const

export async function runAudit(context: CommandContext): Promise<number> {
  const config = context.config
  const format = String(context.options.format ?? 'console')
  if (!(FORMATS as readonly string[]).includes(format)) {
    context.stderr(`Unknown format "${format}". Use one of: ${FORMATS.join(', ')}.\n`)
    return EXIT_INVALID
  }

  let tokenFiles
  try {
    tokenFiles = readTokenDir(config?.tokens.dir ?? 'tokens', context.cwd)
  } catch (error) {
    if (error instanceof TokenDirError) {
      context.stderr(`${error.message}\n`)
      return EXIT_INVALID
    }
    throw error
  }
  const { model, diagnostics } = parseTokenFiles(tokenFiles)
  if (hasErrors(diagnostics)) {
    for (const diagnostic of diagnostics) context.stderr(`${formatDiagnostic(diagnostic)}\n`)
    return EXIT_INVALID
  }

  const audit = config?.audit
  const paths = context.args.length > 0 ? context.args : (audit?.paths ?? DEFAULT_AUDIT_PATHS)
  const missing = paths.filter((entry) => !fs.existsSync(path.resolve(context.cwd, entry)))
  if (missing.length > 0) {
    context.stderr(`Not found: ${missing.join(', ')}.\n`)
    return EXIT_INVALID
  }
  // The generated outputs and the token files are never findings.
  const skip = [
    config?.tokens.dir ?? 'tokens',
    config?.outputs?.css?.outDir ?? 'output/css',
    config?.outputs?.tailwind?.outDir ?? 'output/tailwind',
    config?.outputs?.ios?.outDir,
    config?.outputs?.android?.outDir,
    'output/js',
  ].filter((dir): dir is string => Boolean(dir))
  const files = auditFiles(context.cwd, paths, {
    ...(audit?.ignore ? { ignore: audit.ignore } : {}),
    ...(audit?.languages ? { languages: audit.languages } : {}),
    skip,
  })
  const near = Boolean(context.options.near ?? audit?.near)
  const findings = auditProject(context.cwd, files, model, config, { near })

  const baselineFile = path.resolve(
    context.cwd,
    String(context.options.baseline ?? audit?.baseline ?? DEFAULT_BASELINE),
  )
  const shownBaseline = path.relative(context.cwd, baselineFile).split(path.sep).join('/')
  if (context.options.updateBaseline) {
    fs.mkdirSync(path.dirname(baselineFile), { recursive: true })
    fs.writeFileSync(baselineFile, `${JSON.stringify(baselineOf(findings), null, 2)}\n`)
    context.stdout(
      `Wrote ${shownBaseline} with ${findings.length} finding${findings.length === 1 ? '' : 's'}. Later runs report only new ones.\n`,
    )
    return 0
  }

  let baseline
  try {
    baseline = readBaseline(baselineFile)
  } catch (error) {
    if (error instanceof BaselineError) {
      context.stderr(`${error.message}\n`)
      return EXIT_INVALID
    }
    throw error
  }
  const fresh = newFindings(findings, baseline)
  const summary = {
    findings: fresh,
    baselined: findings.length - fresh.length,
    files: files.length,
  }
  const output =
    format === 'json'
      ? formatJson(summary)
      : format === 'markdown'
        ? formatMarkdown(summary)
        : formatConsole(summary)
  context.stdout(output)
  return fresh.length > 0 ? 1 : 0
}
