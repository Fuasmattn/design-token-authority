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
 * The workflow at a glance, right below the hero (spec decision 12, revised 2026-10-25,
 * TICKET-155): three beats on one line, the token travelling it. No commands on the page beyond
 * `npm create dta`: the second beat links to the command reference instead (TICKET-169).
 */
export const WORKFLOW = {
  title: 'Design changes, reviewed like code.',
  kicker: 'How it works',
  beats: [
    {
      where: 'Where design happens',
      title: 'Tokens change',
      text: 'Edited or added in Figma Variables, in a token file, or by an agent, and pulled into the repository as one change.',
    },
    {
      where: 'In the pull request',
      title: 'Checked, built, rendered',
      text: 'Structure and names are checked against your rules, every output is rebuilt, and the stories are rendered before and after with the token named behind each difference.',
      link: { label: 'Command reference', href: '/reference/' },
    },
    {
      where: 'Still in the pull request',
      title: 'The team decides',
      text: 'Signs the change off by token, or sends it back to whichever side caused it.',
    },
  ],
  end: 'Merged',
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
