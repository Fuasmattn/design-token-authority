# TICKET-011: Add iOS Swift output formatter

**Phase:** 3 — Output Targets
**Priority:** Medium
**Effort:** M

## Summary

Add a Style Dictionary platform configuration that generates typed Swift code for iOS, covering colors, spacing, typography, and other token types. Enables direct use of design tokens in iOS apps without manual mapping.

## Background

Style Dictionary has a built-in `ios-swift` transform group that generates Swift structs/enums. However, the built-in output needs customization for multi-brand support and to match the conventions of modern iOS development (SwiftUI `Color`, `Font`, `CGFloat`).

## Acceptance Criteria

- [ ] Output directory: `build/ios/`
- [ ] Generated files:
  - `DesignTokens.swift` — all primitive values as typed Swift constants
  - `BrandTokens+{BrandName}.swift` — one file per brand with semantic overrides
- [ ] Color tokens output as `SwiftUI.Color` (with RGB float values, not hex strings)
- [ ] Dimension tokens output as `CGFloat` with values in points
- [ ] Typography tokens output as `Font` or at minimum `CGFloat` for sizes
- [ ] Namespace: `DesignTokens.Colors.brandPrimary`, `DesignTokens.Spacing.spacing4`, etc.
- [ ] Generated files compilable with Xcode — include a minimal test target in CI (optional)
- [ ] Enabled via `outputs.ios` in project config (TICKET-008)

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
