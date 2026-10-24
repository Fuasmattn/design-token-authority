import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/lint',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
