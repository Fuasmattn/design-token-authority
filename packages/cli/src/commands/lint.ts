import { parseTokenFiles } from '@dta/core'
import { lintTokens } from '@dta/lint'
import type { LintViolation } from '@dta/lint'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { formatDiagnostic, hasErrors } from '../io/diagnostics.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'
import { banner, createUi } from '../ui.js'

/** Same exit code as the legacy CLI: 2 when there are lint errors. */
const EXIT_LINT_ERRORS = 2

function formatViolation(violation: LintViolation): string {
  const icon = violation.severity === 'error' ? pc.red('error') : pc.yellow('warn')
  return `  ${icon} ${violation.message} ${pc.dim(`[${violation.rule}]`)}`
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export async function runLint(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout)
  const config = context.config
  ui.intro(banner('lint'))

  if (context.options.fix) ui.log.info('--fix is not yet supported. No auto-fixes available.')

  let files
  try {
    files = readTokenDir(config?.tokens.dir ?? 'tokens', context.cwd)
  } catch (error) {
    if (error instanceof TokenDirError) {
      ui.log.error(error.message)
      return 1
    }
    throw error
  }

  const spinner = ui.spinner()
  spinner.start('Linting token files…')
  const { model, diagnostics: parseDiagnostics } = parseTokenFiles(files)
  const result = lintTokens(model, config?.lint)
  spinner.stop('Linting complete.')

  const problems = [...parseDiagnostics, ...result.diagnostics]
  for (const diagnostic of problems) {
    ;(diagnostic.severity === 'error' ? ui.log.error : ui.log.warn)(formatDiagnostic(diagnostic))
  }
  if (hasErrors(problems)) {
    ui.outro(pc.red('Lint failed.'))
    return 1
  }

  if (result.violations.length === 0) {
    ui.log.success('No lint violations found.')
    ui.outro('All clean!')
    return 0
  }

  const byFile = new Map<string, LintViolation[]>()
  for (const violation of result.violations) {
    const key = violation.file || '(unknown file)'
    byFile.set(key, [...(byFile.get(key) ?? []), violation])
  }
  for (const [file, violations] of byFile) {
    ui.log.message(pc.bold(file))
    for (const violation of violations) ui.log.message(formatViolation(violation))
  }

  const summary: string[] = []
  if (result.errorCount > 0) summary.push(pc.red(plural(result.errorCount, 'error')))
  if (result.warningCount > 0) summary.push(pc.yellow(plural(result.warningCount, 'warning')))
  ui.log.message(`\n${summary.join(', ')} found.`)

  if (result.errorCount > 0) {
    ui.outro(pc.red('Lint failed.'))
    return EXIT_LINT_ERRORS
  }
  ui.outro(pc.yellow('Lint passed with warnings.'))
  return 0
}
