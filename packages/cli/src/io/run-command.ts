import { spawnSync } from 'node:child_process'

/** A configured shell command (diff.setup, diff.build) failed. */
export class CommandFailedError extends Error {
  constructor(
    readonly command: string,
    readonly cwd: string,
    readonly output: string,
  ) {
    const tail = output.trim().split('\n').slice(-15).join('\n')
    super(`\`${command}\` failed in ${cwd}${tail ? `:\n${tail}` : ''}`)
    this.name = 'CommandFailedError'
  }
}

/** Runs a shell command and returns its combined output; throws CommandFailedError on failure. */
export function runCommand(command: string, cwd: string): string {
  const result = spawnSync(command, {
    cwd,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (result.status !== 0) throw new CommandFailedError(command, cwd, output)
  return output
}
