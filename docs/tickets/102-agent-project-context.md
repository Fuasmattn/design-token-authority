# TICKET-102: `dta context`: `DESIGN.md` and the `AGENTS.md` pointer

**Phase:** 9 — Agent interop
**Priority:** High
**Effort:** M
**Blocked by:** 100
**Status:** open
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 4, settled questions 3 and 4)
**Replaces:** TICKET-028

## What to build

`dta context [--out <file>] [--check]` writes `DESIGN.md` (default) from the token model and the config: brands and themes and how to switch them, collections and tiers, the semantic tokens with their CSS custom property and Tailwind key, the rules from the lint config, and "do not invent tokens: ask `dta token find`". Primitives are never listed. A size budget (about 2,000 tokens of text) lists the semantic tier in full when it fits, otherwise by group with counts and a pointer to `dta token list`.

`AGENTS.md`: one marked block pointing to `DESIGN.md` and the skill is added or updated; the rest of the file is never touched (created with only that block if missing).

## Acceptance criteria

- [ ] Rendering tested on `brand-ab` and on a synthetic large set (budget respected, groups summarised)
- [ ] The `AGENTS.md` block is idempotent and leaves other content byte-for-byte unchanged
- [ ] `--check` exits 1 when `DESIGN.md` or the block is stale; `context: { out }` in the config makes `dta build` write it (off by default); config documented through the schema
- [ ] Snapshot scenarios recorded by name; all gates pass, and the GitHub run is green
