# TICKET-101: `dta skill add`: the DTA skill for coding agents

**Phase:** 9 — Agent interop
**Priority:** High
**Effort:** S
**Blocked by:** 100
**Status:** open
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 3, settled question 1)

## What to build

`dta skill add [--dir <path>] [--check]` writes `SKILL.md` (Agent Skills format: `name`, `description` front matter) to `.claude/skills/dta/` by default.

Content, short and imperative: DTA in one paragraph; the loop (change tokens → `dta lint` → `dta build` → `dta diff --tokens-only` or `dta diff` → read the result → fix → repeat); look tokens up before writing a value (`dta token find`, `dta token get`); the rules (semantic tokens in components, never raw values; never `dta push --yes`, a person pushes to Figma; never edit generated files); what the exit codes mean; where the project context is (`DESIGN.md`, TICKET-102).

## Acceptance criteria

- [ ] The text is a template in `@dta/cli`, filled from `commandReference()`; a test parses every `dta …` command line in it and checks commands and options against the CLI
- [ ] Header with the DTA version and a "generated" marker; `add` overwrites only a file with the marker (otherwise exits 2 and says so)
- [ ] `--check` exits 1 when the installed skill differs from the current one
- [ ] Snapshot scenario of the written file; all gates pass, and the GitHub run is green
