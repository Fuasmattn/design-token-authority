# TICKET-013: Add Android Compose output formatter

**Phase:** 3 — Output Targets
**Priority:** Low
**Effort:** M
**Status:** done (2026-10-26)

## Summary

Add a Style Dictionary formatter that generates Kotlin code for Jetpack Compose, producing a typed `DesignTokens` object with `Color`, `Dp`, and `TextUnit` values. This enables direct token usage in modern Android Compose UIs.

## Background

Jetpack Compose is the current standard for Android UI development. It uses Kotlin types (`Color`, `Dp`, `sp`) instead of XML resources. The built-in Style Dictionary Android output targets View-based XML and doesn't apply here — a custom formatter is required.

## Acceptance Criteria

- [x] Output directory: `build/android/compose/`
- [x] Generated file: `DesignTokens.kt` with `package` declaration configurable via project config
- [x] Color tokens output as `androidx.compose.ui.graphics.Color` with ARGB float values
- [x] Dimension tokens output as `Dp` (spacing, radius) or `TextUnit` (font sizes in `sp`)
- [x] Namespace: `DesignTokens.Colors.BrandPrimary`, `DesignTokens.Spacing.Spacing4`
- [x] Multi-brand: one `object` per brand, or a sealed class hierarchy — document the pattern
- [x] Enabled via `outputs.android.lang: 'compose'` in project config (TICKET-008)

## Implementation Notes

**Example output:**

```kotlin
// DesignTokens.kt — auto-generated, do not edit
package com.example.app.tokens

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object DesignTokens {
  object Colors {
    val BrandPrimary = Color(red = 0f, green = 0.4f, blue = 0.8f, alpha = 1f)
    val BrandSecondary = Color(red = 1f, green = 0.4f, blue = 0f, alpha = 1f)
  }
  object Spacing {
    val Spacing4: Dp = 16.dp
    val Spacing8: Dp = 32.dp
  }
  object Typography {
    val FontSizeBase: TextUnit = 16.sp
  }
}
```

**Custom formatter:**

```ts
// src/formatters/android-compose.ts
export const androidComposeFormatter: Formatter = ({ dictionary }) => {
  const lines = [
    `// auto-generated, do not edit`,
    `package ${packageName}`,
    ``,
    `import androidx.compose.ui.graphics.Color`,
    `import androidx.compose.ui.unit.dp`,
    `import androidx.compose.ui.unit.sp`,
    ``,
    `object DesignTokens {`,
  ]
  // group by category, emit typed constants
  return lines.join('\n')
}
```

## Dependencies

- TICKET-002 (SD v4)
- TICKET-008 (config — `outputs.android.lang: 'compose'` enables this)
- TICKET-012 (Android XML) — implement after; shares color format logic

## Outcome (2026-10-23)

Built to the [native outputs spec](../specs/native-outputs.md), with 011 and 012.

- `output/android/compose/DesignTokens.kt`, package from `outputs.android.package` (default `designtokens`; checked as a Kotlin package name).
- Colours as `Color(0xAARRGGBB)` instead of ARGB floats: the usual Compose form, and exact. Lengths `Dp` (`16.dp`), font sizes `TextUnit` (`16.sp`), numbers `Int`/`Double`, `String`, `Boolean`, durations `Long` ms.
- `DesignTokens.Colors.BrandPrimary`, `DesignTokens.Dimensions.Spacing4`.
- Multi-brand: `interface BrandTheme` and one `object <Brand> : BrandTheme`, documented in Reference → Outputs (provide one with a `CompositionLocal`).
- Enabled by `android-compose` in `outputs.formats`.
- After an independent review (2026-10-23): types written in full (`SwiftUI.Color`, `androidx.compose.ui.graphics.Color`, `Swift.String`, `kotlin.Int`) so a group named `Color` or `String` compiles; brand tokens decided by structure (the chain goes through a brand collection), not by value; one Kotlin type per brand member; Doubles always with a decimal point, numbers never in exponent form; the `OPACITY` scope as a fraction (as the CSS) and line heights as numbers; every token left out counted in a warning; XML comments and brand folder names made valid; letters of any script kept in Swift and Kotlin, folded to ASCII in XML.
