import type { CommandContext } from '../commands.js'
import { banner, createUi } from '../ui.js'

/** Exit code of a command that has no implementation in this CLI. */
const EXIT_MOVED = 3

/**
 * The Playwright visual regression run is not part of the new CLI: it is replaced by the
 * visual-diff work of Epic 8 (decision in docs/specs/cli-parity.md). Until then the
 * repository script runs the same tests.
 */
export async function runTestVisual(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout)
  ui.intro(banner('test:visual'))
  ui.log.warn(
    '"test:visual" has moved out of the CLI and will be replaced by the visual-diff work.\n' +
      'Until then run the Playwright tests directly: pnpm test:visual',
  )
  context.stderr('dta: "test:visual" is no longer a CLI command.\n')
  return EXIT_MOVED
}
