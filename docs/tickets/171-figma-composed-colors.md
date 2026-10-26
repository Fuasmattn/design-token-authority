# TICKET-171: Figma composed colours (opacity authored apart)

**Phase:** 13 — Maintenance (follow-up of 160; a feature, so it waits for the maintainer's go)
**Priority:** Low
**Effort:** M
**Blocked by:** 160
**Status:** open, not planned
**Spec:** none yet; [dtcg-2025-10](../specs/dtcg-2025-10.md) for the colour model

## Problem

Figma's REST API (spec 0.46, TICKET-160) can return a variable value that is a **composed colour**: a colour whose opacity is authored on its own, where the colour or the opacity, or both, alias another variable:

```ts
{ color: RGB | RGBA, opacity: VariableAlias }
{ color: VariableAlias, opacity: number | VariableAlias }
```

A new scope `COLOR_OPACITY` comes with it. Since 160, `dta pull` accepts such a file and leaves that value out with the warning `composed-color`; `dta push` never sends one, and `planPush` treats one in Figma as a change. So nothing breaks, but a team using the feature loses those values.

## What to decide first

How a composed colour maps onto the token model. The 2025.10 colour value has `alpha` as a number only; an opacity that is a reference has no home there. Options: (a) resolve at pull time into a plain colour with the opacity's current value, warning that the link is lost; (b) a DTA extension that keeps the reference (`$extensions['com.figma'].opacity = '{opacity.half}'`) and resolves it at build; (c) wait for DTCG to cover it. The decision goes into a short spec before any code.

## What to build (after the decision)

- Pull: convert per the decision; the `composed-color` warning goes away for the supported shapes.
- Push: send a composed colour when the token carries one (`VariableComposedColor` in the payload); `sameValue` compares them.
- Build: CSS and the other outputs resolve the opacity; `dta token get` shows the link.
- Fixture in `test/recordings/` from a real file with the feature (the maintainer records it with the Figma recording script).

## Acceptance criteria

- [ ] Spec with the decision
- [ ] Round trip pull → files → push on the fixture without a diagnostic
- [ ] Snapshots recorded for the fixture; the rest unchanged
