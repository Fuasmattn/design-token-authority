/**
 * The one-click examples (spec: docs/specs/playground.md decision 6, TICKET-113), bundled with
 * the page so loading them needs no request:
 * - `brand-ab`: the brand-ab fixture's token files (BrandA/BrandB), which lint clean;
 * - `brand-ab-problems`: the same token set with three flaws the default rules catch (a dangling
 *   alias, a circular alias, a breakpoint left on Figma's default mode name), so a visitor sees
 *   what a finding looks like. It is the fixture `test/fixtures/brand-ab-problems`, whose
 *   `dta lint` output is a CLI reference snapshot; a test checks the playground finds the same.
 */
import type { TokenFileInput } from '@dta/core'

const toFiles = (files: Record<string, string>): readonly TokenFileInput[] =>
  Object.entries(files)
    .map(([file, content]) => ({ fileName: file.slice(file.lastIndexOf('/') + 1), content }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName))

export interface Example {
  /** What the source bar calls it: `<name> example`; also its id. */
  name: string
  /** The button that loads it. */
  label: string
  /** What the button loads, said next to it. */
  description: string
  files: readonly TokenFileInput[]
}

export const EXAMPLE: Example = {
  name: 'brand-ab',
  label: 'Load example',
  description: 'brand-ab: BrandA and BrandB, three breakpoints',
  files: toFiles(
    import.meta.glob('../../../test/fixtures/brand-ab/tokens/*.json', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  ),
}

export const PROBLEM_EXAMPLE: Example = {
  name: 'brand-ab-problems',
  label: 'Example with problems',
  description: 'brand-ab with a broken alias, a circular alias and a default mode name',
  files: toFiles(
    import.meta.glob('../../../test/fixtures/brand-ab-problems/tokens/*.json', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>,
  ),
}

/** The examples under the drop area, in order. */
export const EXAMPLES: readonly Example[] = [EXAMPLE, PROBLEM_EXAMPLE]

/** The examples as TokenInput offers them. */
export const inputExamples = () =>
  EXAMPLES.map(({ name, label, description }) => ({ id: name, label, description }))

export const EXAMPLE_NAME = EXAMPLE.name
export const EXAMPLE_FILES = EXAMPLE.files
