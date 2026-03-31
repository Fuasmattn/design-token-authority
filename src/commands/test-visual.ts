/**
 * TICKET-023: `dta test:visual` command.
 *
 * Runs Playwright visual regression tests against the build output.
 * Compares screenshots of HTML fixture pages to baseline images.
 *
 * Options:
 *   --update-baseline  Update baseline screenshots after intentional changes
 */

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import * as p from '@clack/prompts'
import pc from 'picocolors'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface TestVisualOptions {
  updateBaseline?: boolean
  verbose?: boolean
}

export async function runTestVisual(options: TestVisualOptions): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' dta test:visual ')))

  const configPath = path.resolve(__dirname, '../../test/visual/playwright.config.ts')

  const args = ['npx', 'playwright', 'test', '--config', configPath]
  if (options.updateBaseline) {
    args.push('--update-snapshots')
    p.log.info('Updating baseline screenshots...')
  }

  const s = p.spinner()
  s.start('Running visual regression tests...')

  try {
    const result = execSync(args.join(' '), {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      stdio: options.verbose ? 'inherit' : 'pipe',
      env: { ...process.env, FORCE_COLOR: '1' },
    })

    s.stop(pc.green('All visual tests passed'))

    if (!options.verbose && result) {
      // Show a summary from Playwright output
      const passedMatch = result.match(/(\d+) passed/)
      if (passedMatch) {
        p.log.success(`${passedMatch[1]} screenshot${passedMatch[1] === '1' ? '' : 's'} matched`)
      }
    }

    if (options.updateBaseline) {
      p.log.info('Baseline screenshots have been updated.')
      p.log.message(pc.dim('Commit the new baselines in test/visual/baseline/'))
    }

    p.outro(pc.green('Visual regression tests passed!'))
  } catch (err) {
    s.stop(pc.red('Visual tests failed'))

    if (!options.verbose && err && typeof err === 'object' && 'stdout' in err) {
      const stdout = (err as { stdout: string }).stdout
      // Extract failure lines
      const lines = stdout
        .split('\n')
        .filter((l: string) => l.includes('FAIL') || l.includes('Error'))
      if (lines.length > 0) {
        for (const line of lines.slice(0, 10)) {
          p.log.error(line.trim())
        }
      }
    }

    p.log.message(
      pc.dim('Run with ') +
        pc.cyan('--verbose') +
        pc.dim(' for full output, or ') +
        pc.cyan('--update-baseline') +
        pc.dim(' to accept changes.'),
    )

    const reportPath = path.resolve(__dirname, '../../test/visual/report/index.html')
    p.log.message(pc.dim(`Diff report: ${reportPath}`))

    p.outro(pc.red('Visual regression tests failed.'))
    process.exit(1)
  }
}
