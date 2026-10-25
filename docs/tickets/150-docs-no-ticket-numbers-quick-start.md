# TICKET-150: Docs without ticket numbers; a true Quick start

**Phase:** 7 — Docs site (follow-up)
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** in review (2026-10-25)

## What to build

Maintainer decisions (2026-10-25):

1. **The website never mentions ticket numbers.** They are internal planning, not documentation. Found on 13 pages (design system pages, reference, guides, learn) and in four lint-rule descriptions in the code, which the generated Configuration page and the published config JSON Schema repeat. References to internal spec decisions ("playground spec, decision 15") go too, and history ("before TICKET-121 …") is rewritten as the rule that holds now.
2. **Quick start is quick.** No warning box at the top, no fixture walkthrough, no long output. Only the bare minimum: one copyable command per step with a one-line explanation, and a link to where the details already are (Figma guide, Outputs, Lint rules, the diff guide, Configuration).

The warning about the unrelated `dta` package on npm is not needed there: `npm create dta` installs DTA in the project first, after which `npx dta` runs the installed one.

## Acceptance criteria

- [x] No `TICKET-` (or a bare ticket number like "079's") and no "spec, decision N" on any docs page, generated pages included; a test fails when one comes back (source pages, the generated Configuration and Commands pages, `llms-full.txt`)
- [x] Content that a ticket number marked as out of date is corrected (Learn › Patterns said breakpoint modes are not built; they are)
- [x] Quick start: requirement line, `npm create dta` (the wizard writes the config and offers diff setup, pull and build), then the everyday commands (`npx dta pull`, `build`, `lint`, `diff`), each copyable with one line and a link to the details; no screenshots of the wizard (maintainer, 2026-10-25)
- [x] Nothing that only the old Quick start said is lost (or it is already on the linked pages)
- [x] Links checked by the site build; all gates pass

## Progress (2026-10-25)

- Ticket numbers and spec decisions removed from 14 pages and the four lint-rule descriptions in `packages/lint/src/config.ts` (Configuration page, config JSON Schema). History rewritten as the rule that holds (status colours: why the action tint is not used for a review verdict; detail panel: why code scrolls instead of wrapping). Learn › Patterns corrected: breakpoint modes are built as media queries. Learn › Overview no longer points at the spec and "its tickets" for the `$extends` gap.
- Guard: `site/docs-internal-refs.test.ts` checks every docs source page and the generated Configuration and Commands pages. The built site has no ticket number in any HTML, `llms-full.txt` or the published schemas.
- Quick start: a requirement line, the one setup command and the everyday commands, each copyable with one line and a link. The fixture walkthrough and outputs are on those pages already (breakpoints: Outputs › Breakpoint modes; `init --yes`: Commands; `dta diff --check`: the diff guide).
- Reshaped after review: the wizard already offers diff setup, pull and build, so the page leads with `npm create dta` alone and lists the everyday commands after it. Per-command pages not needed: the generated Commands page has an anchor per command.
