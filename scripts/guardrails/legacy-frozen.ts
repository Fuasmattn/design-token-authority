/**
 * Guardrail: the legacy `src/` tree is the frozen parity reference (ADR 0001).
 * A change to it fails CI unless the PR carries the `legacy-exception` label.
 *
 *   tsx scripts/guardrails/legacy-frozen.ts <base-ref> [--label legacy-exception]
 *
 * Pass `--label <name>` for every label on the PR; the CI workflow does this.
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const EXCEPTION_LABEL = 'legacy-exception'

/** Legacy source: everything under `src/`. Tests beside it are part of the reference too. */
export function isLegacyPath(file: string): boolean {
  return file.startsWith('src/')
}

export interface FrozenResult {
  ok: boolean
  changed: string[]
  message: string
}

export function checkLegacyFrozen(changedFiles: string[], labels: string[]): FrozenResult {
  const changed = changedFiles.filter(isLegacyPath)
  if (changed.length === 0) return { ok: true, changed, message: 'Legacy src/ is untouched.' }
  if (labels.includes(EXCEPTION_LABEL)) {
    return {
      ok: true,
      changed,
      message: `Legacy src/ changed, allowed by the "${EXCEPTION_LABEL}" label:\n${list(changed)}`,
    }
  }
  return {
    ok: false,
    changed,
    message:
      `Legacy src/ is frozen (see docs/adr/0001-strangler-rewrite.md). Changed:\n${list(changed)}\n` +
      `Put new code in packages/*. If this change is intentional, a maintainer adds the ` +
      `"${EXCEPTION_LABEL}" label to the PR.`,
  }
}

const list = (files: string[]) => files.map((f) => `  - ${f}`).join('\n')

function main(argv: string[]) {
  const base = argv[0]
  if (!base) throw new Error('Usage: legacy-frozen.ts <base-ref> [--label <name>]...')
  const labels = argv.flatMap((arg, i) => (arg === '--label' ? [argv[i + 1]] : []))
  const output = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    encoding: 'utf-8',
  })
  const result = checkLegacyFrozen(output.split('\n').filter(Boolean), labels)
  console.log(result.message)
  process.exit(result.ok ? 0 : 1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
