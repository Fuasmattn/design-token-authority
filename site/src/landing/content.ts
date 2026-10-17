/**
 * Content of the landing page (TICKET-071, mockup "J · Drafting Table"). Kept as data so the
 * honesty rule is testable: every command the page shows is either shipped or labelled as
 * coming, and the review demo is marked as example data.
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
  build: { text: 'dta build', uses: ['build'], shipped: true },
  govern: { text: 'dta lint && dta diff', uses: ['lint', 'diff'], shipped: true },
  skill: { text: 'dta skill add', uses: ['skill'], shipped: false },
} satisfies Record<string, Command>

export type Severity = 'error' | 'warning' | 'breaking' | 'expected' | 'needs review'

interface FindingBase {
  id: string
  severity: Severity
  /** The real lint rule id, or what the check is called. */
  rule: string
  title: string
  sub: string
  text: string
  actions: [string, string]
  /** A check that is not released yet: labelled "coming" on the finding. */
  coming?: boolean
}

export type Finding =
  | (FindingBase & {
      kind: 'name'
      parts: Array<{ text: string; bad?: boolean }>
      ruleText: string
      fix: string
    })
  | (FindingBase & { kind: 'chain'; from: string; via: string; to: string; gap: string })
  | (FindingBase & { kind: 'rename'; old: string; next: string; uses: string[]; caption: string })
  | (FindingBase & {
      kind: 'tiles'
      tiles: Array<{ radius: number; fill: 'blue-700' | 'blue-600' | 'hatch' }>
      caption: string
    })

export interface FindingTab {
  id: 'structure' | 'breaking' | 'diff'
  label: string
  /** Shown above the findings when the whole check is not released yet. */
  coming?: string
  findings: Finding[]
}

const tiles = (count: number, radius: number, fill: 'blue-700' | 'blue-600' | 'hatch') =>
  Array.from({ length: count }, () => ({ radius, fill }))

/** The "See it" demo: one design change, three kinds of findings. Numbers are example data. */
export const REVIEW_TABS: FindingTab[] = [
  {
    id: 'structure',
    label: 'Structure',
    findings: [
      {
        id: 's1',
        severity: 'warning',
        rule: 'naming-pattern',
        kind: 'name',
        title: '"Blue Button BG" breaks the naming rule',
        sub: 'new variable in the Brand collection',
        text: 'Names follow your convention: component, part, property, lower case. dta flags it and suggests a name; design and engineering agree on the fix in review.',
        parts: [
          { text: 'Blue', bad: true },
          { text: ' ' },
          { text: 'Button' },
          { text: ' ' },
          { text: 'BG', bad: true },
        ],
        ruleText: '{component}.{part}.{property}',
        fix: 'button.bg',
        actions: ['Suggest button.bg', 'Discuss'],
      },
      {
        id: 's2',
        severity: 'error',
        rule: 'layering',
        coming: true,
        kind: 'chain',
        title: 'button.bg skips the semantic layer',
        sub: 'component token points at a primitive',
        text: 'Components should reference semantic tokens, so themes and brands can swap values. This one points straight at blue.600.',
        from: 'button.bg',
        via: 'color.action',
        to: 'blue.600',
        gap: 'skips semantic',
        actions: ['Point to color.action', 'Allow exception'],
      },
      {
        id: 's3',
        severity: 'warning',
        rule: 'semantic-must-alias',
        kind: 'rename',
        title: 'color.surface holds a raw value',
        sub: '#FFFFFF instead of an alias',
        text: 'Semantic tokens should alias a primitive. A raw value will not follow brand or theme changes.',
        old: '#FFFFFF',
        next: '{paper.0}',
        uses: ['Light', 'Dark: missing'],
        caption: 'the dark theme has no value for this token',
        actions: ['Alias paper.0', 'Ignore once'],
      },
    ],
  },
  {
    id: 'breaking',
    label: 'Breaking changes',
    coming: 'Breaking-change detection is coming: renames and removals traced into your code.',
    findings: [
      {
        id: 'b1',
        severity: 'breaking',
        rule: 'rename',
        kind: 'rename',
        title: 'color.cta was renamed',
        sub: 'color.cta → color.action · used in 14 places',
        text: 'Code still references the old name. Keep it as a deprecated alias for one release, or block the change.',
        old: 'color.cta',
        next: 'color.action',
        uses: ['Button.tsx', 'Banner.tsx', 'checkout.css', '+ 11 more'],
        caption: 'references found in your repository',
        actions: ['Keep alias', 'Block'],
      },
      {
        id: 'b2',
        severity: 'breaking',
        rule: 'removal',
        kind: 'rename',
        title: 'spacing.xl was deleted',
        sub: 'still used by 3 components',
        text: 'Removing it would break three components. Restore it, or map it to the closest existing step.',
        old: 'spacing.xl',
        next: 'space-16 (64px)',
        uses: ['Hero', 'Pricing', 'Footer'],
        caption: 'closest value on the scale: space-16',
        actions: ['Map to space-16', 'Restore'],
      },
    ],
  },
  {
    id: 'diff',
    label: 'Visual diff',
    findings: [
      {
        id: 'd1',
        severity: 'expected',
        rule: 'visual diff',
        kind: 'tiles',
        title: 'color.action changed',
        sub: 'blueprint.600 → 700 · 96 stories',
        text: 'One token explains every one of these diffs. Review a few samples, then approve the whole group.',
        tiles: tiles(6, 6, 'blue-700'),
        caption: '6 of 96 samples · grouped by cause',
        actions: ['Approve group', 'Open all 96'],
      },
      {
        id: 'd2',
        severity: 'expected',
        rule: 'visual diff',
        kind: 'tiles',
        title: 'radius.card changed',
        sub: '6 → 12 · 38 stories',
        text: 'Every card, input and button that uses radius.card. Nothing else moved.',
        tiles: tiles(6, 12, 'blue-600'),
        caption: '6 of 38 samples',
        actions: ['Approve group', 'Open all 38'],
      },
      {
        id: 'd3',
        severity: 'needs review',
        rule: 'visual diff',
        kind: 'tiles',
        title: '4 stories changed without a token change',
        sub: 'Pricing, Hero, Footer, Banner',
        text: 'No token explains these. Usually a component code change: review each one.',
        tiles: tiles(4, 6, 'hatch'),
        caption: 'unexplained · compared against main',
        actions: ['Review each', 'Comment'],
      },
    ],
  },
]

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
