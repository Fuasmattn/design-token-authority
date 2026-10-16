import { parseTokenFiles } from '@dta/core'
import { planPush } from '@dta/figma'
import { lintTokens } from '@dta/lint'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { describeFigmaError, figmaClientFor } from '../figma-client.js'
import { formatDiagnostic, hasErrors } from '../io/diagnostics.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'
import { banner, cmd, createUi, filePath } from '../ui.js'
import {
  buildDiffReport,
  formatConsole,
  formatJson,
  formatMarkdown,
  type DiffFormat,
} from './push-report.js'

const EXIT_BAD_INPUT = 2
const CONFIRMATION_PHRASE = 'push variables to figma'
const FORMATS: readonly DiffFormat[] = ['console', 'markdown', 'json']

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export async function runPush(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout, context.input)
  const config = context.config
  const options = context.options
  const tokensDir = config?.tokens.dir ?? 'tokens'
  const requested = String(options.format ?? 'console')
  ui.intro(banner('push'))

  if (!FORMATS.includes(requested as DiffFormat)) {
    ui.log.error(`Unknown format "${requested}". Use one of: ${FORMATS.join(', ')}.`)
    return 1
  }
  const format = requested as DiffFormat

  let files
  try {
    files = readTokenDir(tokensDir, context.cwd)
  } catch (error) {
    if (!(error instanceof TokenDirError)) throw error
    ui.log.error(`Tokens directory not found: ${pc.dim(tokensDir)}`)
    ui.log.info(`Run ${cmd('pull')} first to export tokens from Figma.`)
    return EXIT_BAD_INPUT
  }
  if (files.length === 0) {
    ui.log.error(`No token files found in ${filePath(tokensDir + '/')}`)
    return EXIT_BAD_INPUT
  }

  const { model, diagnostics: parseDiagnostics } = parseTokenFiles(files)
  if (hasErrors(parseDiagnostics)) {
    for (const diagnostic of parseDiagnostics) ui.log.error(formatDiagnostic(diagnostic))
    return 1
  }

  if (!options.skipLint) {
    const lint = lintTokens(model, config?.lint)
    if (lint.warningCount > 0) {
      ui.log.warn(`${plural(lint.warningCount, 'lint warning')} found.`)
    }
    if (lint.errorCount > 0 || hasErrors(lint.diagnostics)) {
      for (const violation of lint.violations.filter((v) => v.severity === 'error')) {
        ui.log.error(`[${violation.rule}] ${violation.message}`)
      }
      for (const diagnostic of lint.diagnostics) ui.log.error(formatDiagnostic(diagnostic))
      ui.log.error(
        `${plural(lint.errorCount, 'lint error')} found. Fix them or use ${pc.cyan('--skip-lint')} to bypass.`,
      )
      return EXIT_BAD_INPUT
    }
  }

  if (options.verbose) {
    ui.log.message(
      `${pc.dim('Read')} ${plural(files.length, 'token file')} from ${pc.dim(tokensDir + '/')}`,
    )
  }

  const spinner = ui.spinner()
  spinner.start('Comparing local tokens with Figma...')

  const figma = config?.figma
  if (!figma?.personalAccessToken || !figma.fileKey) {
    ui.log.error('Figma API credentials are required for push.')
    return EXIT_BAD_INPUT
  }

  const client = figmaClientFor(figma.personalAccessToken)
  let plan
  try {
    plan = planPush(model, await client.getLocalVariables(figma.fileKey))
  } catch (error) {
    spinner.stop('Could not fetch variables from Figma')
    const message = describeFigmaError(error)
    if (message === null) throw error
    ui.log.error(message)
    return 1
  }

  if (hasErrors(plan.diagnostics)) {
    spinner.stop('Push blocked')
    for (const diagnostic of plan.diagnostics) {
      ;(diagnostic.severity === 'error' ? ui.log.error : ui.log.warn)(formatDiagnostic(diagnostic))
    }
    return 1
  }

  const payload = plan.payload
  if (payload === null) {
    spinner.stop('No changes detected')
    ui.outro('Tokens are already up to date with the Figma file.')
    return 0
  }
  spinner.stop('Diff computed')

  const report = buildDiffReport(payload)
  if (format === 'json') context.stdout(formatJson(report) + '\n')
  else if (format === 'markdown') context.stdout(formatMarkdown(report) + '\n')
  else ui.log.message(formatConsole(report))

  if (options.verbose) {
    const sections: Array<[string, unknown[] | undefined]> = [
      ['Collections:', payload.variableCollections],
      ['Modes:', payload.variableModes],
      ['Variables:', payload.variables],
      ['Mode values:', payload.variableModeValues],
    ]
    for (const [label, items] of sections) {
      if (items?.length) ui.log.message(`${pc.dim(label)} ${JSON.stringify(items, null, 2)}`)
    }
  }

  if (options.dryRun) {
    ui.outro(`${pc.yellow('Dry run')} — no changes were applied to Figma.`)
    return 0
  }

  // Pushing changes the Figma file, so it needs an explicit, typed confirmation.
  if (!(options.yes || config?.push?.skipConfirmation === true)) {
    ui.log.warn(
      `This will modify variables in the Figma file. To confirm, type: ${pc.bold(pc.cyan(CONFIRMATION_PHRASE))}`,
    )
    const answer = await ui.text({
      message: 'Confirm push:',
      placeholder: CONFIRMATION_PHRASE,
      validate: (value) =>
        !value || value.trim().toLowerCase() !== CONFIRMATION_PHRASE
          ? `Type "${CONFIRMATION_PHRASE}" to confirm, or press Ctrl+C to cancel.`
          : undefined,
    })
    if (answer === null) {
      ui.cancel('Push cancelled.')
      return 0
    }
  }

  const pushSpinner = ui.spinner()
  pushSpinner.start('Pushing tokens to Figma...')
  let response
  try {
    response = await client.postVariables(figma.fileKey, payload)
  } catch (error) {
    pushSpinner.stop('Push failed')
    const message = describeFigmaError(error)
    if (message === null) throw error
    ui.log.error(message)
    return 1
  }
  pushSpinner.stop('Push complete')
  if (options.verbose) ui.log.message(`${pc.dim('API response:')} ${JSON.stringify(response)}`)

  ui.outro('Figma file has been updated with the new tokens.')
  return 0
}
