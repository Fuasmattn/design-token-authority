# design-token-authority — Ticket Index

This index lists all feature tickets for turning this project into a whitelabel design token tool.
Tickets are grouped by phase and ordered by recommended implementation sequence.

---

## Phase 1 — Immediate Fixes

Fix correctness issues and security problems before any new features.

| #                                           | Ticket                                             | Priority     | Effort | Status   |
| ------------------------------------------- | -------------------------------------------------- | ------------ | ------ | -------- |
| [001](./001-fix-credentials-gitignore.md)   | Remove committed credentials, add .env.example     | **Critical** | XS     | **Done** |
| [002](./002-upgrade-style-dictionary-v4.md) | Upgrade Style Dictionary v3 → v4                   | High         | M      | **Done** |
| [003](./003-fix-css-transform-units.md)     | Fix missing units in CSS output (blur, opacity)    | High         | S      | **Done** |
| [004](./004-fix-redundant-css-naming.md)    | Fix repeated segments in CSS variable names        | Medium       | S      | **Done** |
| [005](./005-standardize-ci-secret-names.md) | Standardize env variable names across local and CI | Medium       | XS     | **Done** |
| [006](./006-fix-meta-mode1-naming.md)       | Rename default Figma mode name in meta collection  | Low          | XS     | Open     |
| [025](./025-switch-to-vitest.md)            | Switch from Jest to Vitest                         | Medium       | S      | **Done** |
| [027](./027-rename-and-readme.md)           | Rename project and replace README                  | Medium       | XS     | **Done** |

---

## Phase 2 — Developer Experience

Turn the project into a proper CLI tool, usable by other projects without forking.

| #                                     | Ticket                                               | Priority | Effort | Status   |
| ------------------------------------- | ---------------------------------------------------- | -------- | ------ | -------- |
| [007](./007-cli-framework.md)         | Build CLI with subcommands (pull, push, build, init) | High     | M      | **Done** |
| [008](./008-project-config-schema.md) | Project config schema with Zod validation            | High     | M      | **Done** |

---

## Phase 3 — Output Targets

Add output formats for web and mobile development.

| #                                                  | Ticket                                              | Priority | Effort | Status   |
| -------------------------------------------------- | --------------------------------------------------- | -------- | ------ | -------- |
| [009](./009-tailwind-v3-output.md)                 | Tailwind v3 theme output                            | High     | M      | **Done** |
| [010](./010-tailwind-v4-output.md)                 | Tailwind v4 @theme CSS output                       | Medium   | S      | **Done** |
| [026](./026-per-brand-build-and-tailwind-theme.md) | Per-brand build output + Tailwind theme integration | High     | M      | **Done** |
| [011](./011-ios-swift-output.md)                   | iOS Swift output (Color, CGFloat, Font)             | Medium   | M      | Open     |
| [012](./012-android-xml-output.md)                 | Android XML resources (colors.xml, dimens.xml)      | Medium   | M      | Open     |
| [013](./013-android-compose-output.md)             | Android Jetpack Compose output (Kotlin)             | Low      | M      | Open     |

---

## Phase 4 — Structure Intelligence

Make the tool understand and auto-discover Figma variable structure.

| #                                             | Ticket                                   | Priority | Effort | Status   |
| --------------------------------------------- | ---------------------------------------- | -------- | ------ | -------- |
| [014](./014-figma-structure-autodiscovery.md) | Figma collection structure autodiscovery | High     | L      | **Done** |
| [015](./015-init-wizard.md)                   | `dta init` onboarding wizard             | High     | M      | **Done** |
| [016](./016-multi-brand-composition.md)       | Multi-brand token composition model      | Medium   | L      | **Done** |
| [017](./017-token-dependency-graph.md)        | Token alias dependency graph             | Low      | M      | **Done** |

---

## Phase 5 — Quality & Validation

Plausibility checks, linting, and guardrails.

| #                                             | Ticket                                   | Priority | Effort | Status   |
| --------------------------------------------- | ---------------------------------------- | -------- | ------ | -------- |
| [018](./018-token-linter.md)                  | Token linter with configurable rules     | High     | L      | **Done** |
| [019](./019-naming-convention-enforcement.md) | Naming convention rules (extends linter) | Medium   | S      | Open     |
| [020](./020-sync-diff-report.md)              | Human-readable diff report on push/sync  | Medium   | S      | **Done** |
| [021](./021-deletion-safety-prune.md)         | `dta prune` for orphaned variables       | Low      | M      | Open     |

**018 first; 019 is an extension of 018. 020 and 021 are independent.**

---

## Phase 6 — Documentation & Visualization

Token visibility for designers and developers.

| #                                         | Ticket                                     | Priority | Effort | Status   |
| ----------------------------------------- | ------------------------------------------ | -------- | ------ | -------- |
| [022](./022-token-docs-site.md)           | Static token documentation site generator  | Medium   | L      | **Done** |
| [023](./023-visual-regression-testing.md) | Visual regression testing with Playwright  | Low      | L      | **Done** |
| [024](./024-ai-config-generation.md)      | AI-assisted config generation (Claude API) | Low      | L      | Open     |

---

## Phase 7 — AI Interop

Position the tool as the governance and context layer for AI-era design and
coding workflows. These tickets target the parts of the value chain that
Figma and the design/coding AI tools will not build themselves.

| #                                           | Ticket                                                      | Priority | Effort | Status                                    |
| ------------------------------------------- | ----------------------------------------------------------- | -------- | ------ | ----------------------------------------- |
| [028](./028-design-md-generator.md)         | `DESIGN.md` / `AGENTS.md` generator for AI coding agents    | **High** | M      | Replaced by 102                           |
| [029](./029-mcp-server.md)                  | MCP server exposing token graph to AI tools                 | **High** | M      | Deferred (agent-interop spec, decision 1) |
| [030](./030-ai-code-audit.md)               | `dta audit` — detect hardcoded values in AI-generated code  | **High** | M      | Replaced by 103                           |
| [031](./031-ai-design-brief-export.md)      | Brand brief export for AI design generators (Stitch, v0, …) | Medium   | S      | Open                                      |
| [032](./032-native-figma-dtcg-migration.md) | Migrate to Figma's native W3C DTCG export/import            | Medium   | M      | Open                                      |

**Recommended order:** 028 first (static context is the cheapest win and unblocks 031). 029 next (biggest leverage; turns the tool into a live authority). 030 alongside or after 029 — they reinforce each other. 031 is light and can slot in any time. 032 is a tracking/long-running ticket paced by Figma.

---

## Phase 8 — Token Engine Overhaul

Strangler rewrite into `@dta/*` packages behind one CLI. See the [spec](../specs/token-engine-overhaul.md) and ADRs [0001](../adr/0001-strangler-rewrite.md), [0002](../adr/0002-pnpm-monorepo-single-cli.md). Open feature tickets above wait until parity.

**Epic 1 — Workspace scaffold & snapshot harness**

| #                                            | Ticket                                 | Priority | Effort | Blocked by | Status |
| -------------------------------------------- | -------------------------------------- | -------- | ------ | ---------- | ------ |
| [033](./033-workspace-scaffold.md)           | pnpm workspace scaffold                | High     | S      | —          | Done   |
| [034](./034-fixture-projects.md)             | Fixture projects for parity testing    | High     | S      | —          | Done   |
| [035](./035-capture-legacy-snapshots.md)     | Capture legacy snapshots               | High     | S      | 034        | Done   |
| [036](./036-cli-skeleton-snapshot-runner.md) | New CLI skeleton + snapshot runner     | High     | M      | 033, 035   | Done   |
| [037](./037-figma-fake.md)                   | Figma API fake with recorded responses | Medium   | M      | 033, 034   | Done   |
| [038](./038-agent-guardrails.md)             | Agent guardrails for the overhaul      | High     | XS     | 033        | Done   |

**Epic 2 — @dta/core** ([spec](../specs/core-token-model.md))

| #                                                | Ticket                                                   | Priority | Effort | Blocked by | Status |
| ------------------------------------------------ | -------------------------------------------------------- | -------- | ------ | ---------- | ------ |
| [040](./040-core-model-parse-serialize.md)       | Token model, DTCG parse/serialize, diagnostics           | High     | M      | 033        | Done   |
| [041](./041-core-color-utils.md)                 | Color utilities                                          | High     | S      | 033        | Done   |
| [042](./042-core-uniqueness-alias-resolution.md) | Name uniqueness and alias resolution with mode selection | High     | M      | 040        | Done   |
| [043](./043-core-graph-analysis.md)              | Graph analysis                                           | High     | M      | 040, 042   | Done   |

**Epic 3 — @dta/figma** ([spec](../specs/figma-package.md))

| #                                       | Ticket                                           | Priority | Effort | Blocked by | Status   |
| --------------------------------------- | ------------------------------------------------ | -------- | ------ | ---------- | -------- |
| [044](./044-figma-client.md)            | Package scaffold and Zod-validated HTTP client   | High     | S      | 033, 037   | Done     |
| [045](./045-figma-export.md)            | Export variables to the token model              | High     | M      | 040, 044   | Done     |
| [046](./046-figma-push-planning.md)     | Plan a push (payload and structured changes)     | High     | L      | 042, 045   | **Done** |
| [047](./047-figma-plugin-importers.md)  | Documented input format, schema, import adapters | Medium   | M      | 040        | **Done** |
| [048](./048-core-structure-analysis.md) | Structure analysis on the model (in `@dta/core`) | Medium   | S      | 040        | **Done** |

**Epic 4 — @dta/build** ([spec](../specs/build-package.md))

| #                                       | Ticket                                   | Priority | Effort | Blocked by | Status   |
| --------------------------------------- | ---------------------------------------- | -------- | ------ | ---------- | -------- |
| [049](./049-build-scaffold-base-css.md) | Package scaffold and base layer CSS      | High     | S      | 033, 040   | **Done** |
| [050](./050-build-shared-css-js.md)     | Shared CSS variables and JS palette      | High     | S      | 049        | **Done** |
| [051](./051-build-brand-themes.md)      | Per-brand CSS themes                     | High     | M      | 049        | **Done** |
| [052](./052-build-tailwind-v4.md)       | Tailwind v4 output                       | High     | M      | 049, 051   | **Done** |
| [053](./053-build-tailwind-v3.md)       | Tailwind v3 output                       | High     | M      | 049, 051   | **Done** |
| [054](./054-build-api-parity.md)        | Public API, options and full parity test | High     | S      | 050–053    | **Done** |

**Epic 5 — @dta/lint** ([spec](../specs/lint-package.md))

| #                                           | Ticket                                     | Priority | Effort | Blocked by | Status |
| ------------------------------------------- | ------------------------------------------ | -------- | ------ | ---------- | ------ |
| [055](./055-lint-scaffold-builtin-rules.md) | Scaffold, validated config, built-in rules | High     | M      | 033, 043   | Done   |
| [056](./056-lint-semantic-naming-rules.md)  | semantic-must-alias and naming-pattern     | High     | S      | 055        | Done   |
| [057](./057-lint-contrast-duplicates.md)    | color-contrast and no-duplicate-values     | High     | M      | 055        | Done   |
| [058](./058-lint-api-parity.md)             | Public API and full parity test            | High     | S      | 056, 057   | Done   |

**Epic 6 — CLI parity ([spec](../specs/cli-parity.md))**

| #                                  | Ticket                                                      | Priority | Effort | Blocked by | Status |
| ---------------------------------- | ----------------------------------------------------------- | -------- | ------ | ---------- | ------ |
| [059](./059-cli-io-layer.md)       | Shared I/O layer, UI helpers, config wiring                 | High     | M      | 058        | Done   |
| [060](./060-cli-lint-command.md)   | `lint` command                                              | High     | S      | 059        | Done   |
| [061](./061-cli-docs-html-port.md) | Docs HTML generator as a package function (decision needed) | High     | M      | 059        | Done   |
| [062](./062-cli-build-command.md)  | `build` command                                             | High     | M      | 059, 061   | Done   |
| [063](./063-cli-graph-command.md)  | `graph` command (four formats)                              | High     | M      | 059        | Done   |
| [064](./064-cli-analyze-clean.md)  | `analyze` and `clean` (new snapshots)                       | High     | M      | 059        | Done   |
| [065](./065-cli-pull-push.md)      | `pull` and `push`                                           | High     | L      | 059, 064   | Done   |
| [066](./066-cli-init-cutover.md)   | `init`, `test:visual` decision, cut-over                    | High     | L      | 060–065    | Done   |

**Epic 6 — exit plan (written early on purpose)**

| #                              | Ticket                                                                            | Priority | Effort | Blocked by | Status |
| ------------------------------ | --------------------------------------------------------------------------------- | -------- | ------ | ---------- | ------ |
| [039](./039-legacy-removal.md) | Remove the legacy code cleanly (parity table, quirk decisions, removal checklist) | High     | M      | Epics 2–6  | Done   |

**Epic 7 — Website ([spec](../specs/docs-site.md))**

| #                                        | Ticket                                                                   | Priority | Effort | Blocked by | Status |
| ---------------------------------------- | ------------------------------------------------------------------------ | -------- | ------ | ---------- | ------ |
| [067](./067-site-remove-dta-docs.md)     | Remove `@dta/docs` and the generated token docs page                     | High     | S      | 039        | Done   |
| [068](./068-site-design-tokens.md)       | DTA Drafting Table as DTA token files, built with `dta build`            | High     | M      | 039        | Done   |
| [069](./069-site-scaffold-theme.md)      | Site scaffold: Astro + Starlight themed by the built tokens, built in CI | High     | M      | 068        | Done   |
| [070](./070-site-components-stories.md)  | Design system section: token pages, component docs and stories           | High     | L      | 069        | Done   |
| [071](./071-site-landing-page.md)        | Landing page from the "J · Drafting Table" mockup                        | High     | L      | 070        | Done   |
| [072](./072-site-docs-content.md)        | Docs content (Start, Guides, Reference, Contribute) and a slim README    | High     | M      | 067, 069   | Done   |
| [073](./073-site-learn.md)               | Learn: DTCG intro and token pattern catalogue                            | Medium   | M      | 069        | Done   |
| [074](./074-site-generated-reference.md) | Generated reference, published schemas and `llms.txt`                    | Medium   | M      | 069        | Done   |
| [075](./075-site-deploy.md)              | Deploy the website on Vercel                                             | Medium   | S      | 069        | Open   |

**Epic 7b — Playground ([spec](../specs/playground.md))**

| #                                                | Ticket                                                                      | Priority | Effort | Blocked by | Status    |
| ------------------------------------------------ | --------------------------------------------------------------------------- | -------- | ------ | ---------- | --------- |
| [076](./076-playground-browser-packages.md)      | Run the `@dta/*` packages in the browser                                    | High     | M      | 069        | Done      |
| [077](./077-playground-input-structure-lint.md)  | Playground: input, structure and lint findings                              | High     | L      | 076        | Done      |
| [115](./115-playground-workspace-layout.md)      | Playground workspace: source bar, summary, tabs, detail panel               | High     | M      | 077        | Done      |
| [116](./116-motion-tokens-and-transitions.md)    | Motion tokens, motion rule against change blindness, playground transitions | High     | M      | 079        | Done      |
| [120](./120-status-colours.md)                   | Status colours for success, warning and error                               | High     | M      | —          | Done      |
| [078](./078-playground-graph.md)                 | Playground: dependency graph with brand and breakpoint switcher             | Medium   | M      | 077        | Done      |
| [079](./079-playground-outputs-config.md)        | Playground: outputs, generated config and CLI handoff                       | High     | M      | 077        | Done      |
| [113](./113-playground-example-with-findings.md) | Playground: an example that shows findings                                  | Medium   | S      | 077        | Done      |
| [122](./122-example-colours-off-system.md)       | Example content never uses the system colours                               | Medium   | L      | 121        | Done      |
| [121](./121-playground-status-polish.md)         | Polish: path breaks, selected finding marker, CopyButton, review colour     | Low      | S      | 120        | Done      |
| [124](./124-playground-first-load-budget.md)     | Playground first load: analysis engine lazy, budgets split                  | Medium   | S      | —          | In review |

**Epic 8 — `dta diff`, token-aware visual regression ([spec](../specs/visual-diff.md))**

| #                                        | Ticket                                              | Priority | Effort | Blocked by | Status      |
| ---------------------------------------- | --------------------------------------------------- | -------- | ------ | ---------- | ----------- |
| [080](./080-diff-token-change-set.md)    | `dta diff` tracer: token change set                 | High     | M      | 039        | Done        |
| [081](./081-diff-stories-config.md)      | Stories adapter and the `diff` config section       | High     | S      | 070, 080   | Done        |
| [082](./082-diff-dual-render-compare.md) | Render base and head in one run and compare         | High     | L      | 081        | Done        |
| [083](./083-diff-attribution-spike.md)   | Spike: record which CSS variables each element uses | High     | S      | 082        | Done        |
| [084](./084-diff-attribution.md)         | Explain visual changes by token                     | High     | L      | 083        | Done        |
| [085](./085-diff-report.md)              | Review report in the Drafting Table design          | High     | M      | 084        | Done        |
| [086](./086-diff-github.md)              | Publish hook and `dta diff` in pull requests        | High     | M      | 085        | In progress |
| [087](./087-diff-dogfood-site.md)        | Guard the DTA website with `dta diff`               | Medium   | S      | 086        | Open        |
| [088](./088-diff-retire-test-visual.md)  | Retire `test:visual`                                | Medium   | XS     | 082        | Done        |
| [089](./089-diff-storybook-adapter.md)   | Storybook adapter for `dta diff`                    | Medium   | M      | 082        | Done        |

**Follow-ups found while writing the docs (072)**

| #                                             | Ticket                                                                 | Priority | Effort | Blocked by | Status    |
| --------------------------------------------- | ---------------------------------------------------------------------- | -------- | ------ | ---------- | --------- |
| [090](./090-first-npm-release.md)             | First npm release (compiled CLI, `npx design-token-authority`)         | High     | M      | 132–138    | Open      |
| [091](./091-build-breakpoint-modes.md)        | Breakpoint modes in the build output                                   | Medium   | M      | —          | Done      |
| [092](./092-lint-contrast-per-mode.md)        | `color-contrast` per mode, through aliases                             | Medium   | S      | —          | Done      |
| [117](./117-css-prefix.md)                    | Make `outputs.css.prefix` work (or remove it)                          | Low      | M      | —          | Done      |
| [118](./118-init-writes-output-formats.md)    | `dta init` writes `outputs.formats`                                    | Low      | S      | —          | Done      |
| [119](./119-build-fails-on-broken-aliases.md) | `dta build` must not write broken CSS for dangling or circular aliases | High     | S      | —          | Done      |
| [125](./125-audit-rank-breakpoint-values.md)  | `dta audit` / `token find` rank breakpoint-only matches lower          | Low      | S      | 091        | Open      |

**Follow-ups found while writing Learn (073)**

| #                                                      | Ticket                                                         | Priority | Effort | Blocked by | Status    |
| ------------------------------------------------------ | -------------------------------------------------------------- | -------- | ------ | ---------- | --------- |
| [093](./093-build-nested-brand-single-mode-aliases.md) | Nested brands reach single-mode tokens that alias brand tokens | Medium   | S      | —          | Done      |
| [094](./094-dtcg-2025-10-conformance.md)               | Read DTCG 2025.10 token files and resolver documents           | Medium   | L      | —          | Replaced by 132–138 |

**Found on the first deploy (075)**

| #                                          | Ticket                                                                                  | Priority | Effort | Blocked by | Status |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | -------- | ------ | ---------- | ------ |
| [095](./095-site-nav-component.md)         | Navigation component with a mobile menu                                                 | High     | S      | —          | Done   |
| [096](./096-site-landing-on-tokens.md)     | Landing page on tokens and design-system components only                                | Medium   | M      | 095        | Done   |
| [097](./097-site-nav-fullscreen-menu.md)   | Nav: burger button and full-screen menu on phones                                       | Medium   | S      | 095        | Done   |
| [098](./098-site-hero-cleanup.md)          | Calmer hero with one command and one call to action                                     | Medium   | XS     | 096        | Done   |
| [099](./099-site-landing-github-agents.md) | Landing page: GitHub and agents instead of the review demo; token cycle in the headline | Medium   | S      | 098        | Done   |

Playground order (2026-10-20): 076 → 077 → 115 → 079 → 116 → 113 → 078 (all done). Order: Epic 7 first (068 → 069 → 070 unblock the rest); 7b and 8 can run in parallel once 069/070 are done; 080 can start right after 039. Design sources: the maintainer's concept doc, the DTA Drafting Table design system and the landing page mockup (see the specs).

## Phase 9 — Agent interop

Spec: [agent-interop](../specs/agent-interop.md) (approved 2026-10-16). Needs the first npm release (090) to reach users. The MCP server (029) is deferred: the token queries are written so it can wrap them later.

| #                                     | Ticket                                                   | Priority | Effort | Blocked by | Status |
| ------------------------------------- | -------------------------------------------------------- | -------- | ------ | ---------- | ------ |
| [100](./100-agent-token-queries.md)   | `dta token get \| find \| list`                          | High     | M      | —          | Done   |
| [101](./101-agent-skill.md)           | `dta skill add`: the DTA skill for coding agents         | High     | S      | 100        | Done   |
| [102](./102-agent-project-context.md) | `dta context`: `DESIGN.md` and the `AGENTS.md` pointer   | High     | M      | 100        | Done   |
| [103](./103-agent-code-audit.md)      | `dta audit`: hard-coded values in code                   | High     | L      | 100        | Done   |
| [104](./104-agent-guide-landing.md)   | Guide "DTA with coding agents" and the landing page copy | Medium   | S      | 101, 102   | Done   |

Order: 100 → 101 → 102 → 103 → 104 (the audit section of the guide follows 103).

## Phase 10 — Landing redesign

Spec: [landing-redesign](../specs/landing-redesign.md) (approved 2026-10-17, revised 2026-10-18). One story, quietly told: a hero on the gravity-well key visual, one change in four scenes with the Orbit Burger example, facts, final call; one surface, no grid, commands as copyable chips, AAA. Accepted prototype: `docs/specs/landing-redesign/prototypes/p17-page.html`.

| #                                               | Ticket                                                                                       | Priority | Effort | Blocked by | Status      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | ------ | ---------- | ----------- |
| [110](./110-design-system-one-surface.md)       | Design system: one surface, the well's tokens, command chips, AAA                            | High     | M      | —          | Done        |
| [105](./105-orbit-burger-example.md)            | Orbit Burger: example brand as a real token set and fixture                                  | High     | M      | —          | Done        |
| [106](./106-landing-components.md)              | Design-system components for the redesigned landing page                                     | High     | M      | 110, 105   | Done        |
| [107](./107-gravity-well.md)                    | `GravityWell` and `FloatingObjects`: the key visual                                          | High     | L      | 110, 106   | Done        |
| [108](./108-landing-rebuild.md)                 | Rebuild the landing page                                                                     | High     | M      | 106, 107   | Done        |
| [109](./109-diff-report-before-after.md)        | `dta diff` report: before/after with the change outlined                                     | Medium   | M      | 108        | Done        |
| [123](./123-diff-report-refs-in-words.md)       | `dta diff` report: refs in words, commit hashes for both sides                               | Low      | S      | 109        | Done        |
| [111](./111-diff-attribution-scoped-example.md) | `dta diff` attribution for the Orbit Burger example (scoped selectors)                       | Medium   | M      | 108        | Done        |
| [112](./112-landing-workflow-strip.md)          | Workflow strip below the hero; scenes in the same order                                      | Medium   | M      | —          | Done        |
| [114](./114-site-polish-after-112-077.md)       | Site polish after 112 and 077 (strip label, nav current page, diagnostic links, scene order) | Low      | S      | 112, 077   | Done        |

Order: 110 → 105 → 106 → 107 → 108 → 112 (done); 114 (done); 109 and 111 later.

## Phase 11 — `dta diff` with near-zero setup

Spec: [diff-zero-setup](../specs/diff-zero-setup.md) (approved 2026-10-21). From nine manual steps to two: `npm create dta`, then open a pull request. No new diff features; setup and robustness only.

| #                                             | Ticket                                                   | Priority | Effort | Blocked by    | Status |
| --------------------------------------------- | -------------------------------------------------------- | -------- | ------ | ------------- | ------ |
| [126](./126-diff-detect-project.md)           | Detect the project for `dta diff` setup                  | High     | M      | —             | Open   |
| [127](./127-diff-base-build-without-setup.md) | Base build without `diff.setup`                          | High     | M      | —             | Open   |
| [128](./128-diff-stories-page-list.md)        | Stories as a page list                                   | Medium   | S      | —             | Open   |
| [129](./129-diff-one-workflow.md)             | One workflow file for private and team repositories      | High     | M      | 090           | Open   |
| [130](./130-diff-check-loud-failures.md)      | `dta diff --check` and loud failures                     | High     | S      | —             | Open   |
| [131](./131-init-diff-step.md)                | Init step for `dta diff`, re-runnable                    | High     | M      | 126, 128, 129 | Open   |

Order: 126, 127, 128 and 130 in parallel → 129 (after 090) → 131.

## Phase 12 — DTCG 2025.10

Spec: [dtcg-2025-10](../specs/dtcg-2025-10.md) (approved 2026-10-21). A valid DTCG 2025.10 token set works in DTA without conversion: every type, `$ref`/`$root`/`$extends`, `.tokens` files, resolver documents and several modifiers at once (axes). All seven slices go into the first npm release (090). Replaces the plan in TICKET-094.

| #                                      | Ticket                                                          | Priority | Effort | Blocked by | Status |
| -------------------------------------- | --------------------------------------------------------------- | -------- | ------ | ---------- | ------ |
| [132](./132-dtcg-types-and-values.md)  | All DTCG 2025.10 types and structured values in core            | High     | L      | —          | In review |
| [133](./133-dtcg-references.md)        | `$ref`, `$root`, `$extends` and aliases inside composite values | High     | M      | 132        | In review |
| [134](./134-dtcg-consumers.md)         | Build, lint, diff, queries and audit on the new types           | High     | L      | 133        | In review |
| [135](./135-dtcg-tokens-files.md)      | Read `.tokens` and `.tokens.json` files                         | High     | S      | 132        | In review |
| [136](./136-dtcg-resolver.md)          | Resolver documents                                              | High     | L      | 133, 135   | In review |
| [137](./137-dtcg-modifier-axes.md)     | Several modifiers at once (axes)                                | High     | L      | 134, 136   | Open   |
| [138](./138-dtcg-figma-push.md)        | Figma push for the new types                                    | Medium   | M      | 134        | Open   |

Order: 132 → 133 → 134 → 137; 135 after 132; 136 after 133 and 135; 138 after 134.

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
| ----- | ----------- |
| XS    | < 1 hour    |
| S     | half day    |
| M     | 1–2 days    |
| L     | 3–5 days    |
