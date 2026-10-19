import { describe, expect, it } from 'vitest'
import { DOC_PATHS, formatDiagnostic, hasErrors } from './index.js'

describe('diagnostics', () => {
  it('formats one line each and detects errors', () => {
    const warning = { severity: 'warning' as const, code: 'c', message: 'm' }
    const error = { severity: 'error' as const, code: 'e', message: 'bad', file: 'A.Value.json' }
    expect(formatDiagnostic(warning)).toBe('warning [c] m')
    expect(formatDiagnostic(error)).toBe('error [e] bad (A.Value.json)')
    expect(hasErrors([warning])).toBe(false)
    expect(hasErrors([warning, error])).toBe(true)
  })

  it('adds the pointer to the docs, or leaves it to the caller', () => {
    const pointed = {
      severity: 'error' as const,
      code: 'unknown-format',
      message: 'Could not recognise the export format.',
      docs: 'token-files' as const,
    }
    expect(formatDiagnostic(pointed)).toBe(
      'error [unknown-format] Could not recognise the export format. See docs/token-files/input-format.md.',
    )
    expect(formatDiagnostic({ ...pointed, file: 'x.json' })).toBe(
      'error [unknown-format] Could not recognise the export format. See docs/token-files/input-format.md. (x.json)',
    )
    expect(formatDiagnostic(pointed, { docs: false })).toBe(
      'error [unknown-format] Could not recognise the export format.',
    )
    expect(DOC_PATHS['token-files']).toBe('docs/token-files/input-format.md')
  })
})
