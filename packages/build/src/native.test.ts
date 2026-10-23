/** The native outputs (TICKET-011–013, spec native-outputs), through `buildOutputs`. */
import { parseTokenFiles, type TokenModel } from '@dta/core'
import { describe, expect, it } from 'vitest'
import { buildOutputs, DEFAULT_FORMATS, type BuildOptions } from './index.js'
import { fixtureModel, fixtureOptions } from './test-helpers.js'

const NATIVE = ['ios-swift', 'android-xml', 'android-compose'] as const

const modelFrom = (files: Record<string, unknown>): TokenModel =>
  parseTokenFiles(
    Object.entries(files).map(([fileName, tree]) => ({
      fileName,
      content: JSON.stringify(tree),
    })),
  ).model

async function native(model: TokenModel, options: BuildOptions = {}) {
  const { files, diagnostics } = await buildOutputs(model, { formats: [...NATIVE], ...options })
  const file = (path: string) => files.find((f) => f.path === path)?.content ?? ''
  return { files, diagnostics, file, paths: files.map((f) => f.path) }
}

describe('native outputs', () => {
  it('are not built by default: the web outputs are', async () => {
    expect(DEFAULT_FORMATS).toEqual(['css', 'tailwind-v4', 'tailwind-v3', 'js'])
    const { files } = await buildOutputs(fixtureModel('brand-ab'), fixtureOptions('brand-ab'))
    expect(
      files.some((f) => f.path.startsWith('output/ios') || f.path.startsWith('output/android')),
    ).toBe(false)
  })

  it('splits shared and brand tokens, at the default breakpoint, into the planned files', async () => {
    const { paths, file, diagnostics } = await native(
      fixtureModel('brand-ab'),
      fixtureOptions('brand-ab'),
    )
    expect(paths).toEqual([
      'output/android/branda/values/colors.xml',
      'output/android/branda/values/dimens.xml',
      'output/android/brandb/values/colors.xml',
      'output/android/brandb/values/dimens.xml',
      'output/android/compose/DesignTokens.kt',
      'output/android/main/values/colors.xml',
      'output/android/main/values/dimens.xml',
      'output/ios/BrandTokens+BrandA.swift',
      'output/ios/BrandTokens+BrandB.swift',
      'output/ios/DesignTokens.swift',
    ])
    // Brand tokens (read through Brand(Alias)) in the brand files, the rest in DesignTokens; by
    // structure, not by value: Colors.Text.Default is the same in both brands and still a member.
    expect(file('output/ios/BrandTokens+BrandA.swift')).toContain(
      'public let colorsBrandPrimary: SwiftUI.Color = SwiftUI.Color(.sRGB, red: 0, green: 0.3412, blue: 0.7216, opacity: 1)',
    )
    const shared = file('output/ios/DesignTokens.swift')
    expect(shared).toContain('var colorsBrandPrimary: SwiftUI.Color { get }')
    expect(shared).toContain('var colorsTextDefault: SwiftUI.Color { get }')
    expect(shared).not.toContain('static let brandPrimary:')
    expect(shared).toContain('public static let foundationBlue500: SwiftUI.Color')
    // Opacity is a fraction, as in the CSS.
    expect(file('output/ios/BrandTokens+BrandA.swift')).toContain(
      'public let effectsOverlayOpacity: Swift.Double = 0.5',
    )
    expect(file('output/android/branda/values/colors.xml')).toContain(
      '<color name="colors_brand_primary">#FF0057B8</color>',
    )
    expect(file('output/android/brandb/values/colors.xml')).toContain(
      '<color name="colors_brand_primary">#FF3D5A80</color>',
    )
    expect(file('output/android/compose/DesignTokens.kt')).toContain(
      'override val ColorsBrandPrimary: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(0xFF3D5A80)',
    )
    // Spacing.Gap is 8 on phones (the default breakpoint), 16 on desktops.
    expect(file('output/android/main/values/dimens.xml')).toContain(
      '<dimen name="spacing_gap">8dp</dimen>',
    )
    expect(diagnostics.map((d) => d.code)).toContain('native-breakpoints')
    expect(diagnostics.find((d) => d.code === 'native-breakpoints')?.message).toBe(
      'The native outputs use the default breakpoint "Mobile" of "ScreenType"; "Desktop", "Tablet" are not in them (native apps have no media queries).',
    )
  })

  it('writes every value type as each platform has it', async () => {
    const { file } = await native(
      modelFrom({
        'Base.Value.json': {
          color: {
            solid: { $type: 'color', $value: '#ff8000' },
            glass: { $type: 'color', $value: '#ff800080' },
          },
          space: { md: { $type: 'dimension', $value: { value: 1, unit: 'rem' } } },
          text: { size: { $type: 'dimension', $value: { value: 14, unit: 'px' } } },
          weight: { bold: { $type: 'fontWeight', $value: 'bold' } },
          opacity: { half: { $type: 'number', $value: 0.5 } },
          font: { body: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] } },
          flag: { on: { $type: 'boolean', $value: true } },
          motion: { fast: { $type: 'duration', $value: { value: 0.2, unit: 's' } } },
          label: { quote: { $type: 'string', $value: 'Say "hi" for $5\\now' } },
        },
      }),
    )
    const swift = file('output/ios/DesignTokens.swift')
    expect(swift).toContain(
      'public static let glass: SwiftUI.Color = SwiftUI.Color(.sRGB, red: 1, green: 0.502, blue: 0, opacity: 0.502)',
    )
    expect(swift).toContain('public static let md: CoreGraphics.CGFloat = 16')
    expect(swift).toContain('public static let size: CoreGraphics.CGFloat = 14')
    expect(swift).toContain('public static let bold: Swift.Double = 700')
    expect(swift).toContain('public static let half: Swift.Double = 0.5')
    expect(swift).toContain('public static let body: Swift.String = "Inter, sans-serif"')
    expect(swift).toContain('public static let on: Swift.Bool = true')
    expect(swift).toContain('public static let fast: Foundation.TimeInterval = 0.2')
    expect(swift).toContain('public static let quote: Swift.String = "Say \\"hi\\" for $5\\\\now"')

    const kotlin = file('output/android/compose/DesignTokens.kt')
    expect(kotlin).toContain(
      'val Glass: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(0x80FF8000)',
    )
    expect(kotlin).toContain('val Md: androidx.compose.ui.unit.Dp = 16.dp')
    expect(kotlin).toContain('val Size: androidx.compose.ui.unit.TextUnit = 14.sp')
    expect(kotlin).toContain('val Bold: kotlin.Int = 700')
    expect(kotlin).toContain('val Half: kotlin.Double = 0.5')
    expect(kotlin).toContain('val Fast: kotlin.Long = 200L')
    expect(kotlin).toContain('val Quote: kotlin.String = "Say \\"hi\\" for \\$5\\\\now"')

    const colors = file('output/android/main/values/colors.xml')
    expect(colors).toContain('<color name="color_glass">#80FF8000</color>')
    expect(file('output/android/main/values/dimens.xml')).toContain(
      '<dimen name="text_size">14sp</dimen>',
    )
    // XML has colours and dimensions only.
    expect(colors + file('output/android/main/values/dimens.xml')).not.toContain('flag_on')
  })

  it('makes valid names: digits, spaces, keywords, a token without a group', async () => {
    const { file } = await native(
      modelFrom({
        'Base.Value.json': {
          Blue: { 700: { $type: 'color', $value: '#003f8a' } },
          Primary: { 'Light Dark': { $type: 'color', $value: '#ffffff' } },
          default: { case: { $type: 'number', $value: 2 } },
          radius: { $type: 'number', $value: 4 },
        },
      }),
    )
    const swift = file('output/ios/DesignTokens.swift')
    expect(swift).toContain(
      'public enum Blue {\n        /// Blue.700\n        public static let _700: SwiftUI.Color',
    )
    expect(swift).toContain('public static let lightDark: SwiftUI.Color')
    expect(swift).toContain('public enum Default {')
    expect(swift).toContain('public static let `case`: Swift.Double = 2')
    expect(swift).toContain('    public static let radius: CoreGraphics.CGFloat = 4')
    const kotlin = file('output/android/compose/DesignTokens.kt')
    expect(kotlin).toContain('val _700: androidx.compose.ui.graphics.Color')
    expect(kotlin).toContain('val Case: kotlin.Int = 2') // Upper camel: no keyword clash
    expect(kotlin).not.toContain('`')
    expect(file('output/android/main/values/colors.xml')).toContain('name="blue_700"')
  })

  it('reports two tokens with one name and leaves the second out (a warning: the CSS is still written)', async () => {
    const { file, diagnostics } = await native(
      modelFrom({
        'Base.Value.json': {
          Brand: {
            'primary-dark': { $type: 'color', $value: '#000000' },
            'primary dark': { $type: 'color', $value: '#ffffff' },
          },
        },
      }),
      { formats: ['ios-swift', 'css'] },
    )
    const collision = diagnostics.find((d) => d.code === 'native-name-collision')
    expect(collision).toMatchObject({ severity: 'warning' })
    expect(collision?.message).toBe(
      'ios-swift: "Brand.primary-dark" and "Brand.primary dark" both become "primaryDark"; "Brand.primary dark" is left out. Rename one of them.',
    )
    expect(file('output/ios/DesignTokens.swift').match(/primaryDark/g)).toHaveLength(1)
  })

  it('counts what it does not write, moves the folders and checks the Kotlin package', async () => {
    const model = modelFrom({
      'Base.Value.json': {
        shadow: {
          card: {
            $type: 'shadow',
            $value: {
              color: '#00000033',
              offsetX: { value: 0, unit: 'px' },
              offsetY: { value: 1, unit: 'px' },
              blur: { value: 2, unit: 'px' },
              spread: { value: 0, unit: 'px' },
            },
          },
        },
        space: { sm: { $type: 'number', $value: 4 } },
      },
    })
    const { paths, diagnostics } = await native(model, {
      ios: { outDir: 'app/ios/Tokens' },
      android: { outDir: 'app/android/tokens', package: 'com.example.tokens' },
    })
    expect(paths).toContain('app/ios/Tokens/DesignTokens.swift')
    expect(paths).toContain('app/android/tokens/compose/DesignTokens.kt')
    expect(
      diagnostics.filter((d) => d.code === 'native-unsupported-type').map((d) => d.message),
    ).toEqual([
      'ios-swift: 1 shadow token is not written (composite types are not in the native outputs yet).',
      'android-xml: 1 shadow token is not written (composite types are not in the native outputs yet).',
      'android-compose: 1 shadow token is not written (composite types are not in the native outputs yet).',
    ])
    const invalid = await native(model, { android: { package: 'com.example-app' } })
    expect(invalid.diagnostics.find((d) => d.code === 'invalid-option')?.severity).toBe('error')
    expect(invalid.paths.some((path) => path.endsWith('.kt'))).toBe(false)
  })

  it('reads other modes in their default mode, and says so', async () => {
    const { file, diagnostics } = await native(
      modelFrom({
        'Theme.Dark.json': { surface: { $type: 'color', $value: '#000000' } },
        'Theme.Light.json': { surface: { $type: 'color', $value: '#ffffff' } },
      }),
    )
    expect(file('output/android/main/values/colors.xml')).toContain('#FF000000')
    expect(diagnostics.find((d) => d.code === 'native-modes')?.message).toBe(
      'The native outputs read "Theme" in its default mode "Dark"; "Light" is not in them.',
    )
  })

  describe('review findings', () => {
    it('keeps the platform types reachable when a group is named Color or String', async () => {
      const { file } = await native(
        modelFrom({
          'Base.Value.json': {
            Color: { primary: { $type: 'color', $value: '#0057b8' } },
            String: { label: { $type: 'string', $value: 'Hi' } },
          },
        }),
      )
      expect(file('output/ios/DesignTokens.swift')).toContain(
        '    public enum Color {\n        /// Color.primary\n        public static let primary: SwiftUI.Color = SwiftUI.Color(',
      )
      expect(file('output/android/compose/DesignTokens.kt')).toContain(
        'val Primary: androidx.compose.ui.graphics.Color = androidx.compose.ui.graphics.Color(0xFF0057B8)',
      )
    })

    it('gives a brand member one Kotlin type in every brand, and writes Doubles with a point', async () => {
      const size = (value: number) => ({ $type: 'number', $value: value })
      const { file } = await native(
        modelFrom({
          'Brand.BrandA.json': { ratio: size(4), level: size(2.00001) },
          'Brand.BrandB.json': { ratio: size(4.5), level: size(3) },
        }),
        { brands: ['BrandA', 'BrandB'] },
      )
      const kotlin = file('output/android/compose/DesignTokens.kt')
      expect(kotlin).toContain('    val Ratio: kotlin.Double\n')
      expect(kotlin).toContain('override val Ratio: kotlin.Double = 4.0')
      expect(kotlin).toContain('override val Ratio: kotlin.Double = 4.5')
      // 2.00001 rounds to 2 at four decimals: still a Double literal.
      expect(kotlin).toContain('override val Level: kotlin.Double = 2.0')
      expect(kotlin).not.toMatch(/\de[+-]?\d/)
    })

    it('says what it leaves out: values without a native form, tokens missing in a brand', async () => {
      const { diagnostics } = await native(
        modelFrom({
          'Base.Value.json': { width: { $type: 'string', $value: 'x' } },
          'Brand.BrandA.json': {
            gap: { $type: 'number', $value: '50%' },
            only: { $type: 'number', $value: 1 },
          },
          'Brand.BrandB.json': { gap: { $type: 'number', $value: '50%' } },
        }),
        { brands: ['BrandA', 'BrandB'] },
      )
      const messages = diagnostics.map((d) => d.message)
      expect(messages).toContain(
        '1 token with a value the native outputs cannot write (such as 50% or 1em) is left out: "gap".',
      )
      expect(messages).toContain(
        '1 token that do not resolve in every brand is left out of the native outputs: "only".',
      )
    })

    it('writes valid XML comments, flavour folders and non-ASCII names', async () => {
      const { file, paths } = await native(
        modelFrom({
          'Brand.Brand A.json': { 'Grün---': { $type: 'color', $value: '#00ff00' } },
          'Brand.Brand B.json': { 'Grün---': { $type: 'color', $value: '#008800' } },
        }),
        { brands: ['Brand A', 'Brand B'] },
      )
      expect(paths).toContain('output/android/brand_a/values/colors.xml')
      const xml = file('output/android/brand_a/values/colors.xml')
      // No '--' inside, no '-' at the end.
      expect(xml).toContain('<!-- Grün- - -  -->')
      expect(xml).toContain('<color name="grun">')
      expect(file('output/android/compose/DesignTokens.kt')).toContain('val Grün: ')
      expect(file('output/ios/DesignTokens.swift')).toContain('var grün: SwiftUI.Color { get }')
    })

    it('counts a colour outside sRGB once, whatever the number of brands', async () => {
      const p3 = { $type: 'color', $value: { colorSpace: 'display-p3', components: [1, 0, 0] } }
      const { diagnostics } = await native(
        modelFrom({ 'Brand.BrandA.json': { red: p3 }, 'Brand.BrandB.json': { red: p3 } }),
        { brands: ['BrandA', 'BrandB'] },
      )
      expect(diagnostics.find((d) => d.code === 'native-color-clipped')?.message).toBe(
        '1 colour token is outside sRGB; the native outputs write it clipped to sRGB.',
      )
    })

    it('leaves out a Kotlin token that has the name of a group object', async () => {
      const { file, diagnostics } = await native(
        modelFrom({
          'Base.Value.json': {
            colors: { $type: 'color', $value: '#ffffff' },
            Colors: { primary: { $type: 'color', $value: '#000000' } },
          },
        }),
        { formats: ['android-compose'] },
      )
      expect(file('output/android/compose/DesignTokens.kt')).not.toMatch(/val Colors:/)
      expect(diagnostics.find((d) => d.code === 'native-name-collision')?.message).toContain(
        'the token "colors" and the group "Colors" both become "DesignTokens.Colors"',
      )
    })
  })
})
