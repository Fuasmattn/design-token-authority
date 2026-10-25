import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { commandReference } from './commands.js'
import { diffProblems, docsUrl, formatProblem, headingSlug, SITE_URL } from './diff-problems.js'

const DOCS = path.resolve(import.meta.dirname, '..', '..', '..', 'site', 'src', 'content', 'docs')

describe('docs links (TICKET-148)', () => {
  it('point at the website, with the section as an anchor', () => {
    expect(docsUrl({ page: 'guides/dta-diff-in-pull-requests' })).toBe(
      'https://dta.martinprinz.dev/guides/dta-diff-in-pull-requests/',
    )
    expect(
      docsUrl({ page: 'guides/dta-diff-in-pull-requests', section: 'One workflow or three' }),
    ).toBe('https://dta.martinprinz.dev/guides/dta-diff-in-pull-requests/#one-workflow-or-three')
  })

  it('use the address the website is served at', () => {
    const site = fs.readFileSync(path.join(DOCS, '..', '..', '..', 'site-url.mjs'), 'utf8')
    expect(site).toContain(`export const SITE_URL = '${SITE_URL}'`)
  })

  it('slug a heading the way Starlight does (github-slugger)', () => {
    expect(headingSlug('Before you start')).toBe('before-you-start')
    expect(headingSlug('dta diff')).toBe('dta-diff')
    expect(headingSlug('Change your setup later')).toBe('change-your-setup-later')
    expect(headingSlug('Without GitHub')).toBe('without-github')
    expect(headingSlug('Stories, pages & Storybook: 2.0')).toBe('stories-pages--storybook-20')
  })
})

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
    unexpected: ['EPIPE: broken pipe'],
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

  it('names sections that exist on their page, and links to their anchor (TICKET-148)', () => {
    // The commands reference is generated at site build: one "## dta <command>" per command.
    const commands = commandReference().map((command) => `dta ${command.name}`)
    for (const { problem } of all) {
      const { page, section } = problem.docs
      if (!section) continue
      if (page === 'reference/commands') {
        expect(commands, `reference/commands: "${section}"`).toContain(section)
      } else {
        const file = [`${page}.mdx`, `${page}.md`]
          .map((f) => path.join(DOCS, f))
          .find(fs.existsSync)
        const text = fs.readFileSync(file ?? '', 'utf8')
        expect(text, `${page}: "${section}"`).toMatch(new RegExp(`^#+ ${section}$`, 'm'))
      }
      expect(docsUrl(problem.docs)).toBe(`${SITE_URL}/${page}/#${headingSlug(section)}`)
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
