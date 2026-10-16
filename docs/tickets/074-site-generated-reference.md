# TICKET-074: Generated reference, published schemas and `llms.txt`

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** M
**Blocked by:** 069
**Status:** done
**Spec:** [docs-site](../specs/docs-site.md) (decision 9)

## What to build

The Reference section's command and config pages are generated at site build from the real CLI (`--help`) and the config schema; `dta.config.schema.json` and the token-file schema have stable URLs for `$schema`; `llms.txt` and `llms-full.txt` describe the docs for agents.

## Acceptance criteria

- [x] `@dta/cli` exposes the config JSON Schema; a test pins that it accepts both fixture configs and rejects an unknown key and `outputs.docs`
- [x] Generator runs before `astro build`; generated files git-ignored; a test checks every registered command and option appears
- [x] Hand-written text the generator now covers is removed (one source)
- [x] `llms.txt` / `llms-full.txt` generated from the docs content
- [x] All gates pass plus the site job, and the GitHub run is green

## Outcome

- `@dta/cli` exposes `configJsonSchema()` (Zod → JSON Schema draft 2020-12, input side) and `commandReference()`. Every config key has a `.describe()` text (in `@dta/cli`, `@dta/lint` and `@dta/visual-diff`); a test fails when one is missing, so the generated page has no empty rows. The config accepts a `$schema` key so a `dta.config.json` can point at the published schema.
- `diff.stories` is a plain union now (was a preprocessed discriminated union), so the JSON Schema describes what users write: `stories` and its `type` may be left out. Parsing results are unchanged (existing tests).
- `site/scripts/generate-reference.ts` (`pnpm --filter dta-site reference`, run before `astro dev/build/check`) writes `reference/commands.md` (from `dta <command> --help`), `reference/configuration.md` (from the JSON Schema), `public/schemas/{dta.config,token-file}.schema.json`, `public/llms.txt` and `public/llms-full.txt` (MDX stripped, `?raw` code inlined). All git-ignored.
- The hand-written command table on the Reference index is gone; the index links the generated pages, the schemas and the llms files.
- Links in `llms.txt` and the schemas' `$id` wait for the domain (075).
