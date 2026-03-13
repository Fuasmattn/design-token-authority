# TICKET-007: Build a proper CLI with subcommands

**Phase:** 2 — Developer Experience
**Priority:** High
**Effort:** M

## Summary

Replace bare `npm run` scripts with a proper CLI (`figma-tokens`) that exposes named subcommands, help text, and flags. This is the prerequisite for the tool to be usable by other projects without forking.

## Background

Currently the tool is driven by two npm scripts pointing at TypeScript files. There is no:
- Help text or usage documentation
- Argument validation
- `--dry-run`, `--output`, `--verbose` flags
- Entry point that other projects can invoke via `npx`

A proper CLI turns this project into a distributable tool rather than a template to copy.

## Acceptance Criteria

- [ ] CLI entrypoint at `src/cli.ts`, compiled to `dist/cli.js` with a `bin` field in `package.json`
- [ ] Subcommands: `pull`, `push`, `build`, `init` (init stubbed, implemented in TICKET-015)
- [ ] `--help` works at the root level and per subcommand
- [ ] `--dry-run` flag on `push` — logs what would change without calling the Figma API
- [ ] `--output <dir>` flag on `pull` — overrides token output directory (already partially supported)
- [ ] `--config <path>` flag on all commands — points to project config file (TICKET-008)
- [ ] `--verbose` flag enables debug-level logging
- [ ] Exit codes: `0` on success, `1` on error, `2` on validation failure

## Implementation Notes

Recommended library: [`citty`](https://github.com/unjs/citty) (lightweight, TypeScript-native) or `commander`.

```ts
// src/cli.ts
import { defineCommand, runMain } from 'citty'

const pull = defineCommand({
  meta: { description: 'Export variables from Figma to token JSON files' },
  args: {
    output: { type: 'string', default: 'tokens', description: 'Output directory' },
    config: { type: 'string', description: 'Path to config file' },
  },
  async run({ args }) { /* ... */ },
})

const main = defineCommand({
  subCommands: { pull, push, build, init },
})

runMain(main)
```

`package.json`:
```json
{
  "bin": { "figma-tokens": "./dist/cli.js" }
}
```

## Dependencies

- TICKET-008 (config schema) — CLI loads and validates config
