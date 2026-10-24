import path from 'node:path'
import type { PackageManager } from '../io/detect.js'

/**
 * The ref of the DTA actions the generated workflows use. TICKET-129 pins it to a release tag;
 * until the first release (TICKET-090) there is none, so it is the default branch.
 */
export const ACTION_REF = 'main'

const ACTIONS = 'Fuasmattn/design-token-authority/actions'

/**
 * The versions of the third-party actions in the generated workflows, and in this repository's
 * composite actions, workflows and docs (a test keeps them equal, TICKET-143). Majors that run
 * on Node 24: GitHub warns about actions on Node 20.
 */
export const ACTION_VERSIONS = {
  checkout: 'actions/checkout@v7',
  setupNode: 'actions/setup-node@v7',
  pnpm: 'pnpm/action-setup@v6',
  bun: 'oven-sh/setup-bun@v2',
  uploadArtifact: 'actions/upload-artifact@v7',
  downloadArtifact: 'actions/download-artifact@v8',
} as const

export interface WorkflowOptions {
  manager: PackageManager
  /** The install command (detection gives the right one, e.g. Yarn 2+'s `--immutable`). */
  install: string
  /** The Node version: a version file to read (relative to the repository root), or a version. */
  node: { file: string } | { version: string }
  /** One job for repositories without outside contributors, three workflows for public ones. */
  layout: 'single' | 'split'
  /** Folder with dta.config.* relative to the repository root (default `.`). */
  workingDirectory?: string
  /** Folder with the lockfile relative to the repository root (default: workingDirectory). */
  lockDir?: string
  /** pnpm only: the version to install when package.json has no packageManager field. */
  pnpmVersion?: string
  /**
   * A publish hook for the report workflow (the docs' example uses the Vercel recipe): the
   * command and the repository secrets it reads. Without one, the report stays a workflow
   * artifact, linked from the comment (spec decision 5), and the report workflow installs nothing.
   */
  publish?: { command: string; secrets: readonly string[] }
  ref?: string
}

export interface WorkflowFile {
  path: string
  content: string
}

const LOCKFILE: Record<PackageManager, string> = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  bun: 'bun.lock',
}

/** How the workflow runs DTA and the Playwright installer with each package manager. */
const RUNNER: Record<PackageManager, string> = {
  npm: 'npx',
  pnpm: 'pnpm exec',
  yarn: 'yarn',
  // Bun installs node_modules; DTA itself runs on Node.
  bun: 'npx',
}

const indent = (lines: string[], spaces: number) =>
  lines.map((line) => (line ? `${' '.repeat(spaces)}${line}` : line))

/** setup-node (and the package manager), install, Chromium: the steps before DTA runs. */
function setupSteps(options: WorkflowOptions, chromium = true): string[] {
  const dir = options.workingDirectory ?? '.'
  const lockDir = options.lockDir ?? dir
  const inDir = dir === '.' ? [] : [`  working-directory: ${dir}`]
  const inLockDir = lockDir === '.' ? [] : [`  working-directory: ${lockDir}`]
  const node =
    'file' in options.node
      ? `node-version-file: ${options.node.file}`
      : `node-version: ${options.node.version}`
  // setup-node caches by itself when package.json names a package manager; it has no bun cache.
  const cache =
    options.manager === 'bun' ? ['package-manager-cache: false'] : [`cache: ${options.manager}`]
  const cachePath =
    lockDir === '.' || options.manager === 'bun'
      ? []
      : [`cache-dependency-path: ${lockDir}/${LOCKFILE[options.manager]}`]
  const pnpm =
    options.manager !== 'pnpm'
      ? []
      : options.pnpmVersion
        ? [`- uses: ${ACTION_VERSIONS.pnpm}`, '  with:', `    version: ${options.pnpmVersion}`]
        : [`- uses: ${ACTION_VERSIONS.pnpm}`]
  return [
    ...pnpm,
    ...(options.manager === 'bun' ? [`- uses: ${ACTION_VERSIONS.bun}`] : []),
    `- uses: ${ACTION_VERSIONS.setupNode}`,
    '  with:',
    ...indent([node, ...cache, ...cachePath], 4),
    `- run: ${options.install}`,
    ...inLockDir,
    ...(chromium
      ? [`- run: ${RUNNER[options.manager]} playwright-core install --with-deps chromium`, ...inDir]
      : []),
  ]
}

function actionInputs(options: WorkflowOptions, extra: string[] = []): string[] {
  const dir = options.workingDirectory ?? '.'
  const command = `${RUNNER[options.manager]} dta`
  const inputs = [
    ...(command === 'npx dta' ? [] : [`command: ${command}`]),
    ...(dir === '.' ? [] : [`working-directory: ${dir}`]),
    ...extra,
  ]
  return inputs.length === 0 ? [] : ['  with:', ...indent(inputs, 4)]
}

const checkout = [
  `- uses: ${ACTION_VERSIONS.checkout}`,
  '  with:',
  '    ref: ${{ github.event.pull_request.head.sha }}',
  '    fetch-depth: 0 # the base is built from the merge base with the default branch',
]

function single(options: WorkflowOptions, ref: string): WorkflowFile {
  const lines = [
    '# dta diff: screenshots of your stories at the base and the head of every pull request,',
    '# explained by token, as a status check and one comment. One file for repositories without',
    '# outside contributors: a pull request from a fork must not get these write permissions (use',
    '# the three-file setup in "dta diff in pull requests" for public repositories).',
    '# Generated by `dta init --diff`; run it again to update this file.',
    'name: dta diff',
    'on:',
    '  pull_request:',
    '    types: [opened, synchronize, reopened, labeled, unlabeled]',
    'permissions:',
    '  contents: read',
    '  pull-requests: write # the sticky comment, the approval label',
    '  statuses: write # the "dta diff" status check',
    'jobs:',
    '  diff:',
    "    if: github.event.action != 'labeled' && github.event.action != 'unlabeled'",
    '    runs-on: ubuntu-latest',
    '    concurrency:',
    '      group: dta-diff-${{ github.event.pull_request.number }}',
    '      cancel-in-progress: true',
    '    steps:',
    ...indent([...checkout, ...setupSteps(options)], 6),
    `      - uses: ${ACTIONS}/diff-pr@${ref}`,
    ...indent(
      actionInputs(
        options,
        options.publish ? [`publish: ${yamlString(options.publish.command)}`] : [],
      ),
      6,
    ),
    ...(options.publish ? publishEnv(options.publish) : []),
    '  # Adding the dta-diff-approved label turns the status of the head commit green.',
    '  approve:',
    "    if: github.event.label.name == 'dta-diff-approved'",
    '    runs-on: ubuntu-latest',
    '    steps:',
    `      - uses: ${ACTIONS}/diff-approve@${ref}`,
    '',
  ]
  return { path: '.github/workflows/dta-diff.yml', content: lines.join('\n') }
}

/** A YAML string as Prettier writes it: single quotes, double when the text has a single one. */
const yamlString = (text: string) =>
  text.includes("'") && !text.includes('"') ? JSON.stringify(text) : `'${text.replace(/'/g, "''")}'`

/** The publish step's env: its secrets, or where to add them when they are not known. */
function publishEnv(publish: { secrets: readonly string[] }): string[] {
  return publish.secrets.length > 0
    ? [
        '        env:',
        ...publish.secrets.map((name) => `          ${name}: \${{ secrets.${name} }}`),
      ]
    : [
        "        # The publish hook's secrets go here as env, e.g. TOKEN: ${{ secrets.TOKEN }}",
        '        # (see "Publishing the report" in "dta diff in pull requests").',
      ]
}

function split(options: WorkflowOptions, ref: string): WorkflowFile[] {
  const run = [
    '# 1/3 · Runs dta diff on every pull request and uploads the report.',
    '# No secrets, read-only token: safe for pull requests from forks.',
    '# Generated by `dta init --diff`; run it again to update this file.',
    'name: dta diff',
    'on:',
    '  pull_request:',
    'permissions:',
    '  contents: read',
    'jobs:',
    '  diff:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...indent([...checkout, ...setupSteps(options)], 6),
    `      - uses: ${ACTIONS}/diff@${ref}`,
    ...indent(actionInputs(options), 6),
    '',
  ]
  const report = [
    '# 2/3 · Reports the run on its pull request: publish hook (optional), status check, comment.',
    '# Runs trusted code from the default branch and may use secrets; it only reads the report.',
    '# Generated by `dta init --diff`; run it again to update this file.',
    'name: dta diff report',
    'on:',
    '  workflow_run:',
    '    workflows: [dta diff]',
    '    types: [completed]',
    'permissions:',
    '  actions: read # download the report artifact',
    '  pull-requests: write # the sticky comment, removing a stale approval label',
    '  statuses: write # the "dta diff" status check',
    'jobs:',
    '  report:',
    "    if: github.event.workflow_run.conclusion == 'success'",
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...(options.publish
      ? [
          `      - uses: ${ACTION_VERSIONS.checkout} # the default branch: your config and publish script`,
          // Publishing runs DTA, rendering does not happen here: no Chromium.
          ...indent(setupSteps(options, false), 6),
          `      - uses: ${ACTIONS}/diff-report@${ref}`,
          ...indent(
            actionInputs(options, [
              "# Publish only reports of branches in this repository: a fork's report is untrusted HTML.",
              `publish: ${yamlString(`\${{ github.event.workflow_run.head_repository.full_name == github.repository && '${options.publish.command.replace(/'/g, "''")}' || '' }}`)}`,
            ]),
            6,
          ),
          ...publishEnv(options.publish),
        ]
      : [
          '      # The comment links the report artifact. To host the report, add a publish hook',
          '      # (`publish:` and the checkout, install and secrets it needs): see "Publishing the',
          '      # report" in "dta diff in pull requests".',
          `      - uses: ${ACTIONS}/diff-report@${ref}`,
        ]),
    '',
  ]
  const approve = [
    '# 3/3 · Approval: adding the dta-diff-approved label turns the status of the head commit green.',
    '# A new push removes the label again (in the report workflow). Checks out nothing.',
    '# Generated by `dta init --diff`; run it again to update this file.',
    'name: dta diff approve',
    'on:',
    '  pull_request_target:',
    '    types: [labeled, unlabeled]',
    'permissions:',
    '  pull-requests: write',
    '  statuses: write',
    'jobs:',
    '  approve:',
    "    if: github.event.label.name == 'dta-diff-approved'",
    '    runs-on: ubuntu-latest',
    '    steps:',
    `      - uses: ${ACTIONS}/diff-approve@${ref}`,
    '',
  ]
  return [
    { path: '.github/workflows/dta-diff.yml', content: run.join('\n') },
    { path: '.github/workflows/dta-diff-report.yml', content: report.join('\n') },
    { path: '.github/workflows/dta-diff-approve.yml', content: approve.join('\n') },
  ]
}

/** The workflow file(s) of `dta diff` for a project (TICKET-129), rendered from one template. */
export function renderDiffWorkflows(options: WorkflowOptions): WorkflowFile[] {
  const ref = options.ref ?? ACTION_REF
  return options.layout === 'single' ? [single(options, ref)] : split(options, ref)
}

/**
 * The example workflows in `actions/examples` (npm, Node 24): the three-file setup and the
 * one-file setup, as the docs show them. `pnpm workflows:generate` writes them.
 */
export function exampleWorkflows(): Array<{ name: string; content: string }> {
  const options = {
    manager: 'npm',
    install: 'npm ci',
    node: { version: '24' },
    publish: {
      command: 'sh .github/dta-diff-publish.sh',
      secrets: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'],
    },
  } as const
  const split = renderDiffWorkflows({ ...options, layout: 'split' })
  const [single] = renderDiffWorkflows({ ...options, layout: 'single' })
  return [
    ...split.map((file) => ({ name: path.basename(file.path), content: file.content })),
    { name: 'dta-diff-single.yml', content: single.content },
  ]
}
