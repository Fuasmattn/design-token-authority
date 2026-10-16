import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'guardrails',
          environment: 'node',
          include: ['scripts/guardrails/**/*.test.ts'],
        },
      },
      'packages/*',
      'site',
    ],
  },
})
