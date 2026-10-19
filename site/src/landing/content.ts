/**
 * Content of the landing page (spec: docs/specs/landing-redesign.md). Kept as data so the
 * honesty rule is testable: every command the page shows exists (landing.test.ts checks the
 * names against the CLI), and every output shown as real comes from a real run.
 */

/**
 * DTA is not on npm yet (TICKET-090). Until it is, `npm create dta` does not work as written;
 * it is shown unmarked by maintainer decision (TICKET-098). (The npm name `dta` belongs to an
 * unrelated package, so the page never shows `npx dta`.)
 */
export const NPM_RELEASED = false

/** A CLI command the page shows. */
export interface Command {
  text: string
  /** The `dta` commands it uses, in full (`skill add`; checked against the CLI in landing.test.ts). */
  uses: string[]
  /** Works as written today: the subcommands exist and, for `npm create`, the package is released. */
  shipped: boolean
}

export const COMMANDS = {
  /** Hero and final call. */
  init: { text: 'npm create dta', uses: ['init'], shipped: NPM_RELEASED },
  pull: { text: 'dta pull', uses: ['pull'], shipped: true },
  diff: { text: 'dta diff', uses: ['diff'], shipped: true },
  build: { text: 'dta build', uses: ['build'], shipped: true },
  skill: { text: 'dta skill add', uses: ['skill add'], shipped: true },
} satisfies Record<string, Command>

export const HERO = {
  headline: 'The deterministic centre of gravity for design token workflows, built for humans and',
  /** The last word of the headline, set in the action colour, italic. */
  headlineAccent: 'agents.',
  subline:
    'A toolset to lint, structure-check, transform and visually diff design tokens. Synced with Figma, shipped as pull requests.',
  secondary: { label: 'Read the quick start', href: '/start/quick-start/' },
}

/** One change, four scenes. The example product is Orbit Burger (site/examples/orbit-burger). */
export const SCENES = [
  {
    number: '01',
    kicker: 'Something changes',
    heading: 'A change lands as a pull request.',
    text: 'A rounder card and a slightly deeper brand orange. Made in Figma Variables or in a token file; either way DTA pulls them into the repository as one change.',
    command: COMMANDS.pull,
  },
  {
    number: '02',
    kicker: 'The pull request shows the differences',
    heading: 'There are differences to review. DTA knows whether tokens caused them.',
    text: 'dta diff renders the stories before and after and names the token behind each change. The rounder corners are obvious. The darker orange is easy to miss.',
    command: COMMANDS.diff,
  },
  {
    number: '03',
    kicker: 'A person decides',
    heading: 'Approve by token, not by screenshot.',
    text: 'The checks say what changed and why. Approving is a label on the pull request; a new push asks again. Then every output is rebuilt.',
    command: COMMANDS.build,
  },
  {
    number: '04',
    kicker: 'Your agent uses the same commands',
    heading: 'No hard-coded values, even from agents.',
    text: 'The skill teaches the loop; the context file lists your tokens. The agent proposes, the checks decide, and nothing reaches Figma without a person.',
    command: COMMANDS.skill,
  },
] as const

/** Scene 01: the three Orbit Burger tokens, two of them changed (tokens-base → tokens). */
export const TOKEN_ROWS = [
  { name: 'Colors.Surface.Default', value: 'Void.900', swatch: { color: '--void-900' } },
  { name: 'Colors.Brand.Primary', value: '600', from: 'Nova.500', swatch: { color: '--nova-600' } },
  { name: 'Radius.Card', value: '24', from: '8', swatch: { radius: 'lg' as const } },
]

/**
 * Scene 02: how much of the differences each token explains. Illustrative until the recorded
 * `dta diff` run on this site's Orbit Burger stories replaces it (TICKET-108 outcome); the note
 * says so on the page (honesty rule).
 */
export const DIFF_SHARES = {
  lines: [
    { token: 'Radius.Card', change: '8 → 24', share: 'explains 94 % of the changed pixels' },
    { token: 'Colors.Brand.Primary', change: 'Nova 500 → 600', share: 'explains the other 6 %' },
  ],
  note: 'illustrative numbers until the Orbit Burger fixture is recorded',
  real: false,
}

/** Scene 03: the checks of the pull request. */
export const CHECKS = [
  { name: 'dta lint', status: 'passed' as const, detail: '0 violations' },
  { name: 'dta diff', status: 'changes' as const, detail: '2 stories' },
  { name: 'dta build', status: 'pending' as const },
]
export const APPROVE = 'Add label dta-diff-approved'

/**
 * Scene 04: real output of `dta token find '#2443ac'` and `dta audit src` on this website's own
 * tokens and source (2026-10-18; #2443ac is blueprint.700, the action colour on paper).
 */
export const AGENT_RUN = {
  label: 'An agent looking a value up before it writes it',
  lines: [
    [
      { text: 'Agent ', tone: 'muted' as const },
      { text: 'The button needs the brand blue. Looking it up first.' },
    ],
    [{ text: '$ ', tone: 'prompt' as const }, { text: "dta token find '#2443ac'" }],
    [{ text: '2 tokens resolve to #2443ac:', tone: 'muted' as const }],
    [
      { text: '  ' },
      { text: 'action.bg', tone: 'ok' as const },
      { text: '      Light       var(--action-bg)' },
    ],
    [{ text: '  blueprint.700  every mode  var(--blueprint-700)', tone: 'muted' as const }],
    [{ text: '$ ', tone: 'prompt' as const }, { text: 'dta audit src' }],
    [{ text: 'No hard-coded token values in 67 files.', tone: 'ok' as const }],
  ],
}

export const FACTS = [
  {
    term: 'Open source',
    text: "MIT. Runs locally, in CI and in your agent's terminal. No account.",
  },
  { term: 'Your structure', text: 'Your collections, modes and names, in the open DTCG format.' },
  { term: 'Every Figma plan', text: 'REST API on Enterprise, plugin export everywhere else.' },
  { term: 'Deterministic', text: 'Same input, same result, on every machine.' },
]

export const FINAL = {
  heading: 'Start with one command.',
  text: 'Sets up the config, the token folder, the GitHub workflow and the agent skill.',
}
