# TICKET-039: Remove the legacy code cleanly

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** all porting tickets of Epics 2–6 (written in advance so the exit is planned, not improvised)
**Status:** blocked
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md) · [ADR 0001](../adr/0001-strangler-rewrite.md)

## What to build

Delete the frozen legacy tree and everything that only exists to serve it, in one reviewable PR, after parity is proven. Nothing may be deleted before its row in the parity table below is green.

## Parity table (fill in as porting tickets land)

Every legacy command, module and behaviour needs an owner and a proof. "Dropped" is allowed, but only as an explicit, reviewed decision.

| Legacy | New home | Proof of parity | Status |
|---|---|---|---|
| `build` (CSS, JS, Tailwind v3/v4, per-brand) | `@dta/build` (TICKETs 049–054) | Package parity against `test/snapshots/*/build/files/output/{css,js,tailwind}`; CLI snapshot `build` once wired (Epic 6) | package done; CLI `build` ported, snapshot green with one intended change (062); legacy `commands/build.ts`, `style-dictionary.config.ts` deleted at the cut-over (066) |
| `formatters/tailwind-v4.ts` | `@dta/build` (TICKET-052) | Snapshot parity (brand-ab, daisyui) and legacy formatter cases re-expressed through `buildOutputs` | build side done; legacy file deleted with the legacy build command |
| `formatters/tailwind-v3.ts` | `@dta/build` (TICKET-053) | Same, for v3 | build side done; legacy file deleted with the legacy build command |
| `lint` (rules, config validation; `linter.ts`, lint config types) | `@dta/lint` (TICKETs 055–058) | Package parity against the violations in `test/snapshots/*/lint/stdout.txt`; CLI snapshot `lint` once wired (Epic 6) | package done (055–058); CLI `lint` ported and snapshot green (060); legacy files deleted at the cut-over (066); `contrastRatio` duplicate covered by core |
| `graph` analysis (nodes, edges, cycles, dangling, orphans, depth, stats) | `@dta/core` (TICKET-043) | Core tests incl. numbers equal to legacy `graph-console` snapshots on both fixtures | core done; legacy `graph.ts` deleted with the formatters |
| `graph` report formatters (console, dot, markdown, html) and directory reading | `@dta/cli` (CLI epic) | CLI snapshots `graph-*` | open |
| `pull` (API and `--from-file`, importers, format detection) | `@dta/figma` | Package tests + fake-Figma roundtrip (037); add `pull` CLI snapshot | open |
| `push` (diff, confirmation, `--yes`, `--dry-run`, `--skip-lint`, never deletes) | `@dta/figma` | Package tests + payload assertion on the fake (037) | open |
| `analyze` (structure autodiscovery; Figma-response and token-file variants) | `@dta/core` (TICKET-048, on the model) + `@dta/cli` report | Core tests; add `analyze` CLI snapshot | core side done (`analyzeStructure`); text report and legacy `analyze.ts` deleted with the `analyze` command |
| `init` (wizard) | `@dta/cli` | CLI tests with scripted prompts | open |
| `clean` | `@dta/cli` | CLI tests on a temp copy of a fixture | open |
| docs site generator (`formatters/docs-html.ts`) | `@dta/docs` (port, TICKET-061); Epic 7 redesigns | Output byte-identical to `output/docs/index.html` in both fixtures (`@dta/docs`, TICKET-061); the redesign is Epic 7 | package done; legacy `formatters/docs-html.ts` deleted at the cut-over (066) |
| `test:visual` (Playwright) | Epic 8 visual-diff | Explicit "replaced by Epic 8" decision | open |
| `token_types.ts` | `@dta/core` (model, parse/serialize; TICKET-040) | Core tests incl. byte-identical round trip of both fixtures | core done; legacy file deleted when figma/build no longer import it |
| `color.ts` (and `contrastRatio` in `linter.ts`) | `@dta/core` (TICKET-041) | Legacy color tests re-expressed through the core API | core done; legacy deleted with its last importer (`token_import`, `token_export`, `linter`) |
| `figma_api.ts` | `@dta/figma` (TICKET-044) | Client tests against the Figma fake | figma side done; legacy file deleted with its last importer (`pull`/`push` commands) |
| `importers/tokenhaus.ts`, `importers/detect.ts` | `@dta/figma` (TICKET-047) | Legacy importer tests re-expressed through `importPluginExport` / `detectFormat` | figma side done; legacy files deleted with `pull` (`--from-file`). **Keep-or-drop of the tokenHaus adapter:** keep until the CLI parity work (Epic 6) shows nobody needs `--from-file` with it; then delete `adapters/tokenhaus.ts` and its list entry, nothing else changes |
| `importers/analyze-tokens.ts` | `@dta/core` (TICKET-048) | Cross-checked against legacy output (differences listed in the ticket) | core side done; legacy file deleted with the `analyze` command |
| `token_export.ts` (TICKET-045, figma side done), `token_import.ts` (TICKET-046, figma side done), `utils.ts` | `@dta/figma` / `@dta/cli` | Ported unit tests (legacy tests re-expressed through the new public APIs) | open |
| Legacy entrypoints `sync_*`, `dta.config.ts` loader | `@dta/cli` | Config tests (036) | open |

## Delete as you go

A row turning green means its legacy files are deleted in the same PR (labeled `legacy-exception`), not left for the end. Example: once `@dta/core` covers `color`, `graph` and `token_types` with ported tests, the matching legacy files and their tests go. Only what other legacy code still imports stays until its dependents are ported. The final removal PR then only handles the leftovers in the checklist below.

## Quirk decisions

Each legacy quirk is either copied (snapshot stays) or fixed (reviewed snapshot diff in the PR that fixes it). Record the decision here.

| Quirk | Decision |
|---|---|
| Build summary prints `build/js/colorpalette.js` but writes `output/js/…` | fixed: `@dta/build` and the CLI report the real path (`output/js/colorpalette.js`); recorded as `INTENDED_CHANGES` in the CLI snapshot test (062) |
| JS palette directory is hardcoded to `output/js/` | copied for now (not configurable); revisit after parity |
| A brand token aliasing its own path is dropped together with the primitive it shadows | copied (covered by a test in `@dta/build`); revisit after parity |
| Version hardcoded as `0.1.0` in `theme.ts` / `cli.ts` | open |
| Legacy export always writes `$description` (empty string if none) | copied (`variablesToModel`, TICKET-045) |
| Legacy payload omits the alpha channel when it is 1 | copied (`planPush`, TICKET-046) |
| `color-contrast` only compares raw hex, skips aliased/missing tokens, looks up by in-file name in any mode (last wins) | copied (`@dta/lint`, pinned by tests, TICKET-057) |
| `no-duplicate-values` groups across all collections and modes by `type:value` | copied (`@dta/lint`, pinned by tests, TICKET-057) |
| Other quirks listed in `test/snapshots/README.md` | open |

## Removal checklist

- [ ] Parity table has no `open` rows; every "dropped" row links to its decision
- [ ] Quirk table has no `open` rows
- [ ] Delete `src/`, `dist/`, `style-dictionary.config.ts`, `cleanup.sh` and `test/visual/` (unless Epic 8 reuses it)
- [ ] Root `package.json`: remove legacy `dta` / `design-token-authority` bin, `build`, `build:cli`, `prepare`, `sync-*`, `test:visual*` scripts and dependencies only legacy used; the new CLI takes the `dta` bin name
- [ ] Remove the `legacy` project from `vitest.config.ts` and the legacy `tsc` step from `typecheck`
- [ ] Delete `scripts/snapshots/capture-legacy.ts` and the `snapshot:capture` script; turn `snapshot:check` into a plain "snapshots match" run (the snapshot tests already do this)
- [ ] Update `test/snapshots/README.md`: snapshots are now permanent references that were recorded from legacy; they can no longer be re-recorded
- [ ] Remove the `PENDING` list in `packages/cli/test/snapshots.test.ts` (must be empty by now)
- [ ] Remove `guardrails.yml` / `legacy-frozen` script and its tests; remove the legacy rules from CLAUDE.md
- [ ] Update CLAUDE.md: source structure, commands, remove stale references (including the missing sync workflows)
- [ ] Update README, CHANGELOG and the v1 → v2 migration note (config changes)
- [ ] Remove or archive the legacy test fixtures and recordings only if nothing uses them
- [ ] Changeset for the v2.0.0 release; legacy `dta` stops being published
- [ ] All gates green: `prettier:check`, `typecheck`, `guardrails:boundaries`, `test`, `snapshot:check`
- [ ] `git grep` for `src/` paths, `legacy` and `.js` imports from `src/` finds no leftovers

## Notes

- Do the deletion in a PR labeled `legacy-exception` (the freeze guardrail would otherwise fail it).
- If a row can't be proven by a snapshot, a package test through the public API must cover it first. Do not delete on a hunch.
- Keep this ticket's tables current in every porting ticket; a porting ticket is not done until its row here is updated.
