/**
 * TICKET-007: `dta pull` command.
 *
 * Exports variables from Figma to local JSON token files.
 * Supports two sources:
 *   - Figma REST API (default, requires Enterprise plan)
 *   - Local JSON file exported via a plugin like tokenHaus (--from-file)
 */

import * as fs from 'fs'
import * as path from 'path'
import * as p from '@clack/prompts'
import pc from 'picocolors'
import { Config } from '../config/index.js'
import { banner, filePath, count } from '../theme.js'
import FigmaApi from '../figma_api.js'
import { tokenFilesFromLocalVariables } from '../token_export.js'
import { detectFormat, convertTokenHausExport } from '../importers/index.js'
import { sanitizeFileName } from '../utils.js'

export interface PullOptions {
  output?: string
  fromFile?: string
  verbose?: boolean
}

export async function runPull(config: Config, options: PullOptions): Promise<void> {
  const outputDir = options.output ?? config.tokens?.dir ?? 'tokens'

  p.intro(banner('pull'))

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const stripEmojis = config.tokens?.stripEmojis ?? false

  if (options.fromFile) {
    await pullFromFile(options.fromFile, outputDir, stripEmojis, options)
  } else {
    await pullFromApi(config, outputDir, stripEmojis, options)
  }

  p.outro(`Tokens written to ${filePath(outputDir + '/')}`)
}

// ---------------------------------------------------------------------------
// Pull from Figma REST API
// ---------------------------------------------------------------------------

async function pullFromApi(
  config: Config,
  outputDir: string,
  stripEmojis: boolean,
  options: PullOptions,
): Promise<void> {
  if (!config.figma.fileKey || !config.figma.personalAccessToken) {
    p.log.error(
      'Figma API credentials are required for API-based pull.\n' +
        pc.dim(
          'Set figma.fileKey and figma.personalAccessToken in dta.config.ts,\n' +
            'or use --from-file to import from a plugin-exported JSON file.',
        ),
    )
    process.exit(2)
  }

  if (options.verbose) {
    p.log.message(`${pc.dim('File:')} ${config.figma.fileKey}\n${pc.dim('Output:')} ${outputDir}`)
  }

  const s = p.spinner()
  s.start('Fetching variables from Figma...')

  const api = new FigmaApi(config.figma.personalAccessToken)
  const localVariables = await api.getLocalVariables(config.figma.fileKey)
  const tokensFiles = tokenFilesFromLocalVariables(localVariables)

  const fileCount = Object.keys(tokensFiles).length
  s.stop(`Received ${count(fileCount, 'token file')} from Figma`)

  writeTokenFiles(tokensFiles, outputDir, stripEmojis)
}

// ---------------------------------------------------------------------------
// Pull from local file (plugin export)
// ---------------------------------------------------------------------------

async function pullFromFile(
  filePath: string,
  outputDir: string,
  stripEmojis: boolean,
  _options: PullOptions,
): Promise<void> {
  const resolved = path.resolve(filePath)

  if (!fs.existsSync(resolved)) {
    p.log.error(`File not found: ${resolved}`)
    process.exit(2)
  }

  const s = p.spinner()
  s.start(`Reading ${pc.dim(path.basename(resolved))}...`)

  let data: Record<string, unknown>
  try {
    const raw = fs.readFileSync(resolved, 'utf-8')
    data = JSON.parse(raw)
  } catch (err) {
    s.stop('Failed to read file')
    p.log.error(`Could not parse JSON: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(2)
  }

  const format = detectFormat(data)

  if (format === 'unknown') {
    s.stop('Unknown format')
    p.log.error(
      'Could not detect the token file format.\n' +
        pc.dim(
          'Supported formats:\n' +
            '  - tokenHaus plugin export (single file with $extensions.com.figma.modes)\n' +
            '  - DTCG per-mode files ($type/$value with scalar values)',
        ),
    )
    process.exit(2)
  }

  if (format === 'tokenhaus') {
    const tokensFiles = convertTokenHausExport(data)
    const fileCount = Object.keys(tokensFiles).length
    s.stop(`Converted tokenHaus export into ${count(fileCount, 'token file')}`)
    writeTokenFiles(tokensFiles, outputDir, stripEmojis)
  } else {
    // dtcg-per-mode: copy file as-is using the original filename
    s.stop('Detected DTCG per-mode format')
    const destName = path.basename(resolved)
    fs.copyFileSync(resolved, path.join(outputDir, destName))
    p.log.step(`Copied ${pc.dim(destName)}`)
  }
}

// ---------------------------------------------------------------------------
// Shared file writing
// ---------------------------------------------------------------------------

function writeTokenFiles(
  tokensFiles: Record<string, unknown>,
  outputDir: string,
  stripEmojis: boolean,
): void {
  Object.entries(tokensFiles).forEach(([fileName, fileContent]) => {
    // Sanitize collection and mode parts of the filename separately
    const base = fileName.replace(/\.json$/, '')
    const dotIdx = base.indexOf('.')
    let sanitized: string
    if (dotIdx !== -1) {
      const collection = sanitizeFileName(base.substring(0, dotIdx), stripEmojis)
      const mode = sanitizeFileName(base.substring(dotIdx + 1), stripEmojis)
      sanitized = `${collection}.${mode}.json`
    } else {
      sanitized = `${sanitizeFileName(base, stripEmojis)}.json`
    }
    fs.writeFileSync(`${outputDir}/${sanitized}`, JSON.stringify(fileContent, null, 2))
    p.log.step(`Wrote ${pc.dim(sanitized)}`)
  })
}
