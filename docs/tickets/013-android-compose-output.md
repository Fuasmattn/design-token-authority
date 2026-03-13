# TICKET-013: Add Android Compose output formatter

**Phase:** 3 — Output Targets
**Priority:** Low
**Effort:** M

## Summary

Add a Style Dictionary formatter that generates Kotlin code for Jetpack Compose, producing a typed `DesignTokens` object with `Color`, `Dp`, and `TextUnit` values. This enables direct token usage in modern Android Compose UIs.

## Background

Jetpack Compose is the current standard for Android UI development. It uses Kotlin types (`Color`, `Dp`, `sp`) instead of XML resources. The built-in Style Dictionary Android output targets View-based XML and doesn't apply here — a custom formatter is required.

## Acceptance Criteria

- [ ] Output directory: `build/android/compose/`
- [ ] Generated file: `DesignTokens.kt` with `package` declaration configurable via project config
- [ ] Color tokens output as `androidx.compose.ui.graphics.Color` with ARGB float values
- [ ] Dimension tokens output as `Dp` (spacing, radius) or `TextUnit` (font sizes in `sp`)
- [ ] Namespace: `DesignTokens.Colors.BrandPrimary`, `DesignTokens.Spacing.Spacing4`
- [ ] Multi-brand: one `object` per brand, or a sealed class hierarchy — document the pattern
- [ ] Enabled via `outputs.android.lang: 'compose'` in project config (TICKET-008)

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
