# TICKET-023: Visual regression testing for token changes

**Phase:** 6 — Documentation & Visualization
**Priority:** Low
**Effort:** L

## Summary

Add visual regression tests that detect unintended visual changes caused by token updates. A CI step renders a set of reference components with the current tokens and compares them pixel-by-pixel against a baseline, failing if differences exceed a threshold.

## Background

Token changes (especially color, spacing, typography) have visual consequences that are hard to review by looking at JSON diffs. A visual regression test catches unintended side effects — for example, a spacing token used in 12 different components changing when only one was intended.

## Acceptance Criteria

- [ ] A set of reference component fixtures (HTML/CSS) is maintained in `test/visual/fixtures/`
- [ ] Each fixture covers a meaningful visual surface: color palette, typography scale, spacing, brand theme
- [ ] Playwright takes screenshots of each fixture with the current token CSS applied
- [ ] Screenshots are compared to baseline images stored in `test/visual/baseline/`
- [ ] CI fails if pixel diff exceeds a configurable threshold (default: 0.1%)
- [ ] `dtf test:visual` command runs the suite locally
- [ ] `dtf test:visual --update-baseline` updates baseline images after intentional changes
- [ ] Diff images are uploaded as CI artifacts for review

## Implementation Notes

**Stack:** Playwright (already handles screenshots + pixel diff) — no additional visual testing library needed.

**Fixture approach:**
```html
<!-- test/visual/fixtures/color-palette.html -->
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="../../../build/css/variables.css">
  <style>
    .swatch { width: 80px; height: 80px; display: inline-block; }
    .primary { background: var(--color-brand-primary); }
    /* ... */
  </style>
</head>
<body>
  <div class="swatch primary"></div>
  <!-- ... -->
</body>
</html>
```

**Playwright test:**
```ts
test('color palette visual regression', async ({ page }) => {
  await page.goto(`file://${path.resolve('test/visual/fixtures/color-palette.html')}`)
  await expect(page).toHaveScreenshot('color-palette.png', { maxDiffPixelRatio: 0.001 })
})
```

**CI integration:** Add a `visual-regression` job to the test workflow that runs after `build`. Upload diff images as artifacts on failure. Consider only running on PRs that modify `tokens/` or `build/`.

**Multi-brand:** Separate fixture pages per brand, or a single page with a brand switcher — screenshot both states.

## Dependencies

- TICKET-003 (CSS units — CSS must be correct before screenshots are meaningful)
- TICKET-016 (multi-brand — test each brand)
