# TICKET-016: Multi-brand composition model

**Phase:** 4 — Structure Intelligence
**Priority:** Medium
**Effort:** L

## Summary

Define and implement a formal composition model for how brand tokens layer over primitive tokens, and how that layering maps to the various output targets. This makes multi-brand support explicit, reliable, and easily extendable to new brands.

## Background

The current project has two brands (Bayernwerk, LEW) defined as modes in the `Brand(Alias)` collection. The layering is: Primitives → Brand Aliases → Screen Type overrides. This is the right pattern, but it's implicit — the build just flattens all token files into one StyleDictionary run, which can cause alias resolution issues across brands.

Each output target has a different way to express "brand switching":
- **CSS:** Separate `:root` blocks or scoped classes (`.theme-bayernwerk`, `.theme-lew`)
- **Tailwind:** CSS variable references + Tailwind's `class` strategy for dark mode
- **iOS:** Protocol/struct per brand, or separate Swift packages
- **Android:** Resource qualifiers or separate Kotlin objects

## Acceptance Criteria

- [ ] The `build` command runs Style Dictionary once per brand (not once globally)
- [ ] For CSS: generates one `:root` block per brand as scoped class selectors
  ```css
  .theme-bayernwerk { --color-primary: #003f8a; }
  .theme-lew { --color-primary: #e2001a; }
  ```
- [ ] For Tailwind: CSS variable references in the theme so brand switching works at runtime via class
- [ ] For iOS: one Swift file per brand conforming to a shared `BrandTheme` protocol
- [ ] For Android: one resource directory per brand (`build/android/bayernwerk/`, `build/android/lew/`)
- [ ] Primitives are output once (shared across brands)
- [ ] Adding a new brand = adding a new mode in Figma, re-exporting, running build — no code changes required

## Implementation Notes

**CSS brand scoping approach:**

Run Style Dictionary's CSS platform once per brand, using a filter to include only that brand's tokens plus primitives. Set the CSS selector to the brand class:

```ts
for (const brand of config.brands) {
  const sd = new StyleDictionary({
    tokens: mergeTokensForBrand(allTokens, brand),
    platforms: {
      css: {
        transformGroup: 'css',
        files: [{
          destination: `${brand.toLowerCase()}.css`,
          format: 'css/variables',
          options: { selector: `.theme-${brand.toLowerCase()}` },
        }],
      },
    },
  })
  await sd.buildAllPlatforms()
}
```

**Token merge order:** primitives → brand aliases → dimension overrides (per screen type)

**Responsive + brand:** For the combination of brand × screen type, consider generating CSS with nested selectors:
```css
.theme-bayernwerk { --spacing-base: 16px; }
@media (max-width: 768px) {
  .theme-bayernwerk { --spacing-base: 12px; }
}
```

## Dependencies

- TICKET-002 (SD v4 — multi-run build pattern works better in v4)
- TICKET-008 (config — `brands` list drives the per-brand loop)
- TICKET-009/010/011/012/013 (output formatters consume brand-split tokens)
