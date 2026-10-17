/**
 * Content of the landing page (TICKET-071, mockup "J · Drafting Table"). Kept as data so the
 * honesty rule is testable: every command the page shows is either shipped or labelled as
 * coming (one exception, see COMMANDS.init).
 */

/**
 * DTA is not on npm yet (TICKET-090). Until it is, a command that runs through `npx` or
 * `npm create` does not work as written. (The npm name `dta` belongs to an unrelated package,
 * so the page never shows `npx dta`; `npm create dta` runs our own `create-dta` package.)
 */
export const NPM_RELEASED = false

/** A CLI command the page shows. `shipped: false` renders with a "coming" label. */
export interface Command {
  text: string
  /** The `dta` subcommands it uses (checked against the CLI in landing.test.ts). */
  uses: string[]
  /** Works as written today: the subcommands exist and, for `npx`, the package is released. */
  shipped: boolean
}

export const COMMANDS = {
  /** Hero and footer. Shown without a "coming" label by maintainer decision (TICKET-098). */
  init: { text: 'npm create dta', uses: ['init'], shipped: NPM_RELEASED },
  skill: { text: 'dta skill add', uses: ['skill'], shipped: false },
} satisfies Record<string, Command>

/** The trust terminal: lines from a real `dta diff` run on this website's own tokens. */
export const TRUST_RUN = {
  label: 'dta diff on this website: action.bg 600 → 700 and space.2 8 → 12',
  lines: [
    [{ text: '$ ', tone: 'prompt' as const }, { text: 'npx dta diff' }],
    [{ text: 'changed  space.2  Primitives · Value', tone: 'muted' as const }],
    [{ text: 'changed  action.bg  Theme · Light', tone: 'muted' as const }],
    [{ text: 'Rendering: 10 stories', tone: 'muted' as const }],
    [
      {
        text: 'space.2 (Primitives · Value) explains 8 of 9 changed stories',
        tone: 'muted' as const,
      },
    ],
    [{ text: 'action.bg (Theme · Light) explains 7 of 9 changed stories', tone: 'muted' as const }],
    [
      { text: 'Stories: 9 changed · 6 unchanged  ' },
      { text: 'Changes to review', tone: 'signal' as const },
    ],
  ],
}
