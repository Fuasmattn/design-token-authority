import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { packageVersion } from '../version.js'
import {
  ACTION_VERSIONS,
  actionRef,
  exampleWorkflows,
  renderDiffWorkflows,
  type WorkflowOptions,
} from './diff-workflows.js'

const repo = path.resolve(import.meta.dirname, '..', '..', '..', '..')
const examples = path.join(repo, 'actions', 'examples')
/** The ref the generated workflows use: the release of this CLI (TICKET-148). */
const REF = actionRef()

describe('actionRef (TICKET-148)', () => {
  it('pins the release tag of the CLI that writes the workflows', () => {
    expect(actionRef('2.1.0')).toBe('v2.1.0')
    expect(actionRef('3.0.0-beta.1')).toBe('v3.0.0-beta.1')
    expect(REF).toBe(`v${packageVersion()}`)
  })

  it('falls back to main when the version is unknown', () => {
    expect(actionRef('unknown')).toBe('main')
    expect(actionRef('')).toBe('main')
  })
})

describe('renderDiffWorkflows (TICKET-129)', () => {
  it('renders one workflow for npm that runs, reports and approves', () => {
    const [file, ...rest] = renderDiffWorkflows({
      manager: 'npm',
      install: 'npm ci',
      node: { file: '.nvmrc' },
      layout: 'single',
    })
    expect(rest).toEqual([])
    expect(file.path).toBe('.github/workflows/dta-diff.yml')
    const yaml = parse(file.content)
    expect(yaml.on.pull_request.types).toEqual([
      'opened',
      'synchronize',
      'reopened',
      'labeled',
      'unlabeled',
    ])
    expect(yaml.permissions).toEqual({
      contents: 'read',
      'pull-requests': 'write',
      statuses: 'write',
    })
    const steps = yaml.jobs.diff.steps
    expect(steps[1]).toEqual({
      uses: ACTION_VERSIONS.setupNode,
      with: { 'node-version-file': '.nvmrc', cache: 'npm' },
    })
    expect(steps.map((s: { run?: string; uses?: string }) => s.run ?? s.uses)).toEqual([
      ACTION_VERSIONS.checkout,
      ACTION_VERSIONS.setupNode,
      'npm ci',
      'npx playwright-core install --with-deps chromium',
      `Fuasmattn/design-token-authority/actions/diff-pr@${REF}`,
    ])
    expect(yaml.jobs.approve.steps[0].uses).toBe(
      `Fuasmattn/design-token-authority/actions/diff-approve@${REF}`,
    )
  })

  it('renders the pnpm variant in a subfolder, with its own command', () => {
    const files = renderDiffWorkflows({
      manager: 'pnpm',
      install: 'pnpm install --frozen-lockfile',
      node: { version: '22' },
      layout: 'split',
      workingDirectory: 'apps/web',
      publish: { command: 'sh .github/dta-diff-publish.sh', secrets: ['VERCEL_TOKEN'] },
    })
    expect(files.map((f) => f.path)).toEqual([
      '.github/workflows/dta-diff.yml',
      '.github/workflows/dta-diff-report.yml',
      '.github/workflows/dta-diff-approve.yml',
    ])
    const run = parse(files[0].content)
    expect(run.permissions).toEqual({ contents: 'read' })
    const steps = run.jobs.diff.steps
    expect(steps[1]).toEqual({ uses: ACTION_VERSIONS.pnpm })
    expect(steps[2].with).toEqual({
      'node-version': 22,
      cache: 'pnpm',
      'cache-dependency-path': 'apps/web/pnpm-lock.yaml',
    })
    expect(steps[3]).toEqual({
      run: 'pnpm install --frozen-lockfile',
      'working-directory': 'apps/web',
    })
    expect(steps[4].run).toBe('pnpm exec playwright-core install --with-deps chromium')
    expect(steps[5]).toEqual({
      uses: `Fuasmattn/design-token-authority/actions/diff@${REF}`,
      with: { command: 'pnpm exec dta', 'working-directory': 'apps/web' },
    })
    // The report workflow publishes with DTA but renders nothing: no Chromium.
    expect(files[1].content).not.toContain('playwright-core')
    expect(parse(files[1].content).jobs.report.steps.at(-1).with.command).toBe('pnpm exec dta')
  })

  it('installs where the lockfile is, and gives pnpm a version when packageManager does not', () => {
    const [file] = renderDiffWorkflows({
      manager: 'pnpm',
      install: 'pnpm install --frozen-lockfile',
      node: { file: '.nvmrc' },
      layout: 'single',
      workingDirectory: 'packages/web',
      lockDir: '.',
      pnpmVersion: '10',
    })
    const steps = parse(file.content).jobs.diff.steps
    expect(steps[1]).toEqual({ uses: ACTION_VERSIONS.pnpm, with: { version: 10 } })
    expect(steps[2].with).toEqual({ 'node-version-file': '.nvmrc', cache: 'pnpm' })
    expect(steps[3]).toEqual({ run: 'pnpm install --frozen-lockfile' })
    expect(steps[4]['working-directory']).toBe('packages/web')
  })

  it('leaves publishing out unless a hook is given: the report workflow installs nothing', () => {
    const report = renderDiffWorkflows({
      manager: 'npm',
      install: 'npm ci',
      node: { version: '24' },
      layout: 'split',
    })[1].content
    const steps = parse(report).jobs.report.steps
    expect(steps).toEqual([{ uses: `Fuasmattn/design-token-authority/actions/diff-report@${REF}` }])
    expect(report).not.toContain('secrets.')
  })

  it("publishes with the config's hook, quoted, and says where its secrets go", () => {
    const files = renderDiffWorkflows({
      manager: 'npm',
      install: 'npm ci',
      node: { version: '24' },
      layout: 'split',
      publish: { command: "node publish.mjs --name 'a: b'", secrets: [] },
    })
    const step = parse(files[1].content).jobs.report.steps.at(-1)
    expect(step.with.publish).toBe(
      "${{ github.event.workflow_run.head_repository.full_name == github.repository && 'node publish.mjs --name ''a: b''' || '' }}",
    )
    expect(step.env).toBeUndefined()
    expect(files[1].content).toContain("The publish hook's secrets go here as env")
    const [single] = renderDiffWorkflows({
      manager: 'npm',
      install: 'npm ci',
      node: { version: '24' },
      layout: 'single',
      publish: { command: "node publish.mjs --name 'a: b'", secrets: [] },
    })
    expect(parse(single.content).jobs.diff.steps.at(-1).with.publish).toBe(
      "node publish.mjs --name 'a: b'",
    )
  })

  it('renders yarn and bun', () => {
    const yarn = renderDiffWorkflows({
      manager: 'yarn',
      install: 'yarn install --immutable',
      node: { version: '24' },
      layout: 'single',
    })[0].content
    expect(yarn).toContain('- run: yarn install --immutable')
    expect(yarn).toContain('command: yarn dta')
    const bun = renderDiffWorkflows({
      manager: 'bun',
      install: 'bun install --frozen-lockfile',
      node: { version: '24' },
      layout: 'single',
    })[0].content
    expect(bun).toContain(`- uses: ${ACTION_VERSIONS.bun}`)
    // setup-node caches by itself when package.json names a package manager (since v5); it
    // knows no bun cache, so it is off.
    const setupNode = parse(bun).jobs.diff.steps.find(
      (step: { uses?: string }) => step.uses === ACTION_VERSIONS.setupNode,
    )
    expect(setupNode.with).toEqual({ 'node-version': 24, 'package-manager-cache': false })
  })

  it('uses only the action versions of ACTION_VERSIONS, in every variant (TICKET-143)', () => {
    const allowed = new Set<string>(Object.values(ACTION_VERSIONS))
    const variants: WorkflowOptions[] = []
    for (const manager of ['npm', 'pnpm', 'yarn', 'bun'] as const)
      for (const layout of ['single', 'split'] as const)
        for (const publish of [undefined, { command: 'sh publish.sh', secrets: ['TOKEN'] }])
          variants.push({ manager, install: 'install', node: { version: '24' }, layout, publish })
    for (const options of variants) {
      for (const file of renderDiffWorkflows(options)) {
        for (const uses of thirdPartyUses(file.content)) {
          expect(allowed, `${options.manager} ${options.layout}: ${uses}`).toContain(uses)
        }
      }
    }
  })

  it('keeps the actions, workflows and docs of this repository on the same versions', () => {
    const byName = new Map(
      Object.values(ACTION_VERSIONS).map((uses) => [uses.split('@')[0], uses] as const),
    )
    const files = [
      ...listFiles(path.join(repo, 'actions'), /\.ya?ml$/),
      ...listFiles(path.join(repo, '.github', 'workflows'), /\.ya?ml$/),
      ...listFiles(path.join(repo, 'site', 'src', 'content', 'docs'), /\.mdx?$/),
    ]
    expect(files.length).toBeGreaterThan(10)
    for (const file of files) {
      for (const uses of thirdPartyUses(fs.readFileSync(file, 'utf8'))) {
        const expected = byName.get(uses.split('@')[0])
        if (expected) expect(uses, path.relative(repo, file)).toBe(expected)
      }
    }
  })

  it('is what actions/examples holds (run `pnpm workflows:generate` after a change)', () => {
    for (const file of exampleWorkflows()) {
      expect(fs.readFileSync(path.join(examples, file.name), 'utf8'), file.name).toBe(file.content)
    }
  })
})

/** The `uses:` of actions not from DTA (`owner/name@ref`). */
function thirdPartyUses(content: string): string[] {
  return [...content.matchAll(/uses:\s*([\w.-]+\/[\w.-]+@[\w.-]+)/g)]
    .map((match) => match[1])
    .filter((uses) => !uses.startsWith('Fuasmattn/'))
}

function listFiles(dir: string, pattern: RegExp): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true, recursive: true })
    .flatMap((entry) =>
      entry.isFile() && pattern.test(entry.name) ? [path.join(entry.parentPath, entry.name)] : [],
    )
}
