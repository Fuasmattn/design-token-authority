# TICKET-104: Guide "DTA with coding agents" and the landing page copy

**Phase:** 9 — Agent interop
**Priority:** Medium
**Effort:** S
**Blocked by:** 101, 102 (the audit section follows 103)
**Status:** open
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 7)

## What to build

- Guide `guides/coding-agents`: install the skill, generate the context, the loop an agent follows, token queries, CI with `dta audit` (once 103 ships), with output from real runs on the fixtures.
- Landing page "With your agent": "A skill and an MCP server" becomes "A skill and token queries"; items are marked coming until they ship and lose the label when they do (the honesty rule).
- `llms.txt` lists the guide (automatic through the generator).

## Acceptance criteria

- [ ] Guide written from real runs; landing copy matches what ships
- [ ] All gates pass plus the site job, and the GitHub run is green
