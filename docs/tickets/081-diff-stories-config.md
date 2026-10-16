# TICKET-081: Stories adapter and the `diff` config section

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** S
**Blocked by:** 070, 080
**Status:** open
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 3, 4)

## What to build

Projects describe what `dta diff` renders in `dta.config.*`: build command, output dir, stories source, viewports, thresholds. The first adapter reads the stories manifest of a static site (the DTA website from 070). `dta diff --list` prints the stories it would render.

## Acceptance criteria

- [ ] Config schema gains the `diff` section (validated, documented in the generated reference)
- [ ] Adapter interface (list stories → id, URL, viewports) with the static-site adapter; Storybook adapter left as a follow-up ticket
- [ ] `--list` works on the website and on a fixture site
- [ ] All gates pass, and the GitHub run is green
