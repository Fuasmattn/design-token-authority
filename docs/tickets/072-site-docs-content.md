# TICKET-072: Docs content (Start, Guides, Reference, Contribute) and a slim README

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** M
**Blocked by:** 067, 069
**Status:** done
**Spec:** [docs-site](../specs/docs-site.md) (decision 8)

## What to build

Users find everything in the docs: what DTA is and why automate (one-off vs ongoing), quick start, core concepts, getting tokens out of Figma per plan, multi-brand and theming, Tailwind v4 setup, CI with GitHub Actions, migrating from v1, the hand-written parts of the reference (token-file format, outputs, lint rules, exit codes) and Contribute (architecture, package boundaries, ADRs, spec and ticket workflow, release). The README becomes pitch, quick start and links.

## Acceptance criteria

- [x] Every command example was run against a fixture and its output copied (paths `output/…`, no `lint --fix`)
- [x] `docs/token-files/input-format.md` and `docs/migration/v1-to-v2.md` moved into the site; old paths keep a one-line pointer
- [x] Examples use BrandA/BrandB and the fixtures only
- [x] README contains nothing that contradicts the CLI; CLAUDE.md points to the site for user docs
- [x] All gates pass plus the site job and link check, and the GitHub run is green

## Notes

- Pages (`site/src/content/docs/`): Start (What DTA is, Quick start, Core concepts), Guides (overview, Getting tokens out of Figma, Brands and themes, Tailwind, CI with GitHub Actions, Migrating from v1, plus the two `dta diff` guides from 086/089), Reference (overview with every command's options, Token files, Outputs, Lint rules, Exit codes), Contribute. The generated command and config reference follows in 074.
- Command output was copied from runs on copies of the fixtures (`brand-ab`: build, lint, graph, `diff --tokens-only --base tokens-base`; `daisyui`: `pull --from-file`, lint) or from the recorded snapshots (`pull -o pulled` and `push --dry-run` against the Figma recording). The Tailwind v4 example was compiled with Tailwind 4.3.3 against the fixture's output. Paths are `output/…`; `lint --fix` is documented as accepted without fixes.
- `docs/token-files/input-format.md` and `docs/migration/v1-to-v2.md` moved into the site (Reference › Token files, Guides › Migrating from v1); the old files are one-line pointers (the JSON Schema stays in `docs/token-files/`).
- README: pitch, status, quick start from a clone, commands, links to the docs pages. CLAUDE.md says user docs live on the website.
- **Bug found and fixed while running the fixtures outside the repo:** a `dta.config.ts` or `.js` with `export default` failed to load in a project without `"type": "module"` (tsx sent it through the CommonJS loader: "Cannot require() ES Module … in a cycle"). The loader now uses tsx's scoped `tsImport` and unwraps CommonJS interop; `tsx` moved to `@dta/cli`'s dependencies. Regression tests in `packages/cli/test/bin.test.ts` (`.ts`, `.js`, `.mts` outside a module package).
- Documented honestly, found while writing (for the maintainer):
  - DTA is not on npm: `npx dta` runs an unrelated package called `dta`. The docs say so and show running from a clone; the landing page still shows `npx dta init`.
  - `dta init` writes `import { defineConfig } from 'design-token-authority'`, which a project cannot resolve before the release (workaround in the quick start).
  - Breakpoint modes (`ScreenType`) are not written as CSS by `dta build`; `outputs.ios`, `outputs.android`, `outputs.css.prefix` and `outputs.tailwind.version` are accepted but unused.
  - `color-contrast` compares raw hex tokens only, and the last mode read wins (no per-brand check).
