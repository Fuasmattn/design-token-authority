import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'legacy',
          environment: 'node',
          globals: true,
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'guardrails',
          environment: 'node',
          include: ['scripts/guardrails/**/*.test.ts'],
        },
      },
      'packages/*',
    ],
  },
})
