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
 * Uses Node readline for interactive prompts since @clack/prompts
 * could not be installed (npm registry unavailable at implementation time).
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { green, brightRed } from '../utils.js'
import FigmaApi from '../figma_api.js'
import { analyzeCollections, formatAnalysisReport, AnalysisResult } from '../analyze.js'

export interface InitOptions {
  verbose?: boolean
}

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

function createRl(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout })
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })
}

async function confirm(
  rl: readline.Interface,
  question: string,
  defaultYes = true,
): Promise<boolean> {
  const hint = defaultYes ? '(Y/n)' : '(y/N)'
  const answer = await ask(rl, `${question} ${hint} `)
  if (answer === '') return defaultYes
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
}

// ---------------------------------------------------------------------------
// Figma URL/key extraction
// ---------------------------------------------------------------------------

function extractFileKey(input: string): string | null {
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

interface ConfigData {
  fileKey: string
  layers: {
    primitives?: string
    brand?: string
    dimension?: string
  }
  brands: string[]
  outputs: string[]
}

function generateConfigContent(data: ConfigData): string {
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
// Output target selection
// ---------------------------------------------------------------------------

const OUTPUT_OPTIONS = [
  { key: 'css', label: 'CSS variables' },
  { key: 'tailwind3', label: 'Tailwind v3 theme' },
  { key: 'tailwind4', label: 'Tailwind v4 @theme CSS' },
  { key: 'ios', label: 'iOS Swift' },
  { key: 'android-xml', label: 'Android XML resources' },
  { key: 'android-compose', label: 'Android Jetpack Compose' },
]

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export async function runInit(options: InitOptions): Promise<void> {
  const configPath = path.resolve('dtf.config.ts')

  if (fs.existsSync(configPath)) {
    console.error(brightRed(`Config file already exists: ${configPath}`))
    console.error('Remove it first if you want to re-initialize.')
    process.exit(2)
  }

  console.log('')
  console.log(green('  dtf init'))
  console.log(green('  ─────────────────'))
  console.log('  Set up your design token pipeline.\n')

  const rl = createRl()

  try {
    // ---- Step 1: Figma file key ----
    let fileKey: string | null = null
    while (!fileKey) {
      const input = await ask(rl, 'Figma file key or URL: ')
      fileKey = extractFileKey(input)
      if (!fileKey) {
        console.log(brightRed('  Invalid input. Provide a Figma file key or full URL.'))
      }
    }

    // ---- Step 2: Personal access token ----
    let token = ''
    while (!token) {
      token = await ask(rl, 'Figma Personal Access Token: ')
      if (!token) {
        console.log(brightRed('  Token cannot be empty.'))
      }
    }

    // ---- Step 3: Validate + autodiscovery ----
    console.log('\nConnecting to Figma...')
    let analysisResult: AnalysisResult | null = null

    try {
      const api = new FigmaApi(token)
      const localVariables = await api.getLocalVariables(fileKey)
      analysisResult = analyzeCollections(localVariables)

      if (analysisResult.collections.length > 0) {
        console.log(formatAnalysisReport(analysisResult))
      } else {
        console.log('  No variable collections found in this file.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(brightRed(`\n  Could not connect to Figma: ${msg}`))
      console.log('  Continuing without autodiscovery. You can configure layers manually.\n')
    }

    // ---- Step 4: Confirm/adjust layer roles ----
    let layers: ConfigData['layers'] = {}

    if (analysisResult && Object.keys(analysisResult.suggestedLayers).length > 0) {
      const useDetected = await confirm(rl, 'Use the detected layer mapping?')
      if (useDetected) {
        layers = { ...analysisResult.suggestedLayers }
      } else {
        // Let user type collection names manually
        console.log('\nEnter Figma collection names (leave blank to skip):')
        const prim = await ask(rl, '  Primitives collection: ')
        const brand = await ask(rl, '  Brand collection: ')
        const dim = await ask(rl, '  Dimension/responsive collection: ')
        if (prim) layers.primitives = prim
        if (brand) layers.brand = brand
        if (dim) layers.dimension = dim
      }
    } else if (!analysisResult) {
      // No autodiscovery — manual input
      console.log('Enter Figma collection names (leave blank to skip):')
      const prim = await ask(rl, '  Primitives collection: ')
      const brand = await ask(rl, '  Brand collection: ')
      const dim = await ask(rl, '  Dimension/responsive collection: ')
      if (prim) layers.primitives = prim
      if (brand) layers.brand = brand
      if (dim) layers.dimension = dim
    }

    // ---- Step 5: Confirm brand names ----
    let brands: string[] = []

    if (analysisResult && analysisResult.suggestedBrands.length > 0) {
      console.log(`\nDetected brands: ${analysisResult.suggestedBrands.join(', ')}`)
      const useBrands = await confirm(rl, 'Use these brand names?')
      if (useBrands) {
        brands = [...analysisResult.suggestedBrands]
      } else {
        const input = await ask(rl, 'Enter brand names (comma-separated): ')
        brands = input
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      }
    } else if (layers.brand) {
      const input = await ask(rl, 'Brand names (comma-separated, or blank to skip): ')
      brands = input
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }

    // ---- Step 6: Select output targets ----
    console.log('\nSelect output targets (comma-separated numbers):')
    OUTPUT_OPTIONS.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label}`)
    })

    const outputInput = await ask(rl, '\nTargets (e.g. 1,2): ')
    const selectedOutputs = outputInput
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n >= 1 && n <= OUTPUT_OPTIONS.length)
      .map((n) => OUTPUT_OPTIONS[n - 1].key)

    rl.close()

    // ---- Step 7: Write files ----
    const configContent = generateConfigContent({
      fileKey,
      layers,
      brands,
      outputs: selectedOutputs,
    })

    fs.writeFileSync(configPath, configContent, 'utf-8')
    console.log(green(`\nCreated ${path.basename(configPath)}`))

    // Write .env.example if not present
    const envExamplePath = path.resolve('.env.example')
    if (!fs.existsSync(envExamplePath)) {
      fs.writeFileSync(envExamplePath, ENV_EXAMPLE, 'utf-8')
      console.log(green('Created .env.example'))
    }

    // Write .env with the actual values if not present
    const envPath = path.resolve('.env')
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(
        envPath,
        `FIGMA_FILE_KEY=${fileKey}\nFIGMA_PERSONAL_ACCESS_TOKEN=${token}\n`,
        'utf-8',
      )
      console.log(green('Created .env (with your credentials — do not commit this file)'))
    }

    console.log('\nNext steps:')
    console.log('  1. Run "dtf pull" to export tokens from Figma')
    console.log('  2. Run "dtf build" to generate output files')
    console.log('')
  } catch (err) {
    rl.close()
    throw err
  }
}
