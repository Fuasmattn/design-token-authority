import fs from 'node:fs'
import path from 'node:path'
import type { CommandContext } from '../commands.js'
import { renderSkill, SKILL_MARKER } from '../skill/template.js'
import { packageVersion } from '../version.js'

/** Where Claude Code looks for project skills; other agents take `--dir`. */
export const DEFAULT_SKILL_DIR = '.claude/skills/dta'

/** Exit code when the target is a file DTA did not write. */
const EXIT_NOT_OURS = 2

export async function runSkillAdd(context: CommandContext): Promise<number> {
  const dir = String(context.options.dir ?? DEFAULT_SKILL_DIR)
  const file = path.resolve(context.cwd, dir, 'SKILL.md')
  const shown = path.relative(context.cwd, file).split(path.sep).join('/') || 'SKILL.md'
  const content = renderSkill(packageVersion())
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null

  if (context.options.check) {
    if (existing === content) {
      context.stdout(`${shown} is up to date.\n`)
      return 0
    }
    context.stderr(
      existing === null
        ? `${shown} does not exist. Run dta skill add to install it.\n`
        : `${shown} is out of date. Run dta skill add to update it.\n`,
    )
    return 1
  }

  if (existing !== null && !existing.includes(SKILL_MARKER)) {
    context.stderr(
      `${shown} exists and was not written by dta skill add, so it is left as it is. Move it, or install to another folder with --dir.\n`,
    )
    return EXIT_NOT_OURS
  }
  if (existing === content) {
    context.stdout(`${shown} is up to date.\n`)
    return 0
  }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
  context.stdout(`${existing === null ? 'Wrote' : 'Updated'} ${shown}.\n`)
  return 0
}
