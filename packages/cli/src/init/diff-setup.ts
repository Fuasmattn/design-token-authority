/**
 * What `dta init --diff` writes (TICKET-131): the `diff` section of the config and the GitHub
 * workflow, from the project detection (TICKET-126). Pure planning and file editing; the prompts
 * live in the init command.
 *
 * Re-running is how settings change (spec decision 4): the section keeps a record of what init
 * generated, and the workflow carries a stamp of its content, so a key or a file edited by hand
 * is kept and listed instead of being overwritten.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { runScript, type PackageManager, type ProjectDetection } from '../io/detect.js'
import { renderDiffWorkflows, type WorkflowFile } from './diff-workflows.js'

/** The keys init manages in the `diff` section. */
export interface DiffSection {
  build?: string
  outDir: string
  stories: string[] | { type: 'storybook' } | { type: 'static-site'; manifest: string }
  workflow: 'single' | 'split'
}

export type DiffKey = keyof DiffSection

/** The answers for what detection could not find. */
export interface DiffAnswers {
  /** Without Storybook: the pages to check (default `['/']`). */
  pages?: string[]
  /** Without Storybook: the build command and the folder it writes. */
  build?: string
  outDir?: string
  /** Will people outside the team open pull requests? Yes → split, no → single. */
  outsideContributors?: boolean
}

const RUN_DTA: Record<PackageManager, string> = {
  npm: 'npx dta',
  pnpm: 'pnpm exec dta',
  yarn: 'yarn dta',
  bun: 'npx dta',
}

/** The command that adds playwright-core as a dev dependency. */
export function addDevDependency(manager: PackageManager, name: string): string {
  if (manager === 'npm') return `npm install --save-dev ${name}`
  if (manager === 'bun') return `bun add --dev ${name}`
  return `${manager} add --save-dev ${name}`
}

/**
 * The section init proposes: Storybook when detected (built after the tokens), otherwise the
 * project build and a page list. A saved `workflow` is kept, so a re-run does not ask again.
 */
export function proposeSection(
  detection: ProjectDetection,
  answers: DiffAnswers,
  current: Partial<DiffSection> = {},
): DiffSection {
  const manager = detection.packageManager.value ?? 'npm'
  // The tokens are built first, unless the project's build script does that itself.
  const withTokens = (command: string) =>
    detection.buildRunsDta && command === detection.build.value
      ? command
      : `${RUN_DTA[manager]} build && ${command}`
  const workflow = current.workflow ?? (answers.outsideContributors === false ? 'single' : 'split')
  const storybook = detection.storybook.value
  // Without a lockfile the script still runs, with npm.
  const storybookBuild =
    detection.build.value ?? (storybook?.script ? runScript(manager, storybook.script) : null)
  if (storybook && storybookBuild) {
    return {
      build: withTokens(storybookBuild),
      outDir: storybook.outDir,
      stories: { type: 'storybook' },
      workflow,
    }
  }
  // A stories manifest the project already uses stays: it is a choice, not something to detect.
  const manifest =
    current.stories && !Array.isArray(current.stories) && current.stories.type === 'static-site'
      ? current.stories
      : null
  const pages = Array.isArray(current.stories) ? current.stories : (answers.pages ?? ['/'])
  const build = detection.build.value ?? answers.build
  return {
    ...(build ? { build: withTokens(build) } : {}),
    outDir: answers.outDir ?? current.outDir ?? 'dist',
    stories: manifest ?? pages,
    workflow,
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const show = (value: unknown) =>
  value === undefined
    ? '(none)'
    : Array.isArray(value)
      ? `pages ${value.join(', ')}`
      : typeof value === 'object' && value !== null
        ? (value as { type?: string }).type === 'storybook'
          ? 'Storybook'
          : `manifest ${String((value as { manifest?: string }).manifest)}`
        : String(value)

export interface SectionPlan {
  /** What the section becomes. */
  next: DiffSection
  /** Keys that change, as `key: before → after`. */
  changes: string[]
  /** Keys changed by hand since init wrote them: kept as they are. */
  kept: string[]
  /** The keys that change (new or updated), for a section init may not edit itself. */
  changedKeys: DiffKey[]
}

/**
 * Compares the proposal with the config: a key init wrote and nobody changed follows the new
 * detection; a key that differs from what init recorded was edited by hand and is kept; a new
 * key is added.
 */
export function planSection(
  proposed: DiffSection,
  current: Partial<Record<DiffKey, unknown>>,
  record: Partial<Record<DiffKey, unknown>> | null,
): SectionPlan {
  const next = { ...proposed } as Record<DiffKey, unknown>
  const changes: string[] = []
  const kept: string[] = []
  const changedKeys: DiffKey[] = []
  for (const key of Object.keys(proposed) as DiffKey[]) {
    const now = current[key]
    if (now === undefined) {
      changes.push(`${key}: ${show(proposed[key])} (new)`)
      changedKeys.push(key)
      continue
    }
    if (same(now, proposed[key])) continue
    const untouched = record !== null && key in record && same(record[key], now)
    if (untouched) {
      changes.push(`${key}: ${show(now)} → ${show(proposed[key])}`)
      changedKeys.push(key)
    } else {
      next[key] = now
      kept.push(`${key}: ${show(now)} (${record === null ? 'set by hand' : 'changed by hand'})`)
    }
  }
  return { next: next as unknown as DiffSection, changes, kept, changedKeys }
}

// --- The section in dta.config.* -----------------------------------------------------------

const BEGIN = '// dta init --diff: generated'
const END = '// end of dta init --diff'

/** `key: value,` lines for keys of a section, as init writes them into a config. */
export function keyLines(section: DiffSection, keys: readonly DiffKey[]): string[] {
  return keys.map((key) => {
    const value = section[key]
    if (key === 'workflow') return `workflow: '${String(value)}',`
    return `${key}: ${JSON.stringify(value)},`
  })
}

/** The block init writes into a TypeScript or JavaScript config, with the record of its values. */
export function sectionBlock(
  section: DiffSection,
  extra: string[] = [],
  record: DiffSection = section,
): string {
  const lines = [
    `  ${BEGIN} ${JSON.stringify(record)}`,
    '  // Re-run `dta init --diff` to update it; keys you change here are kept.',
    '  diff: {',
    ...(section.build ? [`    build: ${JSON.stringify(section.build)},`] : []),
    `    outDir: ${JSON.stringify(section.outDir)},`,
    Array.isArray(section.stories)
      ? `    stories: [${section.stories.map((page) => JSON.stringify(page)).join(', ')}],`
      : section.stories.type === 'storybook'
        ? "    stories: { type: 'storybook' },"
        : `    stories: { type: 'static-site', manifest: ${JSON.stringify(section.stories.manifest)} },`,
    `    workflow: '${section.workflow}',`,
    ...extra,
    '  },',
    `  ${END}`,
  ]
  return lines.join('\n')
}

/** The record init left in the config (what it generated last time), or null. */
export function readRecord(content: string): Partial<Record<DiffKey, unknown>> | null {
  const line = content.split('\n').find((l) => l.trim().startsWith(BEGIN))
  if (!line) return null
  try {
    return JSON.parse(line.trim().slice(BEGIN.length).trim()) as Partial<Record<DiffKey, unknown>>
  } catch {
    return null
  }
}

export type ConfigEdit =
  { ok: true; content: string } | { ok: false; reason: string; block: string }

/**
 * Brackets in source text, skipping strings, template literals and comments: what a line or a
 * stretch of a config opens minus what it closes.
 */
function scan(text: string, onBracket: (char: string, index: number) => boolean | void): void {
  let quote: string | null = null
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'" || char === '`') quote = char
    else if (char === '/' && text[i + 1] === '/')
      i = text.indexOf('\n', i) === -1 ? text.length : text.indexOf('\n', i)
    else if (char === '/' && text[i + 1] === '*') i = text.indexOf('*/', i + 2) + 1 || text.length
    else if ('{}[]()'.includes(char) && onBracket(char, i)) return
  }
}

/** The index of the `}` that closes the object of `export default` (or `module.exports =`). */
function exportedObjectEnd(content: string): number {
  const start = content.search(/export\s+default\b|module\.exports\s*=/)
  if (start === -1) return -1
  const open = content.indexOf('{', start)
  if (open === -1) return -1
  let depth = 0
  let end = -1
  scan(content.slice(open), (char, index) => {
    if ('{[('.includes(char)) depth++
    else depth--
    if (depth !== 0) return false
    end = open + index
    return true
  })
  return end
}

/**
 * The lines of the old block's `diff: { … }` body that init did not write: keys added by hand.
 * A key init writes can span several lines (Prettier wraps long values): it is skipped to the
 * line where its value ends.
 */
function handLines(body: string[]): string[] {
  const open = body.findIndex((line) => /^\s*diff\s*:\s*\{/.test(line))
  const close = body.map((line) => line.trim()).lastIndexOf('},')
  if (open === -1 || close <= open) return []
  const kept: string[] = []
  let skipping = false
  let depth = 0
  for (const line of body.slice(open + 1, close)) {
    if (!skipping && /^\s*(build|outDir|stories|workflow)\s*:/.test(line)) {
      skipping = true
      depth = 0
    }
    if (!skipping) {
      kept.push(line)
      continue
    }
    scan(line, (char) => {
      depth += '{[('.includes(char) ? 1 : -1
    })
    if (depth <= 0 && line.trim().endsWith(',')) skipping = false
  }
  return kept
}

/**
 * The config with the section written: the generated block replaced, or inserted before the end
 * of the exported object. A JSON config gets the keys merged in. A hand-written `diff` section
 * (no block) is not edited: the result says so and gives the block to paste. `record` is what
 * init proposed: a key kept by hand stays different from it, so it is kept again next time.
 */
export function writeSection(
  file: string,
  content: string,
  section: DiffSection,
  record: DiffSection = section,
): ConfigEdit {
  const block = sectionBlock(section, [], record)
  if (file.endsWith('.json')) {
    const json = JSON.parse(content) as Record<string, unknown>
    const diff = (json.diff ?? {}) as Record<string, unknown>
    json.diff = { ...diff, ...section }
    if (!section.build) delete (json.diff as Record<string, unknown>).build
    return { ok: true, content: `${JSON.stringify(json, null, 2)}\n` }
  }
  const lines = content.split('\n')
  const begin = lines.findIndex((line) => line.trim().startsWith(BEGIN))
  const end = lines.findIndex((line) => line.trim() === END)
  if (begin !== -1 && end > begin) {
    const extra = handLines(lines.slice(begin + 1, end))
    return {
      ok: true,
      content: [
        ...lines.slice(0, begin),
        sectionBlock(section, extra, record),
        ...lines.slice(end + 1),
      ].join('\n'),
    }
  }
  // A `diff` key, also as shorthand (`{ diff }`), that init did not write.
  if (/(^|[{,])\s*diff\s*[:,}]|^\s*diff\s*,?\s*$/m.test(content)) {
    return { ok: false, reason: 'the config has a `diff` section init did not write', block }
  }
  const close = exportedObjectEnd(content)
  if (close === -1)
    return { ok: false, reason: 'the end of the exported config was not found', block }
  // The last property may have no trailing comma.
  const before = content.slice(0, close).replace(/\s*$/, '')
  const comma = before.endsWith(',') || before.endsWith('{') ? '' : ','
  return {
    ok: true,
    content: `${before}${comma}\n\n${block}\n${content.slice(close)}`,
  }
}

// --- Workflow files -------------------------------------------------------------------------

const STAMP = '# dta init --diff sha256:'

const digest = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16)

/** A workflow as init writes it: the content, then a stamp of it to notice hand edits. */
export function stampWorkflow(content: string): string {
  return `${content}${STAMP}${digest(content)}\n`
}

/** Whether a workflow file is as init wrote it (its stamp matches the content). */
export function untouchedWorkflow(content: string): boolean {
  const at = content.lastIndexOf(STAMP)
  if (at === -1) return false
  const body = content.slice(0, at)
  return content.slice(at + STAMP.length).trim() === digest(body)
}

export interface WorkflowPlan {
  write: WorkflowFile[]
  changes: string[]
  kept: string[]
}

/** Which workflow files to write: new ones, and those init wrote that nobody edited since. */
export function planWorkflows(root: string, files: WorkflowFile[]): WorkflowPlan {
  const plan: WorkflowPlan = { write: [], changes: [], kept: [] }
  for (const file of files) {
    const stamped = { path: file.path, content: stampWorkflow(file.content) }
    const target = path.join(root, file.path)
    if (!fs.existsSync(target)) {
      plan.write.push(stamped)
      plan.changes.push(`${file.path} (new)`)
      continue
    }
    const now = fs.readFileSync(target, 'utf8')
    if (now === stamped.content) continue
    if (untouchedWorkflow(now)) {
      plan.write.push(stamped)
      plan.changes.push(`${file.path} (updated)`)
    } else {
      plan.kept.push(`${file.path} (edited by hand: not overwritten)`)
    }
  }
  return plan
}

/** The workflow files for a section and a detection, the project at `workingDirectory`. */
export function workflowsFor(
  detection: ProjectDetection,
  section: DiffSection,
  workingDirectory: string,
  /** The config's `diff.publish` command: the report workflow then publishes with it. */
  publish?: string,
): WorkflowFile[] {
  const manager = detection.packageManager.value ?? 'npm'
  // Paths from the project folder become paths from the repository root.
  const fromRoot = (relative: string) =>
    path.posix.normalize(path.posix.join(workingDirectory, relative)) || '.'
  const nodeFile =
    detection.node.value !== null && /(^|\/)\.(nvmrc|node-version)$/.test(detection.node.source)
  const node = nodeFile
    ? { file: fromRoot(detection.node.source) }
    : {
        version: /^\d+$/.test(detection.node.value ?? '') ? (detection.node.value as string) : '24',
      }
  return renderDiffWorkflows({
    manager,
    install: detection.install.value ?? 'npm ci',
    node,
    layout: section.workflow,
    workingDirectory,
    lockDir: detection.lockfile.value ? fromRoot(detection.lockfile.value.dir) : workingDirectory,
    // pnpm/action-setup reads packageManager from package.json; without it, it needs a version.
    ...(manager === 'pnpm' && !detection.pnpmVersion ? { pnpmVersion: '10' } : {}),
    ...(publish ? { publish: { command: publish, secrets: [] } } : {}),
  })
}
