import { COMMAND_NAMES } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import { AGENT_RUN, CHECKS, COMMANDS, DIFF_SHARES, NPM_RELEASED, SCENES, WORKFLOW } from './content'

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

  it('shows every command of the workflow strip as a shipped dta command from COMMANDS', () => {
    const shown = [
      WORKFLOW.crossing.command,
      ...WORKFLOW.steps.flatMap((step) =>
        'command' in step && step.command ? [step.command] : [],
      ),
      WORKFLOW.back.command,
    ]
    expect(shown.map((command) => command.text)).toEqual([
      'dta pull',
      'dta lint',
      'dta build',
      'dta diff',
      'dta audit',
    ])
    const listed = new Set<object>(Object.values(COMMANDS))
    for (const command of shown) {
      expect(listed.has(command), command.text).toBe(true)
      expect(command.shipped, command.text).toBe(true)
      for (const name of command.uses) expect(registered.has(name), name).toBe(true)
    }
  })

  it('keeps the strip unnumbered and the scenes in its order (spec decision 12)', () => {
    for (const step of [WORKFLOW.change, ...WORKFLOW.steps]) {
      expect(step.label).toMatch(/^[A-Z][a-z]+$/)
    }
    // Scene 03 shows the checks and the decision; its command is the first check, `dta lint`.
    expect(SCENES[2].command).toBe(COMMANDS.lint)
    // Each command of the strip appears at most once as a scene command.
    const sceneCommands = SCENES.map((scene) => scene.command.text)
    expect(new Set(sceneCommands).size).toBe(sceneCommands.length)
    expect(sceneCommands).not.toContain(COMMANDS.build.text)
    // The checks of scene 03 run in the strip's order.
    const stripOrder = WORKFLOW.steps.flatMap((step) =>
      'command' in step && step.command ? [step.command.text] : [],
    )
    expect(CHECKS.map((check) => check.name)).toEqual(stripOrder)
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
