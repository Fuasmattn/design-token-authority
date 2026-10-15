import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/cli',
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // The snapshot suite starts one CLI process per fixture and scenario.
    testTimeout: 60_000,
  },
})
