/** Pure helpers of `dta init`: reading a Figma file key and writing the starter files. */

/** The file key from a Figma URL (`/file/<key>` or `/design/<key>`) or a bare key. */
export function extractFileKey(input: string): string | null {
  if (/^[a-zA-Z0-9]{22,}$/.test(input)) return input
  const match = input.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

export interface ConfigData {
  fileKey: string
  source?: 'api' | 'file'
  collections: string[]
  brands: string[]
  stripEmojis: boolean
  outputs: string[]
}

/** The `dta.config.ts` the wizard writes. */
export function generateConfigContent(data: ConfigData): string {
  const quoted = (values: string[]) => values.map((value) => `'${value}'`).join(', ')
  const lines: string[] = [
    "import { defineConfig } from 'design-token-authority'",
    '',
    'export default defineConfig({',
    '  figma: {',
  ]
  if (data.source === 'file') {
    lines.push("    source: 'file',")
  } else {
    lines.push('    fileKey: process.env.FIGMA_FILE_KEY!,')
    lines.push('    personalAccessToken: process.env.FIGMA_PERSONAL_ACCESS_TOKEN!,')
  }
  lines.push('  },')

  if (data.collections.length > 0) lines.push('', `  collections: [${quoted(data.collections)}],`)
  if (data.brands.length > 0) lines.push('', `  brands: [${quoted(data.brands)}],`)

  lines.push('', '  tokens: {', "    dir: 'tokens',")
  if (data.stripEmojis) lines.push('    stripEmojis: true,')
  lines.push('  },')

  if (data.outputs.length > 0) {
    const has = (name: string) => data.outputs.includes(name)
    lines.push('', '  outputs: {')
    if (has('css'))
      lines.push('    css: {', "      outDir: 'build/css',", "      prefix: '--',", '    },')
    if (has('tailwind3') || has('tailwind4')) {
      lines.push(
        '    tailwind: {',
        "      outDir: 'build/tailwind',",
        `      version: ${has('tailwind4') ? 4 : 3},`,
        '    },',
      )
    }
    if (has('ios'))
      lines.push('    ios: {', "      outDir: 'build/ios',", "      lang: 'swift',", '    },')
    if (has('android-xml') || has('android-compose')) {
      lines.push(
        '    android: {',
        "      outDir: 'build/android',",
        `      lang: '${has('android-compose') ? 'compose' : 'xml'}',`,
        '    },',
      )
    }
    lines.push('  },')
  }

  lines.push('})', '')
  return lines.join('\n')
}

export const ENV_EXAMPLE = `# Figma file key — found in the Figma file URL:
# https://www.figma.com/file/<FIGMA_FILE_KEY>/...
FIGMA_FILE_KEY=

# Figma Personal Access Token — generate at figma.com > Settings > Personal access tokens
# Required scopes:
#   - Read-only Variables (for dta pull)
#   - Read and write Variables (for dta push)
FIGMA_PERSONAL_ACCESS_TOKEN=
`

export const OUTPUT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'css', label: 'CSS variables' },
  { value: 'tailwind3', label: 'Tailwind v3 theme' },
  { value: 'tailwind4', label: 'Tailwind v4 @theme CSS' },
  { value: 'ios', label: 'iOS Swift' },
  { value: 'android-xml', label: 'Android XML resources' },
  { value: 'android-compose', label: 'Android Jetpack Compose' },
]
