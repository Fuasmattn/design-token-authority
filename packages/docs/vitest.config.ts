import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/docs',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
