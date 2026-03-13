# TICKET-007: Build a proper CLI with subcommands

**Phase:** 2 — Developer Experience
**Priority:** High
**Effort:** M

## Summary

Replace bare `npm run` scripts with a proper CLI (`dtf`) that exposes named subcommands, help text, and flags. This is the prerequisite for the tool to be usable by other projects without forking.

## Background

Currently the tool is driven by two npm scripts pointing at TypeScript files. There is no:

- Help text or usage documentation
- Argument validation
- `--dry-run`, `--output`, `--verbose` flags
- Entry point that other projects can invoke via `npx`

A proper CLI turns this project into a distributable tool rather than a template to copy.

## Acceptance Criteria

- [x] CLI entrypoint at `src/cli.ts`, compiled to `dist/cli.js` with a `bin` field in `package.json`
- [x] Subcommands: `pull`, `push`, `build`, `init` (init stubbed, implemented in TICKET-015)
- [x] `--help` works at the root level and per subcommand
- [x] `--dry-run` flag on `push` — logs what would change without calling the Figma API
- [x] `--output <dir>` flag on `pull` — overrides token output directory (already partially supported)
- [x] `--config <path>` flag on all commands — points to project config file (TICKET-008)
- [x] `--verbose` flag enables debug-level logging
- [x] Exit codes: `0` on success, `1` on error, `2` on validation failure
- [x] `push` command validates config and token changes before applying, exits with code `2` if validation fails
- [x] `push` command needs additional confirmation from the user as it will modify the Figma file (e.g. "Are you sure you want to push changes to Figma? (y/N)")
- [x] cli tool uses ASCII output, a ASCII farm logo (to be designed in pairing when working on this ticket) and colors for better readability (e.g. green for success, red for errors)

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
  async run({ args }) {
    /* ... */
  },
})

const main = defineCommand({
  subCommands: { pull, push, build, init },
})

runMain(main)
```

`package.json`:

```json
{
  "bin": { "dtf": "./dist/cli.js" }
}
```

## Dependencies

- TICKET-008 (config schema) — CLI loads and validates config

---

## Implementation Comments

**2026-03-13 — Initial implementation merged.**

- **Library choice:** Used `commander` (v12, already available as transitive dep)
  instead of `citty`. `citty` could not be installed (npm registry unavailable).
  Commander is well-maintained, supports subcommands, auto-generated help, and all
  the flags specified in the acceptance criteria.
- CLI entrypoint: `src/cli.ts`. During dev, run via `npm run dtf -- <command>`.
  The `bin` field in `package.json` points to `./dist/cli.js` for distribution via npx.
- **ASCII logo:** A simple farmhouse ASCII art is shown in `--help` output,
  matching the "Design Token Farm" project name. The exact design can be refined later.
- **`init` is a stub:** Writes a template `dtf.config.ts`. Full wizard
  implementation is deferred to TICKET-015.
- **`build` command:** Inlines the Style Dictionary transform registrations from
  `style-dictionary.config.ts` and reads token source / output dirs from config.
  This duplicates the transform code for now; a future refactor (post output-target
  tickets) should extract shared transforms into a module.
- **`push` confirmation:** Uses `readline` to prompt "Are you sure?" before applying
  changes. `--dry-run` skips the API call entirely.
- Exit codes: 0 success, 1 runtime error, 2 validation/config error.
- Tests in `src/cli.test.ts` verify help output and error handling.
