# TICKET-137: Several modifiers at once (axes)

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L
**Blocked by:** 134, 136
**Status:** in review
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 8, 9; slice 6)

## What to build

- The model gains axes: one per modifier or multi-mode collection; a token's values are keyed by the contexts of every axis that overrides it, and resolution takes one context per axis (`ModeSelection` grows into that).
- Later entries in `resolutionOrder` win, as in the report; resolution happens after flattening.
- CSS: base on `:root`, then each modifier's overrides under its own attribute selector (`[data-brand="b"]`, `[data-theme="dark"]`) in resolution order, aliases as `var()`; one stylesheet covers every combination.
- Resolved outputs (`base.css`, JS, Tailwind v3) per permutation, only for the combinations the config selects.
- `dta diff`, `dta token get`, lint (contrast per combination) and the playground pick a context per axis.
- Existing brands and breakpoints become axes without changing their output (snapshots unchanged).

## Acceptance criteria

- [x] A brand × theme fixture: every combination's resolved values match a resolver run per input (test)
- [x] Browser test: `data-brand` and `data-theme` on one element give the resolver's values for all four combinations
- [x] Existing snapshots unchanged
- [x] Brands and themes guide: a section on combining modifiers (not a full rewrite); the Learn page no longer lists this gap (the `$extends`-across-files gap stays)
- [ ] All gates pass (locally: yes), and the GitHub run is green

## Notes (implementation)

- **Model:** a token that several modifiers change goes into a combined collection named after them in resolution order (`theme × brand`), with one mode per combination of contexts (`dark × b`, values from the resolver's merge of that input). `Collection.modifier` marks a modifier's collection, `Collection.axes` a combination; `Token.layers` keeps the sets' value and what each context of each modifier sets, for the CSS. Tokens one modifier changes stay in that modifier's collection, as in TICKET-136.
- **Selecting:** `modeOf(collection, selection)` in `@dta/core`: a mode named for the collection, else the combination of the contexts selected per modifier (each falling back to its default). `resolve` spells a selected combination out per modifier, so a chain that reaches `theme` from `theme × brand` reads the same theme. Graph, `dta token get` (`--mode theme=dark --mode brand=b`, or `--mode "theme × brand=dark × b"`) and lint (contrast per combination, never mixing two themes in one check) go through it.
- **CSS:** each context of a modifier that no brand names gets `themes/<modifier>-<context>.css` with `[data-<modifier>="<context>"]`; a modifier whose contexts are listed in `brands` keeps `data-brand` (`themes/b.css`). A combined token gets a custom property per layer: `:root` (end of variables.css) has the sets' layer and `--accent: var(--accent-dta-brand, var(--accent-dta-theme, var(--accent-dta-base)))`; each context's rule sets its layer (`initial` where the context leaves the token alone, so a nested context resets it) and declares the token again, with the single-mode tokens that alias it. Layer values are formatted by Style Dictionary like every other value.
- **Tests:** resolver tests (combined collection, layers, every combination resolves as the resolver merges it, selection by modifier or combination, graph edges per context), build tests (layers, `initial`, `data-brand` for brand-named contexts), a lint test (contrast in consistent contexts), the `dtcg-modifiers` fixture (brand × theme) with its scenarios recorded by name, and `site/dtcg-modifiers.e2e.test.ts`: in Chromium, every combination of `data-theme` and `data-brand`, on one element or nested either way and reset inside, gives the value `resolve` gives. Existing snapshots unchanged.
- **Docs:** Brands and themes guide (new section "Brands and themes together", output copied from the fixture), Token files reference (resolver bullets), Learn page (only the `$extends`-across-files gap is left).

### Narrower than the ticket text (to review)

- **Brands and breakpoints are not turned into axes.** Per-mode files keep one dimension per collection; combining happens for resolver modifiers. Their output is unchanged (snapshots), which was the point of that bullet.
- **No resolved outputs per combination** (`base.css`, JS, Tailwind v3/v4 leave combined tokens out; JS writes the default combination for single-mode tokens that alias one, as for brands). The custom properties cover every combination.
- **A token of one modifier that aliases a combined token** is declared in its own modifier's rules only, so it follows the contexts where its own modifier is set (documented in the guide).
- **`dta push`** writes a combined collection as a Figma collection with one mode per combination (Figma has no axes); not tested against Figma.
- **`dta diff` and the playground** were not changed: they read the model and the built CSS, so they see combined collections as collections with one mode per combination. Not checked by hand.
- The CLI build report lists modifier themes as "Theme theme-dark complete".
