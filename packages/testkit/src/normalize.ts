import fs from 'node:fs'

/** "Cursor to column 1" + "erase line": how the spinner library redraws its line. */
const REDRAW = '\u001b[1G\u001b[J'

/**
 * Reduce raw terminal output to what a terminal would finally show.
 *
 * The spinner library redraws its line with "cursor to column 1 + erase line"
 * (ESC[1G ESC[J) and only emits intermediate frames when a phase happens to take
 * longer than one animation tick. Piped, those frames pile up in front of the
 * final line, which makes stdout timing-dependent. Dropping the text that gets
 * redrawn yields the same output regardless of speed. All remaining ANSI
 * sequences (colors, cursor show/hide) are then stripped.
 */
export function stripAnsi(text: string): string {
  // Line by line and with lastIndexOf: a regex such as /[^\n]*ESC.../ is quadratic on long lines.
  const redrawn = text
    .split('\n')
    .map((line) => {
      const index = line.lastIndexOf(REDRAW)
      return index === -1 ? line : line.slice(index + REDRAW.length)
    })
    .join('\n')
  return redrawn.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
}

/** Strip terminal codes, replace machine-specific absolute paths and normalize line endings. */
export function normalizeOutput(text: string, workDir: string, repoRoot: string): string {
  let result = stripAnsi(text).replace(/\r\n/g, '\n')
  // The real path first: on macOS the temp dir is a symlink (/var -> /private/var).
  const variants = new Set([fs.realpathSync(workDir), workDir])
  for (const variant of variants) result = result.split(variant).join('<cwd>')
  return result.split(repoRoot).join('<repo>')
}
