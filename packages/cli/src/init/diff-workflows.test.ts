import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { exampleWorkflows, renderDiffWorkflows } from './diff-workflows.js'

const examples = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'actions', 'examples')

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
      uses: 'actions/setup-node@v4',
      with: { 'node-version-file': '.nvmrc', cache: 'npm' },
    })
    expect(steps.map((s: { run?: string; uses?: string }) => s.run ?? s.uses)).toEqual([
      'actions/checkout@v4',
      'actions/setup-node@v4',
      'npm ci',
      'npx playwright-core install --with-deps chromium',
      'Fuasmattn/design-token-authority/actions/diff-pr@main',
    ])
    expect(yaml.jobs.approve.steps[0].uses).toBe(
      'Fuasmattn/design-token-authority/actions/diff-approve@main',
    )
  })

  it('renders the pnpm variant in a subfolder, with its own command', () => {
    const files = renderDiffWorkflows({
      manager: 'pnpm',
      install: 'pnpm install --frozen-lockfile',
      node: { version: '22' },
      layout: 'split',
      workingDirectory: 'apps/web',
    })
    expect(files.map((f) => f.path)).toEqual([
      '.github/workflows/dta-diff.yml',
      '.github/workflows/dta-diff-report.yml',
      '.github/workflows/dta-diff-approve.yml',
    ])
    const run = parse(files[0].content)
    expect(run.permissions).toEqual({ contents: 'read' })
    const steps = run.jobs.diff.steps
    expect(steps[1]).toEqual({ uses: 'pnpm/action-setup@v4' })
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
      uses: 'Fuasmattn/design-token-authority/actions/diff@main',
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
    expect(steps[1]).toEqual({ uses: 'pnpm/action-setup@v4', with: { version: 10 } })
    expect(steps[2].with).toEqual({ 'node-version-file': '.nvmrc', cache: 'pnpm' })
    expect(steps[3]).toEqual({ run: 'pnpm install --frozen-lockfile' })
    expect(steps[4]['working-directory']).toBe('packages/web')
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
    expect(bun).toContain('- uses: oven-sh/setup-bun@v2')
    expect(bun).not.toContain('cache:')
  })

  it('is what actions/examples holds (run `pnpm workflows:generate` after a change)', () => {
    for (const file of exampleWorkflows()) {
      expect(fs.readFileSync(path.join(examples, file.name), 'utf8'), file.name).toBe(file.content)
    }
  })
})
