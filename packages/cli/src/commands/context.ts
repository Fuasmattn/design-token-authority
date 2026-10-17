import { parseTokenFiles } from '@dta/core'
import type { CommandContext } from '../commands.js'
import {
  ContextConflictError,
  DEFAULT_CONTEXT_FILE,
  planContext,
  writeContext,
} from '../context/write.js'
import { formatDiagnostic, hasErrors } from '../io/diagnostics.js'
import { readTokenDir, TokenDirError } from '../io/token-dir.js'

/** Exit code when the context file exists and DTA did not write it. */
const EXIT_NOT_OURS = 2

export async function runContext(context: CommandContext): Promise<number> {
  const config = context.config
  let files
  try {
    files = readTokenDir(config?.tokens.dir ?? 'tokens', context.cwd)
  } catch (error) {
    if (error instanceof TokenDirError) {
      context.stderr(`${error.message}\n`)
      return 1
    }
    throw error
  }
  const { model, diagnostics } = parseTokenFiles(files)
  if (hasErrors(diagnostics)) {
    for (const diagnostic of diagnostics) context.stderr(`${formatDiagnostic(diagnostic)}\n`)
    return 1
  }

  const out = String(context.options.out ?? config?.context?.out ?? DEFAULT_CONTEXT_FILE)
  const plan = planContext(context.cwd, model, config, out)

  if (context.options.check) {
    const stale = [plan.design, plan.agents].filter((file) => file.existing !== file.content)
    if (stale.length === 0) {
      context.stdout(`${plan.design.path} and ${plan.agents.path} are up to date.\n`)
      return 0
    }
    for (const file of stale) {
      context.stderr(
        `${file.path} ${file.existing === null ? 'does not exist' : 'is out of date'}. Run dta context to update it.\n`,
      )
    }
    return 1
  }

  try {
    const written = writeContext(context.cwd, plan)
    context.stdout(
      written.length === 0
        ? `${plan.design.path} and ${plan.agents.path} are up to date.\n`
        : `Wrote ${written.join(' and ')}.\n`,
    )
    return 0
  } catch (error) {
    if (error instanceof ContextConflictError) {
      context.stderr(`${error.message}\n`)
      return EXIT_NOT_OURS
    }
    throw error
  }
}
