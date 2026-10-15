/** How to start the CLI under test: `command` plus base `args` (scenario arguments are appended). */
export interface CliCommand {
  command: string
  args: string[]
}

/** One CLI invocation that is run against every fixture. */
export interface Scenario {
  name: string
  args: string[]
}

/** The normalized observable behaviour of one CLI invocation. */
export interface ScenarioResult {
  stdout: string
  stderr: string
  exitCode: number
  /** Files the command created, keyed by relative path (forward slashes). */
  files: Record<string, string>
}

export interface CaptureOptions {
  /** Directory of the fixture project; it is copied, never modified. */
  fixtureDir: string
  scenario: Scenario
  cli: CliCommand
  /** Absolute path of the repository; replaced by `<repo>` in captured output. */
  repoRoot: string
  /**
   * Redirect the command's requests for api.figma.com to this URL (a fake Figma API).
   * Works for any Node-based CLI that talks to Figma over `https`.
   */
  figmaApiUrl?: string
  /** Kill the command after this many milliseconds (default: 120000). */
  timeoutMs?: number
}
