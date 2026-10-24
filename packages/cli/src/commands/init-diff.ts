import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { ConfigError, loadConfig } from '../config/load.js'
import { describeFound, detectProject, type ProjectDetection } from '../io/detect.js'
import { gitOutput } from '../io/diff-base.js'
import { CommandFailedError, runCommand } from '../io/run-command.js'
import {
  addDevDependency,
  keyLines,
  planSection,
  planWorkflows,
  proposeSection,
  readRecord,
  workflowsFor,
  writeSection,
  type DiffAnswers,
  type DiffKey,
  type DiffSection,
} from '../init/diff-setup.js'
import type { Ui } from '../ui.js'

export const CONFIG_FILES = [
  'dta.config.ts',
  'dta.config.mts',
  'dta.config.js',
  'dta.config.mjs',
  'dta.config.json',
]

/** Thrown when a prompt is cancelled. */
export class DiffSetupCancelled extends Error {}

function answered<T>(value: T | null): T {
  if (value === null) throw new DiffSetupCancelled()
  return value
}

/** The managed keys of the config's `diff` section as they are now, comparable with a proposal. */
function currentSection(
  diff: Record<string, unknown> | undefined,
): Partial<Record<DiffKey, unknown>> {
  if (!diff) return {}
  const stories = diff.stories as { type?: string } | string[] | undefined
  return {
    ...(diff.build !== undefined ? { build: diff.build } : {}),
    outDir: diff.outDir,
    // Storybook's options (index, excludeTags, exclude) are not init's: compare the source only.
    stories: Array.isArray(stories)
      ? stories
      : stories?.type === 'storybook'
        ? { type: 'storybook' }
        : stories && { type: 'static-site', manifest: (stories as { manifest?: string }).manifest },
    ...(diff.workflow !== undefined ? { workflow: diff.workflow } : {}),
  }
}

/** Whether playwright-core is a dependency of the project, and whether it resolves from there. */
function playwrightState(cwd: string) {
  let declared = false
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    declared = Boolean(
      pkg.devDependencies?.['playwright-core'] ?? pkg.dependencies?.['playwright-core'],
    )
  } catch {
    // no package.json: nothing to add it to
  }
  let chromium = Boolean(
    process.env.DTA_BROWSER_PATH && fs.existsSync(process.env.DTA_BROWSER_PATH),
  )
  if (!chromium) {
    try {
      const require = createRequire(path.join(cwd, 'package.json'))
      const playwright = require('playwright-core') as { chromium: { executablePath(): string } }
      const executable = playwright.chromium.executablePath()
      chromium = Boolean(executable && fs.existsSync(executable))
    } catch {
      chromium = false
    }
  }
  return { declared, chromium }
}

const RUNNER = { npm: 'npx', pnpm: 'pnpm exec', yarn: 'yarn', bun: 'npx' } as const

export interface DiffStepOptions {
  /** Non-interactive: detected or default answers, applied without asking (CI, agents). */
  yes: boolean
}

/**
 * `dta init --diff`, and the last step of `dta init` (TICKET-131): detects the project, asks only
 * what it cannot detect, and writes the `diff` section, the GitHub workflow and playwright-core.
 * Run again on a set-up project, it lists what it would change and asks once.
 */
export async function runDiffStep(
  ui: Ui,
  context: CommandContext,
  options: DiffStepOptions,
): Promise<number> {
  const cwd = context.cwd
  const configName = CONFIG_FILES.find((name) => fs.existsSync(path.join(cwd, name)))
  if (!configName) {
    ui.log.error('No dta.config.* here. Run `dta init` first: it sets up dta diff too.')
    return 2
  }
  const configPath = path.join(cwd, configName)

  const detection = detectProject(cwd)
  ui.log.step(pc.bold('Found'))
  ui.log.message(describeDetection(detection))

  let current: Partial<Record<DiffKey, unknown>> = {}
  let publish: string | undefined
  try {
    const { config } = await loadConfig({ cwd, configPath: configName })
    current = currentSection(config?.diff as Record<string, unknown> | undefined)
    // A publish hook is the user's: init only carries it into the report workflow.
    const hook = (config?.diff as { publish?: string | { command: string } } | undefined)?.publish
    publish = typeof hook === 'string' ? hook : hook?.command
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error
    ui.log.error(error.message)
    return 1
  }
  const record = readRecord(fs.readFileSync(configPath, 'utf8'))

  const answers: DiffAnswers = {}
  const ask = !options.yes
  if (!detection.storybook.value) {
    // A page list or a manifest is kept: only a project without either is asked for pages.
    const stories = current.stories as { type?: string } | string[] | undefined
    if (!Array.isArray(stories) && stories?.type !== 'static-site') {
      answers.pages = ask
        ? answered(
            await ui.text({
              message: 'Which pages should dta diff check? (comma-separated paths)',
              placeholder: '/',
              defaultValue: '/',
              validate: (value) =>
                (value ?? '/')
                  .split(',')
                  .map((page) => page.trim())
                  .filter(Boolean)
                  .every((page) => page.startsWith('/'))
                  ? undefined
                  : 'Each page starts with "/", for example "/" or "/pricing".',
            }),
          )
            .split(',')
            .map((page) => page.trim())
            .filter(Boolean)
        : ['/']
    }
    if (!detection.build.value && current.build === undefined && ask) {
      const build = answered(
        await ui.text({
          message: 'Which command builds the site? (leave blank if it is already built)',
          placeholder: 'npm run build',
          defaultValue: '',
          validate: () => undefined,
        }),
      )
      if (build) answers.build = build
    }
    if (current.outDir === undefined && ask) {
      answers.outDir = answered(
        await ui.text({
          message: 'Which folder does the build write?',
          placeholder: 'dist',
          defaultValue: 'dist',
          validate: (value) => (value === '' ? 'A folder, for example dist.' : undefined),
        }),
      )
    }
  }
  if (current.workflow === undefined && ask && detection.git.host.value !== 'other') {
    answers.outsideContributors = answered(
      await ui.confirm({
        message: 'Will people outside your team open pull requests (forks)?',
        initialValue: true,
      }),
    )
  }

  const proposed = proposeSection(detection, answers, current as Partial<DiffSection>)
  const section = planSection(proposed, current, record)
  const workingDirectory = repoRelative(cwd)
  const repoRoot = gitOutput(cwd, ['rev-parse', '--show-toplevel'])?.trim() ?? cwd
  const workflows =
    detection.git.host.value === 'other'
      ? null
      : planWorkflows(repoRoot, workflowsFor(detection, section.next, workingDirectory, publish))
  const playwright = playwrightState(cwd)
  const manager = detection.packageManager.value ?? 'npm'
  const installSteps = [
    ...(playwright.declared ? [] : [addDevDependency(manager, 'playwright-core')]),
    ...(playwright.chromium ? [] : [`${RUNNER[manager]} playwright-core install chromium`]),
  ]

  // The report folder holds screenshots of every run: keep it out of git.
  const inRepo = gitOutput(cwd, ['rev-parse', '--git-dir']) !== null
  const ignoreReport =
    inRepo && gitOutput(cwd, ['check-ignore', '-q', '--no-index', '.dta/diff/index.html']) === null
  const changes = [
    ...section.changes,
    ...(workflows?.changes ?? []),
    ...(ignoreReport ? ['.gitignore: .dta/diff/ (the report folder)'] : []),
  ]
  const kept = [...section.kept, ...(workflows?.kept ?? [])]
  if (kept.length > 0) ui.note(kept.join('\n'), 'Kept')
  if (changes.length === 0) {
    ui.log.success('Up to date: nothing to change.')
    if (installSteps.length === 0) return 0
  }
  if (changes.length > 0) {
    ui.note(
      changes.join('\n'),
      record === null && Object.keys(current).length === 0 ? 'Will write' : 'Will change',
    )
    const apply =
      options.yes ||
      answered(await ui.confirm({ message: 'Apply these changes?', initialValue: true }))
    if (!apply) {
      ui.log.info('Nothing was changed.')
      return 0
    }
    const edit = writeSection(
      configName,
      fs.readFileSync(configPath, 'utf8'),
      section.next,
      proposed,
    )
    if (edit.ok) {
      fs.writeFileSync(configPath, edit.content)
      ui.log.success(`Wrote the diff section of ${pc.bold(configName)}`)
    } else {
      // Never rewrite a section written by hand: say which keys to add or change in it. Without
      // a section to change, print the whole block to add.
      const lines = keyLines(section.next, section.changedKeys)
      if (Object.keys(current).length === 0) {
        ui.log.warn(`Did not edit ${configName}: ${edit.reason}. Add this to it:\n${edit.block}`)
      } else if (lines.length > 0) {
        ui.log.warn(
          `Did not edit ${configName}: ${edit.reason}. Add or change these keys in its diff section:\n${lines.map((line) => `  ${line}`).join('\n')}`,
        )
      }
    }
    if (ignoreReport) {
      const file = path.join(cwd, '.gitignore')
      const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
      const separator = before === '' || before.endsWith('\n') ? '' : '\n'
      fs.writeFileSync(file, `${before}${separator}# dta diff reports\n.dta/diff/\n`)
      ui.log.success(`Added ${pc.bold('.dta/diff/')} to .gitignore`)
    }
    for (const file of workflows?.write ?? []) {
      const target = path.join(repoRoot, file.path)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, file.content)
      ui.log.success(`Wrote ${pc.bold(file.path)}`)
    }
    if (detection.git.host.value === 'other') {
      ui.log.info(
        'The repository is not on GitHub, so no workflow was written: run `dta diff` in your CI (see "Without GitHub" in the docs).',
      )
    }
  }

  if (installSteps.length > 0) {
    const install =
      options.yes ||
      answered(
        await ui.confirm({
          message: `Install the browser for screenshots now? (${installSteps.join(', then ')})`,
          initialValue: true,
        }),
      )
    if (!install) {
      ui.note(installSteps.join('\n'), 'Run later')
    } else {
      for (const command of installSteps) {
        const spinner = ui.spinner()
        spinner.start(command)
        try {
          runCommand(command, cwd)
          spinner.stop(`Ran ${command}`)
        } catch (error) {
          if (!(error instanceof CommandFailedError)) throw error
          // The setup is written; only this machine lacks the browser (CI installs its own).
          spinner.stop(pc.yellow(`Did not finish: ${command}`))
          const reason = error.output
            .split('\n')
            .find((line) => /error/i.test(line))
            ?.trim()
          ui.log.warn(
            `${reason ?? 'The command failed.'}\nRun \`${command}\` again later, or set DTA_BROWSER_PATH to a Chromium binary. \`npx dta diff --check\` tells when the browser is there.`,
          )
          break
        }
      }
    }
  }

  ui.note(
    `${pc.cyan('npx dta diff --check')}  checks the setup\n${pc.cyan('npx dta diff')}          renders a report locally\nThen open a pull request.`,
    'Next',
  )
  return 0
}

/** The project folder relative to the repository root (`.` at the root). */
function repoRelative(cwd: string): string {
  const prefix = gitOutput(cwd, ['rev-parse', '--show-prefix'])?.trim().replace(/\/$/, '')
  return prefix ? prefix : '.'
}

/** `Storybook   build-storybook → storybook-static, from …`: what detection found. */
export function describeDetection(detection: ProjectDetection): string {
  const rows: Array<[string, string]> = [
    [
      'Storybook',
      describeFound(detection.storybook, (s) => `${s.script ?? 'no build script'} → ${s.outDir}`),
    ],
    ['Package manager', describeFound(detection.packageManager)],
    ['Node', describeFound(detection.node)],
    ['Build', describeFound(detection.build)],
    [
      'Git host',
      describeFound(detection.git.host, (h) => (h === 'github' ? 'GitHub' : 'not GitHub')),
    ],
    ['Default branch', describeFound(detection.git.defaultBranch)],
  ]
  const width = Math.max(...rows.map(([label]) => label.length))
  return rows.map(([label, text]) => `${label.padEnd(width)}  ${text}`).join('\n')
}
