import fs from 'node:fs'
import path from 'node:path'
import { parseTokenFiles, serializeTokenFiles } from '@dta/core'
import type { Diagnostic, TokenFileInput, TokenModel } from '@dta/core'
import { detectFormat, importPluginExport, variablesToModel } from '@dta/figma'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { describeFigmaError, figmaClientFor } from '../figma-client.js'
import { formatDiagnostic, hasErrors } from '../io/diagnostics.js'
import { readTokenDir } from '../io/token-dir.js'
import { sanitizeTokenFileName } from '../util-names.js'
import { banner, createUi, filePath, type Ui } from '../ui.js'

const EXIT_BAD_INPUT = 2

const plural = (count: number, word: string) =>
  `${pc.bold(String(count))} ${word}${count === 1 ? '' : 's'}`

function writeTokenFiles(
  ui: Ui,
  files: readonly TokenFileInput[],
  outputDir: string,
  stripEmojis: boolean,
): void {
  for (const file of files) {
    const name = sanitizeTokenFileName(file.fileName, stripEmojis)
    fs.writeFileSync(path.join(outputDir, name), file.content, 'utf8')
    ui.log.step(`Wrote ${pc.dim(name)}`)
  }
}

function report(ui: Ui, diagnostics: readonly Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    ;(diagnostic.severity === 'error' ? ui.log.error : ui.log.warn)(formatDiagnostic(diagnostic))
  }
}

export async function runPull(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout, context.input)
  const config = context.config
  const outputOption =
    typeof context.options.output === 'string' ? context.options.output : undefined
  const outputDir = outputOption ?? config?.tokens.dir ?? 'tokens'
  const stripEmojis = config?.tokens.stripEmojis ?? false
  const outputPath = path.resolve(context.cwd, outputDir)

  ui.intro(banner('pull'))
  fs.mkdirSync(outputPath, { recursive: true })

  const fromFile =
    typeof context.options.fromFile === 'string' ? context.options.fromFile : undefined
  const code = fromFile
    ? await pullFromFile(ui, context, fromFile, outputPath, stripEmojis)
    : await pullFromApi(ui, context, outputPath, stripEmojis)
  if (code !== 0) return code

  ui.outro(`Tokens written to ${filePath(outputDir + '/')}`)
  return 0
}

async function pullFromApi(
  ui: Ui,
  context: CommandContext,
  outputPath: string,
  stripEmojis: boolean,
): Promise<number> {
  const figma = context.config?.figma
  if (!figma?.fileKey || !figma.personalAccessToken) {
    ui.log.error(
      'Figma API credentials are required for API-based pull.\n' +
        pc.dim(
          'Set figma.fileKey and figma.personalAccessToken in dta.config.ts,\n' +
            'or use --from-file to import from a plugin-exported JSON file.',
        ),
    )
    return EXIT_BAD_INPUT
  }

  if (context.options.verbose) {
    ui.log.message(`${pc.dim('File:')} ${figma.fileKey}\n${pc.dim('Output:')} ${outputPath}`)
  }

  const spinner = ui.spinner()
  spinner.start('Fetching variables from Figma...')
  let files: TokenFileInput[]
  let diagnostics: Diagnostic[]
  try {
    const response = await figmaClientFor(figma.personalAccessToken).getLocalVariables(
      figma.fileKey,
    )
    // Files that are already there keep their formatting, so unchanged tokens give no diff.
    const existing = readExisting(context.cwd, outputPath)
    const result = variablesToModel(response, existing ? { existing } : {})
    files = inModelOrder(serializeTokenFiles(result.model), result.model)
    diagnostics = result.diagnostics
  } catch (error) {
    spinner.stop('Could not fetch variables from Figma')
    const message = describeFigmaError(error)
    if (message === null) throw error
    ui.log.error(message)
    return 1
  }
  spinner.stop(`Received ${plural(files.length, 'token file')} from Figma`)

  report(ui, diagnostics)
  if (hasErrors(diagnostics)) return 1
  writeTokenFiles(ui, files, outputPath, stripEmojis)
  return 0
}

/** Files in the order of the collections and modes in Figma (serialization sorts by name). */
function inModelOrder(files: TokenFileInput[], model: TokenModel): TokenFileInput[] {
  const order = model.collections.flatMap((collection) =>
    collection.modes.map((mode) => `${collection.name}.${mode}.json`),
  )
  const rank = (file: TokenFileInput) => {
    const index = order.indexOf(file.fileName)
    return index === -1 ? order.length : index
  }
  return [...files].sort((a, b) => rank(a) - rank(b))
}

function readExisting(cwd: string, directory: string) {
  try {
    const { model } = parseTokenFiles(readTokenDir(directory, cwd))
    return model.collections.length > 0 ? model : undefined
  } catch {
    return undefined
  }
}

async function pullFromFile(
  ui: Ui,
  context: CommandContext,
  fromFile: string,
  outputPath: string,
  stripEmojis: boolean,
): Promise<number> {
  const resolved = path.resolve(context.cwd, fromFile)
  if (!fs.existsSync(resolved)) {
    ui.log.error(`File not found: ${resolved}`)
    return EXIT_BAD_INPUT
  }

  const spinner = ui.spinner()
  spinner.start(`Reading ${pc.dim(path.basename(resolved))}...`)

  let data: unknown
  try {
    data = JSON.parse(fs.readFileSync(resolved, 'utf8'))
  } catch (error) {
    spinner.stop('Failed to read file')
    ui.log.error(`Could not parse JSON: ${error instanceof Error ? error.message : String(error)}`)
    return EXIT_BAD_INPUT
  }

  const format = detectFormat(data)
  if (format === 'dtcg-per-mode') {
    // DTA's own format: copy the file as it is, under its own name.
    spinner.stop('Detected DTCG per-mode format')
    const name = path.basename(resolved)
    fs.copyFileSync(resolved, path.join(outputPath, name))
    ui.log.step(`Copied ${pc.dim(name)}`)
    return 0
  }

  const imported = importPluginExport(data)
  if (hasErrors(imported.diagnostics) || imported.format === 'unknown') {
    spinner.stop(imported.format === 'unknown' ? 'Unknown format' : 'Could not convert the file')
    report(ui, imported.diagnostics)
    return EXIT_BAD_INPUT
  }

  const files = serializeTokenFiles(imported.model)
  spinner.stop(`Converted ${imported.format} export into ${plural(files.length, 'token file')}`)
  report(ui, imported.diagnostics)
  writeTokenFiles(ui, files, outputPath, stripEmojis)
  return 0
}
