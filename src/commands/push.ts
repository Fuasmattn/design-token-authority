/**
 * TICKET-007: `dtf push` command.
 *
 * Pushes local token JSON files to Figma via the Variables API.
 * Wraps the logic previously in sync_tokens_to_figma.ts.
 */

import * as fs from 'fs'
import * as readline from 'readline'
import { Config } from '../config/index.js'
import FigmaApi from '../figma_api.js'
import { generatePostVariablesPayload, readJsonFiles } from '../token_import.js'
import { green, brightRed } from '../utils.js'

export interface PushOptions {
  dryRun?: boolean
  verbose?: boolean
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

export async function runPush(config: Config, options: PushOptions): Promise<void> {
  const tokensDir = config.tokens?.dir ?? 'tokens'

  if (!fs.existsSync(tokensDir)) {
    console.error(brightRed(`Tokens directory not found: ${tokensDir}`))
    console.error('Run "dtf pull" first to export tokens from Figma.')
    process.exit(2)
  }

  const tokensFiles = fs
    .readdirSync(tokensDir)
    .filter((f: string) => f.endsWith('.json'))
    .map((file: string) => `${tokensDir}/${file}`)

  if (tokensFiles.length === 0) {
    console.error(brightRed(`No token files found in ${tokensDir}/`))
    process.exit(2)
  }

  const tokensByFile = readJsonFiles(tokensFiles)

  if (options.verbose) {
    console.log('Read token files:', Object.keys(tokensByFile))
  }

  const api = new FigmaApi(config.figma.personalAccessToken)
  const localVariables = await api.getLocalVariables(config.figma.fileKey)

  const payload = generatePostVariablesPayload(tokensByFile, localVariables)

  if (Object.values(payload).every((value) => Array.isArray(value) && value.length === 0)) {
    console.log(green('Tokens are already up to date with the Figma file.'))
    return
  }

  // Summary of changes
  const summary = [
    payload.variableCollections?.length
      ? `${payload.variableCollections.length} collection(s)`
      : null,
    payload.variableModes?.length ? `${payload.variableModes.length} mode(s)` : null,
    payload.variables?.length ? `${payload.variables.length} variable(s)` : null,
    payload.variableModeValues?.length
      ? `${payload.variableModeValues.length} mode value(s)`
      : null,
  ]
    .filter(Boolean)
    .join(', ')

  console.log(`\nChanges to push: ${summary}`)

  if (options.verbose) {
    if (payload.variableCollections?.length) {
      console.log('\nCollections:', JSON.stringify(payload.variableCollections, null, 2))
    }
    if (payload.variableModes?.length) {
      console.log('\nModes:', JSON.stringify(payload.variableModes, null, 2))
    }
    if (payload.variables?.length) {
      console.log('\nVariables:', JSON.stringify(payload.variables, null, 2))
    }
    if (payload.variableModeValues?.length) {
      console.log('\nMode values:', JSON.stringify(payload.variableModeValues, null, 2))
    }
  }

  if (options.dryRun) {
    console.log(green('\n[dry-run] No changes were applied to Figma.'))
    return
  }

  // Confirmation — push modifies the Figma file
  const confirmed = await confirm('\nAre you sure you want to push these changes to Figma? (y/N) ')
  if (!confirmed) {
    console.log('Push cancelled.')
    return
  }

  const apiResp = await api.postVariables(config.figma.fileKey, payload)

  if (options.verbose) {
    console.log('API response:', apiResp)
  }

  console.log(green('\nFigma file has been updated with the new tokens.'))
}
