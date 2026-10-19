import { describe, expect, it } from 'vitest'
import { formatDiagnostic, hasErrors } from './index.js'

describe('diagnostics', () => {
  it('formats one line each and detects errors', () => {
    const warning = { severity: 'warning' as const, code: 'c', message: 'm' }
    const error = { severity: 'error' as const, code: 'e', message: 'bad', file: 'A.Value.json' }
    expect(formatDiagnostic(warning)).toBe('warning [c] m')
    expect(formatDiagnostic(error)).toBe('error [e] bad (A.Value.json)')
    expect(hasErrors([warning])).toBe(false)
    expect(hasErrors([warning, error])).toBe(true)
  })
})
