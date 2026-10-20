# Handover — 2026-10-19

For the next session working on Design Token Authority (DTA). Read this, then `CLAUDE.md`, then `docs/tickets/000-index.md`.

## Where things are

- **Branch:** all work is on `plan/token-engine-overhaul` (GitHub: `Fuasmattn/design-token-authority`). `main` is far behind and has no shared history with the plan branch in a shallow clone; how the plan branch reaches `main` is undecided and blocks the npm release (090, "publishes from `main`").
- **Last commit:** `6dfd720` (TICKET-120). CI green on all three jobs (test, site, diff-e2e).
- **Vercel:** the maintainer set up the site project via the Vercel GitHub integration; previews build from this branch. Production from `main` and the domain are still open (075).
- **Design canvas** (private artifact, reference boards for the playground and the status-colour proposal): https://claude.ai/artifact/YJnyPNvHDa4iX9qFr6xJPY. The same boards are in the repo: `docs/specs/playground/prototypes/*.dc.html` (literal colours; the look, not the code).

## Done on 2026-10-19

| Ticket | What |
| --- | --- |
| 112 | Workflow strip below the hero ("How it works"), two sides meeting in a PR |
| 076 | `@dta/*` packages proven to run in the browser (esbuild browser build + Chromium tests, bundle budgets); zod namespace imports |
| 077 | `/playground` as its own page (not Starlight) on a shared `SiteLayout.astro`; Preact island; input, structure, lint in the CLI's wording (shared from `@dta/core` / `@dta/lint`) |
| 115 | Playground workspace: source bar, summary line, tabs (hash in URL), side panel / bottom sheet (`DetailPanel`), lint grouped by rule |
| 079 | Outputs tab: format choices, per-file copy/download, zip per group, download all, file preview, generated `dta.config.ts`; `outputs.formats` added to `@dta/build` and the config |
| 116 | Motion tokens, design-system motion rule against change blindness (principle 7 + Motion page), `Changed` component, playground transitions, no literal durations (test) |
| 113 | "Example with problems" (`test/fixtures/brand-ab-problems`), findings proven equal to `dta lint`; "Next finding" |
| 114 | Strip label, nav current page, diagnostics carry doc ids (CLI text unchanged, site links), Tailwind v4/v3 labels, code previews scroll in their box, landing scenes swapped (01 pull → 02 lint → 03 diff + approve → 04 agents), borders rule "complete or straight" (+ test) |
| 119 | Dangling/circular aliases fail `dta build` (exit 1, nothing written); shared alias diagnostics in `@dta/core` |
| 120 | Status colours: crimson/ochre scales, `status.{success,warning,error}.{text,marker,subtle}`, token contrast test, applied everywhere, Status colours docs page |
| CI fix | `7c89b33`: tests no longer depend on clack's ASCII vs Unicode gutter or on render timing |

New tickets written: 113–120 (above), 117 (`outputs.css.prefix` does nothing: implement or remove), 118 (`dta init` writes `outputs.formats`).

## Next

1. **078 — Playground graph** (last playground view). Findings in the graph use the status colours; selecting a token opens its alias chain in the existing `DetailPanel`; "Show in graph" in the panel becomes live; the Graph tab currently shows a "comes next" note. Record the decision on reusing it for `dta graph --format html` (spec: later, separate ticket).
2. **New polish ticket** (not written yet): token paths in the status banner break mid-word ("Surface/Mu-ted") — break at `/`; decide whether a selected finding keeps its red marker (today selection turns the whole row action blue); CopyButton's "Not copied" has no error marker; report "review" verdict (action tint) vs Checks "changes to review" (signal) differ in colour.
3. **Open decisions for the maintainer:** 119's edge cases (an alias that only breaks because a build filters collections/brands still only warns; cycles across collections in non-first modes are not detected); DTCG `duration`/`cubicBezier` types (motion tokens are strings today); site domain.
4. **Needs the maintainer's Mac/accounts:** 090 first npm release (and the plan-branch → `main` question), 075 production + domain, 086 Vercel report project + secrets and a private test repo, then 087.
5. Later: 109 (diff report before/after), 111 (real attribution numbers on the landing page), 091–094, 117, 118, older 006/011–013/019/021/024/031/032.

## How the maintainer works (follow this)

- **Plans and tickets, not vibe coding.** Every change has a ticket; decisions go into the spec/ticket; open decisions are recorded in the ticket's Outcome.
- **Never commit or push without an explicit "push".** Docs-only ticket updates are usually pushed together with the next feature after approval. A stop hook will nag about uncommitted changes — ignore it until the maintainer approves.
- **Show before pushing:** screenshots (desktop 1280 and phone 390, light and dark) or a short video for motion. For new UI direction, make a design board first and wait for "looks good".
- **Keep the design system up to date with every change** (docs page, stories incl. phone width, overview/patterns). The maintainer asks for this explicitly.
- **Style:** Drafting Table tokens only; borders not shadows; borders complete or straight (never faded, never partial on rounded corners); AAA contrast (7:1 text) in both themes, checked with numbers; colour never alone (shape + word); signal orange only for changes/diffs, never errors; motion short and functional, reduced motion keeps highlights; British spelling on the site. Avoid generic "AI-looking" UI tropes.
- **Often on the phone:** short answers, clear next step, one question at a time.
- Never use real customer brand names (BrandA/BrandB).

## Working setup that worked

- **Agents per ticket:** one background agent per ticket (or two in sequence), told to read `CLAUDE.md`, the ticket, the spec and previous Outcomes; run all gates; save screenshots; not commit. Review screenshots yourself before showing them.
- **Node:** the repo wants Node 24 (`.nvmrc`); the container had Node 22. A Node 24 tarball was unpacked into the session scratchpad (`…/scratchpad/node24/package/bin`) — in a new session fetch it again from the npm registry (`node@24` binary package or the `node-linux-x64` tarball) if needed.
- **Run tests like CI:** `TERM=xterm-256color CI=true pnpm test` (clack prints a Unicode gutter there). Chromium tests: `DTA_BROWSER_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm --filter dta-site run test:contrast` (needs `pnpm site:build` first). Never run `playwright install`.
- **Gates:** `pnpm run prettier:check`, `typecheck`, `guardrails:boundaries`, `pnpm test`, `snapshot:check`, `pnpm site:build`, `test:contrast`. Snapshot changes only when intended, re-recorded by scenario name.
- **Generated files:** after token changes run `pnpm report:tokens` (regenerates `packages/visual-diff/src/report/tokens-css.ts`), or a site test fails.
- **CI check after a push:** `gh run list --branch plan/token-engine-overhaul`, `gh run watch <id>`. Job logs are not downloadable through the proxy; read failures via `gh api repos/Fuasmattn/design-token-authority/check-runs/<job id>/annotations`.
- **Push access:** attach the repo with push access (`add_repo` with `access: "push"`); the clone lives at `/home/claude/design-token-authority`.
