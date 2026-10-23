import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Set by the package build (scripts/package/build.ts); undefined when run from the sources. */
declare const __DTA_VERSION__: string | undefined

/** The version of the published package (the repository root), `unknown` if it cannot be read. */
export function packageVersion(): string {
  if (typeof __DTA_VERSION__ === 'string') return __DTA_VERSION__
  try {
    const file = fileURLToPath(new URL('../../../package.json', import.meta.url))
    const { version } = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }
    return version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
