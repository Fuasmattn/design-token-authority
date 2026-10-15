# Parity fixtures

Two self-contained projects that the legacy and the new (`@dta/*`) pipeline are both run against. Golden outputs (TICKET-035) are captured from these. Run commands from inside a fixture folder.

| Fixture | Source | What it covers |
|---|---|---|
| `brand-ab/` | Synthetic, hand-designed (generated once, then committed) | The 3-layer model: `Primitives` (1 mode), `Brand(Alias)` (modes `BrandA`, `BrandB`), `ScreenType` (modes `Desktop`, `Tablet`, `Mobile`). Aliases into Primitives, parentheses in a collection name, all token types (color, number, string), pixel/opacity/blur scopes, per-brand CSS + Tailwind output. Lint config enables the configurable rules and yields warnings (naming pattern, duplicate values). |
| `daisyui/` | Public daisyUI Figma library export (`docs/token-files/design-tokens-daisyui.json`) | A structurally different input: plugin export imported with `pull --from-file`, emoji-heavy names (`stripEmojis`), ~40 single-token-per-mode collections, Figma default mode names. Lint fails with errors (`no-default-mode-names`), so the non-zero exit path is covered. |

All brand names are generic placeholders (BrandA, BrandB). Never add real customer names here.

## Regenerating `daisyui/tokens/`

From `test/fixtures/daisyui/`:

    dta pull --from-file ../../../docs/token-files/design-tokens-daisyui.json

(`brand-ab/tokens/` is hand-authored; edit the files directly.)

## Expected legacy behaviour

| Command | `brand-ab` | `daisyui` |
|---|---|---|
| `build` | success | success |
| `lint` | success, 8 warnings | exit code 2, 13 errors |
| `graph` | success, 4 orphans | success, no cycles |
