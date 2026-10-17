# TICKET-104: Guide "DTA with coding agents" and the landing page copy

**Phase:** 9 — Agent interop
**Priority:** Medium
**Effort:** S
**Blocked by:** 101, 102 (the audit section follows 103)
**Status:** done
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 7)

## What to build

- Guide `guides/coding-agents`: install the skill, generate the context, the loop an agent follows, token queries, CI with `dta audit` (once 103 ships), with output from real runs on the fixtures.
- Landing page "With your agent": "A skill and an MCP server" becomes "A skill and token queries"; items are marked coming until they ship and lose the label when they do (the honesty rule).
- `llms.txt` lists the guide (automatic through the generator).

## Acceptance criteria

- [x] Guide written from real runs; landing copy matches what ships
- [x] All gates pass plus the site job, and the GitHub run is green

## Outcome

- Guide [DTA with coding agents](../../site/src/content/docs/guides/coding-agents.mdx): skill, context, token queries, audit and the loop, every output taken from the `brand-ab` snapshots (`skill-add`, `context`, `token-find`, `token-get`, `audit`). It names the MCP server as planned, not built.
- Landing "With your agent": the third point is "A skill and token queries", without the coming label; the agent bubble shows a real lookup (`#2f55d4` is `action.bg` on this website) and `dta audit · pass`; `dta skill add` is shipped (it runs once DTA is installed; it is not an `npx`/`npm create` command). The section's button leads to the guide.
- The honesty test reads the full command names from `@dta/cli` (`COMMAND_NAMES`), so `skill add` is checked as a command, not just `add`.
