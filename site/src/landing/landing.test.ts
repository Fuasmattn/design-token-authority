import fs from 'node:fs'
import path from 'node:path'
import { COMMAND_NAMES } from '@dta/cli'
import { describe, expect, it } from 'vitest'
import { COMMANDS, NPM_RELEASED, WORKFLOW } from './content'

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

  it('names only shipped dta commands in the workflow (TICKET-174)', () => {
    const commands = WORKFLOW.steps.flatMap((step) => (step.command ? [step.command] : []))
    expect(commands).toEqual(['dta lint', 'dta build', 'dta diff'])
    for (const command of commands) expect(registered.has(command.replace(/^dta /, ''))).toBe(true)
  })

  it('gives every workflow step one sentence, and the person the last step (TICKET-174)', () => {
    for (const step of WORKFLOW.steps) {
      expect(step.text).toMatch(/^[A-Z][^.]*\.$/)
      expect(Boolean(step.command) !== Boolean(step.who)).toBe(true)
    }
    expect(WORKFLOW.steps.at(-1)?.who).toBe('You')
  })

  it('links the workflow to the command reference and the agents guide, which exist', () => {
    expect(WORKFLOW.links.map((link) => link.href)).toEqual([
      '/reference/commands/',
      '/guides/coding-agents/',
    ])
    const docs = path.join(import.meta.dirname, '..', 'content', 'docs')
    expect(fs.existsSync(path.join(docs, 'reference', 'commands.md'))).toBe(true)
    expect(fs.existsSync(path.join(docs, 'guides', 'coding-agents.mdx'))).toBe(true)
  })
})
