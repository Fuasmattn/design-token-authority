import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  snapshotDir: './baseline',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',
  timeout: 15_000,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.001,
      animations: 'disabled',
    },
  },
  use: {
    browserName: 'chromium',
    viewport: { width: 1024, height: 768 },
    // Consistent rendering across environments
    colorScheme: 'light',
    deviceScaleFactor: 1,
    locale: 'en-US',
  },
  // Single worker for deterministic ordering
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: './report' }]],
})
