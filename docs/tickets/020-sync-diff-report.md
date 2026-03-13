# TICKET-020: Human-readable diff report on sync

**Phase:** 5 — Quality & Validation
**Priority:** Medium
**Effort:** S

## Summary

Improve the `push` command's change reporting to produce a clear, structured diff that shows exactly what will change in Figma before (and after) syncing. The current output is functional but minimal.

## Background

The existing `sync_tokens_to_figma.ts` already logs changes (new collections, modes, variables, value updates), but the format is a raw console dump. For a tool used in CI with pull request workflows, a structured diff report is much more useful — it can be posted as a PR comment, reviewed before merging, and archived.

## Acceptance Criteria

- [ ] `figma-tokens push --dry-run` outputs a full diff without making any API calls
- [ ] Diff categorizes changes: Added / Removed (if deletion is later supported) / Modified / Unchanged
- [ ] Per-variable diff shows: token path, old value → new value, which collection and mode
- [ ] Summary counts at the top: `+12 added, ~5 modified, 0 removed`
- [ ] `--format` flag: `console` (default, colored), `markdown` (for PR comments), `json` (for tooling)
- [ ] Markdown format is designed to be posted as a GitHub PR comment via `gh pr comment`
- [ ] GitHub Actions workflow updated to run `push --dry-run --format markdown` and post as PR comment on `sync-figma-to-tokens` PRs

## Implementation Notes

**Markdown diff output:**
```markdown
## Design Token Changes

**Summary:** +12 added, ~5 modified, 0 removed

### Modified
| Token | Old Value | New Value | Collection | Mode |
|---|---|---|---|---|
| Colors.Brand.Primary | `#003f8a` | `#0044aa` | Brand(Alias) | Bayernwerk |
| Spacing.Base | `16` | `20` | ScreenType | Desktop |

### Added
| Token | Value | Collection | Mode |
|---|---|---|---|
| Colors.Interactive.Focus | `#0077ff` | Brand(Alias) | Bayernwerk |
```

**JSON format:**
```json
{
  "summary": { "added": 12, "modified": 5, "removed": 0 },
  "changes": [
    { "type": "modified", "path": "Colors.Brand.Primary", "oldValue": "#003f8a", "newValue": "#0044aa", ... }
  ]
}
```

## Dependencies

- TICKET-007 (CLI — `--dry-run` and `--format` flags)
