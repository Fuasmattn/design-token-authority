import { Writable, type Readable } from 'node:stream'
import * as p from '@clack/prompts'
import pc from 'picocolors'

type CommandName =
  | 'pull'
  | 'push'
  | 'build'
  | 'analyze'
  | 'graph'
  | 'clean'
  | 'lint'
  | 'init'
  | 'diff'
  | 'test:visual'

const STYLES: Record<CommandName, { icon: string; paint: (text: string) => string }> = {
  pull: { icon: '⤵', paint: (s) => pc.bgCyan(pc.black(s)) },
  push: { icon: '⤴', paint: (s) => pc.bgMagenta(pc.white(s)) },
  build: { icon: '⚒', paint: (s) => pc.bgGreen(pc.black(s)) },
  analyze: { icon: '☉', paint: (s) => pc.bgBlue(pc.white(s)) },
  graph: { icon: '⮕', paint: (s) => pc.bgYellow(pc.black(s)) },
  clean: { icon: '✖', paint: (s) => pc.bgRed(pc.white(s)) },
  lint: { icon: '✔', paint: (s) => pc.bgYellow(pc.black(s)) },
  init: { icon: '✨', paint: (s) => pc.bgCyan(pc.black(s)) },
  diff: { icon: '◑', paint: (s) => pc.bgYellow(pc.black(s)) },
  'test:visual': { icon: '◐', paint: (s) => pc.bgBlue(pc.white(s)) },
}

/** Intro banner of a command, e.g. ` ✔  dta lint ` on a coloured background. */
export function banner(command: CommandName): string {
  const style = STYLES[command]
  return style.paint(` ${style.icon}  dta ${command} `)
}

/** A command name inline, e.g. `dta pull`. */
export const cmd = (name: string): string => pc.cyan(`dta ${name}`)

/** A path for display. */
export const filePath = (value: string): string => pc.cyan(value)

/**
 * The prompt library (`@clack/prompts`) draws the terminal frame of every command. It is
 * pointed at a callback instead of `process.stdout` so command output can be captured.
 */
export function createUi(write: (text: string) => void, input?: Readable) {
  const output = new Writable({
    write(chunk: Buffer | string, _encoding, done) {
      write(chunk.toString())
      done()
    },
  })
  return {
    intro: (title: string) => p.intro(title, { output }),
    outro: (message: string) => p.outro(message, { output }),
    note: (message: string, title: string) => p.note(message, title, { output }),
    spinner: () => p.spinner({ output }),
    /** Asks for a line of text; `null` when the person cancels. */
    async text(options: {
      message: string
      placeholder: string
      defaultValue?: string
      validate: (value: string | undefined) => string | undefined
    }) {
      const answer = await p.text({ ...options, input, output })
      return p.isCancel(answer) ? null : answer
    },
    /** Asks for a secret; the typed characters are masked. `null` when cancelled. */
    async password(options: {
      message: string
      validate: (value: string | undefined) => string | undefined
    }) {
      const answer = await p.password({ ...options, input, output })
      return p.isCancel(answer) ? null : answer
    },
    /** Asks yes or no; `null` when cancelled. */
    async confirm(options: { message: string; initialValue: boolean }) {
      const answer = await p.confirm({ ...options, input, output })
      return p.isCancel(answer) ? null : answer
    },
    /** Picks one option; `null` when cancelled. */
    async select<Value extends string>(options: {
      message: string
      options: Array<{ value: Value; label: string; hint?: string }>
    }) {
      const answer = await p.select<Value>({
        message: options.message,
        options: options.options as never,
        input,
        output,
      })
      return p.isCancel(answer) ? null : (answer as Value)
    },
    /** Picks any number of options; `null` when cancelled. */
    async multiselect(options: {
      message: string
      options: Array<{ value: string; label: string; hint?: string }>
      initialValues?: string[]
    }) {
      const answer = await p.multiselect<string>({
        message: options.message,
        options: options.options as never,
        initialValues: options.initialValues,
        required: false,
        input,
        output,
      })
      return p.isCancel(answer) ? null : (answer as string[])
    },
    cancel: (message: string) => p.cancel(message, { output }),
    log: {
      message: (message: string) => p.log.message(message, { output }),
      success: (message: string) => p.log.success(message, { output }),
      info: (message: string) => p.log.info(message, { output }),
      step: (message: string) => p.log.step(message, { output }),
      warn: (message: string) => p.log.warn(message, { output }),
      error: (message: string) => p.log.error(message, { output }),
    },
  }
}

export type Ui = ReturnType<typeof createUi>
