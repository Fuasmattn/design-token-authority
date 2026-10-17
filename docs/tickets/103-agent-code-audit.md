# TICKET-103: `dta audit`: hard-coded values in code

**Phase:** 9 — Agent interop
**Priority:** High
**Effort:** L (split by language if needed)
**Blocked by:** 100
**Status:** open
**Spec:** [agent-interop](../specs/agent-interop.md) (decision 5, settled question 5)
**Replaces:** TICKET-030

## What to build

`dta audit [paths…]` scans CSS, SCSS, JS/TS, JSX/TSX, the `<style>` blocks of `.astro`, `.vue` and `.svelte`, and Tailwind arbitrary values in class strings. Findings: colours equal (or with `--near`, nearly equal) to a token's resolved value, px/rem lengths equal to a spacing, radius or stroke token, font families a token names. Each finding: file, line, value, the token to use (semantic first) and its code identifier (TICKET-100). Not findings: generated outputs, `0`, `100%`, comments, lines marked `dta-audit-ignore`.

Baseline: `--update-baseline` writes `.dta/audit-baseline.json`; later runs report only new findings. Output `console|markdown|json`; exit 1 on findings not in the baseline. Config section `audit` (paths, ignore globs, languages, `near`).

## Acceptance criteria

- [ ] Detectors per language tested on small snippets (true positives, the listed non-findings)
- [ ] Baseline round trip; JSON shape versioned with a published JSON Schema
- [ ] `dta audit` on this repository's website source reports nothing
- [ ] Guide section for CI (separate step, advisory first); all gates pass, and the GitHub run is green
