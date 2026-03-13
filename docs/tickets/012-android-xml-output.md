# TICKET-012: Add Android XML resource output formatter

**Phase:** 3 — Output Targets
**Priority:** Medium
**Effort:** M

## Summary

Add a Style Dictionary platform configuration that generates Android resource XML files (`colors.xml`, `dimens.xml`) from design tokens. Enables direct use of tokens in traditional Android View-based apps.

## Background

Android apps consume design values via XML resource files in `res/values/`. Style Dictionary has a built-in `android` transform group that outputs these, but it requires configuration for multi-brand support and correct color format (`#AARRGGBB`).

## Acceptance Criteria

- [ ] Output directory: `build/android/values/`
- [ ] Generated files:
  - `colors.xml` — all color tokens as `<color>` resources
  - `dimens.xml` — spacing and size tokens as `<dimen>` resources in `dp`/`sp`
- [ ] Color format: Android `#AARRGGBB` (not CSS `#RRGGBBAA`)
- [ ] Multi-brand: separate resource directories per brand (`build/android/{brand}/values/`)
- [ ] Resource names follow Android naming convention: `color_brand_primary`, `dimen_spacing_4`
- [ ] Enabled via `outputs.android.lang: 'xml'` in project config (TICKET-008)

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
