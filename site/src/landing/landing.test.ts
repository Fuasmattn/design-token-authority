import { COMMAND_NAMES } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import { AGENT_RUN, COMMANDS, DIFF_SHARES, NPM_RELEASED, SCENES } from './content'

/** Full command names: `diff`, `skill add`, … */
const registered = new Set(COMMAND_NAMES)

describe('landing page honesty rule', () => {
  it('shows only commands that work as written as shipped; the rest are labelled coming', () => {
    for (const command of Object.values(COMMANDS)) {
      const exists = command.uses.every((name) => registered.has(name))
      const needsRelease = /^(npx |npm create )/.test(command.text)
      const runnable = !needsRelease || NPM_RELEASED
      expect(exists && runnable, `${command.text} is marked shipped: ${command.shipped}`).toBe(
        command.shipped,
      )
    }
  })

  it('never shows `npx dta` (that npm name belongs to another package)', () => {
    for (const command of Object.values(COMMANDS)) expect(command.text).not.toMatch(/npx dta\b/)
  })

  it('shows every scene command as a shipped dta command', () => {
    for (const scene of SCENES) {
      expect(scene.command.shipped, scene.command.text).toBe(true)
      for (const name of scene.command.uses) expect(registered.has(name), name).toBe(true)
    }
  })

  it('runs the agent terminal on shipped commands', () => {
    const commands = AGENT_RUN.lines
      .filter((line) => line[0].text === '$ ')
      .map((line) =>
        line
          .map((s) => s.text)
          .join('')
          .slice(2),
      )
    expect(commands).toEqual(["dta token find '#2443ac'", 'dta audit src'])
    for (const name of ['token find', 'audit']) expect(registered.has(name), name).toBe(true)
  })

  it('labels the diff shares illustrative until they come from a recorded run', () => {
    if (!DIFF_SHARES.real) expect(DIFF_SHARES.note).toMatch(/illustrative/)
  })
})
