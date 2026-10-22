# TICKET-137: Several modifiers at once (axes)

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L
**Blocked by:** 134, 136
**Status:** done
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
- [x] All gates pass, and the GitHub run is green

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

### Independent review (three agents, before the first push)

Fixed, each with a test:

- **Resolver:** a modifier now counts as changing a token when switching its context changes the token for _any_ choice of the other modifiers, not only at their defaults (a later modifier can undo an earlier one; a default context can hide one). Every combination is compared up to 256; past that, the old check with a `resolver-combinations` warning.
- **Type order (TICKET-132):** an alias without `$type` takes its target's type before its group's (DTCG §5.2.2); the group's type is the fallback when the target does not exist. Writing files back no longer adds `$type` to such aliases.
- **Build:** theme files resolve aliases into other modifiers and into combined tokens (a dark-theme token `{accent}` was written as literal `{accent}`); `:root` also holds the default contexts' layers, so a page without the attributes gets the default combination, as `base.css` does; a gradient stop whose position is an alias is `calc(var(--x) * 100%)` (was `NaN%`); Tailwind v3 quotes category keys that are not identifiers (`'safe-area'`, `'sky-lightness'`; daisyui/build and dtcg-2025/build re-recorded by name).
- **`dta diff`:** the result schema takes every token type (it rejected a change to a dimension or shadow); the base is read without the resolver options when it has no resolver document (diffing a migration to one).
- **CLI:** a resolver document in a folder below the tokens directory is found; `dta clean` removes `.tokens` files and, with a resolver document, the folders it reads (dtcg-2025/clean, dtcg-resolver/clean, dtcg-modifiers/clean re-recorded by name).

Follow-ups, done before closing (2026-10-22):

- **Nested contexts:** a token of one modifier that aliases a combined token (`ring` → `{accent}` in the dark theme) is declared again in every context of its modifier inside `@scope ([data-theme="…"]) { :scope[data-brand], [data-brand] { … } }`, so the nearest context wins where another modifier is set further in (browser test: light inside dark with a brand). The theme files' resolved outputs (Tailwind per theme) read a combined token in the theme's own context.
- **Types of parts:** a reference inside a composite must point at a token of the part's type (a border colour at a string token is `alias-type-mismatch`); a `$ref` into a value without `$type` takes the part's type (a colour component is a number).
- **Values of earlier drafts (decision: warn and keep):** a dimension or duration as text (`"0"`, `"100%"`, `"1em"`) and a colour object with extra properties are kept with a `legacy-value` warning, also inside composites. `X.tokens.json` stays collection X with one mode (TICKET-135).
- **Outputs:** a Tailwind v4 fallback name that starts with a Tailwind namespace gets a `dta-` prefix (`--dta-font-line`, not a font family); `css-shorthand-loss` warns when a typography's `letterSpacing` or a border's dash pattern cannot go into the shorthand. Tailwind v4 has no duration namespace, so durations stay plain custom properties.
- **Push:** an alias is skipped only when its target is pushed in no mode (the variable does not exist). `$root` stays a literal `$root` segment in Figma names, so `dta pull` gives the same file back (decision).
- **Parser:** a circular `$extends` is reported for each group in the circle; a name starting with `$` that is not a DTCG property is a `reserved-name` warning (top-level `$schema`, `$metadata`, `$themes` are allowed).
- **Second review (fixed):** composite parts accept Figma-style scalar tokens whose value fits the part (`fontWeight: "{fw}"` with a number token; a string token holding a hex or a CSS colour function as a colour); a `$ref` into a value must give a valid value; legacy text is a number with a unit or none (not any text: `"{broken"` stays an error); single-mode tokens that alias a scoped token follow it into the `@scope` block; in its own collection, push skips an alias per mode, and the warning names the mode when other modes were pushed; a fallback named exactly like a Tailwind namespace is prefixed too.
- **Decisions kept:** `$root` is `--group-root` in CSS; a modifier without `default` is a `resolver-default` warning (first context), not an error; the `@dta/core` browser budget is 55 KB (50.8 KB).
