# TICKET-117: Make `outputs.css.prefix` work (or remove it)

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Low
**Effort:** M
**Blocked by:** —
**Status:** in review

## Problem

The config schema has `outputs.css.prefix`, but `dta build` ignores it (found in TICKET-079, 2026-10-19). A key that does nothing is a broken promise; the playground does not offer it for that reason.

## What to build

Either implement the prefix end to end (CSS and Tailwind v4 variable names, and everything that reads them: `dta diff` attribution, `dta audit`, `dta token get`), with snapshot changes recorded by name, or remove the key from the schema with a clear config error. Then offer it in the playground's output options (079) if implemented.

## Decision

**Remove** (maintainer, 2026-10-21). The key goes from the schema; a config that still sets it fails with a clear error naming the key and saying it was removed; a migration note in the changelog/docs; `dta init` stops writing it. No playground option.

## Acceptance criteria

- [x] Prefix implemented across build and the commands that read variable names, or removed with a migration note (removed; CHANGELOG and the migration guide say so)
- [x] Playground option added if implemented; generated config carries it (not applicable, removed; the playground's generated config never wrote `prefix`)
- [ ] All gates pass, and the GitHub run is green (gates pass locally; GitHub run pending, nothing pushed)

## Outcome

- **Schema** (`packages/cli/src/config/schema.ts`): `outputs.css.prefix` is now `z.never({ error })`, optional, the same pattern as `outputs.docs` (TICKET-067). The `outputs.css` object is a `z.strictObject`, so without this a leftover key would fail as a generic `Unrecognized key: "prefix"` on `outputs.css`; declaring it as `never` makes the specific message the only issue, on the key's own path. Error, as printed (exit code 2):

  ```text
  Invalid configuration in <cwd>/dta.config.ts:
    outputs.css.prefix: was removed: it never had an effect (CSS variable names always start with --). Delete this line.
  ```

  Its description ("Removed; rejected. It never had an effect: delete the line.") is the row on the generated Configuration reference, which is the site's place for rejected keys (`outputs.docs` has a row there too); the published `dta.config.schema.json` has `"prefix": { "not": {} }`. Both are generated at site build (gitignored), nothing edited by hand. The default `'--'` is gone, so a loaded config no longer has `outputs.css.prefix`.

- **`dta init`** no longer writes `prefix: '--'` in the `css` block (`init-config.ts`); the block is `css: { outDir: 'build/css' }`.
- **Nothing read it.** Repo-wide grep: no code in `@dta/build`, `cssBindings`, `dta audit` or `dta token` used `outputs.css.prefix`; build output is unchanged, so no snapshot changed and none was re-recorded (`snapshot:check` 41 passed). No fixture, example, README, spec or action sets the key; closed tickets that mention it are left as history.
- **Playground:** `generateConfig` (`site/src/playground/outputs.ts`) only ever wrote `figma`, `tokens`, `brands` and `outputs.formats`; no change, no option.
- **Migration note:** CHANGELOG `Unreleased (2.0.0)` → Breaking changes ("Removed the config key `outputs.css.prefix` … Delete the line; the CSS output does not change."); Guides › Migrating from v1, "Config file" list, next to `outputs.docs`. The v1 source is not in this (shallow) clone, so the guide says only that the build does not use the key.
- **Tests:** `config.test.ts`: a config with `outputs.css.prefix` gives exactly one issue, path `outputs.css.prefix` with the message above, and no "Unrecognized"; output-target defaults no longer include `prefix`. `cli.test.ts`: `dta build` with the key exits 2 and prints `outputs.css.prefix: was removed` and `Delete this line`. `init-config.test.ts` and `init.test.ts`: the generated config has no `prefix`.
- **Docs:** Quick start (the `dta init` excerpt from 118 without `prefix`), Outputs reference ("Not built yet": no prefix option, the key was removed and a config with it fails), migration guide. Core concepts never showed it.
- **Files touched:** `packages/cli/src/config/schema.ts`, `config.test.ts`, `cli.test.ts`, `commands/init-config.ts`, `commands/init-config.test.ts`, `commands/init.test.ts`, `site/src/content/docs/start/quick-start.mdx`, `reference/outputs.mdx`, `guides/migrate-from-v1.mdx`, `CHANGELOG.md`.
- **Gates** (Node 24.14.1): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1185 passed (148 skipped); `snapshot:check` 41 passed, none changed or re-recorded; `pnpm site:build` 137 pages, links valid; `test:contrast` 151 passed. Diff e2e not run: nothing it renders changed. Nothing committed or pushed.
