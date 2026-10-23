# Spec: native outputs (iOS Swift, Android XML, Jetpack Compose)

**Status:** draft, written 2026-10-23 for TICKET-011, 012 and 013 while the maintainer was away; every decision below is the implementer's and open to review.
**Tickets:** [011](../tickets/011-ios-swift-output.md), [012](../tickets/012-android-xml-output.md), [013](../tickets/013-android-compose-output.md). They were written for the v1 tree (paths like `build/ios/`, `outputs.android.lang`); this spec maps them onto the v2 build.

## Goal

`dta build` can also write the tokens for native apps: Swift for SwiftUI, Android resource XML and Kotlin for Jetpack Compose. Same model, same resolution as the web outputs, no new dependency.

## Decisions

1. **Chosen through `outputs.formats`**, like the web outputs: `ios-swift`, `android-xml`, `android-compose`. They are **not** in the default (no `formats` = the four web outputs, as today), so no existing build changes. `outputs.ios.outDir` (default `output/ios`) and `outputs.android.outDir` (default `output/android`) move them. The placeholder keys `outputs.ios.lang` and `outputs.android.lang` (accepted but without effect so far) are rejected with a message, as `outputs.tailwind.version` was: `formats` chooses the language. `outputs.android.package` sets the Kotlin package (default `designtokens`). `dta init`'s answers "iOS Swift", "Android XML resources" and "Android Jetpack Compose" become those formats.
2. **Resolved from the model, not through Style Dictionary.** Each token is resolved with `@dta/core`'s `resolve` in the contexts below and written with a small formatter per platform. Native code has no `var()` to keep aliases alive, so every value is the resolved value (the alias chain stays in a comment: `// Colors.Brand.Primary → Colors.Foundation.Blue.500`). The build's guards hold: tokens that do not resolve (dangling, circular) are left out, as in the CSS. The native code is loaded only when a native format is chosen, so web builds and the playground's bundle do not carry it (the playground's Outputs budget, TICKET-124).
3. **Brands are themes.** With `brands`, a token whose alias chain goes through a brand collection (a multi-mode collection that has a brand as a mode) is a **brand token**; every other token is **shared**. Decided by structure, not by comparing values (changed after review): otherwise a token would move between `DesignTokens.Colors.x` and `theme.colorsX` when a value changed or a brand was added, and app code would break.
   - Swift: `DesignTokens.swift` holds the shared tokens and `protocol BrandTheme` (one property per brand token); `BrandTokens+<Brand>.swift` holds `struct <Brand>: BrandTheme`. The app picks a theme (`let theme: BrandTheme = BrandA()`), which also works with SwiftUI's environment.
   - Compose: `DesignTokens.kt` holds `object DesignTokens` (shared), `interface BrandTheme` and `object <Brand> : BrandTheme`; provide one through a `CompositionLocal`.
   - Android XML: `main/values/` holds the shared resources, `<brand>/values/` (lower case, as the CSS theme files) the brand resources: product-flavour source sets (`sourceSets["branda"].res.srcDirs(...)`). Every flavour defines the same brand resources, so code can use them from `main`.
   - Without `brands`, every token is shared. Other multi-mode collections (resolver modifiers such as dark mode) are read in their default mode; a note says which modes are left out. Light and dark for native apps are a follow-up.
4. **Breakpoints: the default breakpoint only.** Native apps have no media queries; size classes are an app decision. The breakpoint collection is read in `breakpoints.default` (without `breakpoints`: its default mode), and a note says which modes are not in the native files.
5. **Types.**

   | Token                                                                                                 | Swift                                   | Android XML                | Compose                                                                                                         |
   | ----------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------- |
   | `color` (any colour space; converted to sRGB, clipped with a note)                                    | `Color(.sRGB, red:green:blue:opacity:)` | `<color>#AARRGGBB</color>` | `Color(0xAARRGGBB)`                                                                                             |
   | length: `dimension` (px, rem × 16) or a `number` whose name says spacing, radius, size, gap …         | `CGFloat` (points)                      | `<dimen>16dp</dimen>`      | `16.dp`                                                                                                         |
   | font size (`fontSize`, or a name with font size / text size)                                          | `CGFloat`                               | `<dimen>16sp</dimen>`      | `16.sp`                                                                                                         |
   | opacity (scope `OPACITY`, `50` → `0.5` as in the CSS), line height, other `number`, `fontWeight`      | `Double`                                | not written                | `Int` for a whole number, else `Double`; a brand member is `Double` in every brand when it is fractional in one |
   | `string`, `fontFamily` (the list joined)                                                              | `String`                                | not written                | `String`                                                                                                        |
   | `boolean`                                                                                             | `Bool`                                  | not written                | `Boolean`                                                                                                       |
   | `duration`                                                                                            | `TimeInterval` (seconds)                | not written                | `Long` (ms)                                                                                                     |
   | composites (`shadow`, `typography`, `border`, `gradient`, `transition`, `cubicBezier`, `strokeStyle`) | not written                             | not written                | not written                                                                                                     |

   Android XML is colours and dimensions only (the tickets' scope). Types are written in full (`SwiftUI.Color`, `androidx.compose.ui.graphics.Color`, `Swift.String`, `kotlin.Int`), so a group named `Color` or `String` (an `enum`/`object` of that name) cannot hide them. What a platform does not write (composites, values without a native form such as `50%`, tokens that do not resolve in every brand, the non-colour kinds in XML) is counted in one note per reason (`ios-swift: 3 shadow tokens are not written (composite types are not in the native outputs yet).`), never silently.

   The ticket asked for ARGB floats in Compose; `Color(0xFF0057B8)` is the usual Compose form and exact, so it is used instead.

6. **Names.** The first segment of the path is the group, the rest is the name.
   - Swift: `DesignTokens.Colors.brandPrimaryDark` (an `enum` per group, lower camel case; a name starting with a digit gets `_`, Swift keywords get backticks).
   - Compose: `DesignTokens.Colors.BrandPrimaryDark` (an `object` per group, upper camel case, as Compose's own colours).
   - Android XML: the whole path in snake case, ASCII-folded (`Grün` → `grun`), `colors_brand_primary_dark`, `dimensions_spacing_4`; brand folders the same way (`Brand A` → `brand_a`). Swift and Kotlin keep letters of any script.
   - Brand tokens: one property per token, named from the whole path (`colorsBrandPrimary`, `ColorsBrandPrimary`).
   - Two tokens with the same name after this are a warning naming both; the second is left out. Not an error: `dta build` writes nothing while there are errors, which would stop the web outputs too.
7. **Files.**

   ```
   output/ios/DesignTokens.swift
   output/ios/BrandTokens+BrandA.swift            (one per brand)
   output/android/main/values/colors.xml
   output/android/main/values/dimens.xml
   output/android/branda/values/colors.xml        (one folder per brand, brand tokens only)
   output/android/compose/DesignTokens.kt
   ```

   Each file starts with "Generated by dta build; do not edit". Files that would be empty are not written.

8. **Verified by tests and snapshots, not by compilers.** The repository has no Swift or Kotlin toolchain and CI does not install one (the tickets made a compile check optional). The formatters are tested for valid identifiers, escaping and every type; a reference snapshot scenario `brand-ab/build-native` pins the files.

## Not in scope

Light/dark (resolver modifiers) as native themes, size classes, typography and shadow composites as `Font`/`TextStyle`/`Shadow`, Android `values-night`, asset catalogs (`.xcassets`). Each is a follow-up once someone needs it.
