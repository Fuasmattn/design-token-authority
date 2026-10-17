# TICKET-022: Token documentation site generator

**Phase:** 6 — Documentation & Visualization
**Priority:** Medium
**Effort:** L

## Summary

Add a `dta docs` command that generates a static HTML documentation site from the token files, providing a visual reference for designers and developers. The site shows all tokens, their values, alias chains, and usage examples.

## Background

Design token documentation is a common pain point: tokens live in JSON files or Figma, but neither format is easy for developers to browse when implementing components. A generated static site bridges this gap without requiring a third-party service.

## Acceptance Criteria

- [ ] `dta docs` generates a static site to `build/docs/` (configurable)
- [ ] Site sections:
  - **Color palette** — all color tokens rendered as swatches with hex value, token name, and alias chain
  - **Typography** — font size, weight, line height tokens with live text previews
  - **Spacing** — spacing tokens rendered as visual boxes
  - **Effects** — blur and opacity tokens
  - **All tokens** — searchable table of every token with type, value, and source
- [ ] Multi-brand: a brand switcher toggles between brand token sets
- [ ] Alias chain shown on hover/click: `Colors.Text.Default → Colors.Brand.BrandA.Primary → Colors.Foundation.Blue.700 → #003f8a`
- [ ] Site is a single-page static HTML file (or minimal multi-file) — no server required
- [ ] Output is deployable to GitHub Pages or any static host
- [ ] Optional: link from PR comments (TICKET-020) to a preview deployment

## Implementation Notes

**Approach options:**

1. **Custom Style Dictionary formatter** — generates HTML directly from token data. Simple, zero extra deps. Limited interactivity.

2. **Astro/Next.js static site** — richer, but adds build complexity and a framework dependency.

**Recommendation:** Start with a custom formatter (option 1). It's self-contained and keeps dependencies minimal. Add framework if interactivity needs grow.

**Color swatch component (HTML):**
```html
<div class="token-swatch">
  <div class="swatch-color" style="background: #003f8a"></div>
  <div class="swatch-info">
    <code>--color-brand-primary</code>
    <span>#003f8a</span>
    <small>↩ Colors.Foundation.Blue.700</small>
  </div>
</div>
```

**GitHub Pages deployment:**

Add a workflow that runs `dta docs` and pushes to `gh-pages` branch on every merge to main that changes token files.

## Dependencies

- TICKET-002 (SD v4 — custom formatter)
- TICKET-007 (CLI subcommand)
- TICKET-016 (multi-brand — brand switcher needs per-brand token sets)
- TICKET-017 (dependency graph — alias chain display)
