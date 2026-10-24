/**
 * The few pure helpers the playground's first load needs (TICKET-124): the summary's plurals and
 * the outputs chosen by default. Kept apart and free of runtime imports, because the modules they
 * came from load lazily: analyse.ts (with `@dta/core`, `@dta/figma`, `@dta/lint`) once the browser
 * is idle or on the first input, outputs.ts with the Outputs tab (outputs-view.tsx). outputs.ts
 * re-exports them, so its callers are unchanged.
 */
import type { OutputFormat } from '@dta/build'

/** `1 file`, `3 breakpoints`. */
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** The outputs a visitor can choose: the web outputs (`DEFAULT_FORMATS`), in their order. */
export const OUTPUT_CHOICES: ReadonlyArray<{ format: OutputFormat; label: string }> = [
  { format: 'css', label: 'CSS' },
  { format: 'tailwind-v4', label: 'Tailwind v4' },
  { format: 'tailwind-v3', label: 'Tailwind v3' },
  { format: 'js', label: 'JS' },
]

/** Every output: what the Outputs tab starts with. */
export const ALL_FORMATS: readonly OutputFormat[] = OUTPUT_CHOICES.map((choice) => choice.format)
