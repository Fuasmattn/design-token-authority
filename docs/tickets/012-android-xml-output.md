# TICKET-012: Add Android XML resource output formatter

**Phase:** 3 — Output Targets
**Priority:** Medium
**Effort:** M
**Status:** in review

## Summary

Add a Style Dictionary platform configuration that generates Android resource XML files (`colors.xml`, `dimens.xml`) from design tokens. Enables direct use of tokens in traditional Android View-based apps.

## Background

Android apps consume design values via XML resource files in `res/values/`. Style Dictionary has a built-in `android` transform group that outputs these, but it requires configuration for multi-brand support and correct color format (`#AARRGGBB`).

## Acceptance Criteria

- [x] Output directory: `build/android/values/`
- [x] Generated files:
  - `colors.xml` — all color tokens as `<color>` resources
  - `dimens.xml` — spacing and size tokens as `<dimen>` resources in `dp`/`sp`
- [x] Color format: Android `#AARRGGBB` (not CSS `#RRGGBBAA`)
- [x] Multi-brand: separate resource directories per brand (`build/android/{brand}/values/`)
- [x] Resource names follow Android naming convention: `color_brand_primary`, `dimen_spacing_4`
- [x] Enabled via `outputs.android.lang: 'xml'` in project config (TICKET-008)

## Implementation Notes

**Color format transform** — Android uses `#AARRGGBB`, CSS uses `#RRGGBBAA`:

```ts
sd.registerTransform({
  name: 'color/android-argb',
  type: 'value',
  filter: (token) => token.$type === 'color',
  transform: (token) => {
    const hex = token.$value.replace('#', '')
    if (hex.length === 8) {
      // RRGGBBAA → AARRGGBB
      return `#${hex.slice(6)}${hex.slice(0, 6)}`
    }
    return `#FF${hex}` // no alpha → fully opaque
  },
})
```

**Example output:**

```xml
<!-- colors.xml -->
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="color_brand_primary">#FF0066CC</color>
  <color name="color_brand_secondary">#FFFF6600</color>
</resources>
```

```xml
<!-- dimens.xml -->
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <dimen name="spacing_4">16dp</dimen>
  <dimen name="spacing_8">32dp</dimen>
</resources>
```

**Multi-brand:** Run Style Dictionary once per brand, filtering to that brand's mode tokens, outputting to `build/android/{brand}/values/`.

## Dependencies

- TICKET-002 (SD v4)
- TICKET-008 (config — `outputs.android.lang: 'xml'` enables this)

## Outcome (2026-10-23)

Built to the [native outputs spec](../specs/native-outputs.md), with 011 and 013.

- `output/android/main/values/colors.xml` and `dimens.xml` (shared), `output/android/<brand>/values/` (the brand tokens, brand lower-cased): product-flavour source sets. The criteria's `build/android/values/` and `build/android/{brand}/values/` map onto `main/` and `<brand>/` so that `main` is a source set too.
- Colours `#AARRGGBB`; lengths in `dp`, font sizes in `sp`.
- Names: the whole path in snake case, `colors_brand_primary`, `dimensions_spacing_4` (the criteria's `color_brand_primary` would repeat the group for `Colors.…` tokens).
- Enabled by `android-xml` in `outputs.formats`; `outputs.android.lang` is rejected now.
- After an independent review (2026-10-23): types written in full (`SwiftUI.Color`, `androidx.compose.ui.graphics.Color`, `Swift.String`, `kotlin.Int`) so a group named `Color` or `String` compiles; brand tokens decided by structure (the chain goes through a brand collection), not by value; one Kotlin type per brand member; Doubles always with a decimal point, numbers never in exponent form; the `OPACITY` scope as a fraction (as the CSS) and line heights as numbers; every token left out counted in a warning; XML comments and brand folder names made valid; letters of any script kept in Swift and Kotlin, folded to ASCII in XML.
