/**
 * `dta audit`: the files to scan, the findings (hard-coded values that equal a token), the
 * baseline of accepted findings, and the output formats.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { TokenModel } from '@dta/core'
import type { CodeNames } from '../code-names.js'
import type { Config } from '../config/schema.js'
import { detect, languageOf, type Language, type ValueKind } from './detect.js'
import { buildTokenIndex, suggestToken } from './match.js'

export const AUDIT_JSON_SCHEMA = 'dta.audit/1'
export const BASELINE_SCHEMA = 'dta.audit-baseline/1'
export const DEFAULT_BASELINE = '.dta/audit-baseline.json'
export const DEFAULT_AUDIT_PATHS = ['src']

export interface Finding {
  /** Relative to the project, with forward slashes. */
  file: string
  line: number
  column: number
  value: string
  kind: ValueKind
  /** The property, object key or Tailwind utility. */
  context: string
  /** The token to use instead. */
  token: string
  /** Its names in code, when `dta build` writes it. */
  code?: CodeNames
}

/** Folders that are never scanned: dependencies, VCS, caches and build output. */
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.astro',
  '.dta',
  'coverage',
  '.next',
  '.svelte-kit',
])

/** Tests hold literal values on purpose; they are never scanned. */
export const DEFAULT_IGNORE = ['**/*.test.*', '**/*.spec.*', '**/__tests__/**']

function globToRegExp(glob: string): RegExp {
  let pattern = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      pattern += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'
      i += glob[i + 2] === '/' ? 2 : 1
    } else if (c === '*') pattern += '[^/]*'
    else if (c === '?') pattern += '[^/]'
    else pattern += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${pattern}(?:/.*)?$`)
}

const toPosix = (file: string) => file.split(path.sep).join('/')

/** The files to audit under the given paths, sorted, relative to `cwd`. */
export function auditFiles(
  cwd: string,
  paths: readonly string[],
  options: {
    ignore?: readonly string[]
    languages?: readonly Language[]
    skip?: readonly string[]
  },
): string[] {
  const ignore = [...DEFAULT_IGNORE, ...(options.ignore ?? [])].map(globToRegExp)
  const skip = (options.skip ?? []).map((dir) => path.resolve(cwd, dir))
  const languages = options.languages ? new Set(options.languages) : null
  const files: string[] = []
  const visit = (absolute: string) => {
    const relative = toPosix(path.relative(cwd, absolute))
    if (ignore.some((pattern) => pattern.test(relative))) return
    if (skip.some((dir) => absolute === dir || absolute.startsWith(dir + path.sep))) return
    const stat = fs.statSync(absolute, { throwIfNoEntry: false })
    if (!stat) return
    if (stat.isDirectory()) {
      if (SKIPPED_DIRS.has(path.basename(absolute))) return
      for (const name of fs.readdirSync(absolute)) visit(path.join(absolute, name))
      return
    }
    const language = languageOf(absolute)
    if (language && (!languages || languages.has(language))) files.push(relative)
  }
  for (const entry of paths) visit(path.resolve(cwd, entry))
  return [...new Set(files)].sort()
}

/** Every hard-coded value in the files that equals a token. */
export function auditProject(
  cwd: string,
  files: readonly string[],
  model: TokenModel,
  config: Config | null,
  options: { near?: boolean } = {},
): Finding[] {
  const index = buildTokenIndex(model, config)
  const findings: Finding[] = []
  for (const file of files) {
    const language = languageOf(file)
    if (!language) continue
    const text = fs.readFileSync(path.resolve(cwd, file), 'utf8')
    for (const candidate of detect(text, language)) {
      const suggestion = suggestToken(index, candidate, options)
      if (suggestion) findings.push({ file, ...candidate, ...suggestion })
    }
  }
  return findings
}

// ---------------------------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------------------------

export interface BaselineEntry {
  file: string
  value: string
  kind: ValueKind
  context: string
  token: string
}

/** Lines move; a finding is the same while its file, value, kind and context are. */
const fingerprint = (finding: BaselineEntry) =>
  [finding.file, finding.kind, finding.value, finding.context].join('\u0000')

export function baselineOf(findings: readonly Finding[]): {
  schema: string
  findings: BaselineEntry[]
} {
  return {
    schema: BASELINE_SCHEMA,
    findings: findings.map(({ file, value, kind, context, token }) => ({
      file,
      value,
      kind,
      context,
      token,
    })),
  }
}

export class BaselineError extends Error {}

export function readBaseline(file: string): BaselineEntry[] {
  if (!fs.existsSync(file)) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    throw new BaselineError(
      `${file} is not valid JSON. Recreate it with dta audit --update-baseline.`,
    )
  }
  const data = parsed as { schema?: unknown; findings?: unknown }
  if (data.schema !== BASELINE_SCHEMA || !Array.isArray(data.findings)) {
    throw new BaselineError(`${file} is not a dta audit baseline (${BASELINE_SCHEMA}).`)
  }
  return data.findings as BaselineEntry[]
}

/** The findings the baseline does not account for (each baseline entry covers one finding). */
export function newFindings(
  findings: readonly Finding[],
  baseline: readonly BaselineEntry[],
): Finding[] {
  const counts = new Map<string, number>()
  for (const entry of baseline)
    counts.set(fingerprint(entry), (counts.get(fingerprint(entry)) ?? 0) + 1)
  return findings.filter((finding) => {
    const key = fingerprint(finding)
    const left = counts.get(key) ?? 0
    if (left === 0) return true
    counts.set(key, left - 1)
    return false
  })
}

// ---------------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------------

const use = (finding: Finding) => (finding.code ? `var(${finding.code.css})` : finding.token)
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export interface AuditSummary {
  findings: Finding[]
  baselined: number
  files: number
}

function summaryLine({ findings, baselined, files }: AuditSummary): string {
  const fileCount = new Set(findings.map((finding) => finding.file)).size
  const known = baselined > 0 ? ` (${baselined} more in the baseline)` : ''
  return findings.length === 0
    ? `No hard-coded token values in ${plural(files, 'file')}${known}.`
    : `${plural(findings.length, 'hard-coded value')} in ${plural(fileCount, 'file')} could be tokens${known}.`
}

export function formatConsole(summary: AuditSummary): string {
  const lines: string[] = []
  let file = ''
  const width = Math.max(0, ...summary.findings.map((f) => `${f.line}:${f.column}`.length))
  const valueWidth = Math.max(0, ...summary.findings.map((f) => f.value.length))
  for (const finding of summary.findings) {
    if (finding.file !== file) {
      if (file) lines.push('')
      file = finding.file
      lines.push(file)
    }
    const position = `${finding.line}:${finding.column}`.padEnd(width)
    lines.push(
      `  ${position}  ${finding.value.padEnd(valueWidth)}  ${finding.context} → ${finding.token}  ${use(finding)}`,
    )
  }
  if (lines.length > 0) lines.push('')
  lines.push(summaryLine(summary))
  return `${lines.join('\n')}\n`
}

export function formatMarkdown(summary: AuditSummary): string {
  const lines = ['## dta audit', '', summaryLine(summary)]
  if (summary.findings.length > 0) {
    lines.push('', '| Where | Value | In | Use |', '| --- | --- | --- | --- |')
    for (const f of summary.findings) {
      const value = f.value.replace(/\|/g, '\\|')
      lines.push(
        `| \`${f.file}:${f.line}\` | \`${value}\` | \`${f.context}\` | \`${f.token}\`${f.code ? ` (\`var(${f.code.css})\`)` : ''} |`,
      )
    }
  }
  return `${lines.join('\n')}\n`
}

export function formatJson(summary: AuditSummary): string {
  return `${JSON.stringify({ schema: AUDIT_JSON_SCHEMA, ...summary }, null, 2)}\n`
}
