# @dta/build

Turns a `@dta/core` token model into output files: CSS variables, a JS colour palette and Tailwind v3/v4 files. Pure and in memory: nothing is read or written, the caller writes the returned files. Spec: [docs/specs/build-package.md](../../docs/specs/build-package.md).

```ts
import { parseTokenFiles } from '@dta/core'
import { buildOutputs } from '@dta/build'

const { model } = parseTokenFiles(tokenFiles)
const { files, diagnostics } = await buildOutputs(model, { brands: ['BrandA', 'BrandB'] })
// files: [{ path: 'output/css/base.css', content: '…' }, …], sorted by path
```

## Options

| Option            | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `brands`          | Modes of the multi-mode collections to build themes for (default: none) |
| `collections`     | Only build from these collections (default: all)                        |
| `css.outDir`      | CSS directory (default `output/css`)                                    |
| `tailwind.outDir` | Tailwind directory (default `output/tailwind`)                          |

The JS palette is always `output/js/colorpalette.js` (same as the v1 build).

## Files

- `base.css`, `variables.css`, `colorpalette.js`, `tailwind.css`, `tailwind.tokens.ts` from the single-mode collections.
- Per brand: `themes/<brand>.css` and `<brand>/tailwind.css`, `<brand>/tailwind.tokens.ts` in the Tailwind directory.

## Contract

- **Parity:** for both fixtures the files are byte-identical to the v1 `build` snapshots in `test/snapshots/*/build/files/output/{css,js,tailwind}`.
- **Deterministic:** the same model gives the same files in the same order.
- **No throwing for data problems:** diagnostics with codes `broken-reference`, `unknown-brand`, `unknown-collection`, `invalid-option` (warnings) and `dangling-alias`, `circular-alias` (errors).
- **Broken aliases (TICKET-119):** a dangling or circular alias is an error, worded as `dta lint` words it (`danglingAliasMessage`, `circularAliasMessage` and `aliasProblems` in `@dta/core`). Its token, and every alias whose chain runs into it, is left out of every file, so no file holds a `var()` that refers to itself or an unresolved `{…}`. The other files still come back (`dta diff` reads the CSS of a base with such an error); a caller that writes files writes none while there are errors, as `dta build` does.
- Known output quirks of the v1 build are kept on purpose and listed in TICKET-039.
