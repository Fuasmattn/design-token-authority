# TICKET-157: Remove dead scripts, unused exports and stale branches

**Phase:** 13 — Maintenance
**Priority:** Low
**Effort:** XS
**Status:** in review (2026-10-26), branch `157-dead-scripts`; the branches wait for the maintainer's go-ahead
**Spec:** [maintenance](../specs/maintenance.md)

## What to build

1. **Dead scripts.** Delete `scripts/list-scopes.mjs` and `scripts/restore-dtcg-keys.mjs` (the second is a one-off from TICKET-002). Nothing references either (checked with `knip` and `git grep`).
2. **Unused exports.** `knip` lists about 20 exports nothing imports (for example `parseModeSelection`, `describeDetection`, `FLAT_TOLERANCE`, `GROUP_GAP`, several in `actions/lib/dta-diff.mjs`). Drop the `export` where it is not public API or used by a test; keep what a package's entry point exposes on purpose.
3. **Stale branches** (with the maintainer's confirmation, deleting is hard to undo):
   - merged: `153-workflow-list`, `plan/token-engine-overhaul` (check first that Vercel no longer builds previews from it)
   - misnumbered aliases of the flake-fix branch (pull request #38 carries it as `170-workflow-dust`, ticket 172): `168-workflow-dust`, `172-workflow-dust`
   - no open pull request: `test/dta-diff-component`, `test/dta-diff-icon`, `test/dta-diff-node24`, `test/dta-diff-token`, `dependabot/npm_and_yarn/axios-1.14.0`, `dependabot/npm_and_yarn/typescript-5.9.3`
   - keep: `dta-diff-assets` (the assets-branch recipe) and `sample/dta-diff-demo` (demo pull request #20)

## Acceptance criteria

- [x] Scripts deleted; safety check of the spec green
- [x] Unused exports reduced; public entry points unchanged (`package:build` types unchanged)
- [ ] Branches deleted after the maintainer's go-ahead; the list in this ticket matches what was deleted

## Notes

`knip` without a config also reports the root `package.json` dependencies as unused; they are bundled into the npm package, so that finding is wrong. Adding a `knip` config is out of scope.

Outcome (2026-10-26): `scripts/list-scopes.mjs` and `scripts/restore-dtcg-keys.mjs` deleted. 22 exports made module-private across `actions/lib/dta-diff.mjs`, `@dta/cli` (audit, commands, context, init), `@dta/core` (`parse.ts`'s internal `detectFormat`; the public one is `@dta/figma`'s), `@dta/testkit`, `@dta/visual-diff` and the site's `graph-layout.ts`. One of them, `LANGUAGES` in `audit/detect.ts`, was dead entirely and is gone. Two knip findings were wrong and kept: `TOKEN_TYPES` (public, exported from `@dta/core`'s index via `values.ts`; only the stale re-export in `entries.ts` was removed) and `GROUP_GAP` in `packages/cli/src/graph/html.ts` (a different constant of the same name). No behaviour change; `dist/index.d.ts` identical.
