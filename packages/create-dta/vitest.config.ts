import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    name: 'create-dta',
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
