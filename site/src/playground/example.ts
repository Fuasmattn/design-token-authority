/**
 * The one-click example (spec: docs/specs/playground.md decision 6): the brand-ab fixture's
 * token files (BrandA/BrandB), bundled with the page so loading it needs no request.
 */
import type { TokenFileInput } from '@dta/core'

const files = import.meta.glob('../../../test/fixtures/brand-ab/tokens/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const EXAMPLE_NAME = 'brand-ab'

export const EXAMPLE_FILES: readonly TokenFileInput[] = Object.entries(files)
  .map(([file, content]) => ({ fileName: file.slice(file.lastIndexOf('/') + 1), content }))
  .sort((a, b) => a.fileName.localeCompare(b.fileName))
