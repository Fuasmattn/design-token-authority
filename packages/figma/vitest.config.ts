import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: '@dta/figma',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
