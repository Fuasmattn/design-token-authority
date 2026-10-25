/**
 * Every way `dta diff` can stop, with the fix and where the docs explain it (TICKET-130,
 * spec diff-zero-setup decision 7). `dta diff` reports problems only through these.
 */

/**
 * The website (TICKET-075), where the docs live. The same address as `site/site-url.mjs`
 * (a test keeps them equal).
 */
export const SITE_URL = 'https://dta.martinprinz.dev'

/**
 * A heading's anchor on the website, as Starlight makes it (github-slugger): lower case, without
 * punctuation and symbols, spaces as hyphens.
 */
export function headingSlug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-')
}

export interface DocsRef {
  /** The page, as on the website: `guides/dta-diff-in-pull-requests`. */
  page: string
  /** The section's heading, as written on the page; the link goes to its anchor. */
  section?: string
}

export interface DiffProblem {
  message: string
  /** The concrete fix: a config key, a command. */
  fix: string
  docs: DocsRef
}

const GUIDE = 'guides/dta-diff-in-pull-requests'
const STORYBOOK = 'guides/dta-diff-with-storybook'

export function docsUrl(ref: DocsRef): string {
  return `${SITE_URL}/${ref.page}/${ref.section ? `#${headingSlug(ref.section)}` : ''}`
}

/** `dta diff: message`, then the fix and the docs link, indented. */
export function formatProblem(problem: DiffProblem): string {
  return `dta diff: ${problem.message}\n  Fix: ${problem.fix}\n  Docs: ${docsUrl(problem.docs)}\n`
}

const buildFirst = (build: string | undefined) =>
  build ? `run \`${build}\` first` : 'build the project first (and set diff.build)'

export const diffProblems = {
  unknownFormat: (requested: string, formats: readonly string[]): DiffProblem => ({
    message: `unknown format "${requested}".`,
    fix: `use --format ${formats.join(', --format ')}.`,
    docs: { page: 'reference/commands', section: 'dta diff' },
  }),
  fromReportWithoutHook: (): DiffProblem => ({
    message: '--from-report needs a publish hook.',
    fix: 'pass --publish "<command>" or set diff.publish in dta.config.ts.',
    docs: { page: GUIDE, section: 'Publishing the report' },
  }),
  fromReportWithoutResult: (dir: string): DiffProblem => ({
    message: `no result.json in ${dir}.`,
    fix: 'run `dta diff` first; --from-report publishes the report of the last run.',
    docs: { page: GUIDE, section: 'Publishing the report' },
  }),
  publishFailed: (message: string): DiffProblem => ({
    message,
    fix: 'run the publish command by hand on the report folder; it must print the public URL as its last line.',
    docs: { page: GUIDE, section: 'Publishing the report' },
  }),
  noTokens: (message: string): DiffProblem => ({
    message: message.replace(/\n.*/s, ''),
    fix: 'set tokens.dir in dta.config.ts to the folder with your token files, or run `dta pull`.',
    docs: { page: 'reference/configuration' },
  }),
  noBase: (message: string): DiffProblem => ({
    message,
    fix: 'in CI, check out the whole history (actions/checkout with fetch-depth: 0); or pass --base <ref|dir>, or set diff.base.',
    docs: { page: GUIDE, section: 'Troubleshooting' },
  }),
  tokenErrors: (): DiffProblem => ({
    message: 'the token files above have errors.',
    fix: 'fix them; `dta lint` lists the same problems with their files.',
    docs: { page: 'reference/lint-rules' },
  }),
  noBrowser: (message: string): DiffProblem => ({
    message,
    fix: '`npm i -D playwright-core` and `npx playwright install chromium`, or set DTA_BROWSER_PATH to a Chromium binary; --tokens-only skips screenshots on purpose.',
    docs: { page: GUIDE, section: 'Troubleshooting' },
  }),
  commandFailed: (message: string, command: string): DiffProblem => ({
    message,
    fix: `run \`${command}\` yourself to see why; diff.build must build the static output, and diff.setup prepares a fresh checkout of the base.`,
    docs: { page: GUIDE, section: 'Troubleshooting' },
  }),
  noDiffSection: (): DiffProblem => ({
    message: 'no `diff` section in the config.',
    fix: 'run `dta init` (it sets up dta diff in a project with a config), or add at least `diff: { outDir: "dist" }` to dta.config.ts.',
    docs: { page: GUIDE, section: 'Before you start' },
  }),
  storiesMissing: (message: string, build: string | undefined): DiffProblem => ({
    message: `${message}.`,
    fix: `${buildFirst(build)}; check diff.outDir and diff.stories.`,
    docs: { page: GUIDE, section: 'Which pages it renders' },
  }),
  storiesInvalid: (message: string): DiffProblem => ({
    message: `${message}.`,
    fix: 'fix diff.stories, or the manifest or Storybook index it points at.',
    docs: { page: GUIDE, section: 'Which pages it renders' },
  }),
  pagesAbsent: (
    urls: readonly string[],
    where: string,
    build: string | undefined,
  ): DiffProblem => ({
    message: `${urls.map((url) => `"${url}"`).join(', ')} ${urls.length === 1 ? 'is' : 'are'} not in ${where}.`,
    fix: `${buildFirst(build)}, or fix the path in diff.stories.`,
    docs: { page: GUIDE, section: 'Which pages it renders' },
  }),
  noStorybookIndex: (where: string, build: string | undefined): DiffProblem => ({
    message: `no Storybook index at ${where}.`,
    fix: `${buildFirst(build)}; diff.outDir is the \`storybook build\` output folder.`,
    docs: { page: STORYBOOK },
  }),
  baseBuildFailed: (message: string, command: string): DiffProblem => ({
    message: `the base did not build: ${message}`,
    fix: `run \`${command}\` on the base commit to see why; set diff.setup to the command that prepares a fresh checkout (an install) if the automatic install does not fit.`,
    docs: { page: GUIDE, section: 'Troubleshooting' },
  }),
  /** Anything else that stops dta diff (TICKET-148): still with a way forward. */
  unexpected: (message: string): DiffProblem => ({
    message: `Unexpected error: ${message}`,
    fix: 'run `dta diff --check`; if every check passes, report it with this output at https://github.com/Fuasmattn/design-token-authority/issues.',
    docs: { page: GUIDE, section: 'Troubleshooting' },
  }),
} satisfies Record<string, (...args: never[]) => DiffProblem>
