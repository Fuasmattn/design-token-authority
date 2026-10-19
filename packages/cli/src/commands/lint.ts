import { formatDiagnostic, hasErrors, parseTokenFiles } from '@dta/core'
import { groupViolationsByFile, LINT_MESSAGES, lintCounts, lintTokens } from '@dta/lint'
import type { LintViolation } from '@dta/lint'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'
import { banner, createUi } from '../ui.js'

/** Same exit code as the v1 CLI: 2 when there are lint errors. */
const EXIT_LINT_ERRORS = 2

function formatViolation(violation: LintViolation): string {
  const icon = violation.severity === 'error' ? pc.red('error') : pc.yellow('warn')
  return `  ${icon} ${violation.message} ${pc.dim(`[${violation.rule}]`)}`
}

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
    ui.outro(pc.red(LINT_MESSAGES.failed))
    return 1
  }

  if (result.violations.length === 0) {
    ui.log.success(LINT_MESSAGES.clean)
    ui.outro('All clean!')
    return 0
  }

  for (const [file, violations] of groupViolationsByFile(result.violations)) {
    ui.log.message(pc.bold(file))
    for (const violation of violations) ui.log.message(formatViolation(violation))
  }

  const summary = lintCounts(result).map((count) =>
    count.severity === 'error' ? pc.red(count.text) : pc.yellow(count.text),
  )
  ui.log.message(`\n${summary.join(', ')} found.`)

  if (result.errorCount > 0) {
    ui.outro(pc.red(LINT_MESSAGES.failed))
    return EXIT_LINT_ERRORS
  }
  ui.outro(pc.yellow(LINT_MESSAGES.passedWithWarnings))
  return 0
}
