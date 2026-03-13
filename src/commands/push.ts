/**
 * TICKET-007: `dtf push` command.
 *
 * Pushes local token JSON files to Figma via the Variables API.
 * Wraps the logic previously in sync_tokens_to_figma.ts.
 */

import * as fs from 'fs'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import FigmaApi from '../figma_api.js'
import { generatePostVariablesPayload, readJsonFiles } from '../token_import.js'

export interface PushOptions {
  dryRun?: boolean
  verbose?: boolean
}

export async function runPush(config: Config, options: PushOptions): Promise<void> {
  const tokensDir = config.tokens?.dir ?? 'tokens'

  p.intro(pc.bgCyan(pc.black(' dtf push ')))

  if (!fs.existsSync(tokensDir)) {
    p.log.error(`Tokens directory not found: ${pc.dim(tokensDir)}`)
    p.log.info(`Run ${pc.cyan('dtf pull')} first to export tokens from Figma.`)
    process.exit(2)
  }

  const tokensFiles = fs
    .readdirSync(tokensDir)
    .filter((f: string) => f.endsWith('.json'))
    .map((file: string) => `${tokensDir}/${file}`)

  if (tokensFiles.length === 0) {
    p.log.error(`No token files found in ${pc.dim(tokensDir + '/')}`)
    process.exit(2)
  }

  const tokensByFile = readJsonFiles(tokensFiles)

  if (options.verbose) {
    p.log.message(
      `${pc.dim('Read')} ${tokensFiles.length} token file${tokensFiles.length !== 1 ? 's' : ''} from ${pc.dim(tokensDir + '/')}`,
    )
  }

  const s = p.spinner()
  s.start('Comparing local tokens with Figma...')

  const api = new FigmaApi(config.figma.personalAccessToken)
  const localVariables = await api.getLocalVariables(config.figma.fileKey)
  const payload = generatePostVariablesPayload(tokensByFile, localVariables)

  if (Object.values(payload).every((value) => Array.isArray(value) && value.length === 0)) {
    s.stop('No changes detected')
    p.outro('Tokens are already up to date with the Figma file.')
    return
  }

  // Summary of changes
  const parts = [
    payload.variableCollections?.length
      ? `${pc.bold(String(payload.variableCollections.length))} collection(s)`
      : null,
    payload.variableModes?.length
      ? `${pc.bold(String(payload.variableModes.length))} mode(s)`
      : null,
    payload.variables?.length
      ? `${pc.bold(String(payload.variables.length))} variable(s)`
      : null,
    payload.variableModeValues?.length
      ? `${pc.bold(String(payload.variableModeValues.length))} mode value(s)`
      : null,
  ].filter(Boolean)

  s.stop('Diff computed')
  p.note(parts.join('\n'), 'Changes to push')

  if (options.verbose) {
    if (payload.variableCollections?.length) {
      p.log.message(`${pc.dim('Collections:')} ${JSON.stringify(payload.variableCollections, null, 2)}`)
    }
    if (payload.variableModes?.length) {
      p.log.message(`${pc.dim('Modes:')} ${JSON.stringify(payload.variableModes, null, 2)}`)
    }
    if (payload.variables?.length) {
      p.log.message(`${pc.dim('Variables:')} ${JSON.stringify(payload.variables, null, 2)}`)
    }
    if (payload.variableModeValues?.length) {
      p.log.message(`${pc.dim('Mode values:')} ${JSON.stringify(payload.variableModeValues, null, 2)}`)
    }
  }

  if (options.dryRun) {
    p.outro(`${pc.yellow('Dry run')} — no changes were applied to Figma.`)
    return
  }

  // Confirmation — push modifies the Figma file
  const confirmed = await p.confirm({
    message: 'Push these changes to Figma?',
    initialValue: false,
  })

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Push cancelled.')
    process.exit(0)
  }

  const pushSpinner = p.spinner()
  pushSpinner.start('Pushing tokens to Figma...')

  const apiResp = await api.postVariables(config.figma.fileKey, payload)

  if (options.verbose) {
    pushSpinner.stop('Push complete')
    p.log.message(`${pc.dim('API response:')} ${JSON.stringify(apiResp)}`)
  } else {
    pushSpinner.stop('Push complete')
  }

  p.outro('Figma file has been updated with the new tokens.')
}
