/**
 * Every story of the design system, once: the docs pages show them inline (both themes), the
 * story routes render each alone for `dta diff`, and the manifest lists them. Rendering is
 * mapped in registry.ts; this file is plain data so it can be tested without Astro.
 */
export interface Story {
  /** Component slug, also the docs page: `/design-system/components/<component>/`. */
  component: string
  variant: string
  title: string
  /** File name of the example in src/examples (without `.astro`). */
  example: string
  /** Suggested viewport widths for screenshots. */
  viewports: number[]
}

const DESKTOP = 1280
const MOBILE = 390

export const STORIES: readonly Story[] = [
  {
    component: 'button',
    variant: 'variants',
    title: 'Primary, outline, quiet, link',
    example: 'ButtonVariants',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'command-button',
    variant: 'default',
    title: 'Copyable command',
    example: 'CommandButtonDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'command-button',
    variant: 'large',
    title: 'The call to action',
    example: 'CommandButtonLarge',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'scene',
    variant: 'default',
    title: 'Kicker, heading, paragraph, command, example',
    example: 'SceneDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'example-button',
    variant: 'states',
    title: 'Main and this change',
    example: 'ExampleButtonStates',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'token-rows',
    variant: 'default',
    title: 'Three rows, two edited',
    example: 'TokenRowsDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'checks',
    variant: 'default',
    title: 'The checks in the order of the strip',
    example: 'ChecksDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'checks',
    variant: 'states',
    title: 'Every status: passed, with warnings, failed, changes to review, pending',
    example: 'ChecksStates',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'checks',
    variant: 'decision',
    title: 'The check that waits for a person, and the approve action',
    example: 'ChecksDecision',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'gravity-well',
    variant: 'default',
    title: 'The well at rest, with the copy on it',
    example: 'GravityWellDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'gravity-well',
    variant: 'large',
    title: 'Size L, position B, tilt 52',
    example: 'GravityWellLarge',
    viewports: [DESKTOP],
  },
  {
    component: 'floating-objects',
    variant: 'default',
    title: 'Objects floating free around the final call',
    example: 'FloatingObjectsDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'facts',
    variant: 'default',
    title: 'Four big words',
    example: 'FactsDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'chip',
    variant: 'states',
    title: 'Info, changed, and the status colours: pass, error, warning',
    example: 'ChipStates',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'text-field',
    variant: 'default',
    title: 'Label, field, help',
    example: 'TextFieldDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'terminal',
    variant: 'diff',
    title: 'Output of dta diff',
    example: 'TerminalDiff',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'redline',
    variant: 'radius',
    title: 'Measuring a radius',
    example: 'RedlineCard',
    viewports: [DESKTOP],
  },
  {
    component: 'redline',
    variant: 'spacing',
    title: 'Measuring a length',
    example: 'RedlineSpacing',
    viewports: [DESKTOP],
  },
  {
    component: 'diff-card',
    variant: 'review',
    title: 'Change to review',
    example: 'DiffCardReview',
    viewports: [DESKTOP],
  },
  {
    component: 'diff-card',
    variant: 'blocked',
    title: 'Blocked change',
    example: 'DiffCardBlocked',
    viewports: [DESKTOP],
  },
  {
    component: 'nav',
    variant: 'default',
    title: 'Links, or a menu button on phones',
    example: 'NavDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'nav',
    variant: 'open',
    title: 'Menu open on a phone, Docs the page shown',
    example: 'NavOpen',
    viewports: [MOBILE],
  },
  {
    component: 'nav',
    variant: 'current',
    title: 'The page you are on: Playground',
    example: 'NavCurrent',
    viewports: [DESKTOP],
  },
  {
    component: 'logo',
    variant: 'default',
    title: 'Mark and wordmark',
    example: 'LogoDefault',
    viewports: [DESKTOP],
  },
  {
    component: 'theme-switch',
    variant: 'default',
    title: 'Light and Graphite',
    example: 'ThemeSwitchDefault',
    viewports: [DESKTOP],
  },
  {
    component: 'badge',
    variant: 'tones',
    title: 'Example, coming, note',
    example: 'BadgeTones',
    viewports: [DESKTOP],
  },
  {
    component: 'card',
    variant: 'variants',
    title: 'Surface, featured, link on grid paper',
    example: 'CardVariants',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'token-cycle',
    variant: 'default',
    title: 'A word and the token that styles it',
    example: 'TokenCycleDefault',
    viewports: [DESKTOP],
  },
  {
    component: 'workflow-rail',
    variant: 'default',
    title: 'Two sides meeting in a pull request',
    example: 'WorkflowRailDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'token-input',
    variant: 'empty',
    title: 'Drop area, example, paste field',
    example: 'TokenInputEmpty',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'token-input',
    variant: 'paste',
    title: "Paste JSON instead: the paste field in the drop area's place",
    example: 'TokenInputPaste',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'structure-table',
    variant: 'brand-ab',
    title: 'Three collections, three roles',
    example: 'StructureTableBrandAb',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'structure-table',
    variant: 'review',
    title: 'Roles to review, with notes',
    example: 'StructureTableReview',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'findings',
    variant: 'lint',
    title: 'Lint warnings by file',
    example: 'FindingsLint',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'findings',
    variant: 'input',
    title: 'Input that cannot be read',
    example: 'FindingsInput',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'findings',
    variant: 'unknown',
    title: 'An export it does not know, with the page that explains the formats',
    example: 'FindingsUnknown',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'structure-table',
    variant: 'selectable',
    title: 'Rows that open their details, one open',
    example: 'StructureTableSelectable',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'findings',
    variant: 'build-failed',
    title: 'The build has errors: a status banner',
    example: 'FindingsBuildFailed',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'findings',
    variant: 'rules',
    title: 'Grouped by rule with counts, one rule open',
    example: 'FindingsRules',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'findings',
    variant: 'clean',
    title: 'No findings',
    example: 'FindingsClean',
    viewports: [DESKTOP],
  },
  {
    component: 'source-bar',
    variant: 'example',
    title: 'The example loaded',
    example: 'SourceBarExample',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'source-bar',
    variant: 'import',
    title: 'A plugin export converted, paste field open',
    example: 'SourceBarImport',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'summary-line',
    variant: 'default',
    title: 'Counts that open their view, outputs built',
    example: 'SummaryLineDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'summary-line',
    variant: 'problems',
    title: 'Status counts: lint errors and a failed build',
    example: 'SummaryLineProblems',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'tabs',
    variant: 'structure',
    title: 'Four views, Structure selected',
    example: 'TabsStructure',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'tabs',
    variant: 'lint',
    title: 'Lint selected, with a count; sticky on phones',
    example: 'TabsLint',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'detail-panel',
    variant: 'side',
    title: 'A collection beside the view',
    example: 'DetailPanelSide',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'detail-panel',
    variant: 'sheet',
    title: 'A finding in the bottom sheet',
    example: 'DetailPanelSheet',
    viewports: [MOBILE],
  },
  {
    component: 'detail-panel',
    variant: 'file',
    title: 'An output file beside the view, with Copy and Download',
    example: 'DetailPanelFile',
    viewports: [DESKTOP],
  },
  {
    component: 'detail-panel',
    variant: 'file-sheet',
    title: 'An output file in the bottom sheet',
    example: 'DetailPanelFileSheet',
    viewports: [MOBILE],
  },
  {
    component: 'output-options',
    variant: 'default',
    title: 'Four outputs, three chosen, Download all',
    example: 'OutputOptionsDefault',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'output-files',
    variant: 'brand-ab',
    title: 'Three groups with their files, one preview open',
    example: 'OutputFilesBrandAb',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'copy-button',
    variant: 'states',
    title: 'Copy, copied, and the outline variant',
    example: 'CopyButtonStates',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'copy-button',
    variant: 'failed',
    title: 'Not copied: the error square, at the same width',
    example: 'CopyButtonFailed',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'token-path',
    variant: 'wrapping',
    title: 'Paths that break between segments, alone and inside a line',
    example: 'TokenPathWrapping',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'cli-handoff',
    variant: 'files',
    title: 'Token files: the config and one command',
    example: 'CliHandoffFiles',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'cli-handoff',
    variant: 'export',
    title: 'A plugin export: import, then build; config preview open',
    example: 'CliHandoffExport',
    viewports: [DESKTOP, MOBILE],
  },
  {
    component: 'changed',
    variant: 'highlighted',
    title: 'Changed values held at their highlight, next to unchanged ones',
    example: 'ChangedHighlighted',
    viewports: [DESKTOP],
  },
]

export const storyId = (story: Story) => `${story.component}--${story.variant}`
export const storyPath = (story: Story) => `/stories/${story.component}/${story.variant}/`

export const STORIES_SCHEMA = 'dta.stories/1'

/** The stories manifest `dta diff` reads (spec decision 3, TICKET-081). */
export function storiesManifest() {
  return {
    schema: STORIES_SCHEMA,
    themes: ['light', 'graphite'],
    stories: STORIES.map((story) => ({
      id: storyId(story),
      component: story.component,
      variant: story.variant,
      title: story.title,
      url: storyPath(story),
      viewports: story.viewports,
    })),
  }
}
