/**
 * Guardrail: packages talk to each other only through their public API (spec: gray-box
 * packages). Fails on
 *  - deep imports of a workspace package, e.g. `@dta/core/src/alias`;
 *  - relative imports that leave the importing package for another one.
 *
 *   tsx scripts/guardrails/package-boundaries.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Violation {
  file: string
  line: number
  specifier: string
  reason: string
}

const SPECIFIER = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g

/** Strip comments so documentation that mentions an import path is not a violation. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '')
}

/** The workspace member a repo-relative path belongs to: `packages/<name>` or `site`. */
function ownerOf(file: string): string | undefined {
  return /^(packages\/[^/]+|site)\//.exec(file)?.[1]
}

/** `file` is repo-relative with forward slashes. */
export function findViolations(file: string, source: string): Violation[] {
  const violations: Violation[] = []
  const owner = ownerOf(file)
  const text = stripComments(source)
  for (const match of text.matchAll(SPECIFIER)) {
    const specifier = match[2]
    const line = text.slice(0, match.index).split('\n').length
    if (/^@dta\/[^/]+\/.+/.test(specifier)) {
      violations.push({
        file,
        line,
        specifier,
        reason: 'deep import of a workspace package; import from its public API instead',
      })
    } else if (specifier.startsWith('.') && owner) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
      if (ownerOf(`${target}/`) !== owner) {
        violations.push({
          file,
          line,
          specifier,
          reason: 'relative import leaves the package; depend on it by name and use its public API',
        })
      }
    }
  }
  return violations
}

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/
const SKIP = new Set(['node_modules', 'dist', '.git', '.astro', 'output'])

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (SOURCE_FILE.test(entry.name)) yield full
  }
}

export function checkBoundaries(repoRoot: string): Violation[] {
  const roots = ['packages', 'scripts', 'site'].map((d) => path.join(repoRoot, d))
  return (
    roots
      .filter((root) => fs.existsSync(root))
      .flatMap((root) => [...walk(root)])
      // The guardrail's own tests contain deliberately bad imports as sample text.
      .filter(
        (full) =>
          !path
            .relative(repoRoot, full)
            .split(path.sep)
            .join('/')
            .startsWith('scripts/guardrails/'),
      )
      .flatMap((full) =>
        findViolations(
          path.relative(repoRoot, full).split(path.sep).join('/'),
          fs.readFileSync(full, 'utf-8'),
        ),
      )
  )
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
  const violations = checkBoundaries(repoRoot)
  if (violations.length === 0) {
    console.log('Package boundaries respected.')
    return
  }
  for (const v of violations) console.error(`${v.file}:${v.line}  "${v.specifier}"  ${v.reason}`)
  process.exit(1)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
