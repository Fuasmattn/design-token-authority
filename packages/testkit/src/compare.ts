import { createTwoFilesPatch } from 'diff'
import type { ScenarioResult } from './types.js'

const MAX_DIFF_LINES = 40

/** A unified diff without its header lines, truncated to a readable length. */
function readableDiff(expected: string, actual: string): string {
  const patch = createTwoFilesPatch('snapshot', 'actual', expected, actual, '', '', { context: 2 })
  const lines = patch.split('\n').slice(4) // drop "Index", "====" and the two file header lines
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  if (lines.length <= MAX_DIFF_LINES) return lines.join('\n')
  const hidden = lines.length - MAX_DIFF_LINES
  return [...lines.slice(0, MAX_DIFF_LINES), `… ${hidden} more diff lines`].join('\n')
}

/**
 * Compare a recorded snapshot with a fresh result.
 * Returns human-readable mismatch descriptions; an empty array means they match.
 */
export function compareSnapshot(expected: ScenarioResult, actual: ScenarioResult): string[] {
  const mismatches: string[] = []

  if (expected.exitCode !== actual.exitCode) {
    mismatches.push(`exit code: expected ${expected.exitCode}, got ${actual.exitCode}`)
  }
  if (expected.stdout !== actual.stdout) {
    mismatches.push(`stdout differs:\n${readableDiff(expected.stdout, actual.stdout)}`)
  }
  if (expected.stderr !== actual.stderr) {
    mismatches.push(`stderr differs:\n${readableDiff(expected.stderr, actual.stderr)}`)
  }

  const expectedNames = Object.keys(expected.files)
  const actualNames = Object.keys(actual.files)
  for (const name of expectedNames) {
    if (!(name in actual.files)) mismatches.push(`missing file: ${name}`)
  }
  for (const name of actualNames) {
    if (!(name in expected.files)) mismatches.push(`unexpected file: ${name}`)
  }
  for (const name of expectedNames) {
    if (name in actual.files && expected.files[name] !== actual.files[name]) {
      mismatches.push(
        `file differs: ${name}\n${readableDiff(expected.files[name], actual.files[name])}`,
      )
    }
  }
  return mismatches
}
