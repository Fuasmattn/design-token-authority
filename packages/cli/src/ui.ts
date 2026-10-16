import pc from 'picocolors'

type CommandName = 'pull' | 'push' | 'build' | 'analyze' | 'graph' | 'clean' | 'lint' | 'init'

const STYLES: Record<CommandName, { icon: string; paint: (text: string) => string }> = {
  pull: { icon: '⤵', paint: (s) => pc.bgCyan(pc.black(s)) },
  push: { icon: '⤴', paint: (s) => pc.bgMagenta(pc.white(s)) },
  build: { icon: '⚒', paint: (s) => pc.bgGreen(pc.black(s)) },
  analyze: { icon: '☉', paint: (s) => pc.bgBlue(pc.white(s)) },
  graph: { icon: '⮕', paint: (s) => pc.bgYellow(pc.black(s)) },
  clean: { icon: '✖', paint: (s) => pc.bgRed(pc.white(s)) },
  lint: { icon: '✔', paint: (s) => pc.bgYellow(pc.black(s)) },
  init: { icon: '✨', paint: (s) => pc.bgCyan(pc.black(s)) },
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
