# TICKET-168: Workflow section renders the same picture every time

**Phase:** 13 — Maintenance
**Priority:** High
**Effort:** XS
**Status:** in review (2026-10-26), branch `168-workflow-dust`
**Spec:** [maintenance](../specs/maintenance.md); [landing-redesign](../specs/landing-redesign.md) (decision 12)

## Problem

`dta diff` fails on every pull request since TICKET-155: `workflow--default` at 1280 and 390 px shows about 200 changed pixels with no token change, and the same commit rendered twice differs the same way (found in TICKET-156). The Workflow component (`site/src/components/ds/Workflow.astro`) places its eight dust motes with `Math.random()` (start position, speed, sway, phase) and picks the token's colour and size at random. Under `prefers-reduced-motion`, which `dta diff` and the stories use, the motes are drawn once at those random positions, so the finished picture is never the same twice. The status check is red for no reason and teaches people to label past it.

## What to build

- Replace `Math.random()` in the component with a small seeded generator (for example a mulberry32 with a fixed seed), so the motes, the token colour and the size are the same on every load. The scatter still looks natural; it is just the same scatter each time.
- Keep the run itself as it is: the animation timing is driven by the token's position, not by random numbers.
- No new design-system component, no token change.

## Acceptance criteria

- [x] `dta diff --base HEAD` on the website: 0 changed stories (rendering one commit twice)
- [ ] `workflow--default` stories look the same as before to the eye at both widths (the maintainer checks the Vercel preview)
- [x] `motion.e2e` and `frame.e2e` green; safety check of the spec green
- [ ] The `dta diff` check on this pull request passes without the approval label

## Notes

Outcome (2026-10-26). Three causes, all in `Workflow.astro`, each proven by rendering one commit against itself (`dta diff --base HEAD`) and by hashing eight screenshots per width:

1. **Random scatter.** The eight motes' start, pace, sway and phase came from `Math.random()`: about 200 changed pixels at both widths. Now a seeded generator (mulberry32, fixed seed): the same scatter on every load. Left random on purpose, since neither reaches a screenshot: the token's spin direction during a run and the easter-egg colour and size after a tap.
2. **Measured before the font.** On phones the beats stack, and the line's end sits below the last beat, whose height moves by a fraction of a pixel when the web font lands after the script ran: 4 changed pixels at 390. The still branch now measures once more on `document.fonts.ready` and places the token again.
3. **Fractional edge.** With the DOM byte-identical on every run, Chromium still produced two different PNGs (29 pixels, colour values off by one): the semi-transparent motes blended over the cube's top edge at `translate(8px, 629.688px)` differently per paint. The token's resting position and the motes in the still picture are now whole pixels.

Result: 8 renders at 390 and at 1280 give one byte-identical screenshot each; `dta diff --base HEAD`: 125 stories, 0 changed. The run itself (timing, path, dust flow) is unchanged. Docs page `workflow` mentions the seeded scatter.
