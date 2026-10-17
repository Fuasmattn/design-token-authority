# Spec: DTA for coding agents — token queries, a skill, project context and a code audit

**Status:** draft (2026-10-16), waiting for the maintainer's calls on the open questions
**Depends on:** [TICKET-090](../tickets/090-first-npm-release.md) (an agent can only use what it can install), [docs-site](./docs-site.md) (generated reference, `llms.txt`)
**Replaces:** the plans in TICKET-028 (`DESIGN.md` generator) and TICKET-030 (`dta audit`), written before the overhaul; defers TICKET-029 (MCP server)
**Related:** landing page section "With your agent" (TICKET-099), which promises what this spec delivers

## Problem

The headline says "built for humans and agents", and today an agent gets little help:

- **It does not know the workflow.** Nothing tells it to lint, build and diff after a token change, how to read the results, or that `dta push` needs a person.
- **It does not know the token set.** Asked to style a button, it writes `#2f55d4` or invents `--color-primary`, because nothing in the repository says which tokens exist and which tier to use.
- **It cannot ask.** "Which token is `#2f55d4`?", "what is `action.bg` in BrandB?" have no command; grepping JSON fails behind alias chains and modes.
- **Nothing checks its code.** `dta lint` checks the token files, not the code that uses them, so hard-coded values in agent-written UI pass unnoticed.

## Solution

Four pieces, all built on the existing packages, all usable by people and CI too:

1. **Token queries** in the CLI: `dta token get | find | list`, JSON output, answered by the resolver.
2. **A skill**: `dta skill add` installs instructions that teach an agent the DTA workflow and when to use the queries.
3. **Project context**: `dta context` writes a compact, generated description of this project's tokens for agents (`DESIGN.md`, linked from `AGENTS.md`).
4. **A code audit**: `dta audit` finds hard-coded values in code and names the token to use instead.

Order: 1 → 2 → 3 → 4. The queries come first because the skill and the context file point to them.

## Decisions

1. **No MCP server now** (maintainer decision, 2026-10-16). Agents with a terminal (Claude Code, Codex, Cursor's agent) use the CLI; an MCP server would be a second channel to configure and maintain for them. The query functions are written so that an MCP server is a thin adapter over them later, when a client without a terminal (chat or design tools) needs one. TICKET-029 stays open, deferred, and is rewritten on top of this spec when it starts.

2. **Token queries.** One command with three subcommands, read-only, working on the token files like `lint` and `build`:
   - `dta token get <name> [--mode <collection>=<mode>]…`: the token's type, description, collection, its value in every mode (or the selected ones), the full alias chain per mode, and the names to use in code: CSS custom property (from `cssVariableName` in `@dta/build`, so it matches the build) and Tailwind theme key. An unknown name exits with 1 and suggests the closest names.
   - `dta token find --value <value> [--type color|number|string|boolean]`: every token that resolves to the value in some mode, semantic tokens first (tokens that alias the match before the primitive itself), with the mode. Colours match after normalising (`#2F55D4` = `rgb(47 85 212)`); near colours with `--near` (`colorsApproximatelyEqual` in `@dta/core`).
   - `dta token list [--collection <name>] [--type <type>] [--match <glob>]`: names with type and collection, sorted.
   - All three take `--format console|json` (default console). JSON shapes are versioned (`dta.token/1`) and documented with a JSON Schema on the website, like `result.json` of `dta diff`.
   - The logic lives in `@dta/core` (resolution, find, list on a model) and `@dta/build` (code identifiers); the command only formats. The same functions are what a future MCP server would call.

3. **The skill.** `dta skill add` writes a skill in the Agent Skills format (`SKILL.md` with `name` and `description` front matter) to `.claude/skills/dta/` by default, or to `--dir <path>`.
   - Content, short and imperative: what DTA is in one paragraph; the loop (change tokens → `dta lint` → `dta build` → `dta diff --tokens-only` or `dta diff` → read the result → fix → repeat); how to find a token before writing a value (`dta token find`, `dta token get`); the rules (use semantic tokens in components, never raw values; never `dta push --yes`, a person pushes to Figma; never edit generated files); what the exit codes mean; where the project's context file is.
   - The text is a template in `@dta/cli`, filled from the command reference (`commandReference()`) and the config schema, so it cannot name a command or option that does not exist. A test parses every `dta …` command line in it and checks it against the CLI.
   - The file carries the DTA version and a "generated, do not edit" marker. `dta skill add` overwrites only a file with that marker; `dta skill add --check` exits 1 when the installed skill is out of date (for CI).
   - The skill is project-independent; project specifics live in the context file (decision 4).

4. **Project context (replaces TICKET-028).** `dta context` writes `DESIGN.md` at the project root (`--out` to change it) from the token model and the config:
   - Brands and themes and how to switch them (`data-brand` values, the theme files), the collections and their tiers, the semantic tokens to use in code (CSS custom property and Tailwind key), the rules taken from the lint config (`semantic-must-alias`, `naming-pattern`, contrast pairs), and "do not invent tokens: ask `dta token find`".
   - A size budget (default about 2,000 tokens of text): the semantic tier is listed in full when it fits, otherwise by group with counts and a pointer to `dta token list`. Primitives are never listed: code should not use them.
   - `AGENTS.md`: DTA adds or updates one marked block that points to `DESIGN.md` and the skill, and never touches the rest of the file. Agents that read `AGENTS.md` but have no skill support still find the context.
   - Generated, idempotent, with a header naming the command. Optionally refreshed by `dta build` (`context: { out }` in the config); off by default.

5. **Code audit (replaces TICKET-030).** `dta audit [paths…]` scans source files for values that should be tokens:
   - Version 1 languages: CSS, SCSS, JS/TS, JSX/TSX, the `<style>` blocks of `.astro`, `.vue` and `.svelte` files, and Tailwind arbitrary values in class strings (`bg-[#2f55d4]`, `p-[12px]`). Swift, Kotlin and Android XML later.
   - Findings: colours that equal (or with `--near`, nearly equal) a token's resolved value; lengths in px or rem that equal a spacing, radius or stroke token; font families that a token names. Each finding names file, line, value and the token to use, semantic before primitive, with the code identifier from decision 2.
   - Not findings: values inside the generated outputs, `0`, `100%`, values in comments, lines marked `dta-audit-ignore`.
   - **Baseline:** `dta audit --update-baseline` records today's findings in `.dta/audit-baseline.json`; later runs report only new ones. Teams adopt it without fixing everything first.
   - Output `console|markdown|json`; exits 1 when there are findings not in the baseline. Config section `audit` (paths, ignore globs, languages, `near` threshold), validated and documented like the others.

6. **Agents only read and build.** Everything in this spec is read-only on the token files and Figma. Writing tokens stays a person's (or a reviewed pull request's) job; `dta push` keeps its typed confirmation, and the skill tells agents never to bypass it.

7. **Docs and landing page.** A guide "DTA with coding agents" (install the skill, generate the context, the loop, CI with `dta audit`); the commands and config in the generated reference; `llms.txt` lists the guide. The landing page item "A skill and an MCP server" becomes "A skill and token queries", marked coming until they ship.

## Open questions (need a maintainer call before the tickets start)

1. **Skill location:** `.claude/skills/dta/` as the default plus `--dir` for other agents, and the `AGENTS.md` pointer (decision 4) for agents without skills? Recommended: yes.
2. **Command names:** `dta token get|find|list` (recommended: one noun, subcommands, room for more), or top-level `dta get` / `dta find`?
3. **Context file name:** `DESIGN.md` plus a pointer block in `AGENTS.md` (recommended), or write everything into `AGENTS.md`?
4. **`dta build` writes the context:** off by default with a config switch (recommended), or always?
5. **Audit in pull requests:** report audit findings in the `dta diff` comment and status check (one place to review), or keep `dta audit` a separate CI step for version 1 (recommended)?

## Public API changes

- `@dta/core`: `findTokensByValue`, `listTokens`, and a resolution summary per mode (built on `resolve`).
- `@dta/build`: Tailwind theme key per token next to `cssVariableName`.
- `@dta/cli`: commands `token`, `skill`, `context`, `audit`; config sections `context` and `audit`.

## Testing decisions

- Package seam: queries on crafted models and the `brand-ab` fixture (alias chains across modes, near colours, unknown names); audit detectors on small source snippets per language; context rendering within its budget.
- CLI seam: snapshot scenarios per new command on `brand-ab` (console and JSON), recorded with `pnpm snapshot:record`.
- The skill test: every `dta …` line in the generated `SKILL.md` parses against the CLI's commands and options.
- An end-to-end check on this repository: `dta audit` on the website source (which uses only tokens) reports nothing.

## Out of scope

The MCP server (deferred, decision 1), the brand brief for AI design tools (TICKET-031), agents writing tokens or pushing to Figma, a hosted service, IDE extensions, and audit for Swift, Kotlin and Android XML (later).

## Tickets (after approval)

Token queries · skill · project context (closes 028) · code audit (closes 030) · guide and landing copy.
