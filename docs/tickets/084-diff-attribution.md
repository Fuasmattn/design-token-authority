# TICKET-084: Explain visual changes by token

**Phase:** 8 — Token Engine Overhaul, Epic 8 (dta diff)
**Priority:** High
**Effort:** L
**Blocked by:** 083
**Status:** done
**Spec:** [visual-diff](../specs/visual-diff.md) (decisions 8, 9)

## What to build

Every changed story is marked explained (its changed regions trace to changed tokens) or unexplained, and results are grouped by token change: "color.action 600 → 700 explains 96 of 100 changed stories; 4 are unexplained". Thresholds apply by cause.

## Acceptance criteria

- [x] Element-level attribution by revert, as recommended in [083](./083-diff-attribution-spike.md): for each changed story, each changed token (grouped per collection · mode, split when a group does not fully explain a story) is set back to its base value in the head page; elements whose computed style (incl. `::before`/`::after`) or box changes are its dependents
- [x] `@dta/build` exposes, per token and mode, the CSS variable name and the selector it was written under (`:root`, `[data-brand="…"]`), so the revert rule matches the build; primitives built as literals are reverted through the semantic variables that reference them (`affected` entries)
- [x] A changed pixel is explained when it lies in a dependent's head or base box (2 px tolerance); a story is explained when all its changed pixels are; unexplained stories report the pixel count and bounding region
- [x] Each result lists, per story, the explaining tokens with dependent count and explained pixels (tokens may overlap)
- [x] Fixture site at two commits: token-only change → all explained; component change → unexplained; a token in one mode only explains only that mode's elements
- [x] Attribution cost logged per story; it runs only on changed stories
- [x] Thresholds by cause in config; exit code with `--fail-on-change` counts only unexplained changes above threshold plus unreviewed explained groups
- [x] `result.json` schema versioned and documented
- [x] All gates pass, and the GitHub run is green

## Notes

- `@dta/build`: `cssBindings(model, options)` (variable, selector and value per token and mode, from the CSS `buildOutputs` writes), `cssVariableName`, `parseCssVariables`.
- `@dta/visual-diff`: `planReverts`, `DEPENDENTS_SCRIPT`, `attributePixels`, `reviewStories`, `diffResultSchema`; `compareStories` takes an `attribute` step that runs for changed stories only. README section "Explaining changes by token".
- Config: `diff.thresholds: { explained, unexplained }` (changed-pixel ratios, default 0). Verdict `pass` / `review` / `fail`; `--fail-on-change` exits 1 unless `pass` (without stories: on any token change, as before). Approval by label follows in 086.
- `result.json`: [docs/diff/result.md](../diff/result.md), JSON Schema generated to `docs/diff/result.schema.json` (`pnpm run schema:generate`, now `scripts/generate-schemas.ts` for both schemas).
- End to end (`packages/cli/test/diff-visual.test.ts`): token change → explained by `Brand (Base · Value)`; a change in theme mode A only → explained by `accent (Theme · A)` with the one element inside `[data-brand="a"]`; component change → unexplained, verdict `fail`.
- Dogfood on the website (`action.bg` Light 600 → 700 plus `space.2` 8 → 12): 9 of 9 changed stories explained (`space.2` 8, `action.bg` 7), about 0.8 s attribution per changed story (one extra page load). A Chip radius change alone: 3 stories unexplained, verdict `fail`.
