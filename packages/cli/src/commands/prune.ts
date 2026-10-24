/**
 * `dta prune` (TICKET-021): deletes variables from the Figma file whose tokens are no longer in
 * the token files. Never part of `dta push`, which only creates and updates.
 */
import { formatDiagnostic, hasErrors, parseTokenFiles } from '@dta/core'
import { planPrune, type Orphan } from '@dta/figma'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { describeFigmaError, figmaClientFor } from '../figma-client.js'
import { readTokenDir, TokenDirError, tokenParseOptions } from '../io/token-dir.js'
import { banner, cmd, createUi, filePath } from '../ui.js'

const EXIT_BAD_INPUT = 2
const CONFIRMATION_PHRASE = 'delete variables from figma'

const plural = (count: number, word: string, many = `${word}s`) =>
  `${count} ${count === 1 ? word : many}`

/** Parser warnings for entries it skips: such a token is missing, not deleted. */
const DROPPED = new Set(['reserved-name', 'unexpected-value'])

/** `Brand(Alias)  Colors.Text.Old  BrandA {Colors.Gray.500} · BrandB #6b7280`, aligned. */
function orphanLines(orphans: readonly Orphan[]): string[] {
  const collectionWidth = Math.max(...orphans.map((o) => o.collection.length))
  const nameWidth = Math.max(...orphans.map((o) => o.name.length))
  return orphans.map((orphan) => {
    const values =
      orphan.values.length === 1
        ? orphan.values[0].value
        : orphan.values.map(({ mode, value }) => `${mode} ${value}`).join(' · ')
    return `${orphan.collection.padEnd(collectionWidth)}  ${orphan.name.padEnd(nameWidth)}  ${pc.dim(values)}`
  })
}

export async function runPrune(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout, context.input)
  const config = context.config
  const options = context.options
  const tokensDir = config?.tokens.dir ?? 'tokens'
  ui.intro(banner('prune'))

  const figma = config?.figma
  if (!figma?.personalAccessToken || !figma.fileKey) {
    ui.log.error(
      'Figma API credentials are required for prune (FIGMA_PERSONAL_ACCESS_TOKEN and FIGMA_FILE_KEY, Enterprise plan).',
    )
    return EXIT_BAD_INPUT
  }

  let files
  try {
    files = readTokenDir(tokensDir, context.cwd)
  } catch (error) {
    if (!(error instanceof TokenDirError)) throw error
    ui.log.error(`Tokens directory not found: ${pc.dim(tokensDir)}`)
    return EXIT_BAD_INPUT
  }
  // Without token files every variable would look orphaned: never prune against nothing.
  if (files.length === 0) {
    ui.log.error(`No token files found in ${filePath(tokensDir + '/')}: nothing to compare with.`)
    return EXIT_BAD_INPUT
  }
  const { model, diagnostics: parseDiagnostics } = parseTokenFiles(files, tokenParseOptions(config))
  if (hasErrors(parseDiagnostics)) {
    for (const diagnostic of parseDiagnostics) ui.log.error(formatDiagnostic(diagnostic))
    return 1
  }
  // An entry the parser skips (a `$` name, a value that is neither a token nor a group) is
  // missing from the model, so its variable would look orphaned: stop until the file is fixed.
  const skipped = parseDiagnostics.filter((d) => DROPPED.has(d.code))
  for (const diagnostic of parseDiagnostics) ui.log.warn(formatDiagnostic(diagnostic))
  if (skipped.length > 0) {
    ui.log.error(
      `${plural(skipped.length, 'entry', 'entries')} in the token files ${skipped.length === 1 ? 'is' : 'are'} not read as tokens (above). Prune would take ${skipped.length === 1 ? 'its variable' : 'their variables'} for orphans: fix the files first.`,
    )
    return 1
  }
  // Only the collections the project builds from (`collections`), like every other command.
  const scoped = config?.collections
    ? { collections: model.collections.filter((c) => config.collections?.includes(c.name)) }
    : model

  const spinner = ui.spinner()
  spinner.start('Comparing the Figma file with the token files...')
  const client = figmaClientFor(figma.personalAccessToken)
  let plan
  try {
    plan = planPrune(scoped, await client.getLocalVariables(figma.fileKey), {
      allowBulk: Boolean(options.allowBulk),
    })
  } catch (error) {
    spinner.stop('Could not fetch variables from Figma')
    const message = describeFigmaError(error)
    if (message === null) throw error
    ui.log.error(message)
    return 1
  }
  spinner.stop('Compared')

  for (const diagnostic of plan.diagnostics) {
    ;(diagnostic.severity === 'error' ? ui.log.error : ui.log.warn)(formatDiagnostic(diagnostic))
  }
  if (hasErrors(plan.diagnostics)) return 1
  for (const { collection, orphans, variables } of plan.bulk) {
    ui.log.warn(
      `"${collection}" would lose ${orphans} of its ${variables} variables. That usually means the token files are incomplete, so it is left alone; ${cmd('prune --allow-bulk')} deletes them anyway.`,
    )
  }
  if (plan.kept.length > 0) {
    ui.log.warn(
      `${plural(plan.kept.length, 'orphan')} kept, because other variables in Figma still alias ${plan.kept.length === 1 ? 'it' : 'them'} (run ${cmd('push')} first):\n${plan.kept
        .map((orphan) => `  ${orphan.name} ← ${orphan.aliasedBy.join(', ')}`)
        .join('\n')}`,
    )
  }
  const payload = plan.payload
  if (payload === null) {
    ui.outro('No orphaned variables: every variable in Figma has its token in the token files.')
    return 0
  }

  ui.note(
    orphanLines(plan.orphans).join('\n'),
    `${plural(plan.orphans.length, 'variable')} in Figma without a token`,
  )

  if (options.dryRun) {
    ui.outro(`${pc.yellow('Dry run')}: nothing was deleted.`)
    return 0
  }

  // The REST API does not say where a variable is used: deleting one can change designs.
  ui.log.warn(
    'Figma does not tell DTA whether components or frames use these variables. Layers that do lose the value when they are deleted.',
  )
  if (!options.force) {
    if (context.input === process.stdin && !process.stdin.isTTY) {
      ui.log.error(
        'Deleting asks for a typed confirmation, and this is not a terminal. Pass --force to delete without it, or --dry-run to only list.',
      )
      return EXIT_BAD_INPUT
    }
    ui.log.warn(
      `This deletes ${plural(plan.orphans.length, 'variable')} from the Figma file. To confirm, type: ${pc.bold(pc.cyan(CONFIRMATION_PHRASE))}`,
    )
    const answer = await ui.text({
      message: 'Confirm delete:',
      placeholder: CONFIRMATION_PHRASE,
      validate: (value) =>
        !value || value.trim().toLowerCase() !== CONFIRMATION_PHRASE
          ? `Type "${CONFIRMATION_PHRASE}" to confirm, or press Ctrl+C to cancel.`
          : undefined,
    })
    if (answer === null) {
      ui.cancel('Prune cancelled: nothing was deleted.')
      return 0
    }
  }

  const deleting = ui.spinner()
  deleting.start(`Deleting ${plural(plan.orphans.length, 'variable')}...`)
  try {
    await client.postVariables(figma.fileKey, payload)
  } catch (error) {
    deleting.stop('Delete failed')
    const message = describeFigmaError(error)
    if (message === null) throw error
    ui.log.error(message)
    return 1
  }
  deleting.stop(`Deleted ${plural(plan.orphans.length, 'variable')}`)
  ui.outro('The Figma file has no variables without a token any more.')
  return 0
}
