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
      {
        test: { name: 'actions', environment: 'node', include: ['actions/**/*.test.ts'] },
      },
      'packages/*',
      'site',
    ],
  },
})
