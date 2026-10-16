import { describe, expect, it } from 'vitest'
import { findViolations } from './package-boundaries.js'

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

  it('keeps the website inside its own folder', () => {
    expect(
      findViolations('site/src/a.ts', `import x from './b.js'\nimport y from '@dta/core'\n`),
    ).toEqual([])
    const [v] = findViolations(
      'site/src/a.ts',
      `import x from '../../packages/core/src/index.js'\n`,
    )
    expect(v.reason).toContain('leaves the package')
  })
})
