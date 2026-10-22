# TICKET-133: `$ref`, `$root`, `$extends` and aliases inside composite values

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** M
**Blocked by:** 132
**Status:** open
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 5, 6; slice 2)

## What to build

- `$ref` (JSON Pointer, `~0`/`~1` escapes) in values and sub-values, for example `#/colors/blue/$value/components/0`; within the token set only.
- Curly aliases inside composite sub-values (`shadow.color`, `typography.fontSize` …); still whole tokens only.
- `$root` as an ordinary token named `$root` (`{color.accent.$root}`); `{color.accent}` stays invalid.
- `$extends` on groups: deep merge, a local token replaces the inherited one entirely; target must be a group; cycles reported for every group in them.
- References stay unresolved in the model and resolve late; cycles reported for every token in them.
- `dta graph` and the graph analysis show sub-value references.

## Acceptance criteria

- [ ] Package tests from the report's examples for each feature, including every error case named in the report
- [ ] `dta token get` shows the chain through `$ref` and composite sub-values
- [ ] Existing snapshots unchanged
- [ ] All gates pass, and the GitHub run is green
