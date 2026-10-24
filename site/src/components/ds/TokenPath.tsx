/**
 * Token paths and file paths that wrap between their segments, never inside one (TICKET-121):
 * `Colors/Surface/Muted`, `{Colors.Foundation.Blue.700}`, `Brand(Alias).BrandA.json`,
 * `output/css/themes/branda.css`. A line-break opportunity (`<wbr>`) follows each `/` and each
 * `.` between two parts of a name, so a long path breaks after a separator and keeps every
 * segment whole. Only a single segment wider than its box still breaks inside, as a last resort
 * (the `overflow-wrap: anywhere` the components keep).
 *
 * `breakPaths(text)` is the shared helper: every component that shows a path, or a line that
 * contains one (Findings, DetailPanel, OutputFiles, SourceBar, CliHandoff), renders its text
 * through it. Plain prose is left as it is: a full stop before a space, and a decimal (`0.94`,
 * `1.2 KB`), get no break. `TokenPath` is the same as a mono element of its own, for a path that
 * stands alone.
 *
 * A Preact component; stories render it to static HTML.
 */
import type { ComponentChildren } from 'preact'
import './TokenPath.css'

const SPACE = /\s/
const LETTER = /[\p{L}_$]/u
const CLOSING = /[)\]}]/
const DIGIT = /\d/

/** Whether a line may break after `text[i]`: a separator between two parts of a name. */
function breaksAfter(text: string, i: number): boolean {
  const char = text[i]
  const prev = text[i - 1]
  const next = text[i + 1]
  if (prev === undefined || next === undefined) return false
  if (SPACE.test(prev) || SPACE.test(next)) return false
  if (char === '/') return next !== '/'
  if (char !== '.' || next === '.' || prev === '.') return false
  // `Blue.700`, `Brand(Alias).BrandA`, `Mode 1.json`; never `0.94`
  return LETTER.test(prev) || CLOSING.test(prev) || (DIGIT.test(prev) && !DIGIT.test(next))
}

/**
 * The text cut after each separator a path may break at: `Colors/Surface/Muted` →
 * `['Colors/', 'Surface/', 'Muted']`. Joined, the parts are the text again.
 */
export function pathParts(text: string): string[] {
  const parts: string[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (breaksAfter(text, i)) {
      parts.push(text.slice(start, i + 1))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

/** The text with a `<wbr>` after each separator a path may break at (see `pathParts`). */
export function breakPaths(text: string): ComponentChildren {
  const parts = pathParts(text)
  if (parts.length === 1) return text
  return parts.map((part, index) => (index < parts.length - 1 ? [part, <wbr />] : part))
}

export interface TokenPathProps {
  /** A token path, alias id or file path. */
  path: string
}

/** A path on its own: mono, breaking only between segments. */
export default function TokenPath({ path }: TokenPathProps) {
  return <span class="dta-path">{breakPaths(path)}</span>
}
