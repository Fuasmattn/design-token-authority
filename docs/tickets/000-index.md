# design-token-authority — Ticket Index

This index lists all feature tickets for turning this project into a whitelabel design token tool.
Tickets are grouped by phase and ordered by recommended implementation sequence.

---

## Phase 1 — Immediate Fixes

Fix correctness issues and security problems before any new features.

| # | Ticket | Priority | Effort | Status |
|---|---|---|---|---|
| [001](./001-fix-credentials-gitignore.md) | Remove committed credentials, add .env.example | **Critical** | XS | **Done** |
| [002](./002-upgrade-style-dictionary-v4.md) | Upgrade Style Dictionary v3 → v4 | High | M | **Done** |
| [003](./003-fix-css-transform-units.md) | Fix missing units in CSS output (blur, opacity) | High | S | **Done** |
| [004](./004-fix-redundant-css-naming.md) | Fix repeated segments in CSS variable names | Medium | S | **Done** |
| [005](./005-standardize-ci-secret-names.md) | Standardize env variable names across local and CI | Medium | XS | **Done** |
| [006](./006-fix-meta-mode1-naming.md) | Rename default Figma mode name in meta collection | Low | XS | Open |
| [025](./025-switch-to-vitest.md) | Switch from Jest to Vitest | Medium | S | **Done** |
| [027](./027-rename-and-readme.md) | Rename project and replace README | Medium | XS | **Done** |

---

## Phase 2 — Developer Experience

Turn the project into a proper CLI tool, usable by other projects without forking.

| # | Ticket | Priority | Effort | Status |
|---|---|---|---|---|
| [007](./007-cli-framework.md) | Build CLI with subcommands (pull, push, build, init) | High | M | **Done** |
| [008](./008-project-config-schema.md) | Project config schema with Zod validation | High | M | **Done** |

---

## Phase 3 — Output Targets

Add output formats for web and mobile development.

| # | Ticket | Priority | Effort | Status |
|---|---|---|---|---|
| [009](./009-tailwind-v3-output.md) | Tailwind v3 theme output | High | M | **Done** |
| [010](./010-tailwind-v4-output.md) | Tailwind v4 @theme CSS output | Medium | S | **Done** |
| [026](./026-per-brand-build-and-tailwind-theme.md) | Per-brand build output + Tailwind theme integration | High | M | **Done** |
| [011](./011-ios-swift-output.md) | iOS Swift output (Color, CGFloat, Font) | Medium | M | Open |
| [012](./012-android-xml-output.md) | Android XML resources (colors.xml, dimens.xml) | Medium | M | Open |
| [013](./013-android-compose-output.md) | Android Jetpack Compose output (Kotlin) | Low | M | Open |

---

## Phase 4 — Structure Intelligence

Make the tool understand and auto-discover Figma variable structure.

| # | Ticket | Priority | Effort | Status |
|---|---|---|---|---|
| [014](./014-figma-structure-autodiscovery.md) | Figma collection structure autodiscovery | High | L | **Done** |
| [015](./015-init-wizard.md) | `dta init` onboarding wizard | High | M | **Done** |
| [016](./016-multi-brand-composition.md) | Multi-brand token composition model | Medium | L | **Done** |
| [017](./017-token-dependency-graph.md) | Token alias dependency graph | Low | M | **Done** |

---

## Phase 5 — Quality & Validation

Plausibility checks, linting, and guardrails.

| # | Ticket | Priority | Effort | Status |
|---|---|---|---|---|
| [018](./018-token-linter.md) | Token linter with configurable rules | High | L | **Done** |
| [019](./019-naming-convention-enforcement.md) | Naming convention rules (extends linter) | Medium | S | Open |
| [020](./020-sync-diff-report.md) | Human-readable diff report on push/sync | Medium | S | **Done** |
| [021](./021-deletion-safety-prune.md) | `dta prune` for orphaned variables | Low | M | Open |

**018 first; 019 is an extension of 018. 020 and 021 are independent.**

---

## Phase 6 — Documentation & Visualization

Token visibility for designers and developers.

| # | Ticket | Priority | Effort | Status |
|---|---|---|---|---|
| [022](./022-token-docs-site.md) | Static token documentation site generator | Medium | L | **Done** |
| [023](./023-visual-regression-testing.md) | Visual regression testing with Playwright | Low | L | **Done** |
| [024](./024-ai-config-generation.md) | AI-assisted config generation (Claude API) | Low | L | Open |

---

## Phase 7 — AI Interop

Position the tool as the governance and context layer for AI-era design and
coding workflows. These tickets target the parts of the value chain that
Figma and the design/coding AI tools will not build themselves.

| # | Ticket | Priority | Effort | Status |
|---|---|---|---|---|
| [028](./028-design-md-generator.md) | `DESIGN.md` / `AGENTS.md` generator for AI coding agents | **High** | M | Open |
| [029](./029-mcp-server.md) | MCP server exposing token graph to AI tools | **High** | M | Open |
| [030](./030-ai-code-audit.md) | `dta audit` — detect hardcoded values in AI-generated code | **High** | M | Open |
| [031](./031-ai-design-brief-export.md) | Brand brief export for AI design generators (Stitch, v0, …) | Medium | S | Open |
| [032](./032-native-figma-dtcg-migration.md) | Migrate to Figma's native W3C DTCG export/import | Medium | M | Open |

**Recommended order:** 028 first (static context is the cheapest win and unblocks 031). 029 next (biggest leverage; turns the tool into a live authority). 030 alongside or after 029 — they reinforce each other. 031 is light and can slot in any time. 032 is a tracking/long-running ticket paced by Figma.

---

## Dependency Map

```
001 ──────────────────────────────── (no deps)
005 ──────────────────────────────── (no deps, do with 001)
002 ──────────────────────────────── (no deps)
  └─► 003 ──────────────────────────────── (no deps after 002)
  └─► 004 ──────────────────────────────── (no deps after 002)
  └─► 009/010/011/012/013 (output formatters)
       └─► 026 (per-brand build extends 009+010)
006 ──────────────────────────────── (no deps)
008 ──────────────────────────────── (no deps)
  └─► 007 (CLI loads config)
       └─► 014 (analyze subcommand)
            └─► 015 (init uses analyze)
                 └─► 024 (AI path through init)
016 ──► 011/012/013 (brand-aware mobile outputs; CSS+Tailwind covered by 026)
017 ──► 018 (linter reuses graph)
     └─► 022 (docs site shows alias chains)
018 ──► 019 (naming rules extend linter)
020 ──────────────────────────────── (extends push command)
021 ──────────────────────────────── (new prune command)
022 ──────────────────────────────── (docs formatter)
023 ──► 003 (units must be correct first)

028 ──► 017, 022, 009/010 (DESIGN.md reuses graph + docs enumeration + formatter identifiers)
029 ──► 017, 018, 028 (MCP server reuses graph, lint, and serves DESIGN.md as a resource)
030 ──► 017, 018 (audit reuses graph + lint primitives)
031 ──► 016 (per-brand briefs)
032 ──► 014, 015 (autodiscovery + wizard branches update when native export lands)
```

---

## Effort Key

| Label | Rough Scope |
|---|---|
| XS | < 1 hour |
| S | half day |
| M | 1–2 days |
| L | 3–5 days |
