# TICKET-074: Generated reference, published schemas and `llms.txt`

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** Medium
**Effort:** M
**Blocked by:** 069
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decision 9)

## What to build

The Reference section's command and config pages are generated at site build from the real CLI (`--help`) and the config schema; `dta.config.schema.json` and the token-file schema have stable URLs for `$schema`; `llms.txt` and `llms-full.txt` describe the docs for agents.

## Acceptance criteria

- [ ] `@dta/cli` exposes the config JSON Schema; a test pins that it accepts both fixture configs and rejects an unknown key and `outputs.docs`
- [ ] Generator runs before `astro build`; generated files git-ignored; a test checks every registered command and option appears
- [ ] Hand-written text the generator now covers is removed (one source)
- [ ] `llms.txt` / `llms-full.txt` generated from the docs content
- [ ] All gates pass plus the site job, and the GitHub run is green
