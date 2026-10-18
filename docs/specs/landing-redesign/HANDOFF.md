# Handoff: the loop as the landing-page key visual

**Written:** 2026-10-18, end of the prototype session with the maintainer (phone-first review, 17–18 Oct 2026)
**State:** direction chosen, fine-tuning open, spec and tickets not yet updated
**Read first:** [landing-redesign.md](../landing-redesign.md) (approved spec), [concept-notes.md](../concept-notes.md) ("The loop has two sides"), then this file

## Where things stand in one paragraph

The spec (decisions 3 and 4) describes the loop as a two-lane path with a travelling capsule, placed as the first section after the hero. Prototyping on the phone moved it in two steps: first the seven-station path was judged too detailed for a landing page, then a four-station version "lost readers" too. What the maintainer liked is a different visual: a **token that crosses from design into the pull request, is taken apart there in an orbit (exploded view, shapes only), sends a finding to the side that can fix it, and ships**. The maintainer wants this as the **key visual in the hero**, which also settles the spec's open item about a hero figure. Light and dark, desktop and phone layouts exist as prototypes. What remains is fine-tuning, then rewriting decisions 3/4 and tickets 107/108 from the version the maintainer accepts.

## Decisions made in this session (maintainer's words where they matter)

1. **Orbit over the alternatives.** Of the three exploded-view variants (A plates, B orbit, C zoom), "Orbit is best." Details of the token are shown as **shapes, not text**: the colour swatch, a split swatch old | new, an alias link, three output tiles (`{ }`, `tw`, `ios`), two small satellites. Checks are badges (✓ ✓ !). The finding is a pair of miniature buttons, the second outlined in red.
2. **Findings go to the side that can fix them, and the usual side is the product.** The maintainer's correction, verbatim in spirit: it is usually not the design that made the mistake; lint, build and diff in the pull request show whether the implementation is right or drifting (tokens not used, a component changed with or without a token cause). The prototype therefore runs **two laps**: lap 1, the usual case, the diff finds a change the tokens do not explain (a hard-coded value, `#`), a red finding chip flies to the product side, is replaced by the token there, returns, the token ships; lap 2, the rarer case, the token itself was wrong (label contrast), the token goes back to Figma on a red arc, is fixed, ships. Whether the landing page shows both laps or only lap 1 (docs show both) is undecided.
3. **The token is its own carrier.** The earlier spaceship / paper plane / plotter head / cube carriers (prototype 1) were dropped once the token moved by itself; nothing else travels.
4. **Flat or risen, unchanged.** Station labels rise (3 px, soft double shadow) while the token is there and settle flat after; no pressed state.
5. **Shadows fall on the lines, not on the paper.** The token's cast shadow is a second copy of the grid in darker ink (lighter ink in dark mode), masked to a soft ellipse that follows the token: larger and trailing in flight, tucked under the chip when landed. The maintainer: "I like the visuals." The label pills still use the ordinary risen shadow; whether they switch to lines-only or lose their shadow is open.
6. **Grid softer.** Fine lines at 4.5 % ink, the 120 px lines at 6–7.5 %, instead of 7 / 9 %.
7. **Key visual in the hero.** "I'm thinking of putting this as a key visual in the intro section." Consequence (proposed, not yet written into the spec): the separate loop section goes; its paragraph becomes the hero subline or sits directly under the headline; the page becomes hero (with visual) → four scenes → facts → final call. Desktop: text left, board right. Phone: a compact horizontal strip under the buttons (Figma and code at the edges, orbit in the middle), not the tall vertical board.
8. **Both themes.** Dark uses the graphite theme of the site tokens (graphite-900 ground, blueprint-400 rings, redline-400 findings, sage-400 checks). Orbit-orange swatches stay as they are in both themes: they are the example's colour, not ours.

## Prototypes (in `prototypes/`, throwaway, literal colours)

| File | What it is | Verdict |
| --- | --- | --- |
| `p1-seven-stations.html` | Two-lane path with seven stations, carrier switch (ship / plane / plotter / cube), synced captions, step numbers. | Liked, but "I'd lose readers here" as the first section. Right level of detail for a docs page, not the landing. |
| `p2-four-stations-in-page.html` | Four stations inside the page (hero, loop, scenes 01–02). | Superseded by the exploded-token idea. |
| `p3-exploded-text.html` | First exploded view with text labels. | "It's cool", but text in the explosion was replaced by shapes. |
| `p3-exploded-variants.html` | A plates · B orbit · C zoom, shapes only; switch at the bottom. | **B orbit chosen.** |
| `p4-orbit-two-laps.html` | Orbit, two laps (findings routed by side), vertical on phones / three lanes on desktop, light only, lines-only shadow. | The working version; fine-tuning list below applies. |
| `p5-hero.html` | The hero with the orbit as key visual, phone strip + desktop two-column, light and dark (◐ toggle in the nav). | **Current direction.** |
| `gen3.py`, `gen4.py`, `gen-variants.py` | Generators (Python, no dependencies) for p4, p5, p3-variants: timelines in seconds → CSS keyframes. Edit the timeline there, not the HTML. `python3 gen4.py` rewrites `p5-hero.html` (it imports `gen3.py`, which rewrites `p4-…`). | |
| `tokens.css`, `carriers.html` | Shared bits the generators read. | |

Published copies (private artifacts, for the phone): p4 and p5 were reviewed as claude.ai artifacts; the files here are the same HTML.

## Fine-tuning list (open, in rough priority)

Maintainer: "It needs some fine tuning but I like the visuals." Items the maintainer named or agreed to, then items noticed during the session:

1. Shadow position and size were off on the phone once (safe-area inset); fixed by measuring against the body box and re-measuring on font load / resize. Verify on a notched phone again after any layout change.
2. Phone hero: lane names (DESIGN · PULL REQUEST · PRODUCT) and station labels (Figma · lint · build · diff · code) double up; one row can go. The empty pad circles at Figma and code then look like missing content: a small Figma glyph and a `</>` tile would carry the meaning.
3. Lines-only shadow for the label pills too, or no shadow there; decide and apply consistently.
4. Orbit: ring speed (30 s/turn now) and the number of satellites; the finding chip's `#` → swatch is small at phone size; the dashed rail reads as a second line under the token.
5. Lap captions ("lap 1 · the usual case …") are prototype aids and must not ship in the hero; the hero has to work for a five-second viewer with lap 1 alone.
6. Desktop sizes: p4 used `zoom: 1.25` to thicken the "filigree" lines; p5 sets explicit stroke widths (2 px) instead. Keep explicit sizes; no zoom in production.
7. `prefers-reduced-motion`: freeze in the exploded state with checks visible (the story still reads); no capsule, no shadow layer.
8. Hover/tap pauses (prototype toggles `.paused`); decide whether the production visual pauses on hover at all.

## What has to change in the plan

Not done yet, on purpose: the maintainer wanted the fine-tuning round first so the spec is written from the accepted version.

- **Spec** [landing-redesign.md](../landing-redesign.md): rewrite decision 3 (the visual is the orbit loop, not the two-lane path), decision 4 (motion: flight with lift and lines-only shadow, orbit inspection, flat-or-risen labels, two laps or one), the page outline (no loop section; hero carries the visual), and close the open item about the hero figure. Add decision 2 of this file (findings routed by side) and link concept-notes.
- **TICKET-107** (LoopPath): becomes the hero visual component, with: positions as CSS custom properties per layout (phone strip, desktop lanes), keyframes generated or hand-written on one timeline, the orbit parts as shapes, the finding chip, the masked line-shadow layer anchored to the body box, both themes from tokens, reduced-motion state, stories for both layouts and themes. New tokens: shadow pair (risen), line-ink for the shadow layer, orbit ring colour (blueprint-400 / 600), Orbit Burger example colours (TICKET-105 already plans the example collection).
- **TICKET-108** (landing rebuild): hero gets the visual; the loop section and its heading go; the "two sides" paragraph moves into the hero; the honesty test still applies (no new commands shown).
- **Concept note** "The loop has two sides": add the routing rule (finding goes to the side that can fix it; usual case is the product side) if the spec does not carry it itself.
- **Index** `docs/tickets/000-index.md`: Phase 10 order stays 105 → 106 → 107 → 108; 107's scope note changes.

## Technique notes for the implementer

- **Positions as variables.** Stations are `--pd`, `--pc`, `--pp` (two-value `translate`) plus per-axis `--pdx/--pdy …` for the shadow mask; layouts only swap the variables in a media query. Keyframes reference the variables, so one timeline serves every layout.
- **Centring without transforms.** Elements that rotate (the loupe spins) must not centre with `transform: translate(-50%,-50%)`; the rotation then orbits the origin. Use negative margins (`margin: calc(var(--r1) * -1)`).
- **Individual transform properties.** Lift uses `translate`/`scale` on an inner wrapper; label rise uses `transform: translateY` so it composes with the `translate` that centres the label. Don't animate a property that also positions the element.
- **Lines-only shadow.** One absolutely positioned layer per moving object, covering the body, with the grid as background (darker ink), a radial-gradient `mask-image`, `mask-repeat: no-repeat`, and `mask-position`/`mask-size` animated on the same timeline as the object. The layer's origin must be the same box the grid is painted on (the body), so the stage offset is measured as `stage.getBoundingClientRect() − body.getBoundingClientRect()` and re-measured on resize, font load and any reflow (ResizeObserver). Mask and body grid share `background-size`, so they stay aligned.
- **Class names.** The shadow layers are `.ls.la` / `.ls.lb`; an earlier `.ls.tok` collided with the token's `.tok` rule and collapsed to 0 × 0. Keep prototype class names out of the production component.
- **Two laps** on one 32 s timeline; if the hero ships with lap 1 only, cut the timeline at 15.5 s and remove lap-2 elements rather than hiding them.

## Not to be started without the maintainer

Implementation of 105–109; the npm release (090); the remainder of 075; demo cleanup (PR #20); 086/087. Commits happen per ticket after the gates (`prettier:check`, `typecheck`, `guardrails:boundaries`, `test`, `snapshot:check`, `site:build`); never commit without the maintainer's go-ahead. Brand names in examples are BrandA/BrandB and Orbit Burger only.
