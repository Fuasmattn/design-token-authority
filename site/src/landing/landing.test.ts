import fs from 'node:fs'
import path from 'node:path'
import { COMMAND_NAMES } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import {
  AGENT_RUN,
  CHECKS,
  COMMANDS,
  DECISION,
  DIFF_SHARES,
  NPM_RELEASED,
  SCENES,
  WORKFLOW,
} from './content'
import DIFF_RUN from './diff-run.json'

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
    // The scenes follow the strip (TICKET-114 item 5): 02 the checks (`dta lint`), 03 the diff
    // and the decision (`dta diff`, with the approve action).
    expect(SCENES.map((scene) => scene.command)).toEqual([
      COMMANDS.pull,
      COMMANDS.lint,
      COMMANDS.diff,
      COMMANDS.skill,
    ])
    const stepCommands = WORKFLOW.steps.flatMap((step) =>
      'command' in step && step.command ? [step.command.text] : [],
    )
    const inStrip = SCENES.map((scene) => scene.command.text).filter((t) =>
      stepCommands.includes(t),
    )
    expect(inStrip).toEqual(stepCommands.filter((t) => inStrip.includes(t)))
    expect(SCENES[2].kicker).toBe('A person decides')
    expect(DECISION.map((check) => check.name)).toEqual(['dta diff'])
    // Each command of the strip appears at most once as a scene command.
    const sceneCommands = SCENES.map((scene) => scene.command.text)
    expect(new Set(sceneCommands).size).toBe(sceneCommands.length)
    expect(sceneCommands).not.toContain(COMMANDS.build.text)
    // The checks of scene 02 run in the strip's order.
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

  describe('diff shares come from a recorded dta diff run (diff-run.json)', () => {
    const example = path.resolve(import.meta.dirname, '..', '..', 'examples', 'orbit-burger')
    /** `$value` of a token in one of the example's token files. */
    const value = (dir: string, name: string) => {
      const json = JSON.parse(
        fs.readFileSync(path.join(example, dir, 'Brand.OrbitBurger.json'), 'utf8'),
      )
      return name.split('.').reduce((node, key) => node[key], json).$value
    }

    it('is marked real, with no illustrative note', () => {
      expect(DIFF_SHARES.real).toBe(true)
      expect(DIFF_SHARES).not.toHaveProperty('note')
    })

    it('records the example change: tokens-base/ before, tokens/ after', () => {
      expect(DIFF_RUN.tokens.map((t) => t.name).sort()).toEqual(
        DIFF_SHARES.lines.map((l) => l.token).sort(),
      )
      for (const token of DIFF_RUN.tokens) {
        expect(token.before.raw, token.name).toBe(value('tokens-base', token.name))
        expect(token.after.raw, token.name).toBe(value('tokens', token.name))
      }
    })

    it('words every share from the run, as the CLI prints it', () => {
      for (const line of DIFF_SHARES.lines) {
        const token = DIFF_RUN.tokens.find((t) => t.name === line.token)
        expect(line.share).toBe(
          `explains ${token?.stories.length} of ${DIFF_RUN.changed} changed stories`,
        )
        // Every story the token explains is a changed story of the run, explained by it.
        for (const id of token?.stories ?? []) {
          expect(DIFF_RUN.stories.find((s) => s.story === id)?.explainedBy).toContain(line.token)
        }
      }
      expect(DIFF_RUN.stories).toHaveLength(DIFF_RUN.changed)
    })

    it("shows the dta diff check with the run's verdict and count (scenes 02 and 03)", () => {
      const diff = CHECKS.find((check) => check.name === 'dta diff')
      expect(DIFF_RUN.verdict).toBe('review') // explained changes, waiting for a person
      expect(diff).toEqual({
        name: 'dta diff',
        status: 'changes',
        detail: `${DIFF_RUN.changed} stories`,
      })
      expect(DECISION).toEqual([diff])
      expect(DIFF_RUN.explained).toBe(DIFF_RUN.changed)
      expect(DIFF_RUN.unexplained).toEqual([])
    })

    it('shows the change as the token files have it', () => {
      const change = Object.fromEntries(DIFF_SHARES.lines.map((l) => [l.token, l.change]))
      const radius = DIFF_RUN.tokens.find((t) => t.name === 'Radius.Card')
      expect(change['Radius.Card']).toBe(`${radius?.before.resolved} → ${radius?.after.resolved}`)
      const brand = DIFF_RUN.tokens.find((t) => t.name === 'Colors.Brand.Primary')
      const alias = (raw: unknown) => String(raw).replace(/[{}]/g, '').replace('.', ' ')
      expect(change['Colors.Brand.Primary']).toBe(
        `${alias(brand?.before.raw)} → ${alias(brand?.after.raw).split(' ')[1]}`,
      )
    })
  })
})
