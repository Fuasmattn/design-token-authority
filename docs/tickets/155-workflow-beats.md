# TICKET-155: Landing page: the workflow as three beats on a line, the token travelling it

**Phase:** 10 — Landing redesign
**Priority:** Medium
**Effort:** M
**Blocked by:** 153 (superseded by this)
**Status:** in progress (2026-10-25), on the `153-workflow-list` branch
**Spec:** [landing-redesign](../specs/landing-redesign.md) (decision 12, revision 2026-10-25); design canvas "DTA Workflow Section Alternatives", boards T3 → LB6

## Problem

The numbered list of TICKET-153 was clean but still a list of five rows with commands, and it read as a second grammar next to the scenes. The maintainer's narrative for the section is three beats: tokens change somewhere, DTA does its work in a pull request, the team signs off or iterates. The section should say that, read in one glance, and pick up the hero's key visual so the page has one object to follow.

## What to build

`Workflow` replaces `WorkflowList`:

1. **Three beats on one line.** Eyebrow (where), title, two sentences; no commands, no numbers. A faint dotted `rail` line through three ring stations to an end dot labelled `Merged`; Stacked on phones, three columns from 960px.
2. **The token.** The hero's cube (same markup, `well-object-*` tokens, hairline of the throat colour) travels the line once, with eight motes of `well-dust` (two as the hero's spheres) trailing it. While it waits at a station the dust gathers into a flat ring and turns (a loading state), then lets go. At the decision it steps back a third of the way and returns. At the end it turns blueprint; the end dot fills, gets a halo and a tick. Stations fill as the token passes and stay filled.
3. **One run.** 28 s, started once when a third of the section is visible (`IntersectionObserver`), never looping; stations and the end are driven by the token's position along the path, not by timers. Positions are measured after layout (a polyline through the stations), so phone and desktop share one component. Under `prefers-reduced-motion` the finished picture is shown without a run.
4. **Copy** in `content.ts` (`WORKFLOW`: title, kicker, beats, end). Headline for review: _Design changes, reviewed like code._
5. **Tests.** `landing.test.ts`: the beats carry no commands; the scene order checks stay. `components.test.ts`: tokens only, motion tokens for transitions. Stories `workflow--default` at both widths (the token at rest at the end, since the story is captured after the run or with reduced motion).

Out of scope here: the scenes section (its own ticket, after the canvas round on the example grid).

## Acceptance criteria

- [ ] `Workflow` renders the three beats and the line in both themes at 390px and 1280px; the run starts on view, once, and ends on the merged picture; reduced motion shows that picture directly
- [ ] The token is the hero's cube by tokens and markup; no colour literals; transitions on the motion tokens
- [ ] `WorkflowList` is gone from site, docs and stories; docs page `workflow`; stories at both widths
- [ ] AAA contrast test green; no horizontal scroll at 390px; no layout shift from the run
- [ ] All gates pass; Vercel preview reviewed by the maintainer on a phone and a desktop
