import { parseTokenFiles } from '@dta/core'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { tokenFileJsonSchema, tokenFileSchema } from './index.js'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')

function fixtureFiles(fixture: string) {
  const dir = path.join(repoRoot, 'test', 'fixtures', fixture, 'tokens')
  return fs.readdirSync(dir).map((name) => ({
    name,
    content: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as unknown,
  }))
}

describe('tokenFileSchema', () => {
  for (const fixture of ['brand-ab', 'daisyui']) {
    it(`accepts every ${fixture} fixture file`, () => {
      for (const { name, content } of fixtureFiles(fixture)) {
        const result = tokenFileSchema.safeParse(content)
        expect(result.success, `${name}: ${JSON.stringify(result.error?.issues)}`).toBe(true)
      }
    })
  }

  it('accepts nested groups, descriptions and Figma extensions', () => {
    const file = {
      Colors: {
        $description: 'All colors',
        Brand: {
          Primary: {
            $type: 'color',
            $value: '{Colors.Blue}',
            $description: 'Main color',
            $extensions: {
              'com.figma': { scopes: ['ALL_SCOPES'], codeSyntax: { WEB: 'var(--p)' } },
            },
          },
        },
      },
    }
    expect(tokenFileSchema.safeParse(file).success).toBe(true)
  })

  it('rejects a token with an unknown $type', () => {
    expect(tokenFileSchema.safeParse({ A: { $type: 'shape', $value: 'round' } }).success).toBe(
      false,
    )
  })

  it('reads an object with $type but no $value as a group whose tokens inherit the type', () => {
    const file = { A: { $type: 'color', primary: { $value: '#fff' } } }
    expect(tokenFileSchema.safeParse(file).success).toBe(true)
  })

  it('accepts DTCG 2025.10 values; the token model checks them against the type', () => {
    const file = {
      A: { $type: 'color', $value: { colorSpace: 'srgb', components: [1, 1, 1] } },
      B: { $type: 'dimension', $value: { value: 4, unit: 'px' }, $deprecated: 'Use C.' },
    }
    expect(tokenFileSchema.safeParse(file).success).toBe(true)
  })

  it('leaves mode-keyed values (multi-mode exports) to the adapters: the model rejects them', () => {
    const content = JSON.stringify({
      A: { $type: 'color', $value: { Light: '#fff', Dark: '#000' } },
    })
    const { diagnostics } = parseTokenFiles([{ fileName: 'X.Mode.json', content }])
    expect(diagnostics.map((d) => d.code)).toEqual(['invalid-value'])
  })

  it('rejects scalars where a group or token is expected', () => {
    expect(tokenFileSchema.safeParse({ A: 'red' }).success).toBe(false)
  })
})

describe('the committed JSON Schema', () => {
  const committed = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'docs', 'token-files', 'token-file.schema.json'), 'utf-8'),
  ) as unknown

  it('is up to date with the Zod schema (run `pnpm run schema:generate`)', () => {
    expect(committed).toEqual(JSON.parse(JSON.stringify(tokenFileJsonSchema())))
  })
})
