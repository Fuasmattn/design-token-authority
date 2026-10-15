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
| `build` (CSS, JS, Tailwind v3/v4, per-brand) | `@dta/build` | CLI snapshot `build` (brand-ab, daisyui) | open |
| `lint` | `@dta/lint` | CLI snapshot `lint` | open |
| `graph` (console, dot, markdown, html) | `@dta/core` + `@dta/cli` | CLI snapshots `graph-*` | open |
| `pull` (API and `--from-file`, importers, format detection) | `@dta/figma` | Package tests + fake-Figma roundtrip (037); add `pull` CLI snapshot | open |
| `push` (diff, confirmation, `--yes`, `--dry-run`, `--skip-lint`, never deletes) | `@dta/figma` | Package tests + payload assertion on the fake (037) | open |
| `analyze` (structure autodiscovery) | `@dta/figma` | Package tests; add `analyze` CLI snapshot | open |
| `init` (wizard) | `@dta/cli` | CLI tests with scripted prompts | open |
| `clean` | `@dta/cli` | CLI tests on a temp copy of a fixture | open |
| docs site generator (`formatters/docs-html.ts`) | `@dta/build` or Epic 7 | Snapshot or explicit "replaced by Epic 7" decision | open |
| `test:visual` (Playwright) | Epic 8 visual-diff | Explicit "replaced by Epic 8" decision | open |
| `token_types.ts` | `@dta/core` (model, parse/serialize; TICKET-040) | Core tests incl. byte-identical round trip of both fixtures | core done; legacy file deleted when figma/build no longer import it |
| `color.ts`, `token_export.ts`, `token_import.ts`, `utils.ts` | `@dta/core` / `@dta/figma` | Ported unit tests (legacy tests re-expressed through the new public APIs) | open |
| Legacy entrypoints `sync_*`, `dta.config.ts` loader | `@dta/cli` | Config tests (036) | open |

## Delete as you go

A row turning green means its legacy files are deleted in the same PR (labeled `legacy-exception`), not left for the end. Example: once `@dta/core` covers `color`, `graph` and `token_types` with ported tests, the matching legacy files and their tests go. Only what other legacy code still imports stays until its dependents are ported. The final removal PR then only handles the leftovers in the checklist below.

## Quirk decisions

Each legacy quirk is either copied (snapshot stays) or fixed (reviewed snapshot diff in the PR that fixes it). Record the decision here.

| Quirk | Decision |
|---|---|
| Build summary prints `build/js/colorpalette.js` but writes `output/js/…` | open |
| Version hardcoded as `0.1.0` in `theme.ts` / `cli.ts` | open |
| Legacy export always writes `$description` (empty string if none) | open |
| Legacy payload omits the alpha channel when it is 1 | open |
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
