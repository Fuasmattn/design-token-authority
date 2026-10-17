import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The version of the published package (the repository root), `unknown` if it cannot be read. */
export function packageVersion(): string {
  try {
    const file = fileURLToPath(new URL('../../../package.json', import.meta.url))
    const { version } = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string }
    return version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
