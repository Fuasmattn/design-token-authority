/**
 * TICKET-015: `dta init` wizard.
 *
 * Interactive setup that:
 *  1. Asks for Figma file key/URL + personal access token
 *  2. Validates by making a test API call
 *  3. Runs autodiscovery (TICKET-014) and displays results
 *  4. Confirms detected layer roles
 *  5. Confirms detected brand names
 *  6. Selects desired output targets
 *  7. Writes dta.config.ts + .env.example
 *
 * Uses @clack/prompts for a polished CLI experience.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { exec } from 'child_process'
import { banner } from '../theme.js'
import FigmaApi from '../figma_api.js'
import { analyzeCollections, formatAnalysisReport, AnalysisResult } from '../analyze.js'
import { detectFormat, convertTokenHausExport } from '../importers/index.js'
import { analyzeTokenFiles } from '../importers/analyze-tokens.js'
import { sanitizeFileName } from '../utils.js'
import { loadConfig } from '../config/index.js'
import { runPull } from './pull.js'
import { runBuild } from './build.js'

export interface InitOptions {
  verbose?: boolean
}

// ---------------------------------------------------------------------------
// Figma URL/key extraction
// ---------------------------------------------------------------------------

export function extractFileKey(input: string): string | null {
  // Direct key (22+ alphanumeric characters)
  if (/^[a-zA-Z0-9]{22,}$/.test(input)) return input

  // Figma URL patterns:
  //   figma.com/file/<KEY>/...
  //   figma.com/design/<KEY>/...
  const urlMatch = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
  if (urlMatch) return urlMatch[1]

  return null
}

// ---------------------------------------------------------------------------
// Config file generation
// ---------------------------------------------------------------------------

export interface ConfigData {
  fileKey: string
  source?: 'api' | 'file'
  collections: string[]
  brands: string[]
  stripEmojis: boolean
  outputs: string[]
}

export function generateConfigContent(data: ConfigData): string {
  const lines: string[] = []

  lines.push("import { defineConfig } from 'design-token-authority'")
  lines.push('')
  lines.push('export default defineConfig({')
  lines.push('  figma: {')
  if (data.source === 'file') {
    lines.push("    source: 'file',")
  } else {
    lines.push('    fileKey: process.env.FIGMA_FILE_KEY!,')
    lines.push('    personalAccessToken: process.env.FIGMA_PERSONAL_ACCESS_TOKEN!,')
  }
  lines.push('  },')

  // Collections
  if (data.collections.length > 0) {
    lines.push('')
    lines.push(`  collections: [${data.collections.map((c) => `'${c}'`).join(', ')}],`)
  }

  // Brands
  if (data.brands.length > 0) {
    lines.push('')
    lines.push(`  brands: [${data.brands.map((b) => `'${b}'`).join(', ')}],`)
  }

  lines.push('')
  lines.push('  tokens: {')
  lines.push("    dir: 'tokens',")
  if (data.stripEmojis) {
    lines.push('    stripEmojis: true,')
  }
  lines.push('  },')

  // Outputs
  if (data.outputs.length > 0) {
    lines.push('')
    lines.push('  outputs: {')
    if (data.outputs.includes('css')) {
      lines.push('    css: {')
      lines.push("      outDir: 'build/css',")
      lines.push("      prefix: '--',")
      lines.push('    },')
    }
    if (data.outputs.includes('tailwind3') || data.outputs.includes('tailwind4')) {
      lines.push('    tailwind: {')
      lines.push("      outDir: 'build/tailwind',")
      lines.push(`      version: ${data.outputs.includes('tailwind4') ? 4 : 3},`)
      lines.push('    },')
    }
    if (data.outputs.includes('ios')) {
      lines.push('    ios: {')
      lines.push("      outDir: 'build/ios',")
      lines.push("      lang: 'swift',")
      lines.push('    },')
    }
    if (data.outputs.includes('android-xml') || data.outputs.includes('android-compose')) {
      lines.push('    android: {')
      lines.push("      outDir: 'build/android',")
      lines.push(`      lang: '${data.outputs.includes('android-compose') ? 'compose' : 'xml'}',`)
      lines.push('    },')
    }
    lines.push('  },')
  }

  lines.push('})')
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// .env.example generation
// ---------------------------------------------------------------------------

const ENV_EXAMPLE = `# Figma file key — found in the Figma file URL:
# https://www.figma.com/file/<FIGMA_FILE_KEY>/...
FIGMA_FILE_KEY=

# Figma Personal Access Token — generate at figma.com > Settings > Personal access tokens
# Required scopes:
#   - Read-only Variables (for sync-figma-to-tokens)
#   - Read and write Variables (for sync-tokens-to-figma)
FIGMA_PERSONAL_ACCESS_TOKEN=
`

// ---------------------------------------------------------------------------
// Output target options
// ---------------------------------------------------------------------------

const OUTPUT_OPTIONS: { value: string; label: string }[] = [
  { value: 'css', label: 'CSS variables' },
  { value: 'tailwind3', label: 'Tailwind v3 theme' },
  { value: 'tailwind4', label: 'Tailwind v4 @theme CSS' },
  { value: 'ios', label: 'iOS Swift' },
  { value: 'android-xml', label: 'Android XML resources' },
  { value: 'android-compose', label: 'Android Jetpack Compose' },
]

// ---------------------------------------------------------------------------
// ASCII logo + background token animation
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Terminal title escape: \x1b]0;...\x07 sets the tab/window title */
const TITLE_FRAMES = [
  'dta init \u25c6 \u25cf \u25aa',
  'dta init \u25aa \u25c6 \u25cf',
  'dta init \u25cf \u25aa \u25c6',
]

let titleInterval: ReturnType<typeof setInterval> | null = null
let titleFrame = 0

function startTitleAnimation(): void {
  titleFrame = 0
  titleInterval = setInterval(() => {
    const frame = TITLE_FRAMES[titleFrame % TITLE_FRAMES.length]
    process.stdout.write(`\x1b]0;${frame}\x07`)
    titleFrame++
  }, 400)
}

function stopTitleAnimation(): void {
  if (titleInterval) {
    clearInterval(titleInterval)
    titleInterval = null
    // Reset terminal title
    process.stdout.write('\x1b]0;\x07')
  }
}

async function printLogo(): Promise<void> {
  const d = pc.dim
  const tokenFrames = [
    [pc.magenta('\u25c6'), pc.cyan('\u25cf'), pc.yellow('\u25aa')],
    [pc.yellow('\u25aa'), pc.magenta('\u25c6'), pc.cyan('\u25cf')],
    [pc.cyan('\u25cf'), pc.yellow('\u25aa'), pc.magenta('\u25c6')],
  ]

  const top = `          ${d('\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510')}`
  const bot = `   ${d('/|\\')}    ${d('\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518')}   ${d('Sync Figma variables to code, and back.')}`
  const feet = `   ${d('\u2575 \u2575')}`

  console.log('')
  console.log(top)

  // Animate token rotation in the logo
  for (let frame = 0; frame < 6; frame++) {
    const tokens = tokenFrames[frame % tokenFrames.length]
    const mid =
      `  ${pc.cyan('[')}\u2022\u203f\u2022${pc.cyan(']')} ${d('\u2500\u2500\u2524')} ${tokens[0]}  ${tokens[1]}  ${tokens[2]} ${d('\u2502')}   ${pc.cyan('Design Token Authority')}`
    process.stdout.write(`\r${mid}`)
    await sleep(200)
  }

  // Final frame
  const tokens = tokenFrames[0]
  const mid =
    `  ${pc.cyan('[')}\u2022\u203f\u2022${pc.cyan(']')} ${d('\u2500\u2500\u2524')} ${tokens[0]}  ${tokens[1]}  ${tokens[2]} ${d('\u2502')}   ${pc.cyan('Design Token Authority')}`
  process.stdout.write(`\r${mid}\n`)

  console.log(bot)
  console.log(feet)
  console.log('')

  // Start background animation in terminal title
  startTitleAnimation()
}

// ---------------------------------------------------------------------------
// Cancellation helper
// ---------------------------------------------------------------------------

function exitIfCancelled<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    stopTitleAnimation()
    p.cancel('Setup cancelled.')
    process.exit(0)
  }
  return value as T
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export async function runInit(_options: InitOptions): Promise<void> {
  const configPath = path.resolve('dta.config.ts')

  if (fs.existsSync(configPath)) {
    p.log.error(`Config file already exists: ${pc.dim(configPath)}`)
    p.log.info('Remove it first if you want to re-initialize.')
    process.exit(2)
  }

  await printLogo()
  p.intro(banner('init'))

  p.log.message(
    `This wizard will connect to your Figma file, auto-detect your\nvariable structure, and generate a ${pc.bold('dta.config.ts')} for your project.`,
  )

  // ---- Step 0: Figma plan type ----
  p.log.step(pc.bold('Figma plan'))
  p.log.message(
    pc.dim(
      'The Figma Variables REST API is only available on Enterprise plans.\n' +
        'On other plans, you can export tokens via a Figma plugin instead.',
    ),
  )

  const figmaPlan = exitIfCancelled(
    await p.select({
      message: 'Which Figma plan do you have?',
      options: [
        {
          value: 'enterprise',
          label: 'Enterprise',
          hint: 'Full REST API access — automated CI/CD',
        },
        {
          value: 'other',
          label: 'Professional / Organization / other',
          hint: 'Use a plugin to export tokens as JSON',
        },
      ],
    }),
  )

  const isEnterprise = figmaPlan === 'enterprise'
  let fileKey = ''
  let token = ''

  if (isEnterprise) {
    // ---- Step 1: Figma connection ----
    p.log.step(pc.bold('Figma connection'))
    p.log.message(
      pc.dim(
        'Paste the URL from your browser when viewing the Figma file,\nor just the file key (the alphanumeric ID in the URL).',
      ),
    )

    const fileKeyInput = exitIfCancelled(
      await p.text({
        message: 'Figma file key or URL',
        placeholder: 'https://figma.com/design/abc123.../My-File',
        validate(val) {
          if (!val) return 'Please provide a Figma file key or URL.'
          if (!extractFileKey(val)) return 'Could not extract a file key. Paste a Figma URL or key.'
          return undefined
        },
      }),
    )
    fileKey = extractFileKey(fileKeyInput)!

    // ---- Step 2: Personal access token ----
    p.log.message(
      pc.dim(
        `Generate a token at ${pc.underline('figma.com > Settings > Personal access tokens')}.\nRequired scope: ${pc.cyan('Read and write Variables')}.`,
      ),
    )

    token = exitIfCancelled(
      await p.password({
        message: 'Figma Personal Access Token',
        validate(val) {
          if (!val) return 'Token cannot be empty.'
          return undefined
        },
      }),
    )
  }

  // ---- Step 3: Autodiscovery ----
  let analysisResult: AnalysisResult | null = null
  let importFilePath = ''

  if (isEnterprise) {
    const s = p.spinner()
    s.start('Connecting to Figma and analyzing variable collections...')

    try {
      const api = new FigmaApi(token)
      const localVariables = await api.getLocalVariables(fileKey)
      analysisResult = analyzeCollections(localVariables)

      const count = analysisResult.collections.length
      s.stop(`Found ${count} variable collection${count !== 1 ? 's' : ''}`)

      if (count > 0) {
        p.log.info(formatAnalysisReport(analysisResult))
      } else {
        p.log.warn('No variable collections found in this file.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      s.stop('Could not connect to Figma')
      p.log.warn(`${msg}\nContinuing without autodiscovery — you can configure layers manually.`)
    }
  } else {
    // File-based autodiscovery for non-Enterprise plans
    p.log.step(pc.bold('Token file'))
    p.log.message(
      pc.dim(
        'Export your Figma variables as a JSON file using a plugin like tokenHaus\n' +
          'or any tool that exports in W3C DTCG format.\n' +
          'Provide the path to the exported file for autodiscovery.',
      ),
    )

    const tokenFilePath = exitIfCancelled(
      await p.text({
        message: 'Path to exported token JSON file (or leave blank to skip)',
        placeholder: './design-tokens.json',
        defaultValue: '',
      }),
    )
    importFilePath = tokenFilePath

    if (tokenFilePath) {
      const resolved = path.resolve(tokenFilePath)
      if (!fs.existsSync(resolved)) {
        p.log.warn(`File not found: ${resolved}\nContinuing without autodiscovery.`)
      } else {
        const s = p.spinner()
        s.start('Analyzing token file...')

        try {
          const raw = fs.readFileSync(resolved, 'utf-8')
          const data = JSON.parse(raw) as Record<string, unknown>
          const format = detectFormat(data)

          if (format === 'tokenhaus') {
            const tokenFiles = convertTokenHausExport(data)
            analysisResult = analyzeTokenFiles(tokenFiles)
            const count = analysisResult.collections.length
            s.stop(`Found ${count} collection${count !== 1 ? 's' : ''} in tokenHaus export`)
          } else if (format === 'dtcg-per-mode') {
            // Single per-mode file — limited autodiscovery
            s.stop('Detected single DTCG per-mode file')
            p.log.message(
              pc.dim(
                'For full autodiscovery, export all collections in a single file\n' +
                  'using a plugin like tokenHaus.',
              ),
            )
          } else {
            s.stop('Could not detect token format')
            p.log.warn('Continuing without autodiscovery — you can configure layers manually.')
          }

          if (analysisResult && analysisResult.collections.length > 0) {
            p.log.info(formatAnalysisReport(analysisResult))
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          s.stop('Could not analyze file')
          p.log.warn(`${msg}\nContinuing without autodiscovery.`)
        }
      }
    }
  }

  // ---- Step 3b: Emoji handling ----
  // Check if any discovered collection names contain emojis
  const hasEmojis =
    analysisResult?.suggestedCollections.some((name) => sanitizeFileName(name, true) !== name) ??
    false

  let stripEmojis = false
  if (hasEmojis) {
    p.log.step(pc.bold('Filenames'))
    p.log.message(
      pc.dim(
        'Some collection names contain emoji characters (e.g. "🎨 theme").\n' +
          'You can strip emojis from token filenames for cleaner file paths.',
      ),
    )

    stripEmojis = exitIfCancelled(
      await p.confirm({
        message: 'Strip emojis from token filenames?',
        initialValue: true,
      }),
    )
  }

  // ---- Step 4: Collections ----
  p.log.step(pc.bold('Collections'))
  p.log.message(
    pc.dim(
      'Select which Figma variable collections to include in the build.\nEach collection maps to one or more token files.',
    ),
  )

  let selectedCollections: string[] = []

  if (analysisResult && analysisResult.suggestedCollections.length > 0) {
    const collectionOptions = analysisResult.collections.map((c) => {
      const modeInfo = c.modeCount > 1 ? ` (${c.modeCount} modes: ${c.modeNames.join(', ')})` : ''
      const roleHint = c.inferredRole !== 'unknown' ? ` [${c.inferredRole}]` : ''
      return {
        value: c.name,
        label: c.name,
        hint: `${c.variableCount} tokens${modeInfo}${roleHint}`,
      }
    })

    const chosen = exitIfCancelled(
      await p.multiselect({
        message: 'Which collections should be included in the build?',
        options: collectionOptions,
        initialValues: analysisResult.suggestedCollections,
        required: false,
      }),
    )
    selectedCollections = chosen
  } else if (!analysisResult) {
    p.log.message(pc.dim('No collections were auto-detected. Enter collection names manually.'))
    const input = exitIfCancelled(
      await p.text({
        message: 'Collection names (comma-separated, or blank to skip)',
        placeholder: 'Primitives, Brand, ScreenType',
        defaultValue: '',
      }),
    )
    selectedCollections = input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  // ---- Step 5: Brand names ----
  // Detect multi-mode collections among the selected ones as potential brand sources
  let brands: string[] = []

  if (analysisResult && analysisResult.suggestedBrands.length > 0) {
    p.log.step(pc.bold('Brands'))
    p.log.message(
      pc.dim(
        'Multi-mode collections can generate per-brand outputs.\nEach brand corresponds to a mode in such a collection.',
      ),
    )

    p.note(analysisResult.suggestedBrands.join(', '), 'Detected brands')

    const useBrands = exitIfCancelled(
      await p.confirm({
        message: 'Use these brand names?',
        initialValue: true,
      }),
    )

    if (useBrands) {
      brands = [...analysisResult.suggestedBrands]
    } else {
      const input = exitIfCancelled(
        await p.text({
          message: 'Enter brand names (comma-separated)',
          placeholder: 'BrandA, BrandB',
        }),
      )
      brands = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  } else if (analysisResult) {
    // Check if any selected collection has multiple modes
    const multiModeCollections = analysisResult.collections.filter(
      (c) => selectedCollections.includes(c.name) && c.modeCount > 1,
    )
    if (multiModeCollections.length > 0) {
      p.log.step(pc.bold('Brands'))
      const modeNames = multiModeCollections.flatMap((c) => c.modeNames)
      p.log.message(
        pc.dim(
          `Found multi-mode collections: ${multiModeCollections.map((c) => c.name).join(', ')}.\n` +
            'Their modes can be used as brand names for per-brand output.',
        ),
      )
      const input = exitIfCancelled(
        await p.text({
          message: `Brand names (comma-separated, or blank to skip)`,
          placeholder: modeNames.join(', '),
          defaultValue: modeNames.join(', '),
        }),
      )
      brands = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
  }

  // ---- Step 6: Output targets ----
  p.log.step(pc.bold('Output targets'))
  p.log.message(
    pc.dim(
      'Select the formats you want dta to generate.\nYou can change these later in dta.config.ts.',
    ),
  )

  const selectedOutputs = exitIfCancelled(
    await p.multiselect({
      message: 'Which formats should dta generate?',
      options: OUTPUT_OPTIONS,
      required: false,
    }),
  )

  // ---- Step 7: Write files ----
  p.log.step(pc.bold('Writing config'))

  const configContent = generateConfigContent({
    fileKey,
    source: isEnterprise ? undefined : 'file',
    collections: selectedCollections.map((c) => sanitizeFileName(c, stripEmojis)),
    brands: brands.map((b) => sanitizeFileName(b, stripEmojis)),
    stripEmojis,
    outputs: selectedOutputs,
  })

  fs.writeFileSync(configPath, configContent, 'utf-8')
  p.log.success(`Created ${pc.bold('dta.config.ts')}`)

  if (isEnterprise) {
    // Write .env.example if not present
    const envExamplePath = path.resolve('.env.example')
    if (!fs.existsSync(envExamplePath)) {
      fs.writeFileSync(envExamplePath, ENV_EXAMPLE, 'utf-8')
      p.log.success(`Created ${pc.bold('.env.example')}`)
    }

    // Write or update .env with the actual values
    const envPath = path.resolve('.env')
    const envVars: Record<string, string> = {
      FIGMA_FILE_KEY: fileKey,
      FIGMA_PERSONAL_ACCESS_TOKEN: token,
    }

    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf-8')
      for (const [key, value] of Object.entries(envVars)) {
        const regex = new RegExp(`^${key}=.*$`, 'm')
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${value}`)
        } else {
          envContent = envContent.trimEnd() + `\n${key}=${value}\n`
        }
      }
      fs.writeFileSync(envPath, envContent, 'utf-8')
      p.log.success(`Updated ${pc.bold('.env')} ${pc.dim('(do not commit this file)')}`)
    } else {
      fs.writeFileSync(
        envPath,
        `FIGMA_FILE_KEY=${fileKey}\nFIGMA_PERSONAL_ACCESS_TOKEN=${token}\n`,
        'utf-8',
      )
      p.log.success(`Created ${pc.bold('.env')} ${pc.dim('(do not commit this file)')}`)
    }
  }

  // ---- Post-setup: run pull + build ----

  const pullCmd = isEnterprise
    ? pc.cyan('dta pull')
    : importFilePath
      ? pc.cyan(`dta pull --from-file ${importFilePath}`)
      : pc.cyan('dta pull --from-file <exported.json>')

  const canRunPull = isEnterprise || !!importFilePath
  let pullSucceeded = false
  let buildSucceeded = false

  if (canRunPull) {
    const shouldPull = exitIfCancelled(
      await p.confirm({
        message: `Run ${pullCmd} now?`,
        initialValue: true,
      }),
    )

    if (shouldPull) {
      try {
        const config = await loadConfig(configPath)
        await runPull(config, {
          fromFile: isEnterprise ? undefined : importFilePath,
        })
        pullSucceeded = true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        p.log.error(`Pull failed: ${msg}`)
      }
    }
  } else {
    p.note(
      `Export variables from Figma using ${pc.bold('tokenHaus')} or another DTCG-compatible plugin,\n` +
        `then run ${pc.cyan('dta pull --from-file <exported.json>')} to import tokens.`,
      'Next step',
    )
  }

  if (pullSucceeded) {
    const shouldBuild = exitIfCancelled(
      await p.confirm({
        message: `Run ${pc.cyan('dta build')} now?`,
        initialValue: true,
      }),
    )

    if (shouldBuild) {
      try {
        const config = await loadConfig(configPath)
        await runBuild(config, {})
        buildSucceeded = true
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        p.log.error(`Build failed: ${msg}`)
      }
    }
  }

  if (buildSucceeded) {
    const docsPath = path.resolve('build/docs/index.html')
    if (fs.existsSync(docsPath)) {
      const shouldOpen = exitIfCancelled(
        await p.confirm({
          message: 'Open token documentation in your browser?',
          initialValue: true,
        }),
      )

      if (shouldOpen) {
        const openCmd =
          process.platform === 'darwin'
            ? 'open'
            : process.platform === 'win32'
              ? 'start'
              : 'xdg-open'
        exec(`${openCmd} ${docsPath}`)
      }
    }
  }

  stopTitleAnimation()
  p.outro("You're all set!")
}
