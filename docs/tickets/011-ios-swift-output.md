# TICKET-011: Add iOS Swift output formatter

**Phase:** 3 — Output Targets
**Priority:** Medium
**Effort:** M
**Status:** done (2026-10-26)

## Summary

Add a Style Dictionary platform configuration that generates typed Swift code for iOS, covering colors, spacing, typography, and other token types. Enables direct use of design tokens in iOS apps without manual mapping.

## Background

Style Dictionary has a built-in `ios-swift` transform group that generates Swift structs/enums. However, the built-in output needs customization for multi-brand support and to match the conventions of modern iOS development (SwiftUI `Color`, `Font`, `CGFloat`).

## Acceptance Criteria

- [x] Output directory: `build/ios/`
- [x] Generated files:
  - `DesignTokens.swift` — all primitive values as typed Swift constants
  - `BrandTokens+{BrandName}.swift` — one file per brand with semantic overrides
- [x] Color tokens output as `SwiftUI.Color` (with RGB float values, not hex strings)
- [x] Dimension tokens output as `CGFloat` with values in points
- [x] Typography tokens output as `Font` or at minimum `CGFloat` for sizes
- [x] Namespace: `DesignTokens.Colors.brandPrimary`, `DesignTokens.Spacing.spacing4`, etc.
- [ ] Generated files compilable with Xcode — include a minimal test target in CI (optional)
- [x] Enabled via `outputs.ios` in project config (TICKET-008)

## Implementation Notes

Style Dictionary v4 built-in transform group `ios-swift` provides a starting point. The main customizations needed:

**Color transform** — SD outputs hex by default; iOS needs `Color(red:green:blue:opacity:)`:

```ts
sd.registerTransform({
  name: 'color/swift-color',
  type: 'value',
  filter: (token) => token.$type === 'color',
  transform: (token) => {
    const { r, g, b, a } = parseColor(token.$value)
    return `Color(red: ${r}, green: ${g}, blue: ${b}, opacity: ${a ?? 1})`
  },
})
```

**Output structure:**

```swift
// DesignTokens.swift — auto-generated, do not edit
import SwiftUI

public enum DesignTokens {
  public enum Colors {
    public static let brandPrimary = Color(red: 0.0, green: 0.4, blue: 0.8, opacity: 1)
    // ...
  }
  public enum Spacing {
    public static let spacing4: CGFloat = 16
    // ...
  }
}
```

**Multi-brand:** Generate a protocol `BrandTheme` and one conforming struct per brand, or use separate asset catalogs — document the chosen approach.

## Dependencies

- TICKET-002 (SD v4)
- TICKET-008 (config — `outputs.ios` enables this)

## Outcome (2026-10-23)

Built to the [native outputs spec](../specs/native-outputs.md) (written for 011–013 together; its decisions are open to review). Against the criteria, which were written for v1:

- Folder `output/ios` (`outputs.ios.outDir`; the v1 `build/ios` is what `dta init` writes into the config, as for the other outputs). Files `DesignTokens.swift` (shared tokens in `enum DesignTokens`, one nested `enum` per group, and `protocol BrandTheme`) and `BrandTokens+<Brand>.swift` (`struct <Brand>: BrandTheme`).
- Colours as `Color(.sRGB, red:green:blue:opacity:)` (floats, four decimals: exact to the byte); lengths and font sizes as `CGFloat` points; other numbers `Double`, strings, `Bool`, `TimeInterval`. Typography composites are not written yet (counted in a warning), so font sizes are `CGFloat`, as the criteria allowed.
- Names `DesignTokens.Colors.brandPrimary`, `DesignTokens.Dimensions.spacing4`.
- Enabled by `ios-swift` in `outputs.formats` (not by `outputs.ios`; `outputs.ios.lang` is rejected now). Not in the default formats.
- No Xcode compile check (optional in the criteria; no Swift toolchain in CI). The formatter is tested for identifiers, keywords and escaping; the snapshot `brand-ab/build-native` pins the files.

Code: `packages/build/src/native/` (`tokens.ts` resolves, `names.ts`, `swift.ts`). Tests: `packages/build/src/native.test.ts`. Docs: Reference → Outputs → Native outputs.
- After an independent review (2026-10-23): types written in full (`SwiftUI.Color`, `androidx.compose.ui.graphics.Color`, `Swift.String`, `kotlin.Int`) so a group named `Color` or `String` compiles; brand tokens decided by structure (the chain goes through a brand collection), not by value; one Kotlin type per brand member; Doubles always with a decimal point, numbers never in exponent form; the `OPACITY` scope as a fraction (as the CSS) and line heights as numbers; every token left out counted in a warning; XML comments and brand folder names made valid; letters of any script kept in Swift and Kotlin, folded to ASCII in XML.
