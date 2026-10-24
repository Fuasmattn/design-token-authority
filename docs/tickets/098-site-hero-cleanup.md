# TICKET-098: Calmer hero with one command and one call to action

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** XS
**Blocked by:** 096
**Status:** done

## Background

Maintainer feedback on the preview: the two pills above the headline and everything under the subline (second button, agent link, release note) made the hero noisy.

The long command `npx design-token-authority init` goes too. `npx dta` cannot be used: the npm name `dta` belongs to an unrelated package ("Dynamically typed arguments for javascript", 2015), and DTA has never published under it. `create-dta` is free, so the short command is `npm create dta`, published with the first release (TICKET-090).

## Decisions (maintainer, 2026-10-16)

- Hero: headline, subline, the command `npm create dta` and one button, "Get started" (to `/start/`). No pills.
- The hero command is shown without a "coming" label, although it works only after the npm release. This is an exception to the honesty rule of the docs-site spec (decision 7) for the hero; the footer keeps its note.

## Acceptance criteria

- [x] Pills, second button, agent link and release note removed from the hero; their unused CSS removed
- [x] `COMMANDS.init` is `npm create dta`; the honesty test treats `npm create` like `npx` (needs the release)
- [x] TICKET-090 lists the `create-dta` package
- [x] Checked at 1280px and 390px; all gates pass plus the site job, and the GitHub run is green
