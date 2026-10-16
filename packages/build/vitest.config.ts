import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/build',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
