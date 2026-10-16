# TICKET-093: Nested brands reach single-mode tokens that alias brand tokens

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** open

## Background

Found while writing the Learn pattern pages (073). A single-mode collection that aliases a multi-mode one, such as a `Component` tier over a `Brand` tier, is built into `variables.css` on `:root`:

```css
:root { --button-background: var(--action-background); }          /* variables.css */
[data-brand="brandb"] { --action-background: var(--color-green-600); } /* themes/brandb.css */
```

CSS resolves `var()` where the custom property is declared, so `--button-background` takes the brand of the root element and is inherited from there. On `<html data-brand="branda">` with a nested `<section data-brand="brandb">`, the section gets BrandB's `--action-background` but BrandA's `--button-background` (checked in Chromium with the `multi-brand` example plus a single-mode `Component.Value.json`). Switching the brand on `<html>` works. The Brands and themes guide says brands work "on any element"; that holds for the brand tokens only.

`base.css` resolves the same token to the first brand's value, which is expected for a base layer but worth stating in the Outputs reference.

## What to build

Single-mode tokens whose alias chain reaches a brand-mode token are also emitted in each brand's theme file (same `var()` reference), so they are recomputed wherever `data-brand` is set. Tokens that only alias other single-mode tokens stay on `:root` only.

## Acceptance criteria

- [ ] A test with a single-mode tier over brand modes: the theme files declare the dependent tokens, `variables.css` is unchanged
- [ ] A browser check (or computed-style test) that a nested `data-brand` section resolves the dependent tokens to its own brand
- [ ] `brand-ab` snapshots unchanged, or re-recorded by name and reviewed if its output changes
- [ ] The caution on the Learn patterns page and the note in Brands and themes updated; Outputs reference states what `base.css` resolves to; all gates pass, and the GitHub run is green
