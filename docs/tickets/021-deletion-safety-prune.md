# TICKET-021: Deletion safety and `prune` command

**Phase:** 5 — Quality & Validation
**Priority:** Low
**Effort:** M
**Status:** in review

## Summary

The current `push` command never deletes variables from Figma, which is safe but causes Figma files to accumulate dead/orphaned tokens over time. Add a `dta prune` command that identifies orphaned variables and offers to clean them up with explicit confirmation.

## Background

When a token is removed from the JSON files and `push` is run, the variable remains in Figma — silently. Over time this creates drift between the token files and the Figma file. The conservative no-delete approach is correct as a default, but there should be a controlled path to clean up.

Deletion via the Figma Variables API requires care: variables that are used in design files (not just referenced by other variables) will cause visual changes if deleted.

## Acceptance Criteria

- [x] `dta prune` command that:
  1. Fetches all variables from Figma
  2. Compares to the local token files
  3. Lists variables present in Figma but absent from local files (orphans)
  4. Shows each orphan with its collection, mode, and current value
  5. Asks for explicit confirmation before deleting
  6. Deletes confirmed orphans via the Figma API
- [x] `--dry-run` flag shows orphans without deleting or prompting
- [x] `--force` flag skips confirmation (for CI use, with explicit opt-in)
- [x] Warning displayed if the Figma API indicates a variable is used in components (if API surface allows this check): it does not, so the warning is always shown before deleting
- [x] Prune is never run automatically as part of `push` — always a separate explicit command

## Implementation Notes

Orphan detection:

```ts
function findOrphanedVariables(
  figmaVariables: LocalVariable[],
  localTokens: FlatTokenMap,
): LocalVariable[] {
  return figmaVariables.filter((v) => {
    const tokenKey = v.name.replace(/\//g, '.')
    return !localTokens.has(tokenKey)
  })
}
```

The Figma API `DELETE /v1/files/{file_key}/variables` endpoint accepts a list of variable IDs. Batch deletions for efficiency.

Note: check whether the API exposes usage information. If not, always warn the user that deleted variables may break component designs.

## Dependencies

- TICKET-007 (CLI subcommand)
- TICKET-020 (diff report — reuse the reporting format for showing orphans)

## Outcome (2026-10-23)

- `@dta/figma`: `planPrune(model, response)` returns the orphans (collection, dot name, value per mode as a token file writes it), the orphans it keeps, and the `POST /v1/files/:key/variables` body with `action: 'DELETE'` (the API has no separate delete endpoint). Deliberately narrow, so a mistake cannot empty a file:
  - only Figma collections that are in the token files are looked at; another collection (never pulled, or left out by `collections`) is left alone with a `prune-collection-skipped` note;
  - library (`remote`) variables are never deleted;
  - an orphan that a staying variable still aliases is kept and named (`← Colors.Text.Muted`), and so is what a kept orphan aliases (until nothing changes): push first, then prune;
  - names are unique across collections, so a token that moved to another collection is not an orphan.
- `dta prune` (`packages/cli/src/commands/prune.ts`): `--dry-run` lists and changes nothing; otherwise a warning that Figma's REST API cannot tell whether components or frames use the variables, then the typed confirmation `delete variables from figma` (`--force` skips it; without a terminal and without `--force` it stops with exit 2). An empty tokens folder stops it (exit 2) rather than making every variable an orphan. `push.skipConfirmation` does not apply: deleting is confirmed on its own.
- Tests: `packages/figma/src/prune.test.ts` (on the brand-ab recording: in sync, an orphan with its values, a kept one, a chain, skipped collections, remote variables), `packages/cli/src/commands/prune.test.ts` (Figma fake: nothing, dry run, `--force` sends exactly the DELETE, the typed phrase, empty folder, no API).
- The agent skill tells agents never to run `dta prune` (only `--dry-run`); `skill-add` snapshot re-recorded.
- Docs: Guides → Figma ("Removing variables: dta prune", output from a run against the fake), Start, Contribute, README; the Commands reference through `--help`.
- After an independent review: entries the parser skips with a warning (`reserved-name`, `unexpected-value`) stop prune (their variables would look orphaned); an empty collection file is treated as not there; a collection that would lose more than half of its variables is left alone unless `--allow-bulk`; `collections` in the config is honoured; names compare in dot form (a key `"Spacing.4"` matches Figma's `Spacing/4`); `deletedButReferenced` variables are parsed now and neither deleted nor counted as aliasing (and `dta pull` no longer writes them as tokens); two Figma collections with one name stop prune, as they stop push.
- Not verified against a real Figma file (the fake does not apply writes): step 7 of `docs/testing/figma-smoke-test.md` (added) does that on a test file before the release.
