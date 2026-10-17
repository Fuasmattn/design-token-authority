# TICKET-103: `dta audit`: hard-coded values in code

**Phase:** 9 — Agent interop
**Priority:** High
**Effort:** L (split by language if needed)
**Blocked by:** 100
**Status:** done
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 5, settled question 5)
**Replaces:** TICKET-030

## What to build

`dta audit [paths…]` scans CSS, SCSS, JS/TS, JSX/TSX, the `<style>` blocks of `.astro`, `.vue` and `.svelte`, and Tailwind arbitrary values in class strings. Findings: colours equal (or with `--near`, nearly equal) to a token's resolved value, px/rem lengths equal to a spacing, radius or stroke token, font families a token names. Each finding: file, line, value, the token to use (semantic first) and its code identifier (TICKET-100). Not findings: generated outputs, `0`, `100%`, comments, lines marked `dta-audit-ignore`.

Baseline: `--update-baseline` writes `.dta/audit-baseline.json`; later runs report only new findings. Output `console|markdown|json`; exit 1 on findings not in the baseline. Config section `audit` (paths, ignore globs, languages, `near`).

## Acceptance criteria

- [x] Detectors per language tested on small snippets (true positives, the listed non-findings)
- [x] Baseline round trip; JSON shape versioned with a published JSON Schema
- [x] `dta audit` on this repository's website source reports nothing
- [x] Guide section for CI (separate step, advisory first); all gates pass, and the GitHub run is green

## Outcome

- `packages/cli/src/audit/`: `detect.ts` (per language: comments blanked so lines stay true; CSS declarations, JS style objects, colour strings and CSS in template literals, `<style>` blocks and `style=""` attributes of Astro/Vue/Svelte/HTML, Tailwind arbitrary values), `match.ts` (token values resolved once; lengths compared only with tokens of their kind, from Figma scopes or names), `audit.ts` (files, baseline, console/markdown/JSON). `@dta/core` exports `valueMatcher` and `toColor`, so colours match exactly as in `dta token find`.
- Beyond the spec: `.html` files and font-size lengths are audited; tests (`*.test.*`, `*.spec.*`, `__tests__`) and `@font-face` are skipped by default; `* 1px` unit casts are not findings. `near` is a boolean (the 2 % threshold of the query module), not a configurable threshold.
- Baseline fingerprint: file, kind, value and context (not the line), counted, so moved lines stay accepted and a second identical value is new.
- The website audit found five real hard-coded spacings (Logo, Terminal, WorkflowRail, ColorTokens); they now use `--space-*` tokens with the same values. `site/audit.test.ts` keeps it at zero.
- The CI guide's DTA checkout moved from `.dta` to `.dta-cli`: `.dta/` is DTA's own folder (diff report, audit baseline).
- Snapshot scenarios `audit`, `audit-json`, `audit-baseline` on `brand-ab` (new `src/` with a few hard-coded values); JSON Schema `/schemas/dta.audit.schema.json`.
