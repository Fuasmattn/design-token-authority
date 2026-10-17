# TICKET-003: Fix missing units in CSS variable output

**Status:** ✅ Done — commits `91d5f3e`, `0e5fdf7`
**Phase:** 1 — Foundation (Bug Fix)
**Priority:** High
**Effort:** S

## Summary

Several token categories output unit-less numeric values to CSS, making them unusable directly. Blur values, opacity percentages, and potentially spacing/radius values are affected.

## Background

Current CSS output:
```css
--effects-blur-blur-3xl: 64;       /* should be 64px */
--effects-blur-blur-md: 12;        /* should be 12px */
--effects-opacity-opacity-100: 100; /* should be 100% */
```

This happens because the `size/px` transform in the current config only applies to tokens with `type: dimension` (or the old CTI `size` attribute), and the blur/opacity tokens are typed as `number` in the DTCG sense but need different unit treatment.

## Acceptance Criteria

- [x] Blur tokens output with `px` unit: `--effects-blur-3xl: 64px`
- [x] Opacity tokens output as decimals (0–1): `--effects-opacity-100: 1`
- [x] Spacing and border-radius tokens output with `px` units: `--dimensions-spacing-4: 16px`
- [x] Unit transforms are driven by Figma variable scope (`$extensions.com.figma.scopes`) — not path-based
- [x] Existing color outputs are unaffected
- [ ] Typography tokens (FONT_SIZE, LINE_HEIGHT, LETTER_SPACING) intentionally deferred — need rem/em handling per output target

## Implementation Notes

In Style Dictionary v4, register a custom transform:

```ts
sd.registerTransform({
  name: 'value/blur-px',
  type: 'value',
  filter: (token) => token.path.includes('blur') && token.$type === 'number',
  transform: (token) => `${token.$value}px`,
})

sd.registerTransform({
  name: 'value/opacity-decimal',
  type: 'value',
  filter: (token) => token.path.includes('opacity') && token.$type === 'number',
  transform: (token) => `${Number(token.$value) / 100}`,
})
```

Alternatively, use token `$type: dimension` (with `$value: "64px"`) directly in the Figma export — which is the cleaner long-term fix as it pushes intent into the token definition.

## Dependencies

- TICKET-002 (v4 upgrade) — custom transforms are much cleaner in v4
