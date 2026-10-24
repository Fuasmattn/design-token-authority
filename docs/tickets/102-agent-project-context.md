# TICKET-102: `dta context`: `DESIGN.md` and the `AGENTS.md` pointer

**Phase:** 9 — Agent interop
**Priority:** High
**Effort:** M
**Blocked by:** 100
**Status:** done
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 4, settled questions 3 and 4)
**Replaces:** TICKET-028

## What to build

`dta context [--out <file>] [--check]` writes `DESIGN.md` (default) from the token model and the config: brands and themes and how to switch them, collections and tiers, the semantic tokens with their CSS custom property and Tailwind key, the rules from the lint config, and "do not invent tokens: ask `dta token find`". Primitives are never listed. A size budget (about 2,000 tokens of text) lists the semantic tier in full when it fits, otherwise by group with counts and a pointer to `dta token list`.

`AGENTS.md`: one marked block pointing to `DESIGN.md` and the skill is added or updated; the rest of the file is never touched (created with only that block if missing).

## Acceptance criteria

- [x] Rendering tested on `brand-ab` and on a synthetic large set (budget respected, groups summarised)
- [x] The `AGENTS.md` block is idempotent and leaves other content byte-for-byte unchanged
- [x] `--check` exits 1 when `DESIGN.md` or the block is stale; `context: { out }` in the config makes `dta build` write it (off by default); config documented through the schema
- [x] Snapshot scenarios recorded by name; all gates pass, and the GitHub run is green

## Outcome

- `packages/cli/src/context/render.ts`: `renderDesignMd` (brands and how to switch them, collections with their role from `analyzeStructure`, the tokens to use with CSS custom property, Tailwind name and value per brand, the lint rules) and `updateAgentsMd` (one `<!-- dta:begin -->` … `<!-- dta:end -->` block). `write.ts` plans and writes both; a `DESIGN.md` without the marker is never overwritten (exit 2).
- "Tokens to use" = tokens the build writes outside collections inferred as primitives. Collections the build does not write (multi-mode, no mode in `brands`, like the fixture's `ScreenType`) are named in the collections table as "not in the build output" and their tokens are not listed.
- Budget: about 8,000 characters (~2,000 tokens). Over it, the tokens are summarised by their first two name segments with a `dta token list --match` per group (tested with 600 tokens).
- `dta context [--out] [--check]`; config `context: { out }` (default `DESIGN.md`) makes `dta build` write both files. Snapshot scenario `context` on `brand-ab`. The code-name helpers moved from the token command to `code-names.ts`, shared by both.
