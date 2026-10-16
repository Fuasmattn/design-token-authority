# TICKET-072: Docs content (Start, Guides, Reference, Contribute) and a slim README

**Phase:** 8 — Token Engine Overhaul, Epic 7 (website)
**Priority:** High
**Effort:** M
**Blocked by:** 067, 069
**Status:** open
**Spec:** [docs-site](../specs/docs-site.md) (decision 8)

## What to build

Users find everything in the docs: what DTA is and why automate (one-off vs ongoing), quick start, core concepts, getting tokens out of Figma per plan, multi-brand and theming, Tailwind v4 setup, CI with GitHub Actions, migrating from v1, the hand-written parts of the reference (token-file format, outputs, lint rules, exit codes) and Contribute (architecture, package boundaries, ADRs, spec and ticket workflow, release). The README becomes pitch, quick start and links.

## Acceptance criteria

- [ ] Every command example was run against a fixture and its output copied (paths `output/…`, no `lint --fix`)
- [ ] `docs/token-files/input-format.md` and `docs/migration/v1-to-v2.md` moved into the site; old paths keep a one-line pointer
- [ ] Examples use BrandA/BrandB and the fixtures only
- [ ] README contains nothing that contradicts the CLI; CLAUDE.md points to the site for user docs
- [ ] All gates pass plus the site job and link check, and the GitHub run is green
