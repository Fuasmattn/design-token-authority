/**
 * TICKET-015: `dtf init` wizard.
 *
 * Interactive setup that:
 *  1. Asks for Figma file key/URL + personal access token
 *  2. Validates by making a test API call
 *  3. Runs autodiscovery (TICKET-014) and displays results
 *  4. Confirms detected layer roles
 *  5. Confirms detected brand names
 *  6. Selects desired output targets
 *  7. Writes dtf.config.ts + .env.example
 *
 * Uses @clack/prompts for a polished CLI experience.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import FigmaApi from '../figma_api.js'
import { analyzeCollections, formatAnalysisReport, AnalysisResult } from '../analyze.js'

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
  layers: {
    primitives?: string
    brand?: string
    dimension?: string
  }
  brands: string[]
  outputs: string[]
}

export function generateConfigContent(data: ConfigData): string {
  const lines: string[] = []

  lines.push("import { defineConfig } from 'design-token-farm'")
  lines.push('')
  lines.push('export default defineConfig({')
  lines.push('  figma: {')
  lines.push('    fileKey: process.env.FIGMA_FILE_KEY!,')
  lines.push('    personalAccessToken: process.env.FIGMA_PERSONAL_ACCESS_TOKEN!,')
  lines.push('  },')

  // Layers
  if (data.layers.primitives || data.layers.brand || data.layers.dimension) {
    lines.push('')
    lines.push('  layers: {')
    if (data.layers.primitives) lines.push(`    primitives: '${data.layers.primitives}',`)
    if (data.layers.brand) lines.push(`    brand: '${data.layers.brand}',`)
    if (data.layers.dimension) lines.push(`    dimension: '${data.layers.dimension}',`)
    lines.push('  },')
  }

  // Brands
  if (data.brands.length > 0) {
    lines.push('')
    lines.push(`  brands: [${data.brands.map((b) => `'${b}'`).join(', ')}],`)
  }

  lines.push('')
  lines.push('  tokens: {')
  lines.push("    dir: 'tokens',")
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
// ASCII logo
// ---------------------------------------------------------------------------

function printLogo(): void {
  const g = pc.green
  const y = pc.yellow
  const c = pc.cyan
  const d = pc.dim

  console.log('')
  console.log(`   ${g('{')}${y('\u00b7')}${g('}')}      ${c('Design Token Farm')}`)
  console.log(`  ${g('{')} ${y('\u25c8')} ${g('}')}     ${d('~~~~~~~~~~~~~~~~~~~~')}`)
  console.log(`   ${g('{')}${y('\u00b7')}${g('}')}      ${d('Sync Figma variables')}`)
  console.log(`    ${g('|')}       ${d('to code, and back.')}`)
  console.log(`   ${g('_|_')}`)
  console.log(`  ${g('|___|')}`)
  console.log('')
}

// ---------------------------------------------------------------------------
// Cancellation helper
// ---------------------------------------------------------------------------

function exitIfCancelled<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Setup cancelled.')
    process.exit(0)
  }
  return value as T
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export async function runInit(_options: InitOptions): Promise<void> {
  const configPath = path.resolve('dtf.config.ts')

  if (fs.existsSync(configPath)) {
    p.log.error(`Config file already exists: ${pc.dim(configPath)}`)
    p.log.info('Remove it first if you want to re-initialize.')
    process.exit(2)
  }

  printLogo()
  p.intro(pc.bgCyan(pc.black(' dtf init ')))

  p.log.message(
    `This wizard will connect to your Figma file, auto-detect your\nvariable structure, and generate a ${pc.bold('dtf.config.ts')} for your project.`,
  )

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
  const fileKey = extractFileKey(fileKeyInput)!

  // ---- Step 2: Personal access token ----
  p.log.message(
    pc.dim(
      `Generate a token at ${pc.underline('figma.com > Settings > Personal access tokens')}.\nRequired scope: ${pc.cyan('Read and write Variables')}.`,
    ),
  )

  const token = exitIfCancelled(
    await p.password({
      message: 'Figma Personal Access Token',
      validate(val) {
        if (!val) return 'Token cannot be empty.'
        return undefined
      },
    }),
  )

  // ---- Step 3: Autodiscovery ----
  let analysisResult: AnalysisResult | null = null

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

  // ---- Step 4: Layer mapping ----
  p.log.step(pc.bold('Layer mapping'))
  p.log.message(
    pc.dim(
      'dtf uses a three-layer model: Primitives (raw values),\nBrand (semantic aliases per brand), and Dimension (responsive overrides).\nEach layer maps to a Figma variable collection.',
    ),
  )

  let layers: ConfigData['layers'] = {}

  if (analysisResult && Object.keys(analysisResult.suggestedLayers).length > 0) {
    const sl = analysisResult.suggestedLayers

    const mappingLines: string[] = []
    if (sl.primitives)
      mappingLines.push(`${pc.cyan('primitives')}  ${pc.dim('\u2192')}  ${sl.primitives}`)
    if (sl.brand) mappingLines.push(`${pc.cyan('brand')}       ${pc.dim('\u2192')}  ${sl.brand}`)
    if (sl.dimension)
      mappingLines.push(`${pc.cyan('dimension')}   ${pc.dim('\u2192')}  ${sl.dimension}`)

    p.note(mappingLines.join('\n'), 'Detected layers')

    const useDetected = exitIfCancelled(
      await p.confirm({
        message: 'Use detected layer mapping?',
        initialValue: true,
      }),
    )

    if (useDetected) {
      layers = { ...sl }
    } else {
      p.log.message(pc.dim('Enter the exact Figma collection name for each layer.'))
      const group = await p.group(
        {
          primitives: () =>
            p.text({
              message: 'Primitives collection name',
              placeholder: 'Leave blank to skip',
              defaultValue: '',
            }),
          brand: () =>
            p.text({
              message: 'Brand collection name',
              placeholder: 'Leave blank to skip',
              defaultValue: '',
            }),
          dimension: () =>
            p.text({
              message: 'Dimension/responsive collection name',
              placeholder: 'Leave blank to skip',
              defaultValue: '',
            }),
        },
        {
          onCancel: () => {
            p.cancel('Setup cancelled.')
            process.exit(0)
          },
        },
      )
      if (group.primitives) layers.primitives = group.primitives
      if (group.brand) layers.brand = group.brand
      if (group.dimension) layers.dimension = group.dimension
    }
  } else if (!analysisResult) {
    p.log.message(pc.dim('Enter the exact Figma collection name for each layer.'))
    const group = await p.group(
      {
        primitives: () =>
          p.text({
            message: 'Primitives collection name',
            placeholder: 'Leave blank to skip',
            defaultValue: '',
          }),
        brand: () =>
          p.text({
            message: 'Brand collection name',
            placeholder: 'Leave blank to skip',
            defaultValue: '',
          }),
        dimension: () =>
          p.text({
            message: 'Dimension/responsive collection name',
            placeholder: 'Leave blank to skip',
            defaultValue: '',
          }),
      },
      {
        onCancel: () => {
          p.cancel('Setup cancelled.')
          process.exit(0)
        },
      },
    )
    if (group.primitives) layers.primitives = group.primitives
    if (group.brand) layers.brand = group.brand
    if (group.dimension) layers.dimension = group.dimension
  }

  // ---- Step 5: Brand names ----
  let brands: string[] = []

  if (analysisResult && analysisResult.suggestedBrands.length > 0) {
    p.log.step(pc.bold('Brands'))
    p.log.message(
      pc.dim('Each brand corresponds to a mode in your Brand collection.\nTokens are resolved per-brand during build.'),
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
  } else if (layers.brand) {
    p.log.step(pc.bold('Brands'))
    p.log.message(
      pc.dim('Each brand corresponds to a mode in your Brand collection.\nTokens are resolved per-brand during build.'),
    )

    const input = exitIfCancelled(
      await p.text({
        message: 'Brand names (comma-separated, or blank to skip)',
        defaultValue: '',
      }),
    )
    brands = input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  // ---- Step 6: Output targets ----
  p.log.step(pc.bold('Output targets'))
  p.log.message(
    pc.dim('Select the formats you want dtf to generate.\nYou can change these later in dtf.config.ts.'),
  )

  const selectedOutputs = exitIfCancelled(
    await p.multiselect({
      message: 'Which formats should dtf generate?',
      options: OUTPUT_OPTIONS,
      required: false,
    }),
  )

  // ---- Step 7: Write files ----
  p.log.step(pc.bold('Writing config'))

  const configContent = generateConfigContent({
    fileKey,
    layers,
    brands,
    outputs: selectedOutputs,
  })

  fs.writeFileSync(configPath, configContent, 'utf-8')
  p.log.success(`Created ${pc.bold('dtf.config.ts')}`)

  // Write .env.example if not present
  const envExamplePath = path.resolve('.env.example')
  if (!fs.existsSync(envExamplePath)) {
    fs.writeFileSync(envExamplePath, ENV_EXAMPLE, 'utf-8')
    p.log.success(`Created ${pc.bold('.env.example')}`)
  }

  // Write .env with the actual values if not present
  const envPath = path.resolve('.env')
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(
      envPath,
      `FIGMA_FILE_KEY=${fileKey}\nFIGMA_PERSONAL_ACCESS_TOKEN=${token}\n`,
      'utf-8',
    )
    p.log.success(`Created ${pc.bold('.env')} ${pc.dim('(do not commit this file)')}`)
  }

  p.note(
    `1. Run ${pc.cyan('dtf pull')} to export tokens from Figma\n2. Run ${pc.cyan('dtf build')} to generate output files`,
    'Next steps',
  )

  p.outro("You're all set!")
}
