# Fixtures

Three self-contained projects the CLI snapshot test runs against (reference snapshots in `test/snapshots/`, originally captured from v1 to prove parity, TICKET-035). Run commands from inside a fixture folder.

| Fixture | Source | What it covers |
|---|---|---|
| `brand-ab/` | Synthetic, hand-designed (generated once, then committed) | The 3-layer model: `Primitives` (1 mode), `Brand(Alias)` (modes `BrandA`, `BrandB`), `ScreenType` (modes `Desktop`, `Tablet`, `Mobile`; configured as `breakpoints`, mobile-first, TICKET-091). Aliases into Primitives, parentheses in a collection name, all token types (color, number, string), pixel/opacity/blur scopes, per-brand CSS + Tailwind output. Lint config enables the configurable rules and yields warnings (naming pattern, duplicate values). |
| `brand-ab-problems/` | `brand-ab/tokens/` with three deliberate flaws (TICKET-113) | The playground's "Example with problems": one finding per default lint rule. BrandB's `Colors.Brand.Accent` aliases `Colors.Foundation.Sky.550`, which does not exist (`no-dangling-aliases`); BrandA's `Colors.Surface.Muted` and `Colors.Text.Muted` alias each other (`no-circular-aliases`); the primitives' one mode keeps Figma's default name, `Primitives.Mode 1.json` (`no-default-mode-names`). No lint section in its config, so `dta lint` runs the default rules, as the playground does; `site/src/playground/analyse.test.ts` checks the playground finds exactly what `dta lint` prints. |
| `daisyui/` | Public daisyUI Figma library export (`docs/token-files/design-tokens-daisyui.json`) | A structurally different input: plugin export imported with `pull --from-file`, emoji-heavy names (`stripEmojis`), ~40 single-token-per-mode collections, Figma default mode names. Lint fails with errors (`no-default-mode-names`), so the non-zero exit path is covered. |

`brand-ab/tokens-base/` is an earlier version of the same token set, the base for `dta diff` (scenario `diff-tokens`): `Colors.Foundation.Blue.500` and `Dimensions.spacing.8` have other values, BrandB's `Colors.Brand.Accent` aliases another colour, `Dimensions.radius.pill` does not exist yet and `Colors.Foundation.Steel.500` still exists. Other commands only read `tokens/`.

`brand-ab/src/` holds a few hard-coded values (and one line marked `dta-audit-ignore`) for the `dta audit` scenarios; no other command reads it.

All brand names are generic placeholders (BrandA, BrandB). Never add real customer names here.

## Regenerating `daisyui/tokens/`

From `test/fixtures/daisyui/`:

    dta pull --from-file ../../../docs/token-files/design-tokens-daisyui.json

(`brand-ab/tokens/` is hand-authored; edit the files directly. `brand-ab-problems/tokens/` is a copy of it with the three edits above; keep it in step when brand-ab changes.)

## Expected behaviour

| Command | `brand-ab` | `brand-ab-problems` | `daisyui` |
|---|---|---|---|
| `build` | success | exit code 1, 2 errors (`dangling-alias`, `circular-alias`), writes nothing (TICKET-119) | success |
| `lint` | success, 8 warnings | exit code 2, 3 errors | exit code 2, 13 errors |
| `graph` | success, 4 orphans | success, 1 cycle, 1 dangling alias, 4 orphans | success, no cycles |
