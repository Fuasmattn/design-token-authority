import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/visual-diff',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
