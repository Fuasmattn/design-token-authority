import fs from 'node:fs'
import path from 'node:path'
import { analyzeStructure } from '@dta/core'
import type { StructureAnalysis } from '@dta/core'
import { detectFormat, importPluginExport, variablesToModel } from '@dta/figma'
import pc from 'picocolors'
import type { CommandContext } from '../commands.js'
import { ConfigError, loadConfig } from '../config/load.js'
import { describeFigmaError, figmaClientFor } from '../figma-client.js'
import { sanitizeFileName } from '../util-names.js'
import { banner, createUi, type Ui } from '../ui.js'
import { runBuild } from './build.js'
import { formatStructureReport } from './analyze.js'
import {
  ENV_EXAMPLE,
  OUTPUT_OPTIONS,
  extractFileKey,
  generateConfigContent,
} from './init-config.js'
import { runPull } from './pull.js'

const EXIT_CONFIG_EXISTS = 2
const CONFIG_FILES = [
  'dta.config.ts',
  'dta.config.mts',
  'dta.config.js',
  'dta.config.mjs',
  'dta.config.json',
]

/** Thrown when a prompt is cancelled, to leave the wizard from any depth. */
class Cancelled extends Error {}

function answered<T>(value: T | null): T {
  if (value === null) throw new Cancelled()
  return value
}

const splitList = (text: string) =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

/** Writes `KEY=value` lines into an existing .env, replacing keys that are already there. */
function mergeEnv(existing: string, values: Record<string, string>): string {
  let content = existing
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${key}=.*$`, 'm')
    content = line.test(content)
      ? content.replace(line, () => `${key}=${value}`)
      : content.trimEnd() + `\n${key}=${value}\n`
  }
  return content
}

async function discoverFromApi(
  ui: Ui,
  fileKey: string,
  token: string,
): Promise<StructureAnalysis | null> {
  const spinner = ui.spinner()
  spinner.start('Connecting to Figma and analyzing variable collections...')
  try {
    const response = await figmaClientFor(token).getLocalVariables(fileKey)
    const analysis = analyzeStructure(variablesToModel(response).model)
    const count = analysis.collections.length
    spinner.stop(`Found ${count} variable collection${count === 1 ? '' : 's'}`)
    if (count > 0) ui.log.info(formatStructureReport(analysis))
    else ui.log.warn('No variable collections found in this file.')
    return analysis
  } catch (error) {
    spinner.stop('Could not connect to Figma')
    const message = describeFigmaError(error) ?? (error instanceof Error ? error.message : '')
    ui.log.warn(`${message}\nContinuing without autodiscovery — you can configure layers manually.`)
    return null
  }
}

function discoverFromFile(ui: Ui, cwd: string, file: string): StructureAnalysis | null {
  const resolved = path.resolve(cwd, file)
  if (!fs.existsSync(resolved)) {
    ui.log.warn(`File not found: ${resolved}\nContinuing without autodiscovery.`)
    return null
  }
  const spinner = ui.spinner()
  spinner.start('Analyzing token file...')
  try {
    const data: unknown = JSON.parse(fs.readFileSync(resolved, 'utf8'))
    if (detectFormat(data) === 'dtcg-per-mode') {
      spinner.stop('Detected single DTCG per-mode file')
      ui.log.message(
        pc.dim(
          'For full autodiscovery, export all collections in a single file\n' +
            'using a plugin like tokenHaus.',
        ),
      )
      return null
    }
    const imported = importPluginExport(data)
    if (imported.format === 'unknown') {
      spinner.stop('Could not detect token format')
      ui.log.warn('Continuing without autodiscovery — you can configure layers manually.')
      return null
    }
    const analysis = analyzeStructure(imported.model)
    const count = analysis.collections.length
    spinner.stop(`Found ${count} collection${count === 1 ? '' : 's'} in ${imported.format} export`)
    if (count > 0) ui.log.info(formatStructureReport(analysis))
    return analysis
  } catch (error) {
    spinner.stop('Could not analyze file')
    ui.log.warn(
      `${error instanceof Error ? error.message : String(error)}\nContinuing without autodiscovery.`,
    )
    return null
  }
}

async function chooseCollections(ui: Ui, analysis: StructureAnalysis | null): Promise<string[]> {
  ui.log.step(pc.bold('Collections'))
  ui.log.message(
    pc.dim(
      'Select which Figma variable collections to include in the build.\nEach collection maps to one or more token files.',
    ),
  )
  if (analysis && analysis.suggestedCollections.length > 0) {
    return answered(
      await ui.multiselect({
        message: 'Which collections should be included in the build?',
        options: analysis.collections.map((c) => {
          const modes = c.modeCount > 1 ? ` (${c.modeCount} modes: ${c.modeNames.join(', ')})` : ''
          const role = c.inferredRole !== 'unknown' ? ` [${c.inferredRole}]` : ''
          return { value: c.name, label: c.name, hint: `${c.variableCount} tokens${modes}${role}` }
        }),
        initialValues: analysis.suggestedCollections,
      }),
    )
  }
  if (analysis) return []
  ui.log.message(pc.dim('No collections were auto-detected. Enter collection names manually.'))
  return splitList(
    answered(
      await ui.text({
        message: 'Collection names (comma-separated, or blank to skip)',
        placeholder: 'Primitives, Brand, ScreenType',
        defaultValue: '',
        validate: () => undefined,
      }),
    ),
  )
}

async function chooseBrands(
  ui: Ui,
  analysis: StructureAnalysis | null,
  selected: string[],
): Promise<string[]> {
  if (!analysis) return []
  if (analysis.suggestedBrands.length > 0) {
    ui.log.step(pc.bold('Brands'))
    ui.log.message(
      pc.dim(
        'Multi-mode collections can generate per-brand outputs.\nEach brand corresponds to a mode in such a collection.',
      ),
    )
    ui.note(analysis.suggestedBrands.join(', '), 'Detected brands')
    const useDetected = answered(
      await ui.confirm({ message: 'Use these brand names?', initialValue: true }),
    )
    if (useDetected) return [...analysis.suggestedBrands]
    return splitList(
      answered(
        await ui.text({
          message: 'Enter brand names (comma-separated)',
          placeholder: 'BrandA, BrandB',
          defaultValue: '',
          validate: () => undefined,
        }),
      ),
    )
  }

  const multiMode = analysis.collections.filter((c) => selected.includes(c.name) && c.modeCount > 1)
  if (multiMode.length === 0) return []
  ui.log.step(pc.bold('Brands'))
  const modeNames = multiMode.flatMap((c) => c.modeNames)
  ui.log.message(
    pc.dim(
      `Found multi-mode collections: ${multiMode.map((c) => c.name).join(', ')}.\n` +
        'Their modes can be used as brand names for per-brand output.',
    ),
  )
  return splitList(
    answered(
      await ui.text({
        message: 'Brand names (comma-separated, or blank to skip)',
        placeholder: modeNames.join(', '),
        defaultValue: modeNames.join(', '),
        validate: () => undefined,
      }),
    ),
  )
}

function writeEnv(ui: Ui, cwd: string, fileKey: string, token: string): void {
  const examplePath = path.join(cwd, '.env.example')
  if (!fs.existsSync(examplePath)) {
    fs.writeFileSync(examplePath, ENV_EXAMPLE, 'utf8')
    ui.log.success(`Created ${pc.bold('.env.example')}`)
  }
  const values = { FIGMA_FILE_KEY: fileKey, FIGMA_PERSONAL_ACCESS_TOKEN: token }
  const envPath = path.join(cwd, '.env')
  const note = pc.dim('(do not commit this file)')
  if (fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, mergeEnv(fs.readFileSync(envPath, 'utf8'), values), 'utf8')
    ui.log.success(`Updated ${pc.bold('.env')} ${note}`)
  } else {
    const lines = Object.entries(values).map(([key, value]) => `${key}=${value}\n`)
    fs.writeFileSync(envPath, lines.join(''), 'utf8')
    ui.log.success(`Created ${pc.bold('.env')} ${note}`)
  }
}

/** Runs a follow-up command against the config that was just written. */
async function runFollowUp(
  ui: Ui,
  context: CommandContext,
  label: string,
  run: (context: CommandContext) => Promise<number>,
  options: Record<string, unknown>,
): Promise<boolean> {
  try {
    const { config } = await loadConfig({ cwd: context.cwd })
    return (await run({ ...context, config, options })) === 0
  } catch (error) {
    const message =
      error instanceof ConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error)
    ui.log.error(`${label} failed: ${message}`)
    return false
  }
}

async function wizard(ui: Ui, context: CommandContext): Promise<void> {
  const cwd = context.cwd
  ui.log.message(
    `This wizard will connect to your Figma file, auto-detect your\nvariable structure, and generate a ${pc.bold('dta.config.ts')} for your project.`,
  )

  ui.log.step(pc.bold('Figma plan'))
  ui.log.message(
    pc.dim(
      'The Figma Variables REST API is only available on Enterprise plans.\n' +
        'On other plans, you can export tokens via a Figma plugin instead.',
    ),
  )
  const plan = answered(
    await ui.select({
      message: 'Which Figma plan do you have?',
      options: [
        {
          value: 'enterprise' as const,
          label: 'Enterprise',
          hint: 'Full REST API access — automated CI/CD',
        },
        {
          value: 'other' as const,
          label: 'Professional / Organization / other',
          hint: 'Use a plugin to export tokens as JSON',
        },
      ],
    }),
  )
  const isEnterprise = plan === 'enterprise'

  let fileKey = ''
  let token = ''
  let analysis: StructureAnalysis | null = null
  let importFile = ''

  if (isEnterprise) {
    ui.log.step(pc.bold('Figma connection'))
    ui.log.message(
      pc.dim(
        'Paste the URL from your browser when viewing the Figma file,\nor just the file key (the alphanumeric ID in the URL).',
      ),
    )
    const keyInput = answered(
      await ui.text({
        message: 'Figma file key or URL',
        placeholder: 'https://figma.com/design/abc123.../My-File',
        validate(value) {
          if (!value) return 'Please provide a Figma file key or URL.'
          if (!extractFileKey(value))
            return 'Could not extract a file key. Paste a Figma URL or key.'
          return undefined
        },
      }),
    )
    fileKey = extractFileKey(keyInput)!

    ui.log.message(
      pc.dim(
        `Generate a token at ${pc.underline('figma.com > Settings > Personal access tokens')}.\nRequired scope: ${pc.cyan('Read and write Variables')}.`,
      ),
    )
    token = answered(
      await ui.password({
        message: 'Figma Personal Access Token',
        validate: (value) => (value ? undefined : 'Token cannot be empty.'),
      }),
    )
    analysis = await discoverFromApi(ui, fileKey, token)
  } else {
    ui.log.step(pc.bold('Token file'))
    ui.log.message(
      pc.dim(
        'Export your Figma variables as a JSON file using a plugin like tokenHaus\n' +
          'or any tool that exports in W3C DTCG format.\n' +
          'Provide the path to the exported file for autodiscovery.',
      ),
    )
    importFile = answered(
      await ui.text({
        message: 'Path to exported token JSON file (or leave blank to skip)',
        placeholder: './design-tokens.json',
        defaultValue: '',
        validate: () => undefined,
      }),
    )
    if (importFile) analysis = discoverFromFile(ui, cwd, importFile)
  }

  const hasEmojis =
    analysis?.suggestedCollections.some((name) => sanitizeFileName(name, true) !== name) ?? false
  let stripEmojis = false
  if (hasEmojis) {
    ui.log.step(pc.bold('Filenames'))
    ui.log.message(
      pc.dim(
        'Some collection names contain emoji characters (e.g. "🎨 theme").\n' +
          'You can strip emojis from token filenames for cleaner file paths.',
      ),
    )
    stripEmojis = answered(
      await ui.confirm({ message: 'Strip emojis from token filenames?', initialValue: true }),
    )
  }

  const collections = await chooseCollections(ui, analysis)
  const brands = await chooseBrands(ui, analysis, collections)

  ui.log.step(pc.bold('Output targets'))
  ui.log.message(
    pc.dim(
      'Select the formats you want dta to generate.\nYou can change these later in dta.config.ts.',
    ),
  )
  const outputs = answered(
    await ui.multiselect({
      message: 'Which formats should dta generate?',
      options: OUTPUT_OPTIONS,
    }),
  )

  ui.log.step(pc.bold('Writing config'))
  fs.writeFileSync(
    path.join(cwd, 'dta.config.ts'),
    generateConfigContent({
      fileKey,
      source: isEnterprise ? undefined : 'file',
      collections: collections.map((name) => sanitizeFileName(name, stripEmojis)),
      brands: brands.map((name) => sanitizeFileName(name, stripEmojis)),
      stripEmojis,
      outputs,
    }),
    'utf8',
  )
  ui.log.success(`Created ${pc.bold('dta.config.ts')}`)
  if (isEnterprise) writeEnv(ui, cwd, fileKey, token)

  const canPull = isEnterprise || importFile !== ''
  if (!canPull) {
    ui.note(
      `Export variables from Figma using ${pc.bold('tokenHaus')} or another DTCG-compatible plugin,\n` +
        `then run ${pc.cyan('dta pull --from-file <exported.json>')} to import tokens.`,
      'Next step',
    )
    return
  }

  const pullCommand = isEnterprise ? 'dta pull' : `dta pull --from-file ${importFile}`
  if (
    !answered(await ui.confirm({ message: `Run ${pc.cyan(pullCommand)} now?`, initialValue: true }))
  ) {
    return
  }
  const pulled = await runFollowUp(ui, context, 'Pull', runPull, {
    fromFile: isEnterprise ? undefined : importFile,
  })
  if (!pulled) return

  if (
    !answered(await ui.confirm({ message: `Run ${pc.cyan('dta build')} now?`, initialValue: true }))
  ) {
    return
  }
  if (!(await runFollowUp(ui, context, 'Build', runBuild, {}))) return

  const loaded = await loadConfig({ cwd }).catch(() => null)
  const docsDir = loaded?.config.outputs?.docs?.outDir ?? 'output/docs'
  const docsPath = path.resolve(cwd, docsDir, 'index.html')
  if (
    fs.existsSync(docsPath) &&
    answered(
      await ui.confirm({
        message: 'Open token documentation in your browser?',
        initialValue: true,
      }),
    )
  ) {
    context.openFile(docsPath)
  }
}

export async function runInit(context: CommandContext): Promise<number> {
  const ui = createUi(context.stdout, context.input)
  const existing = CONFIG_FILES.find((name) => fs.existsSync(path.join(context.cwd, name)))
  if (existing) {
    ui.log.error(`Config file already exists: ${pc.dim(path.join(context.cwd, existing))}`)
    ui.log.info('Remove it first if you want to re-initialize.')
    return EXIT_CONFIG_EXISTS
  }

  ui.intro(banner('init'))
  try {
    await wizard(ui, context)
  } catch (error) {
    if (error instanceof Cancelled) {
      ui.cancel('Setup cancelled.')
      return 0
    }
    throw error
  }
  ui.outro("You're all set!")
  return 0
}
