/**
 * TICKET-007 / TICKET-020: `dtf push` command.
 *
 * Pushes local token JSON files to Figma via the Variables API.
 * Produces a structured diff report in console, markdown, or JSON format.
 */

import * as fs from 'fs'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import FigmaApi from '../figma_api.js'
import { lintTokens } from '../linter.js'
import { generatePostVariablesPayload, readJsonFiles } from '../token_import.js'
import type { PostVariablesRequestBody } from '@figma/rest-api-spec'

export type DiffFormat = 'console' | 'markdown' | 'json'

export interface PushOptions {
  dryRun?: boolean
  verbose?: boolean
  format?: DiffFormat
  skipLint?: boolean
}

interface DiffEntry {
  action: 'added' | 'modified'
  path: string
  collection: string
  mode?: string
  oldValue?: string
  newValue?: string
}

interface DiffReport {
  summary: { added: number; modified: number }
  collections: Array<{ action: string; name: string }>
  modes: Array<{ action: string; name: string; collection: string }>
  changes: DiffEntry[]
}

/**
 * Build a structured diff report from the Figma POST payload.
 */
function buildDiffReport(payload: PostVariablesRequestBody): DiffReport {
  const report: DiffReport = {
    summary: { added: 0, modified: 0 },
    collections: [],
    modes: [],
    changes: [],
  }

  for (const coll of payload.variableCollections ?? []) {
    if (coll.action === 'CREATE') {
      report.collections.push({ action: 'added', name: coll.name ?? coll.id })
    }
  }

  for (const mode of payload.variableModes ?? []) {
    if (mode.action === 'DELETE') continue
    report.modes.push({
      action: mode.action === 'CREATE' ? 'added' : 'renamed',
      name: ('name' in mode && mode.name) || mode.id || '(unnamed)',
      collection: 'variableCollectionId' in mode ? String(mode.variableCollectionId) : '',
    })
  }

  for (const variable of payload.variables ?? []) {
    if (variable.action === 'CREATE' && 'name' in variable) {
      report.summary.added++
      report.changes.push({
        action: 'added',
        path: variable.name!,
        collection: 'variableCollectionId' in variable ? String(variable.variableCollectionId) : '',
      })
    } else if (variable.action === 'UPDATE') {
      report.summary.modified++
      const updates: string[] = []
      if ('description' in variable && variable.description !== undefined)
        updates.push('description')
      if ('hiddenFromPublishing' in variable) updates.push('visibility')
      if ('scopes' in variable) updates.push('scopes')
      if ('codeSyntax' in variable) updates.push('codeSyntax')
      report.changes.push({
        action: 'modified',
        path: variable.id,
        collection: '',
        newValue: updates.length > 0 ? updates.join(', ') : 'properties',
      })
    }
  }

  // Count value changes that aren't already tracked as added variables
  const addedPaths = new Set(report.changes.filter((c) => c.action === 'added').map((c) => c.path))
  const valueChangeCount = (payload.variableModeValues ?? []).filter(
    (v) => !addedPaths.has(v.variableId),
  ).length

  // Add value-only modifications (variables whose values changed but metadata didn't)
  if (valueChangeCount > 0) {
    const modifiedPaths = new Set(
      report.changes.filter((c) => c.action === 'modified').map((c) => c.path),
    )
    for (const mv of payload.variableModeValues ?? []) {
      if (addedPaths.has(mv.variableId)) continue
      if (modifiedPaths.has(mv.variableId)) continue
      report.summary.modified++
      const valueStr =
        typeof mv.value === 'object' && mv.value !== null
          ? 'type' in mv.value && mv.value.type === 'VARIABLE_ALIAS'
            ? `alias(${mv.value.id})`
            : JSON.stringify(mv.value)
          : String(mv.value)
      report.changes.push({
        action: 'modified',
        path: mv.variableId,
        collection: '',
        mode: mv.modeId,
        newValue: valueStr,
      })
    }
  }

  return report
}

/**
 * Format the diff report for console output (colored).
 */
function formatConsole(report: DiffReport): string {
  const lines: string[] = []

  // Summary
  const parts: string[] = []
  if (report.summary.added > 0) parts.push(pc.green(`+${report.summary.added} added`))
  if (report.summary.modified > 0) parts.push(pc.yellow(`~${report.summary.modified} modified`))
  if (parts.length === 0) parts.push(pc.dim('no changes'))
  lines.push(`${pc.bold('Summary:')} ${parts.join(', ')}`)
  lines.push('')

  // Collections
  if (report.collections.length > 0) {
    lines.push(pc.bold('New collections:'))
    for (const c of report.collections) {
      lines.push(`  ${pc.green('+')} ${c.name}`)
    }
    lines.push('')
  }

  // Modes
  const newModes = report.modes.filter((m) => m.action === 'added')
  if (newModes.length > 0) {
    lines.push(pc.bold('New modes:'))
    for (const m of newModes) {
      lines.push(`  ${pc.green('+')} ${m.name} ${pc.dim(`(${m.collection})`)}`)
    }
    lines.push('')
  }

  // Added variables
  const added = report.changes.filter((c) => c.action === 'added')
  if (added.length > 0) {
    lines.push(pc.bold(pc.green(`Added (${added.length}):`)))
    for (const c of added) {
      lines.push(`  ${pc.green('+')} ${c.path} ${pc.dim(`[${c.collection}]`)}`)
    }
    lines.push('')
  }

  // Modified variables
  const modified = report.changes.filter((c) => c.action === 'modified')
  if (modified.length > 0) {
    lines.push(pc.bold(pc.yellow(`Modified (${modified.length}):`)))
    for (const c of modified) {
      const detail = c.newValue ? pc.dim(` → ${c.newValue}`) : ''
      const mode = c.mode ? pc.dim(` (${c.mode})`) : ''
      lines.push(`  ${pc.yellow('~')} ${c.path}${mode}${detail}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format the diff report as GitHub-flavored markdown (for PR comments).
 */
function formatMarkdown(report: DiffReport): string {
  const lines: string[] = []

  lines.push('## Design Token Changes')
  lines.push('')

  const parts: string[] = []
  if (report.summary.added > 0) parts.push(`**+${report.summary.added}** added`)
  if (report.summary.modified > 0) parts.push(`**~${report.summary.modified}** modified`)
  if (parts.length === 0) parts.push('no changes')
  lines.push(`**Summary:** ${parts.join(', ')}`)
  lines.push('')

  if (report.collections.length > 0) {
    lines.push('### New Collections')
    lines.push('')
    for (const c of report.collections) {
      lines.push(`- \`${c.name}\``)
    }
    lines.push('')
  }

  const added = report.changes.filter((c) => c.action === 'added')
  if (added.length > 0) {
    lines.push('### Added')
    lines.push('')
    lines.push('| Token | Collection |')
    lines.push('|---|---|')
    for (const c of added) {
      lines.push(`| \`${c.path}\` | ${c.collection} |`)
    }
    lines.push('')
  }

  const modified = report.changes.filter((c) => c.action === 'modified')
  if (modified.length > 0) {
    lines.push('### Modified')
    lines.push('')
    lines.push('| Token | Detail |')
    lines.push('|---|---|')
    for (const c of modified) {
      const detail = [c.newValue, c.mode].filter(Boolean).join(' ')
      lines.push(`| \`${c.path}\` | ${detail || 'properties updated'} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Format the diff report as JSON (for tooling).
 */
function formatJson(report: DiffReport): string {
  return JSON.stringify(report, null, 2)
}

export async function runPush(config: Config, options: PushOptions): Promise<void> {
  const tokensDir = config.tokens?.dir ?? 'tokens'
  const format: DiffFormat = options.format ?? 'console'

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

  // Run lint check before push (unless skipped)
  if (!options.skipLint) {
    const lintResult = lintTokens(tokensDir, config.lint)

    if (lintResult.warningCount > 0) {
      p.log.warn(
        `${lintResult.warningCount} lint warning${lintResult.warningCount === 1 ? '' : 's'} found.`,
      )
    }

    if (lintResult.errorCount > 0) {
      for (const v of lintResult.violations.filter((v) => v.severity === 'error')) {
        p.log.error(`[${v.rule}] ${v.message}`)
      }
      p.log.error(
        `${lintResult.errorCount} lint error${lintResult.errorCount === 1 ? '' : 's'} found. Fix them or use ${pc.cyan('--skip-lint')} to bypass.`,
      )
      process.exit(2)
    }
  }

  const tokensByFile = readJsonFiles(tokensFiles)

  if (options.verbose) {
    p.log.message(
      `${pc.dim('Read')} ${tokensFiles.length} token file${tokensFiles.length !== 1 ? 's' : ''} from ${pc.dim(tokensDir + '/')}`,
    )
  }

  const s = p.spinner()
  s.start('Comparing local tokens with Figma...')

  if (!config.figma.personalAccessToken || !config.figma.fileKey) {
    p.log.error('Figma API credentials are required for push.')
    process.exit(2)
  }

  const api = new FigmaApi(config.figma.personalAccessToken)
  const localVariables = await api.getLocalVariables(config.figma.fileKey)
  const payload = generatePostVariablesPayload(tokensByFile, localVariables)

  if (Object.values(payload).every((value) => Array.isArray(value) && value.length === 0)) {
    s.stop('No changes detected')
    p.outro('Tokens are already up to date with the Figma file.')
    return
  }

  s.stop('Diff computed')

  // Build and output structured diff report
  const report = buildDiffReport(payload)

  if (format === 'json') {
    console.log(formatJson(report))
  } else if (format === 'markdown') {
    console.log(formatMarkdown(report))
  } else {
    p.log.message(formatConsole(report))
  }

  if (options.verbose) {
    if (payload.variableCollections?.length) {
      p.log.message(
        `${pc.dim('Collections:')} ${JSON.stringify(payload.variableCollections, null, 2)}`,
      )
    }
    if (payload.variableModes?.length) {
      p.log.message(`${pc.dim('Modes:')} ${JSON.stringify(payload.variableModes, null, 2)}`)
    }
    if (payload.variables?.length) {
      p.log.message(`${pc.dim('Variables:')} ${JSON.stringify(payload.variables, null, 2)}`)
    }
    if (payload.variableModeValues?.length) {
      p.log.message(
        `${pc.dim('Mode values:')} ${JSON.stringify(payload.variableModeValues, null, 2)}`,
      )
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

  const apiResp = await api.postVariables(config.figma.fileKey!, payload)

  if (options.verbose) {
    pushSpinner.stop('Push complete')
    p.log.message(`${pc.dim('API response:')} ${JSON.stringify(apiResp)}`)
  } else {
    pushSpinner.stop('Push complete')
  }

  p.outro('Figma file has been updated with the new tokens.')
}
