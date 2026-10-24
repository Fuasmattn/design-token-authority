import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/core',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
