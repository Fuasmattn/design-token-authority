# TICKET-169: Landing: no commands section; the checks beat links to the command reference

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** XS
**Status:** done (2026-10-26)
**Spec:** [landing-redesign](../specs/landing-redesign.md) (revision note 2026-10-26, second)

## Problem

TICKET-168 replaced the scenes with a commands grid. On review the grid is still a section to read; the commands belong in the reference. The page goes one step further: hero, the strip, the facts, the final call — and one link to the command reference where the commands are mentioned, under the second beat of the strip.

The second beat's title, "DTA does its work", was the odd one of the three (vague, the only one naming DTA); it becomes "Checked, built, rendered": the three steps named, parallel in weight to "Tokens change" and "The team decides".

## What to build

- `Workflow`: a beat may carry an optional `link` (label, href) under its text, in the section intro's link style one size down. Docs guideline updated.
- Content: the second beat links to `/reference/` and is retitled; `COMMAND_GRID` and `COMMANDS_SECTION` go; `COMMANDS` keeps only `init`, the one command on the page.
- The `Commands` component, its docs page, example and story go again (nothing uses them).
- `landing.test.ts`: the beat titles and that the reference link sits on the checks beat only.

## Acceptance criteria

- [x] The page shows one command (`npm create dta`) and one link to the command reference, under the checks beat
- [x] `Commands` is gone from the design system; the Workflow docs describe the beat link
- [x] CI gates green; links validator green
- [x] Spec revision note; this ticket in the index
