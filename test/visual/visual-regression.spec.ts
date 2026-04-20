/**
 * TICKET-023: Visual regression tests for design token output.
 *
 * Takes screenshots of HTML fixture pages that render CSS custom properties
 * from the build output and compares them against baseline images.
 *
 * Usage:
 *   npx playwright test --config test/visual/playwright.config.ts
 *   npx playwright test --config test/visual/playwright.config.ts --update-snapshots
 */

import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures')

test.describe('Color palette', () => {
  test('primitive color scales', async ({ page }) => {
    await page.goto(`file://${path.join(FIXTURES_DIR, 'color-palette.html')}`)
    await expect(page).toHaveScreenshot('color-palette.png')
  })
})

test.describe('Spacing & sizing', () => {
  test('spacing scale, sizing scale, and border radius', async ({ page }) => {
    await page.goto(`file://${path.join(FIXTURES_DIR, 'spacing.html')}`)
    await expect(page).toHaveScreenshot('spacing.png')
  })
})

test.describe('Typography', () => {
  test('font size scale', async ({ page }) => {
    await page.goto(`file://${path.join(FIXTURES_DIR, 'typography.html')}`)
    await expect(page).toHaveScreenshot('typography.png')
  })
})

test.describe('Brand themes', () => {
  test('BrandA and BrandB brand colors side by side', async ({ page }) => {
    await page.goto(`file://${path.join(FIXTURES_DIR, 'brand-theme.html')}`)
    await expect(page).toHaveScreenshot('brand-themes.png')
  })
})
