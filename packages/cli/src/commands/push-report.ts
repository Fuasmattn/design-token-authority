import type { PushPlan } from '@dta/figma'
import pc from 'picocolors'

type PostVariablesRequestBody = NonNullable<PushPlan['payload']>

export type DiffFormat = 'console' | 'markdown' | 'json'

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
export function buildDiffReport(payload: PostVariablesRequestBody): DiffReport {
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
export function formatConsole(report: DiffReport): string {
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
export function formatMarkdown(report: DiffReport): string {
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
export function formatJson(report: DiffReport): string {
  return JSON.stringify(report, null, 2)
}
