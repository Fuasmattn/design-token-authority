import { describe, expect, it } from 'vitest'
import { detect, languageOf } from './detect.js'

const values = (text: string, language: Parameters<typeof detect>[1]) =>
  detect(text, language).map(
    ({ line, value, kind, context }) => `${line} ${kind} ${value} (${context})`,
  )

describe('languageOf', () => {
  it('knows the audited extensions', () => {
    expect(languageOf('a/b.tsx')).toBe('js')
    expect(languageOf('x.SCSS')).toBe('scss')
    expect(languageOf('page.astro')).toBe('astro')
    expect(languageOf('README.md')).toBeNull()
  })
})

describe('CSS and SCSS', () => {
  it('finds colours anywhere and lengths in spacing, size, radius, stroke and font-size properties', () => {
    const css = [
      '.a {',
      '  color: #2F55D4;',
      '  padding: 16px 1rem;',
      '  border: 1px solid rgb(0 0 0);',
      '  border-radius: 8px;',
      '  width: 320px;',
      '  font-size: 14px;',
      "  font-family: 'Inter', sans-serif;",
      '}',
    ].join('\n')
    expect(values(css, 'css')).toEqual([
      '2 color #2F55D4 (color)',
      '3 spacing 16px (padding)',
      '3 spacing 1rem (padding)',
      '4 stroke 1px (border)',
      '4 color rgb(0 0 0) (border)',
      '5 radius 8px (border-radius)',
      '6 size 320px (width)',
      '7 font-size 14px (font-size)',
      '8 font-family Inter (font-family)',
    ])
  })

  it('skips comments, 0, percentages, var() fallbacks, unit casts and @font-face', () => {
    const css = [
      '/* color: #fff; padding: 16px */',
      '.a { margin: 0; padding: 50%; color: var(--x, #fff); gap: calc(var(--s) * 1px); }',
      "@font-face { font-family: 'Inter'; src: url(x.woff2); }",
    ].join('\n')
    expect(values(css, 'css')).toEqual([])
  })

  it('skips SCSS line comments but not URLs', () => {
    const scss = '// color: #fff\n.a { background: url(http://x/y.png); color: #000; }'
    expect(values(scss, 'scss')).toEqual(['2 color #000 (color)'])
  })

  it('finds sizes in width, height and their min, max, logical and flex-basis forms (TICKET-147)', () => {
    const css = [
      '.a {',
      '  height: 44px; min-width: 20px; max-height: 2rem;',
      '  inline-size: 12px; min-block-size: 14px; flex-basis: 16px;',
      '  line-height: 18px; border-width: 1px; outline-width: 3px;',
      '}',
    ].join('\n')
    expect(values(css, 'css')).toEqual([
      '2 size 44px (height)',
      '2 size 20px (min-width)',
      '2 size 2rem (max-height)',
      '3 size 12px (inline-size)',
      '3 size 14px (min-block-size)',
      '3 size 16px (flex-basis)',
      '4 stroke 1px (border-width)',
      '4 stroke 3px (outline-width)',
    ])
  })

  it('skips the conditions of @media, @container and @supports (TICKET-147)', () => {
    const css = [
      '@media (max-width: 760px) and (min-height: 400px) {',
      '  .a { width: 20px; }',
      '}',
      '@container card (min-width: 30rem) { .b { height: 8px; } }',
      '@supports (width: 1px) { .c { gap: 4px; } }',
    ].join('\n')
    expect(values(css, 'css')).toEqual([
      '2 size 20px (width)',
      '4 size 8px (height)',
      '5 spacing 4px (gap)',
    ])
  })

  it('honours dta-audit-ignore on the line and before it', () => {
    const css =
      '.a {\n  color: #fff; /* dta-audit-ignore */\n  /* dta-audit-ignore */\n  color: #000;\n  color: #111;\n}'
    expect(values(css, 'css')).toEqual(['5 color #111 (color)'])
  })
})

describe('JS and TS', () => {
  it('finds values in style objects, colour strings, CSS in template literals and Tailwind classes', () => {
    const tsx = [
      "const primary = '#2f55d4'",
      "const style = { padding: '16px', borderRadius: '4px', width: '10px' }",
      'const Box = styled.div`',
      '  margin: 8px;',
      '`',
      'export const B = () => <button className="bg-[#fff] p-[12px] md:rounded-[6px] w-[30px]" />',
      "// const old = '#000'",
    ].join('\n')
    expect(values(tsx, 'js')).toEqual([
      '1 color #2f55d4 (string)',
      '2 spacing 16px (padding)',
      '2 radius 4px (borderRadius)',
      '2 size 10px (width)',
      '4 spacing 8px (margin)',
      '6 color #fff (bg-[…])',
      '6 spacing 12px (p-[…])',
      '6 radius 6px (rounded-[…])',
      '6 size 30px (w-[…])',
    ])
  })
})

describe('sizes in JS objects and Tailwind (TICKET-147)', () => {
  it('finds size keys in style objects and the size utilities', () => {
    const tsx = [
      "const style = { minHeight: '44px', maxWidth: '640px', flexBasis: '2rem', lineHeight: '20px' }",
      'const C = () => <i className="h-[20px] size-[44px] min-w-[8px] max-h-[9px] basis-[10px] -mt-[4px]" />',
    ].join('\n')
    expect(values(tsx, 'js')).toEqual([
      '1 size 44px (minHeight)',
      '1 size 640px (maxWidth)',
      '1 size 2rem (flexBasis)',
      '2 size 20px (h-[…])',
      '2 size 44px (size-[…])',
      '2 size 8px (min-w-[…])',
      '2 size 9px (max-h-[…])',
      '2 size 10px (basis-[…])',
      '2 spacing 4px (-mt-[…])',
    ])
  })
})

describe('Astro, Vue, Svelte and HTML', () => {
  it('reads style blocks, style attributes and Tailwind classes, not comments', () => {
    const astro = [
      '---',
      "const x = 'not scanned'",
      '---',
      '<!-- <div style="color: #000"></div> -->',
      '<div class="text-[#111]" style="gap: 8px"></div>',
      '<style lang="scss">',
      '  // color: #222',
      '  .a { color: #333; }',
      '</style>',
    ].join('\n')
    expect(values(astro, 'astro')).toEqual([
      '5 color #111 (text-[…])',
      '5 spacing 8px (gap)',
      '8 color #333 (color)',
    ])
  })
})
