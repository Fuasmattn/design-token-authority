# TICKET-025: Switch from Jest to Vitest

**Status:** ✅ Done — commit `e65e751`
**Phase:** 1 — Foundation
**Priority:** Medium
**Effort:** S

## Summary

Replace Jest + ts-jest with Vitest. Vitest is faster, requires no TypeScript preprocessing config, and is better aligned with modern ESM projects. It also shares the same `describe`/`it`/`expect` API, so test files need minimal changes.

## Background

The current test setup uses `jest` + `ts-jest` + a `jest.config.ts` with module name mapping to handle `.js` ESM imports in TypeScript. This configuration is fiddly and adds two heavy dev dependencies. Vitest handles ESM and TypeScript natively without a preprocessor step.

Additional benefits:
- Built-in watch mode is faster (uses Vite's module graph)
- `vitest ui` provides a browser-based test runner
- Compatible with the same `expect` and `vi` (jest-compatible) APIs — minimal migration effort
- First-class support for coverage via `@vitest/coverage-v8` (no `jest-coverage` config needed)

## Acceptance Criteria

- [x] `jest`, `ts-jest`, `@types/jest` removed from `devDependencies`
- [x] `vitest` added to `devDependencies`
- [x] `jest.config.ts` deleted
- [x] `vitest.config.ts` added with equivalent settings (`globals: true`)
- [x] All existing tests pass unchanged (`jest.mock` → `vi.mock` was the only change)
- [x] `npm test` runs Vitest
- [ ] `npm run test:ui` added as a script for the Vitest browser UI (optional, skipped)
- [x] `npm run test:coverage` added for coverage reports
- [x] CI workflow (`test.yml`) — no changes needed, `npm run test` still works

## Implementation Notes

**Install:**
```bash
npm remove jest ts-jest @types/jest
npm install -D vitest @vitest/coverage-v8
```

**`vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

**`package.json` scripts:**
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

**Test file changes:** The existing tests use `describe`, `it`, `expect` — all available in Vitest without imports. If any test file uses `jest.fn()`, replace with `vi.fn()` from `'vitest'`. Check with:
```bash
grep -r "jest\." src/
```

**`moduleNameMapper` replacement:** The `jest.config.ts` has module name mapping to strip `.js` from imports. Vitest handles this natively for TypeScript + ESM — no equivalent config needed.

## Dependencies

- None — can be done independently at any point
- Recommended before TICKET-018 (linter) to avoid adding more Jest-dependent test infrastructure
