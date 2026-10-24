/**
 * `dta brief` (TICKET-031): one prompt-ready brief per brand for AI design generators, as
 * Markdown (to paste) or JSON (to pipe into a tool's API). `--copy` puts it on the clipboard.
 */
import { spawnSync } from 'node:child_process'
import { formatDiagnostic, hasErrors, parseTokenFiles } from '@dta/core'
import type { CommandContext } from '../commands.js'
import { BRIEF_SCHEMA, briefMarkdown, buildBrief } from '../brief/render.js'
import { readTokenDir, TokenDirError, tokenParseOptions } from '../io/token-dir.js'

const FORMATS = ['markdown', 'json'] as const

/** The clipboard commands to try, by platform. */
const CLIPBOARD: Record<string, string[][]> = {
  darwin: [['pbcopy']],
  win32: [['clip']],
  linux: [['wl-copy'], ['xclip', '-selection', 'clipboard'], ['xsel', '--clipboard', '--input']],
}

/** Puts text on the clipboard; false when no clipboard command works here. */
export function copyToClipboard(text: string, platform = process.platform): boolean {
  for (const [command, ...args] of CLIPBOARD[platform] ?? []) {
    // A clipboard tool that hangs (xclip without a display) must not hang the CLI.
    const result = spawnSync(command, args, {
      input: text,
      stdio: ['pipe', 'ignore', 'ignore'],
      timeout: 5000,
    })
    if (result.status === 0) return true
  }
  return false
}

export async function runBrief(context: CommandContext): Promise<number> {
  const config = context.config
  const format = String(context.options.format ?? 'markdown')
  if (!(FORMATS as readonly string[]).includes(format)) {
    context.stderr(`Unknown format "${format}". Use one of: ${FORMATS.join(', ')}.\n`)
    return 2
  }
  let files
  try {
    files = readTokenDir(config?.tokens.dir ?? 'tokens', context.cwd)
  } catch (error) {
    if (!(error instanceof TokenDirError)) throw error
    context.stderr(`${error.message}\n`)
    return 1
  }
  const { model, diagnostics } = parseTokenFiles(files, tokenParseOptions(config))
  if (hasErrors(diagnostics)) {
    for (const diagnostic of diagnostics) context.stderr(`${formatDiagnostic(diagnostic)}\n`)
    return 1
  }

  const brands = config?.brands ?? []
  const requested = context.options.brand as string | undefined
  if (requested !== undefined && !brands.includes(requested)) {
    context.stderr(
      `Unknown brand "${requested}". ${brands.length > 0 ? `Brands: ${brands.join(', ')}.` : 'The config has no brands.'}\n`,
    )
    return 2
  }
  const chosen = requested !== undefined ? [requested] : brands.length > 0 ? brands : [null]
  const briefs = chosen.map((brand) => buildBrief(model, config, brand))

  const text =
    format === 'json'
      ? `${JSON.stringify({ schema: BRIEF_SCHEMA, briefs }, null, 2)}\n`
      : briefs.map(briefMarkdown).join('\n---\n\n')
  context.stdout(text)
  if (context.options.copy) {
    if (copyToClipboard(text)) context.stderr('Copied to the clipboard.\n')
    else {
      context.stderr(
        'Could not copy: no clipboard command here (pbcopy, clip, wl-copy, xclip or xsel). The brief is printed above.\n',
      )
      return 1
    }
  }
  return 0
}
