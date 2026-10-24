import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commandReference, runCli } from '../index.js'
import { renderSkill, SKILL_MARKER } from '../skill/template.js'
import { packageVersion } from '../version.js'

let dir: string
beforeEach(() => {
  dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'dta-skill-')))
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

async function skill(...args: string[]) {
  let stdout = ''
  let stderr = ''
  const exitCode = await runCli(['skill', 'add', ...args], {
    cwd: dir,
    stdout: (text) => (stdout += text),
    stderr: (text) => (stderr += text),
  })
  return { exitCode, stdout, stderr }
}

const installed = (folder = '.claude/skills/dta') => path.join(dir, folder, 'SKILL.md')

describe('dta skill add', () => {
  it('writes SKILL.md for Claude Code, without a config', async () => {
    const { exitCode, stdout } = await skill()
    expect(exitCode).toBe(0)
    expect(stdout).toBe('Wrote .claude/skills/dta/SKILL.md.\n')
    expect(fs.readFileSync(installed(), 'utf8')).toBe(renderSkill(packageVersion()))
  })

  it('writes to another folder with --dir', async () => {
    expect((await skill('--dir', '.agents/skills/dta')).exitCode).toBe(0)
    expect(fs.existsSync(installed('.agents/skills/dta'))).toBe(true)
  })

  it('updates its own file and says when nothing changed', async () => {
    fs.mkdirSync(path.dirname(installed()), { recursive: true })
    fs.writeFileSync(installed(), `old\n<!-- ${SKILL_MARKER} (DTA 0.1.0) -->\n`)
    expect((await skill()).stdout).toBe('Updated .claude/skills/dta/SKILL.md.\n')
    expect((await skill()).stdout).toBe('.claude/skills/dta/SKILL.md is up to date.\n')
  })

  it('leaves a file it did not write alone and exits 2', async () => {
    fs.mkdirSync(path.dirname(installed()), { recursive: true })
    fs.writeFileSync(installed(), 'my own skill\n')
    const { exitCode, stderr } = await skill()
    expect(exitCode).toBe(2)
    expect(stderr).toContain('was not written by dta skill add')
    expect(fs.readFileSync(installed(), 'utf8')).toBe('my own skill\n')
  })

  it('--check exits 1 when the skill is missing or stale, 0 when current', async () => {
    expect((await skill('--check')).exitCode).toBe(1)
    fs.mkdirSync(path.dirname(installed()), { recursive: true })
    fs.writeFileSync(installed(), `<!-- ${SKILL_MARKER} (DTA 0.1.0) -->\n`)
    const stale = await skill('--check')
    expect(stale.exitCode).toBe(1)
    expect(stale.stderr).toContain('out of date')
    await skill()
    expect((await skill('--check')).exitCode).toBe(0)
  })
})

describe('the skill text', () => {
  const text = renderSkill('1.2.3')

  it('has Agent Skills front matter and the version marker', () => {
    expect(text).toMatch(/^---\nname: dta\ndescription: .+\n---\n/)
    expect(text).toContain(`<!-- ${SKILL_MARKER} (DTA 1.2.3).`)
  })

  it('names only commands and options the CLI has', () => {
    const reference = commandReference()
    const lines = [...text.matchAll(/`(dta [^`]+)`/g)].map((match) => match[1])
    expect(lines.length).toBeGreaterThan(10)
    for (const line of lines) {
      const words = (line.match(/'[^']*'|\S+/g) ?? []).slice(1)
      if (words[0] === '<command>') continue
      // The longest command name the line starts with: `token get` before `token`.
      const command = reference
        .filter((c) => c.name.split(' ').every((part, i) => words[i] === part))
        .sort((a, b) => b.name.length - a.name.length)[0]
      expect(command, `unknown command in: ${line}`).toBeDefined()
      if (!command) continue
      const flags = command.options.flatMap((option) => option.flags.match(/-{1,2}[\w-]+/g) ?? [])
      for (const word of words.filter((w) => w.startsWith('-'))) {
        expect(flags, `unknown option ${word} in: ${line}`).toContain(word)
      }
    }
  })

  it('lists every command', () => {
    for (const command of commandReference()) expect(text).toContain(`\`dta ${command.name}\``)
  })
})
