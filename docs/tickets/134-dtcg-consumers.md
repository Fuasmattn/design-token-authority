# TICKET-134: Build, lint, diff, queries and audit on the new types

**Phase:** 12 — DTCG 2025.10
**Priority:** High
**Effort:** L (split by package if needed)
**Blocked by:** 133
**Status:** done
**Spec:** [dtcg-2025-10](../specs/dtcg-2025-10.md) (decisions 9, 10; slice 3)

## What to build

- **Build:** structured values reach Style Dictionary so the DTCG transforms already listed in `CSS_BASE_TRANSFORMS` apply; composites become CSS shorthands (`box-shadow`, `font`, `transition`, `border`, gradients); dimensions keep their unit; sRGB colours stay hex, other colour spaces use the matching CSS function (`oklch()`, `color(display-p3 …)`); Tailwind v3 and v4 keys for the new types; JS output with the values as written.
- **Lint:** `color-contrast` converts any colour space to sRGB (gamut-mapped) and says when it clipped; `no-duplicate-values` uses `sameValue`.
- **`dta diff`:** token change set compares with `sameValue` and prints with `formatValue`.
- **Token queries and `dta audit`:** dimensions with units (rem × 16 only where a unit says rem), `--type` lists all types, `token find` matches structured values.

## Acceptance criteria

- [x] A fixture `test/fixtures/dtcg-2025` with one file per feature, mostly from the report's examples; its CLI scenarios recorded by name
- [x] CSS for every composite checked in a browser test (the shorthand renders)
- [x] Contrast test with an `oklch` pair, clipped and not clipped
- [x] Existing snapshots unchanged, except `daisyui/build` (re-recorded by name, see notes)
- [x] Learn page "Where DTA differs" and the Outputs reference updated
- [x] All gates pass, and the GitHub run is green

## Notes

Decisions made while building it, for review:

- **Style Dictionary 4.4 → 5.7.** Version 4 wrote `[object Object]` for 2025.10 values; 5 formats them all. **One existing snapshot changed: `daisyui/build`** (`variables.css`, 22 lines). Version 4 left aliases whose names contain spaces or parentheses (`{tailwind.spacing.2 (8)}`) in the CSS as literal text, which is invalid CSS; version 5 resolves them to `var(--tailwind-spacing-2-8)`, a variable defined in the same file. Re-recorded with `pnpm snapshot:record --scenario daisyui/build`; please review that diff. Every other snapshot is unchanged.
- **Alpha rounding:** Style Dictionary 5 writes `rgba(0, 0, 0, 0.5019607843137255)`, 4 wrote `0.5`; a transform (`value/alpha-rounded`) rounds to two decimals, so existing outputs stay the same.
- **Values are prepared before Style Dictionary** (`prepareValue` in `build.ts`): colour objects anywhere (also inside composites) become CSS text, sRGB as hex, other spaces as written (`oklch()`, `color(display-p3 …)`; `hsl`/`hwb` are sRGB and become hex); a `$ref` to a whole token becomes an alias, so `variables.css` keeps `var()` references inside composites; a token that points into a value is written resolved; weight keywords become numbers (`semi-bold` → `600`, CSS has no such keyword).
- **Gradient** has no CSS shorthand of its own (no angle in DTCG), so it is written as the colour-stop list: `var(--color-sky) 0%, var(--color-grass) 100%`, used as `linear-gradient(to right, var(--gradient-brand))`.
- **strokeStyle** objects become the keyword (`dashed`): CSS borders have no dash lengths.
- **`$root`** tokens are named `--group-root` (from TICKET-133). Still open for you if you prefer `--group`.
- **JS output** uses Style Dictionary's js transforms plus the DTCG shorthands, so composites are one string, colours hex.
- **Tailwind:** keys for `fontFamily`, `fontWeight`, `shadow`, `cubicBezier` (and `duration` in v3); a `dimension` maps by the words in its name (`dimensionKind`: radius, spacing/gap/padding…, font-size, blur, breakpoint), since DTCG files carry no Figma scopes. v3 values are now escaped inside their quotes (a font stack with `'` broke the generated TypeScript).
- **Colour spaces in core** (`color-spaces.ts`, `toSrgb`): all 14 spaces of the Color module to sRGB, following the CSS Color 4 sample code, clipped with a flag. Checked against known values (`oklch(0.7 0.15 250)` = `#4ba3f7`, the same as Style Dictionary's conversion). `colorHex`, `sameValue`, `dta token find` and the contrast check use it; contrast adds a `contrast-clipped` warning when a colour lies outside sRGB.
- **`dta token find`** matches dimensions and durations with units (`0.2s` = `200ms`, `16` = `16px`), weights as number or keyword, font families by first name, other values by their text.
- **`dta audit`** reads `dimension` tokens like numbers (px and rem, 16px root) and `fontFamily` lists by their first name.
- **Fixture `dtcg-2025`** (see `test/fixtures/README.md`) with scenarios `build`, `lint`, the four `graph` formats, `clean` and a new `token-get-composite`, each recorded by name.
- **Browser test** `site/dtcg-css.e2e.test.ts` (in `test:contrast`): every composite renders in Chromium, colour spaces stay as written, `data-brand` switches a composite.
- **Test fix:** `site/browser-packages.test.ts` picked the first output with an `entryPoint` as the playground's entry; lazy `import()` chunks have one too, and the new chunk order made it inspect a lazy chunk. It now picks the output whose entry is `Playground.tsx`. The playground's first load is unchanged (no `@dta/*`, no zod).
