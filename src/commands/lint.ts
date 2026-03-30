/**
 * TICKET-018: `dta lint` command.
 *
 * Validates token files against built-in and configurable linting rules.
 */

import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import { banner } from '../theme.js'
import { lintTokens, LintResult, LintViolation } from '../linter.js'

export interface LintOptions {
  fix?: boolean
  verbose?: boolean
}

function formatViolation(v: LintViolation): string {
  const icon = v.severity === 'error' ? pc.red('error') : pc.yellow('warn')
  const rule = pc.dim(`[${v.rule}]`)
  return `  ${icon} ${v.message} ${rule}`
}

export async function runLint(config: Config, options: LintOptions): Promise<LintResult> {
  p.intro(banner('lint'))

  const tokensDir = config.tokens?.dir ?? 'tokens'

  const s = p.spinner()
  s.start('Linting token files…')

  const result = lintTokens(tokensDir, config.lint)

  s.stop('Linting complete.')

  if (result.violations.length === 0) {
    p.log.success('No lint violations found.')
    p.outro('All clean!')
    return result
  }

  // Group violations by file
  const byFile = new Map<string, LintViolation[]>()
  for (const v of result.violations) {
    const key = v.file || '(unknown file)'
    const group = byFile.get(key)
    if (group) {
      group.push(v)
    } else {
      byFile.set(key, [v])
    }
  }

  for (const [file, violations] of byFile) {
    p.log.message(pc.bold(file))
    for (const v of violations) {
      p.log.message(formatViolation(v))
    }
  }

  const summary: string[] = []
  if (result.errorCount > 0) {
    summary.push(pc.red(`${result.errorCount} error${result.errorCount === 1 ? '' : 's'}`))
  }
  if (result.warningCount > 0) {
    summary.push(pc.yellow(`${result.warningCount} warning${result.warningCount === 1 ? '' : 's'}`))
  }
  p.log.message(`\n${summary.join(', ')} found.`)

  if (options.fix) {
    p.log.info('--fix is not yet supported. No auto-fixes available.')
  }

  if (result.errorCount > 0) {
    p.outro(pc.red('Lint failed.'))
  } else {
    p.outro(pc.yellow('Lint passed with warnings.'))
  }

  return result
}
