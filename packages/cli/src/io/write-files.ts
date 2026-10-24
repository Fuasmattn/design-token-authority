import fs from 'node:fs'
import path from 'node:path'

export interface OutputFile {
  /** Path relative to the working directory. */
  path: string
  content: string
}

/** Writes files below `cwd`, creating folders as needed. Refuses paths that leave `cwd`. */
export function writeFiles(cwd: string, files: readonly OutputFile[]): void {
  const root = path.resolve(cwd)
  for (const file of files) {
    const target = path.resolve(root, file.path)
    if (target !== root && !target.startsWith(root + path.sep)) {
      throw new Error(`Refusing to write outside the project: ${file.path}`)
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, file.content, 'utf8')
  }
}
