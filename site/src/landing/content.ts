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
  lint: { text: 'dta lint', uses: ['lint'], shipped: true },
  build: { text: 'dta build', uses: ['build'], shipped: true },
  diff: { text: 'dta diff', uses: ['diff'], shipped: true },
  audit: { text: 'dta audit', uses: ['audit'], shipped: true },
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

/**
 * The workflow at a glance, right below the hero (spec decision 12, TICKET-112): two sides
 * meeting in a pull request, unnumbered. The change is made on the design side (or in a file, or
 * by an agent), `dta pull` carries it across, and in the pull request it is checked, built,
 * diffed and decided. A fix goes back to whichever side caused it; there is no arrow back.
 */
export const WORKFLOW = {
  title: 'How it works',
  change: {
    side: 'where the change is made',
    label: 'Change',
    text: 'In Figma Variables, in a token file, or by an agent.',
  },
  crossing: { command: COMMANDS.pull, text: 'into the repository' },
  pullRequest: 'in the pull request',
  steps: [
    { label: 'Check', text: 'Structure and names, against your rules.', command: COMMANDS.lint },
    { label: 'Build', text: 'Every output, for every brand and mode.', command: COMMANDS.build },
    {
      label: 'Diff',
      text: 'Before and after, each difference named by token.',
      command: COMMANDS.diff,
    },
    { label: 'Decide', text: 'A person approves by token.' },
  ],
  back: {
    text: 'A fix goes back to whichever side caused it: a value in Figma, or a component in code.',
    command: COMMANDS.audit,
    detail: 'finds the hard-coded ones',
  },
}

/**
 * One change, four scenes, in the order of the strip (maintainer, 2026-10-19, TICKET-114 item 5):
 * the change crossing over (`dta pull`), the checks (`dta lint` first, then every output is
 * rebuilt; `dta build` lives in the strip), the differences and the person who approves them
 * (`dta diff`: the approve action sits with the diff, because that is what a person decides on),
 * and the agent. The example product is Orbit Burger (site/examples/orbit-burger).
 */
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
    kicker: 'The checks run first',
    heading: 'Structure and names are checked before anyone looks.',
    text: 'dta lint checks the change against your rules, then every output is rebuilt. Nothing here needs a person: what is left is what changed on screen.',
    command: COMMANDS.lint,
  },
  {
    number: '03',
    kicker: 'A person decides',
    heading: 'Approve by token, not by screenshot.',
    text: 'dta diff renders the stories before and after and names the token behind each change. The rounder corners are obvious; the darker orange is easy to miss. Approving is a label on the pull request; a new push asks again.',
    command: COMMANDS.diff,
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
 * Scene 03: how much of the differences each token explains. Illustrative until the recorded
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

/** Scene 02: the checks of the pull request, in the order of the strip (lint, build, diff). */
export const CHECKS = [
  { name: 'dta lint', status: 'passed' as const, detail: '0 violations' },
  { name: 'dta build', status: 'passed' as const },
  { name: 'dta diff', status: 'changes' as const, detail: '2 stories' },
]
/** Scene 03: the check that waits for a person, and the approve action under it. */
export const DECISION = CHECKS.filter((check) => check.status === 'changes')
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
