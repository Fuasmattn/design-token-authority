import { spawn } from 'node:child_process'

/** Opens a file with the system's default application; failures are ignored. */
export function openWithSystem(file: string): void {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  try {
    const child = spawn(command, [file], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32',
    })
    child.on('error', () => undefined)
    child.unref()
  } catch {
    // Nothing to open with: the file was written, that is what counts.
  }
}
