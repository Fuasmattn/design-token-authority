# TICKET-026: Per-brand build output and Tailwind theme integration

**Status:** ✅ Done
**Phase:** 3 — Output Targets
**Priority:** High
**Effort:** M

## Summary

Split the Style Dictionary build so each brand (Bayernwerk, LEW, …) gets its own
output artifacts, eliminating the current token-collision problem. Define a concrete
Tailwind integration pattern that supports both runtime class-based brand switching and
static per-brand builds.

## Background

The current build loads all token files in a single SD run. Because both
`Brand(Alias).Bayernwerk.json` and `Brand(Alias).LEW.json` export the same semantic
token paths (e.g. `Colors.foundation.brand.default`), SD reports 4 606 collisions and
silently picks one brand's values for the output. The Tailwind files produced by
TICKET-009/010 therefore only reflect whichever brand happened to win — not both.

The fix is to run SD separately for each brand file detected in `tokens/`, producing:

1. A shared **primitives layer** — all raw values, output once.
2. A per-brand **semantic layer** — alias tokens resolved against that brand's
   primitives only, output with a scoped CSS class selector.
3. A shared **Tailwind config** referencing CSS vars (runtime switching via class).
4. Per-brand **Tailwind configs** with fully resolved values (for static builds).

Brands are auto-detected from the filename pattern `Brand(Alias).{Brand}.json` so
adding a new brand in Figma and re-exporting is all that's needed — no code changes.

---

## Acceptance Criteria

- [x] Build auto-detects brands from `tokens/Brand(Alias).*.json` filenames
- [x] Primitives output once to `build/css/base.css` as `:root { ... }`
- [x] Each brand outputs a scoped CSS file to `build/css/themes/{brand}.css`
      with selector `[data-brand="{brand}"]` (configurable; class alternative `.theme-{brand}`
      also supported), aliases resolved to `var(--primitives-var)`
- [x] Each brand outputs a resolved Tailwind v3 file to
      `build/tailwind/{brand}/tailwind.tokens.ts` (actual values, no `var()` refs)
- [x] Each brand outputs a resolved Tailwind v4 file to
      `build/tailwind/{brand}/tailwind.css` (actual values, no `var()` refs)
- [x] The shared `build/tailwind/tailwind.tokens.ts` and `build/tailwind/tailwind.css`
      continue to use CSS var references (unchanged behaviour from TICKET-009/010)
- [x] No SD collision warnings during build
- [x] Existing CSS/JS outputs are unaffected

---

## Output structure

```
build/
  css/
    base.css                              :root { all primitive raw values }
    themes/
      bayernwerk.css                      .theme-bayernwerk { semantic aliases }
      lew.css                             .theme-lew { semantic aliases }
    variables.css                         (unchanged — kept for backwards compat)
  tailwind/
    tailwind.tokens.ts                    shared, CSS var refs (TICKET-009)
    tailwind.css                          @theme { CSS var refs } (TICKET-010)
    bayernwerk/
      tailwind.tokens.ts                  resolved BW values
      tailwind.css                        @theme with resolved BW values
    lew/
      tailwind.tokens.ts                  resolved LEW values
      tailwind.css                        @theme with resolved LEW values
  js/
    colorpalette.js                       (unchanged)
```

---

## Tailwind integration patterns

### Pattern A — Runtime `data-brand` attribute switching (recommended)

Brand is set as a data attribute on `<html>`. Cleaner than a class because it doesn't
conflict with Tailwind's own class-based utilities, and the JS API is more ergonomic.

```html
<!-- index.html -->
<html data-brand="bayernwerk">
```

```ts
// tailwind.config.ts
import { tokens } from './build/tailwind/tailwind.tokens'
export default { ...tokens }
```

```css
/* app.css */
@import './build/css/base.css';
@import './build/css/themes/bayernwerk.css';
@import './build/css/themes/lew.css';
/* Both theme files are loaded; only the one matching [data-brand] is active. */
```

Switching brand at runtime:
```ts
document.documentElement.dataset.brand = 'lew'
```

How it works: Tailwind utility classes like `bg-foundation-brand-default` expand to
`var(--color-foundation-brand-default)`. That resolves through the `@theme` block to
`var(--colors-foundation-brand-default)`. That resolves to the value set by
`[data-brand="bayernwerk"]` on `<html>` (inherited by `:root`), which in turn uses
`var(--colors-bw-blue-500)` from `base.css`.

### Pattern B — Runtime class-based switching

Same as Pattern A but via a CSS class. Useful when the consuming framework already
manages classes on `<html>` (e.g. Tailwind dark mode with `class` strategy).

```html
<html class="theme-bayernwerk">
```

```ts
// tailwind.config.ts — identical to Pattern A
import { tokens } from './build/tailwind/tailwind.tokens'
export default { ...tokens }
```

```css
/* app.css */
@import './build/css/base.css';
@import './build/css/themes/bayernwerk.css';
@import './build/css/themes/lew.css';
```

Switching:
```ts
document.documentElement.className = 'theme-lew'
// or alongside dark mode:
document.documentElement.classList.replace('theme-bayernwerk', 'theme-lew')
```

### Pattern C — Static per-brand build (for SSG, white-label projects)

A separate Tailwind config per brand with fully resolved values baked in.
No runtime attribute or class switching needed.

```ts
// bayernwerk/tailwind.config.ts
import { tokens } from '../build/tailwind/bayernwerk/tailwind.tokens'
export default { ...tokens }
```

```css
/* bayernwerk/app.css — only needs base.css, no data-brand needed */
@import '../build/css/base.css';
```

### Tailwind v4 variants

Runtime (data-brand, Patterns A/B):

```css
/* app.css (Tailwind v4) */
@import 'tailwindcss';
@import './build/css/base.css';
@import './build/css/themes/bayernwerk.css';
@import './build/css/themes/lew.css';
@import './build/tailwind/tailwind.css';      /* @theme with var() refs */
```

Static per-brand (Pattern C):

```css
/* bayernwerk/app.css (Tailwind v4, static) */
@import 'tailwindcss';
@import './build/css/base.css';
@import './build/tailwind/bayernwerk/tailwind.css';   /* @theme with resolved values */
```

---

## Implementation notes

### Brand detection

```ts
import { glob } from 'node:fs'
// or simply filter readdir output
const brandFiles = fs.readdirSync('tokens').filter(f => /^Brand\(Alias\)\./.test(f))
const brands = brandFiles.map(f => f.replace(/^Brand\(Alias\)\./, '').replace(/\.json$/, ''))
// → ['Bayernwerk', 'LEW']
```

### Build structure in `style-dictionary.config.ts`

```ts
// Run 1 — primitives only
const sdBase = new StyleDictionary({
  source: ['tokens/Primitives*.json'],
  platforms: {
    'css-base': {
      transformGroup: 'design-system/css',
      buildPath: 'build/css/',
      files: [{
        destination: 'base.css',
        format: 'css/variables',
        options: { selector: ':root', outputReferences: false },
      }],
    },
  },
})
await sdBase.buildAllPlatforms()

// Run 2 — per brand
for (const brand of brands) {
  const slug = brand.toLowerCase()

  // Filter: include only tokens whose source file is the brand file.
  // Primitives are included in the SD source for alias resolution but NOT emitted.
  const brandOnly = (token: TransformedToken) =>
    token.filePath.includes(`Brand(Alias).${brand}.json`)

  const sd = new StyleDictionary({
    source: [
      'tokens/Primitives*.json',        // needed for alias resolution
      `tokens/Brand(Alias).${brand}.json`,
    ],
    platforms: {
      // Scoped CSS vars — aliases output as var(--primitives-token)
      'css-theme': {
        transformGroup: 'design-system/css',
        buildPath: 'build/css/themes/',
        files: [{
          destination: `${slug}.css`,
          format: 'css/variables',
          filter: brandOnly,
          options: { selector: `[data-brand="${slug}"]`, outputReferences: true },
        }],
      },
      // Tailwind v3 — resolved values (no var() refs for colors)
      'tailwind-v3-brand': {
        transformGroup: 'design-system/css',
        buildPath: `build/tailwind/${slug}/`,
        files: [{
          destination: 'tailwind.tokens.ts',
          format: 'tailwind/v3',
          filter: brandOnly,
          options: { resolvedValues: true },  // new option — see below
        }],
      },
      // Tailwind v4 — resolved values
      'tailwind-v4-brand': {
        transformGroup: 'design-system/css',
        buildPath: `build/tailwind/${slug}/`,
        files: [{
          destination: 'tailwind.css',
          format: 'tailwind/v4',
          filter: brandOnly,
          options: { resolvedValues: true },
        }],
      },
    },
  })
  await sd.buildAllPlatforms()
}
```

### `resolvedValues` option for Tailwind formatters

The existing `tailwind/v3` and `tailwind/v4` formatters always output CSS var references
for color tokens. For per-brand static output we want the resolved hex values instead.

Add an option check to both formatters:

```ts
// In tailwindV3Formatter / tailwindV4Formatter:
const resolvedValues = (options as { resolvedValues?: boolean }).resolvedValues ?? false

const value =
  (category === 'colors' && !resolvedValues)
    ? `var(--${token.name})`
    : String(rawValue)
```

The default remains `false` (var() references), preserving existing behaviour.

### What `base.css` replaces / what it does NOT replace

`base.css` contains only Primitives — raw color values, spacing scale, radii, blur,
opacity, typography primitives. It does **not** contain semantic aliases.

The existing `build/css/variables.css` is produced by the unchanged legacy platform
and may be kept for backwards compatibility during migration. Once consuming projects
have migrated to `base.css` + `themes/{brand}.css`, the legacy `variables.css` platform
can be retired.

### Selector strategy

The CSS selector passed to SD's `css/variables` format controls which pattern is used.
Both are supported — pick one and use it consistently:

| Pattern | SD `selector` value | HTML usage |
|---|---|---|
| data-brand (recommended) | `[data-brand="bayernwerk"]` | `<html data-brand="bayernwerk">` |
| class | `.theme-bayernwerk` | `<html class="theme-bayernwerk">` |

The data-attribute approach is recommended because it doesn't conflict with Tailwind's
class-based utilities (e.g. dark mode via `class="dark"`), and switching in JS is
cleaner: `document.documentElement.dataset.brand = 'lew'`.

Implementation — swap out the selector string in the build loop:

```ts
// data-brand (Pattern A)
options: { selector: `[data-brand="${slug}"]`, outputReferences: true }

// class (Pattern B)
options: { selector: `.theme-${slug}`, outputReferences: true }
```

### Scoped CSS example (data-brand)

```css
/* build/css/themes/bayernwerk.css */
[data-brand="bayernwerk"] {
  --colors-foundation-neutral-whisper: var(--colors-bw-grey-50);
  --colors-foundation-brand-default: var(--colors-bw-blue-500);
  --colors-foundation-brand-faint: var(--colors-bw-blue-50);
  /* … all Brand(Alias) tokens with outputReferences: true */
  --typography-font-family-heading: var(--typography-font-family-bayernwerk);
}

/* build/css/themes/lew.css */
[data-brand="lew"] {
  --colors-foundation-neutral-whisper: var(--colors-grey-50);
  --colors-foundation-brand-default: var(--colors-blue-600);
  --colors-foundation-brand-faint: var(--colors-blue-100);
  /* … */
  --typography-font-family-heading: var(--typography-font-family-lechwerke);
}
```

### Resolved Tailwind v3 example

```ts
/* build/tailwind/bayernwerk/tailwind.tokens.ts */
export const tokens = {
  theme: {
    extend: {
      colors: {
        'foundation-brand-default': '#0091bb',   // resolved BW value
        'foundation-brand-faint':   '#e5f4f8',
        /* … */
      },
      fontFamily: {
        heading: 'Polo 11',
      },
    },
  },
} satisfies Partial<Config>
```

---

## Dependencies

- TICKET-009 (Tailwind v3 formatter — extended with `resolvedValues` option)
- TICKET-010 (Tailwind v4 formatter — extended with `resolvedValues` option)

## Related

- TICKET-016 (multi-brand composition model — the CSS side of this ticket overlaps;
  TICKET-016 should be updated or marked superseded by this ticket for the
  CSS + Tailwind targets)
