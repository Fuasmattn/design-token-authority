# TICKET-010: Add Tailwind v4 output formatter

**Phase:** 3 — Output Targets
**Priority:** Medium
**Effort:** S

## Summary

Add a formatter that generates a Tailwind v4 `@theme` CSS block from design tokens. Tailwind v4 uses CSS custom properties natively, which aligns perfectly with the existing CSS output.

## Background

Tailwind v4 (released early 2025) eliminates the JavaScript config for most use cases. Instead, tokens are defined as CSS custom properties under an `@theme` block in a CSS file. Tailwind v4 reads these at build time.

This means our existing CSS variable output is almost the right shape — the main difference is adding the `@theme {}` wrapper and mapping property names to Tailwind's naming convention.

## Acceptance Criteria

- [ ] New formatter `tailwind/v4` registered in Style Dictionary
- [ ] Output file: `build/tailwind/tailwind.css`
- [ ] Output wraps tokens in `@theme { }` with correct Tailwind v4 naming (`--color-*`, `--spacing-*`, etc.)
- [ ] Tailwind v4 naming conventions followed (see Tailwind v4 docs)
- [ ] Enabled via `outputs.tailwind.version: 4` in project config (TICKET-008)

## Implementation Notes

Tailwind v4 `@theme` format:
```css
@theme {
  --color-brand-primary: #0066cc;
  --color-brand-secondary: #ff6600;
  --spacing-4: 16px;
  --font-size-base: 16px;
  --radius-md: 8px;
}
```

The formatter is essentially TICKET-009 but outputting CSS instead of JS, and using Tailwind's expected namespace prefixes. Token path → Tailwind name mapping:

| Token | CSS property |
|---|---|
| `Colors/Brand/Primary` | `--color-brand-primary` |
| `Spacing/4` | `--spacing-4` |
| `Typography/fontSize/base` | `--font-size-base` |
| `BorderRadius/md` | `--radius-md` |
| `Effects/blur/md` | `--blur-md` |

The consuming project just imports the file:
```css
/* app.css */
@import 'build/tailwind/tailwind.css';
```

## Dependencies

- TICKET-002 (SD v4)
- TICKET-003 (unit transforms — units must be correct before this is useful)
- TICKET-008 (config)
