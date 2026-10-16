# TICKET-039: Remove the legacy code cleanly

**Phase:** 8 — Token Engine Overhaul, Epic 6 (CLI parity and legacy removal)
**Priority:** High
**Effort:** M
**Blocked by:** all porting tickets of Epics 2–6 (written in advance so the exit is planned, not improvised)
**Status:** done
**Spec:** [token-engine-overhaul](../specs/token-engine-overhaul.md) · [ADR 0001](../adr/0001-strangler-rewrite.md)

## What to build

Delete the frozen legacy tree and everything that only exists to serve it, in one reviewable PR, after parity is proven. Nothing may be deleted before its row in the parity table below is green.

## Parity table (fill in as porting tickets land)

Every legacy command, module and behaviour needs an owner and a proof. "Dropped" is allowed, but only as an explicit, reviewed decision.

| Legacy | New home | Proof of parity | Status |
|---|---|---|---|
| `build` (CSS, JS, Tailwind v3/v4, per-brand) | `@dta/build` (TICKETs 049–054) | Package parity against `test/snapshots/*/build/files/output/{css,js,tailwind}`; CLI snapshot `build` once wired (Epic 6) | package done; CLI `build` ported, snapshot green with one intended change (062); legacy `commands/build.ts`, `style-dictionary.config.ts` deleted (039) |
| `formatters/tailwind-v4.ts` | `@dta/build` (TICKET-052) | Snapshot parity (brand-ab, daisyui) and legacy formatter cases re-expressed through `buildOutputs` | done; legacy file deleted (039) |
| `formatters/tailwind-v3.ts` | `@dta/build` (TICKET-053) | Same, for v3 | done; legacy file deleted (039) |
| `lint` (rules, config validation; `linter.ts`, lint config types) | `@dta/lint` (TICKETs 055–058) | Package parity against the violations in `test/snapshots/*/lint/stdout.txt`; CLI snapshot `lint` once wired (Epic 6) | package done (055–058); CLI `lint` ported and snapshot green (060); legacy files deleted (039); `contrastRatio` duplicate covered by core |
| `graph` analysis (nodes, edges, cycles, dangling, orphans, depth, stats) | `@dta/core` (TICKET-043) | Core tests incl. numbers equal to legacy `graph-console` snapshots on both fixtures | done; legacy `graph.ts` deleted (039) |
| `graph` report formatters (console, dot, markdown, html) and directory reading | `@dta/cli` (CLI epic, TICKET-063) | CLI snapshots `graph-*` | done: all four formats green on both fixtures; legacy `graph.ts`, `commands/graph.ts` deleted (039) |
| `pull` (API and `--from-file`, importers, format detection) | `@dta/figma` + `@dta/cli` (TICKET-065) | Package tests + fake-Figma roundtrip (037); CLI snapshots `pull-api`, `pull-from-file` | done; legacy `commands/pull.ts` deleted (039) |
| `push` (diff, confirmation, `--yes`, `--dry-run`, `--skip-lint`, never deletes) | `@dta/figma` + `@dta/cli` (TICKET-065) | Package tests + payload assertion on the fake (037); CLI snapshots `push-*` | done; legacy `commands/push.ts` deleted (039) |
| `analyze` (structure autodiscovery; Figma-response and token-file variants) | `@dta/core` (TICKET-048, on the model) + `@dta/cli` report | Core tests; add `analyze` CLI snapshot | core side done (`analyzeStructure`); CLI `analyze` ported, snapshot green on brand-ab (064); legacy `analyze.ts`, `commands/analyze.ts` deleted (039) |
| `init` (wizard) | `@dta/cli` (TICKET-066) | CLI tests with scripted prompts (both Figma plan paths; generated config loaded through the config schema) | done; legacy `commands/init.ts` and its test deleted (039) |
| `clean` | `@dta/cli` (TICKET-064) | Snapshot `clean` (both fixtures) + CLI tests on temp dirs | done; legacy `commands/clean.ts` deleted (039) |
| docs site generator (`formatters/docs-html.ts`) | `@dta/docs` (port, TICKET-061); Epic 7 redesigns | Output byte-identical to `output/docs/index.html` in both fixtures (`@dta/docs`, TICKET-061); the redesign is Epic 7 | package done; legacy `formatters/docs-html.ts` deleted (039) |
| `test:visual` (Playwright) | Epic 8 visual-diff | Explicit "replaced by Epic 8" decision | done: decision 10 of the CLI parity spec; the command stays registered, prints where to run the tests and exits 3; no workflow uses it (checked in 066); legacy `commands/test-visual.ts` deleted (039) |
| `token_types.ts` | `@dta/core` (model, parse/serialize; TICKET-040) | Core tests incl. byte-identical round trip of both fixtures | done; legacy file deleted (039) |
| `color.ts` (and `contrastRatio` in `linter.ts`) | `@dta/core` (TICKET-041) | Legacy color tests re-expressed through the core API | done; legacy file deleted (039) |
| `figma_api.ts` | `@dta/figma` (TICKET-044) | Client tests against the Figma fake | done; legacy file deleted (039) |
| `importers/tokenhaus.ts`, `importers/detect.ts` | `@dta/figma` (TICKET-047) | Legacy importer tests re-expressed through `importPluginExport` / `detectFormat` | done; legacy files deleted (039). tokenHaus adapter **kept** (decided in 065, covered by a CLI test); dropping it later means deleting `adapters/tokenhaus.ts` and its list entry |
| `importers/analyze-tokens.ts` | `@dta/core` (TICKET-048) | Cross-checked against legacy output (differences listed in the ticket) | done; legacy file deleted (039) |
| `token_export.ts` (TICKET-045, figma side done), `token_import.ts` (TICKET-046, figma side done), `utils.ts` | `@dta/figma` / `@dta/cli` | Ported unit tests (legacy tests re-expressed through the new public APIs) | done: `variablesToModel` / `planPush` in `@dta/figma`, file-name helpers in `@dta/cli` (`util-names.ts`); legacy files deleted at the cut-over (039) |
| Legacy entrypoints `sync_*`, `dta.config.ts` loader | `@dta/cli` | Config tests (036) | done: `sync_*` dropped (the `sync-*` npm scripts are removed; `dta pull` / `dta push` replace them), loader replaced by `packages/cli/src/config/load.ts`; legacy files deleted at the cut-over (039) |

## Delete as you go

A row turning green means its legacy files are deleted in the same PR (labeled `legacy-exception`), not left for the end. Example: once `@dta/core` covers `color`, `graph` and `token_types` with ported tests, the matching legacy files and their tests go. Only what other legacy code still imports stays until its dependents are ported. The final removal PR then only handles the leftovers in the checklist below.

## Quirk decisions

Each legacy quirk is either copied (snapshot stays) or fixed (reviewed snapshot diff in the PR that fixes it). Record the decision here.

| Quirk | Decision |
|---|---|
| Build summary prints `build/js/colorpalette.js` but writes `output/js/…` | fixed: `@dta/build` and the CLI report the real path (`output/js/colorpalette.js`) (062); snapshot re-recorded (039) |
| JS palette directory is hardcoded to `output/js/` | copied for now (not configurable); revisit after parity |
| A brand token aliasing its own path is dropped together with the primitive it shadows | copied (covered by a test in `@dta/build`); revisit after parity |
| Version hardcoded as `0.1.0` in `theme.ts` / `cli.ts` | fixed: `dta --version` prints the version of `package.json` (066) |
| Legacy export always writes `$description` (empty string if none) | copied (`variablesToModel`, TICKET-045) |
| Legacy payload omits the alpha channel when it is 1 | copied (`planPush`, TICKET-046) |
| `color-contrast` only compares raw hex, skips aliased/missing tokens, looks up by in-file name in any mode (last wins) | copied (`@dta/lint`, pinned by tests, TICKET-057) |
| `no-duplicate-values` groups across all collections and modes by `type:value` | copied (`@dta/lint`, pinned by tests, TICKET-057) |
| `clean` deleted the whole top-level directory of any configured outDir (`src/styles` removed `src/`) | fixed: only configured output folders and the build defaults, then empty parents; outside-project folders refused (064) |
| `push` printed `Local variable collections in Figma file: [...]` (debug `console.log`) | fixed: removed (065); snapshots re-recorded (039) |
| `pull` wrote token files without a final newline | fixed: new files end with a newline; existing files keep their formatting (065); snapshot re-recorded (039) |
| `graph --format html` always opens a browser | copied (opening goes through the injectable `openFile`, so tests do not launch one) |
| `lint` exits 2 on errors, 0 on warnings | copied (decision 7 of the CLI parity spec) |
| `graph` console report truncates long lists | copied (snapshot stays) |
| `init` printed an animated logo and rewrote the terminal title every 400 ms | dropped: static banner only (066); the title animation never reset on a crash |
| `init` opened `build/docs/index.html`, which `dta build` does not write by default | fixed: opens the configured docs folder (default `output/docs`) (066) |
| `init` copied script names (`sync-figma-to-tokens`) into `.env.example` | fixed: names `dta pull` / `dta push` (066) |
| `init` cancelled with `process.exit(0)` from anywhere | fixed: cancelling returns exit code 0 through the normal path, nothing is written (066) |

## Removal checklist

- [x] Parity table has no `open` rows; every "dropped" row links to its decision
- [x] Quirk table has no `open` rows
- [x] Delete `src/`, `dist/` (untracked, ignored), `style-dictionary.config.ts`, `cleanup.sh`; `test/visual/` stays until Epic 8 (spec decision 10 of the CLI parity spec)
- [x] Root `package.json`: removed `build`, `build:cli`, `prepare`, `snapshot:capture`, `guardrails:legacy` and every runtime dependency except `tsx` (the bin entry needs it); `sync-*` were already gone (066); `test:visual*` stay until Epic 8; the new CLI already owns the `dta` bin (066)
- [x] Remove the `legacy` project from `vitest.config.ts` and the legacy `tsc` step (and root `tsconfig.json`) from `typecheck`
- [x] Replace `scripts/snapshots/capture-legacy.ts`: **decision (maintainer, 039):** snapshots stay re-recordable, but from the CLI and only per named scenario: `pnpm snapshot:record --scenario <fixture>/<scenario>` (`scripts/snapshots/record.ts`, no record-all mode). `snapshot:check` runs the CLI snapshot test
- [x] Fold the reviewed `INTENDED_CHANGES` into the snapshot files (re-recorded `build` on both fixtures, `pull-api` and the five `push-*` scenarios on brand-ab; the diff contains exactly the quirk fixes above) and remove `INTENDED_CHANGES` and `PENDING` from `packages/cli/test/snapshots.test.ts`
- [x] Update `test/snapshots/README.md`: reference snapshots recorded from v1, re-recorded only on purpose per named scenario
- [x] The testkit roundtrip test (recording ⇄ fixture) uses the CLI instead of v1 (`figma-roundtrip.test.ts`)
- [x] Remove `guardrails.yml` / `legacy-frozen` script and its tests; remove the legacy rules from CLAUDE.md
- [x] Update CLAUDE.md: source structure, commands, conventions, testing, stale build-pipeline and tech-debt sections
- [x] Update README, CHANGELOG and the v1 → v2 migration note (`docs/migration/v1-to-v2.md`)
- [x] Changeset (`@dta/cli` major); publishing itself is part of a later release ticket (packages are still private)
- [x] Fix found on the way: `bin/dta.js` failed under plain `node` (Node's type stripping does not resolve the `.js` specifiers); it now registers `tsx`, covered by `packages/cli/test/bin.test.ts`
- [x] All gates green: `prettier:check`, `typecheck`, `guardrails:boundaries`, `test`, `snapshot:check`
- [x] `git grep` for `src/` paths, `legacy` and `.js` imports from `src/` finds no leftovers (remaining mentions are history in docs/tickets, specs and ADRs; package comments say "v1")

## Notes

- Landed as a direct commit on `plan/token-engine-overhaul` (maintainer decision); the freeze guardrail is deleted in the same commit, so no `legacy-exception` label was needed.
- If a row can't be proven by a snapshot, a package test through the public API must cover it first. Do not delete on a hunch.
- Keep this ticket's tables current in every porting ticket; a porting ticket is not done until its row here is updated.
