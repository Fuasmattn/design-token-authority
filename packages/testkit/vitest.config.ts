import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/testkit',
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
})
