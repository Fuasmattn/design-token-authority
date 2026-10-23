import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { diffProblems, formatProblem } from './diff-problems.js'

const DOCS = path.resolve(import.meta.dirname, '..', '..', '..', 'site', 'src', 'content', 'docs')

describe('dta diff problems (TICKET-130)', () => {
  // Every way dta diff stops, with sample arguments (a test fails when one is added without).
  const samples: Record<keyof typeof diffProblems, unknown[]> = {
    unknownFormat: ['html', ['console', 'json']],
    fromReportWithoutHook: [],
    fromReportWithoutResult: ['.dta/diff'],
    publishFailed: ['the publish hook failed'],
    noTokens: ['Tokens directory "tokens" not found.'],
    noBase: ['HEAD has no merge base with main.'],
    tokenErrors: [],
    noBrowser: ['No browser for screenshots.'],
    commandFailed: ['`npm run build` failed', 'npm run build'],
    noDiffSection: [],
    storiesMissing: ['no stories manifest at dist/stories/manifest.json', 'npm run build'],
    storiesInvalid: ['dist/stories/manifest.json is not valid JSON'],
    pagesAbsent: [['/pricing'], 'dist', 'npm run build'],
    noStorybookIndex: ['storybook-static/index.json', undefined],
    baseBuildFailed: ['`npm run build` failed', 'npm run build'],
  }
  const all = Object.entries(diffProblems).map(([name, make]) => ({
    name,
    problem: (make as (...args: unknown[]) => ReturnType<typeof diffProblems.noBase>)(
      ...samples[name as keyof typeof diffProblems],
    ),
  }))

  it.each(all)('$name names a fix and a docs page that exists', ({ problem }) => {
    expect(problem.message.length).toBeGreaterThan(0)
    expect(problem.fix.length).toBeGreaterThan(0)
    const text = formatProblem(problem)
    expect(text).toMatch(/^dta diff: .+\n {2}Fix: .+\n {2}Docs: https:\/\/.+\n$/s)
    expect(
      fs.existsSync(path.join(DOCS, `${problem.docs.page}.mdx`)) ||
        fs.existsSync(path.join(DOCS, `${problem.docs.page}.md`)),
    ).toBe(true)
  })

  it('names sections that exist on their page', () => {
    for (const { problem } of all) {
      const { page, section } = problem.docs
      if (!section || page === 'reference/commands') continue
      const file = [`${page}.mdx`, `${page}.md`].map((f) => path.join(DOCS, f)).find(fs.existsSync)
      const text = fs.readFileSync(file ?? '', 'utf8')
      expect(text, `${page}: "${section}"`).toMatch(new RegExp(`^#+ ${section}$`, 'm'))
    }
  })

  it('is the only way dta diff reports a failure', () => {
    const source = fs.readFileSync(path.join(import.meta.dirname, 'commands', 'diff.ts'), 'utf8')
    // fail() takes a DiffProblem; no message is written to stderr by hand.
    expect(source).not.toMatch(/\bfail\(\s*['"`]/)
    expect(source).not.toMatch(/stderr\(\s*`dta diff:/)
    expect(source).not.toMatch(/new VisualDiffError\(\s*['"`]/)
  })
})
