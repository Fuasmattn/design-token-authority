# TICKET-093: Nested brands reach single-mode tokens that alias brand tokens

**Phase:** 8 — Token Engine Overhaul, follow-ups
**Priority:** Medium
**Effort:** S
**Blocked by:** —
**Status:** done

## Background

Found while writing the Learn pattern pages (073). A single-mode collection that aliases a multi-mode one, such as a `Component` tier over a `Brand` tier, is built into `variables.css` on `:root`:

```css
:root {
  --button-background: var(--action-background);
} /* variables.css */
[data-brand='brandb'] {
  --action-background: var(--color-green-600);
} /* themes/brandb.css */
```

CSS resolves `var()` where the custom property is declared, so `--button-background` takes the brand of the root element and is inherited from there. On `<html data-brand="branda">` with a nested `<section data-brand="brandb">`, the section gets BrandB's `--action-background` but BrandA's `--button-background` (checked in Chromium with the `multi-brand` example plus a single-mode `Component.Value.json`). Switching the brand on `<html>` works. The Brands and themes guide says brands work "on any element"; that holds for the brand tokens only.

`base.css` resolves the same token to the first brand's value, which is expected for a base layer but worth stating in the Outputs reference.

## What to build

Single-mode tokens whose alias chain reaches a brand-mode token are also emitted in each brand's theme file (same `var()` reference), so they are recomputed wherever `data-brand` is set. Tokens that only alias other single-mode tokens stay on `:root` only.

## Acceptance criteria

- [x] A test with a single-mode tier over brand modes: the theme files declare the dependent tokens, `variables.css` is unchanged
- [x] A browser check (or computed-style test) that a nested `data-brand` section resolves the dependent tokens to its own brand
- [x] `brand-ab` snapshots unchanged, or re-recorded by name and reviewed if its output changes
- [x] The caution on the Learn patterns page and the note in Brands and themes updated; Outputs reference states what `base.css` resolves to; all gates pass, and the GitHub run is green

## Outcome

- **Decision: the shape the ticket proposes, no open choice.** A single-mode token whose alias chain reaches a token of the brand's mode is declared again, with the same `var()` reference, in that brand's `themes/<brand>.css`; it stays in `variables.css` on `:root` too, so a page without `data-brand` on any element behaves as before. The chain may run through other single-mode tokens (`card.accent` → `button.background` → `action.background` is repeated as a whole); a token that only reaches primitives stays on `:root` only. Alternatives were not needed: declaring them only in the themes would leave `variables.css` short of tokens for pages without a brand, and resolved values in the themes would break the "aliases stay references" contract of the CSS output.

  ```css
  /* before: variables.css only */
  :root {
    --button-background: var(--action-background);
  }
  [data-brand='brandb'] {
    --action-background: var(--color-green-600);
  }

  /* after: themes/brandb.css also holds the dependent token */
  [data-brand='brandb'] {
    --action-background: var(--color-green-600);
    --button-background: var(--action-background);
  }
  ```

- **Scope:** CSS themes only. `variables.css`, `base.css` and the per-brand Tailwind files are unchanged: the `<brand>/tailwind.*` files are resolved, single-brand builds of the brand collections and do not need the copy; the shared `tailwind.css` already points at the custom properties. `base.css` resolves such a token through the first mode (alphabetical) of each multi-mode collection, as before; the Outputs reference now says so.
- **Code** (`@dta/build`): `aliasesInto(merged, to, through)` in `tree.ts` walks each token's alias chain in the merged tree of one brand (memoised, cycle-safe; broken and circular aliases are already left out by 119) and returns the single-mode tokens that reach a brand origin. `buildOutputs` adds them to the `css-theme` filter only. No public API change.
- **`dta diff`:** `cssBindings` keeps binding these tokens to `:root` only (the theme rule's candidates are the brand modes). The revert plan still puts them back in the theme rules: the page loads the theme files, `PAGE_DECLARATIONS_SCRIPT` finds those rules, and `declares()` reverts any page rule of a variable that only one collection · mode declares (TICKET-111). Covered by a new `bindings.test.ts` case.
- **Tests:** `build.test.ts`, "single-mode tokens that alias brand tokens (TICKET-093)": the theme files declare `--button` and `--card` (through another single-mode token) with the same reference; `--border` / `--outline` (primitives only) stay out of the themes; `variables.css`, `base.css` and the brand Tailwind files equal a build without the dependent tier; nothing is repeated when `collections` leaves the brand collection out. `bindings.test.ts`: such a token is bound to `:root` only. New `site/nested-brands.e2e.test.ts` (in `test:contrast`, so in the CI job "site"): the Learn `multi-brand` example plus a single-mode `Component.Value.json`, built with `bin/dta.js`, loaded into Chromium as `<html data-brand="branda">` with a nested `<section data-brand="brandb">`; the nested box has BrandB's green background, 999px radius and green `card.accent`, the root box BrandA's, the primitive-only border is blue in both. Fails without the fix (checked by stashing `build.ts`).
- **Docs:** Brands and themes: the caution is replaced by a section "Tokens that alias brand tokens" with the theme file of a real run of the extended `multi-brand` example. Token patterns: the caution is a note (a single-mode component tier now works with nested brands; brand modes on the component tier are for overrides). Outputs reference: new section on these tokens and on what `base.css` resolves them to.
- **Snapshots:** no fixture has a single-mode collection that aliases a brand collection (`brand-ab`'s and `daisyui`'s Primitives hold raw values), so build output is unchanged and nothing was re-recorded. The site's tokens have no such alias either: `site/output/css` is byte-identical with and without the change, `pnpm report:tokens` rewrote `tokens-css.ts` unchanged, so no screenshots and no diff re-record were needed.
- **Files touched:** `packages/build/src/tree.ts`, `build.ts`, `build.test.ts`, `bindings.test.ts`, `site/nested-brands.e2e.test.ts`, `site/package.json` (`test:contrast`), `site/src/content/docs/guides/brands-and-themes.mdx`, `learn/patterns.mdx`, `reference/outputs.mdx`.
- **Gates** (Node 24): prettier, typecheck, boundaries pass; `TERM=xterm-256color CI=true pnpm test` 1190 passed (149 skipped); `snapshot:check` 41 passed, none changed; `pnpm site:build` 137 pages, links valid; `test:contrast` 152 passed (6 files, incl. the new one); diff e2e (`DTA_E2E=1`) 3 passed. Nothing committed or pushed.

**Closed 2026-10-21.** GitHub run 39688510420 (CI, ee0a71e) green.
