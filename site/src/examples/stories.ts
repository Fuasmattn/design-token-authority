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
    title: 'Primary, outline, link',
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
    title: 'Checks and the approve action',
    example: 'ChecksDefault',
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
    title: 'Info, changed, pass',
    example: 'ChipStates',
    viewports: [DESKTOP],
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
    title: 'Menu open on a phone',
    example: 'NavOpen',
    viewports: [MOBILE],
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
    title: 'Stations on the rail',
    example: 'WorkflowRailDefault',
    viewports: [DESKTOP, MOBILE],
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
