/**
 * Content of the landing page (spec: docs/specs/landing-redesign.md). Kept as data so the
 * honesty rule is testable: every command the page shows exists (landing.test.ts checks the
 * names against the CLI), and every output shown as real comes from a real run.
 */
/**
 * DTA is on npm since 2.0.1 (TICKET-090), so `npm create dta` works as written. (The npm name
 * `dta` belongs to an unrelated package, so the page never shows `npx dta`.)
 */
export const NPM_RELEASED = true

/** A CLI command the page shows. */
export interface Command {
  text: string
  /** The `dta` commands it uses, in full (`skill add`; checked against the CLI in landing.test.ts). */
  uses: string[]
  /** Works as written today: the subcommands exist and, for `npm create`, the package is released. */
  shipped: boolean
}

export const COMMANDS = {
  /** Hero and final call: the one command on the page (TICKET-169). */
  init: { text: 'npm create dta', uses: ['init'], shipped: NPM_RELEASED },
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
 * The workflow at a glance, right below the hero (spec revision note 2026-10-28, TICKET-174): the
 * three commands that run on a token change and the person who approves it, one sentence each.
 * The headline names the benefit; the link goes to the command reference.
 */
export const WORKFLOW = {
  kicker: 'How it works',
  title: 'Catch naming, structure and visual mistakes before a token change merges.',
  steps: [
    {
      command: 'dta lint',
      text: 'Validates names and structure against your rules, and finds broken aliases and low contrast.',
    },
    { command: 'dta build', text: 'Rebuilds every output for every brand and mode.' },
    { command: 'dta diff', text: 'Shows which stories look different, and which token did it.' },
    { who: 'You', text: 'Look once per token change and approve it.' },
  ],
  link: { label: 'Command reference', href: '/reference/commands/' },
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
