import { describe, expect, it } from 'vitest'
import { checkLegacyFrozen } from './legacy-frozen.js'
import { findViolations } from './package-boundaries.js'

describe('legacy is frozen', () => {
  it('passes when only packages and docs change', () => {
    const result = checkLegacyFrozen(['packages/core/src/index.ts', 'docs/x.md'], [])
    expect(result.ok).toBe(true)
  })

  it('fails when legacy source or its tests change, and names the files', () => {
    const result = checkLegacyFrozen(['src/color.ts', 'src/color.test.ts', 'README.md'], [])
    expect(result.ok).toBe(false)
    expect(result.changed).toEqual(['src/color.ts', 'src/color.test.ts'])
    expect(result.message).toContain('src/color.ts')
    expect(result.message).toContain('legacy-exception')
  })

  it('passes with the exception label', () => {
    expect(checkLegacyFrozen(['src/color.ts'], ['legacy-exception']).ok).toBe(true)
  })

  it('ignores other labels and look-alike paths', () => {
    expect(checkLegacyFrozen(['src/color.ts'], ['bug']).ok).toBe(false)
    expect(checkLegacyFrozen(['packages/cli/src/run.ts', 'scripts/src/a.ts'], []).ok).toBe(true)
  })
})

describe('package boundaries', () => {
  const file = 'packages/cli/src/run.ts'

  it('allows the public API and imports inside the same package', () => {
    const source = `import { parseAlias } from '@dta/core'\nimport { a } from './commands.js'\nimport { b } from '../test/helper.js'\n`
    expect(findViolations(file, source)).toEqual([])
  })

  it('flags deep imports of another workspace package', () => {
    const [v] = findViolations(file, `import { x } from '@dta/core/src/alias.js'\n`)
    expect(v).toMatchObject({ file, line: 1, specifier: '@dta/core/src/alias.js' })
  })

  it('flags relative imports into another package', () => {
    const violations = findViolations(
      file,
      `import a from '../../core/src/index.js'\nexport * from '../../testkit/src/x.js'\nconst b = await import('../../core/src/y.js')\n`,
    )
    expect(violations.map((v) => v.line)).toEqual([1, 2, 3])
  })

  it('flags require() and side-effect imports', () => {
    expect(findViolations(file, `const a = require('@dta/core/x')\n`)).toHaveLength(1)
    expect(findViolations(file, `import '@dta/core/x'\n`)).toHaveLength(1)
  })

  it('ignores mentions in comments', () => {
    const source = `// import x from '@dta/core/src/a'\n/* import y from '@dta/core/src/b' */\n`
    expect(findViolations(file, source)).toEqual([])
  })

  it('treats files outside packages/ as consumers of public APIs only', () => {
    expect(findViolations('scripts/a.ts', `import x from '@dta/testkit'\n`)).toEqual([])
    expect(
      findViolations('scripts/a.ts', `import x from '@dta/testkit/src/capture.js'\n`),
    ).toHaveLength(1)
  })
})
