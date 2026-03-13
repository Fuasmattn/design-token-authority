# TICKET-021: Deletion safety and `prune` command

**Phase:** 5 — Quality & Validation
**Priority:** Low
**Effort:** M

## Summary

The current `push` command never deletes variables from Figma, which is safe but causes Figma files to accumulate dead/orphaned tokens over time. Add a `figma-tokens prune` command that identifies orphaned variables and offers to clean them up with explicit confirmation.

## Background

When a token is removed from the JSON files and `push` is run, the variable remains in Figma — silently. Over time this creates drift between the token files and the Figma file. The conservative no-delete approach is correct as a default, but there should be a controlled path to clean up.

Deletion via the Figma Variables API requires care: variables that are used in design files (not just referenced by other variables) will cause visual changes if deleted.

## Acceptance Criteria

- [ ] `figma-tokens prune` command that:
  1. Fetches all variables from Figma
  2. Compares to the local token files
  3. Lists variables present in Figma but absent from local files (orphans)
  4. Shows each orphan with its collection, mode, and current value
  5. Asks for explicit confirmation before deleting
  6. Deletes confirmed orphans via the Figma API
- [ ] `--dry-run` flag shows orphans without deleting or prompting
- [ ] `--force` flag skips confirmation (for CI use, with explicit opt-in)
- [ ] Warning displayed if the Figma API indicates a variable is used in components (if API surface allows this check)
- [ ] Prune is never run automatically as part of `push` — always a separate explicit command

## Implementation Notes

Orphan detection:
```ts
function findOrphanedVariables(
  figmaVariables: LocalVariable[],
  localTokens: FlatTokenMap
): LocalVariable[] {
  return figmaVariables.filter(v => {
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
