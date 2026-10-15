# Spec: Token Engine Overhaul (DTA v2)

**Status:** ready-for-agent
**Related ADRs:** 0001 (strangler rewrite), 0002 (pnpm monorepo, single CLI)

## Problem Statement

Design Token Authority works, but it has grown as one flat source tree with legacy entrypoints, mixed responsibilities and implicit coupling between sync, build, lint and graph logic. Every new feature (mobile outputs, MCP server, audit, visual-diff) has to reach into that tree, which makes changes risky and makes it hard to hand work to coding agents with confidence. Users also still need to know too much about the repo; the tool should feel like one small CLI that just works via `npx`.

## Solution

Rewrite DTA as a set of small, deep packages behind a single CLI, using a strangler approach: the legacy code stays frozen and runnable until the new CLI reproduces its behaviour, proven by snapshot tests, and is then deleted. Users keep one entry point (`npx dta …`) and one config file. Internally, each `@dta/*` package exposes a small public API and hides its internals, so each can be rewritten, tested and reasoned about on its own.

## User Stories

1. As a design system engineer, I want to run DTA via `npx dta` without cloning the repo, so that adopting it in a project is a one-liner.
2. As a design system engineer, I want one `dta.config.ts` with typed `defineConfig` autocomplete, so that misconfiguration is caught in my editor.
3. As a design system engineer without TypeScript tooling, I want a JSON config fallback, so that I can still configure DTA.
4. As a design system engineer, I want clear validation errors for an invalid config, so that I know exactly which field to fix.
5. As a design system engineer upgrading from v1, I want a short migration note for config changes, so that the v2 major bump doesn't block me.
6. As a design system engineer on a Figma Enterprise plan, I want `dta pull` to fetch variables from the Figma REST API, so that my token files stay in sync with Figma.
7. As a design system engineer on a non-Enterprise plan, I want `dta pull --from-file` to import plugin exports, so that I can use DTA without the Variables REST API.
8. As a design system engineer, I want the import format auto-detected, so that I don't have to specify which plugin produced a file.
9. As a design system engineer, I want `dta push` to update Figma variables without ever deleting any, so that a push can't destroy designer work.
10. As a design system engineer, I want `dta push` to show a human-readable diff and require typed confirmation, so that I know what will change before it does.
11. As a CI pipeline, I want `dta push --yes` (or a config flag) to skip confirmation, so that automated syncs work.
12. As a design system engineer, I want `dta build` to generate CSS, JS and Tailwind v3/v4 outputs identical to v1, so that upgrading doesn't change my product's styling.
13. As a design system engineer with multiple brands, I want per-brand build output, so that each product consumes only its brand's tokens.
14. As a design system engineer, I want `dta lint` with the same rules as v1, so that existing quality checks keep working.
15. As a design system engineer, I want `dta graph` (console and HTML) to show alias chains, cycles, dangling and orphaned tokens, so that I understand token dependencies.
16. As a design system engineer, I want `dta analyze` to auto-discover my Figma collection structure (Primitives, Brand, ScreenType), so that setup needs no manual mapping.
17. As a new user, I want `dta init` to walk me through setup based on my Figma plan, so that I get a working config fast.
18. As a design system engineer, I want `dta clean` to remove generated token and build files, so that I can start fresh.
19. As a design system engineer, I want token files to keep the DTCG format with `com.figma` extensions and one file per collection and mode, so that my existing token repos remain valid.
20. As a design system engineer, I want aliases to stay in dot-notation in JSON and slash-notation in Figma, so that the conversion stays invisible to me.
21. As a DTA maintainer, I want each package to expose a small public API, so that I can change internals without breaking other packages.
22. As a DTA maintainer, I want `@dta/core` to depend on no other DTA package, so that the token model stays the stable centre.
23. As a DTA maintainer, I want strict dependency isolation between packages, so that undeclared dependencies fail immediately.
24. As a DTA maintainer, I want snapshot tests comparing legacy and new outputs on the same fixtures, so that I can prove parity before deleting legacy code.
25. As a DTA maintainer, I want intentional output changes to show up as snapshot diffs in the PR, so that they are reviewed explicitly.
26. As a DTA maintainer, I want Figma interactions tested against recorded API responses, so that CI needs no Figma secrets or Enterprise plan.
27. As a DTA maintainer, I want one version for all `@dta/*` packages managed by Changesets, so that releases stay simple.
28. As a coding agent, I want every ticket gated by typecheck, Vitest, snapshots and Prettier in CI, so that I get a clear pass/fail signal while working in a loop.
29. As a coding agent, I want the legacy source tree off-limits, so that the parity reference can't be accidentally changed.
30. As a coding agent, I want each ticket to fit one context window and touch mostly one package, so that I can finish it without losing context.
31. As a DTA user, I want the legacy `dta` binary to keep working until the new CLI reaches parity, so that I'm never given a half-finished tool.

## Implementation Decisions

- **Strangler rewrite** (ADR 0001): new code is written fresh; legacy modules such as color parsing, the dependency graph and export/import conversion may be ported where they fit. Legacy stays frozen and is removed only after parity.
- **Workspace** (ADR 0002): pnpm workspaces in this repo, no Turbo/Nx for now. ESM only, Node 24+ (matches current `engines`).
- **Packages and responsibilities:**
  - `@dta/core`: token model, DTCG parsing and serialisation, alias resolution, dependency graph. No dependency on other DTA packages.
  - `@dta/figma`: Figma REST API access, plugin/file importers with format detection, export (Figma → tokens) and import payload generation (tokens → Figma), push diff.
  - `@dta/build`: Style Dictionary v4 integration and formatters (CSS, JS, Tailwind v3/v4, per-brand output).
  - `@dta/lint`: lint rules and runner, built on the core graph.
  - `@dta/cli`: the only user-facing package; commands, config loading and validation, prompts and output.
  - `@dta/testkit` (private, dev-only): the snapshot harness shared by the legacy capture script and the CLI parity tests.
- **Gray-box packages:** each package exposes a deliberately small public API and keeps everything else internal. Other packages may only import from that public API.
- **Config:** `dta.config.ts` with `defineConfig` and Zod validation, JSON fallback, no TOML. Starts from the v1 schema; breaking changes are allowed and released as v2.0.0 with a migration note.
- **Existing invariants kept:** variable names unique across collections; push never deletes; typed push confirmation, bypassable via flag or config.
- **Release:** legacy keeps the `dta` binary until parity; the new CLI is not published before then. Changesets in fixed mode for all `@dta/*` packages.
- **Epic order:** 1) workspace scaffold and snapshot harness, 2) core, 3) figma, 4) build, 5) lint, 6) CLI parity and legacy removal, 7) docs site, 8) visual-diff.

## Testing Decisions

- **Good tests** exercise behaviour through a public interface (what users or calling packages do and see), never internals. Refactoring internals must not break tests.
- **Two levels of seams:**
  - **Package seam (primary):** each package is tested through its small public API, with thorough tests inside each package.
  - **CLI seam (parity):** snapshot tests run CLI commands against fixture projects and compare written files and stdout with outputs captured from the legacy pipeline.
- **Figma boundary:** a fake that replays recorded API responses; push is verified by asserting the request payload. One manual smoke test against real Figma before release.
- **Fixtures:** the repo's anonymized BrandA/BrandB token set, plus the DaisyUI DTCG token file as a structurally different second input.
- **CI gates per ticket:** typecheck, Vitest, snapshots, Prettier.
- **Prior art:** existing Vitest suites for color parsing, export/import conversion, config schema, analyze, CLI, init and graph; Vitest file snapshots for snapshots.

## Out of Scope

- Open feature tickets until parity: iOS/Android outputs (011–013), naming rules (019), prune (021), AI config generation (024), AI interop (028–032).
- Docs site (Astro + Starlight on Vercel) and visual-diff (GitHub PR visual output): later epics, each with its own grilling session.
- Replacing Style Dictionary as the build engine.
- Turbo/Nx or other build orchestration.

## Further Notes

- Work happens on the `plan/token-engine-overhaul` branch first; specs and tickets live in the repo so they can be grilled on the phone and implemented on the Mac.
- Tickets for each epic are created only when the previous epic is near done, so later tickets reflect what earlier epics taught us.
