# Handover — 2026-10-21

For the next session working on Design Token Authority (DTA). Read this, then `CLAUDE.md`, then `docs/tickets/000-index.md`.

## Where things are

- **Branch:** all work is on `plan/token-engine-overhaul` (GitHub: `Fuasmattn/design-token-authority`). `main` is far behind and has no shared history with the plan branch in a shallow clone; how the plan branch reaches `main` is undecided and blocks the npm release (090, "publishes from `main`").
- **Last commit:** the one that adds this file (TICKET-123 plus this handover). Check the GitHub run for it first (`gh run list --branch plan/token-engine-overhaul`).
- **Vercel:** previews build from this branch via the Vercel GitHub integration. Production from `main` and the domain are still open (075).
- **Design boards** (literal colours; the look, not the code): `docs/specs/playground/prototypes/*.dc.html` (incl. `Graph.dc.html`, approved 2026-10-20) and `docs/specs/visual-diff/prototypes/ReportRow.dc.html` (approved 2026-10-20, revised board).

## Done on 2026-10-20 / 21

| Ticket | What                                                                                                                                                                                                                                                                                                                                                      |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 121    | Polish: token paths break between segments (`TokenPath`), a selected finding keeps its severity marker, CopyButton "Not copied" with the error square, the report's "Changes to review" in signal like Checks                                                                                                                                             |
| 122    | Example content never uses system colours (orange/red/yellow/green): brand-ab(-problems) primitives → Navy/Sky/Steel, Orbit Burger in blue, Badge example tone neutral, 16 snapshots re-recorded by name, scan test `site/example-colours.test.ts`                                                                                                        |
| 078    | Playground graph: brand/breakpoint switcher, three layer columns from `analyzeGraph`, alias chain in the DetailPanel, "Show in graph"/"Show in lint"/"Show BrandB", `#graph/<id>` hash, keyboard, phone list; `GraphSwitcher`/`GraphCanvas`/`GraphList`; `codeNames` moved to `@dta/build`; hover instant, state changes animate (fixed the motion flake) |
| 111    | `dta diff` attribution reverts a token in every page rule that declares its variable (re-scoped CSS is explained); landing scenes 02/03 read a recorded Orbit Burger run (`site/src/landing/diff-run.json`, `pnpm --filter dta-site diff:record`); GravityWell paints its objects only once placed (deterministic renders); stacked labels                |
| 109    | Report story row: only the render "With this change", changed elements outlined (signal + 1 px ink line), token notes, token table, whole-image links; "Show before" swaps the image in place; unexplained rows with the diff overlay on; thumbnails and slider removed; `DiffCard` reworked, Chip `neutral` tone                                         |
| 123    | Report refs in words: "Before" / "With this change" everywhere (no base/head), branch + short hash under both sides (`result.json` gains optional `head`: branch, sha, uncommitted); notes and numbered markers never cover story content (flat-surface map read back from the screenshot), boxes with the same token changes share one list entry        |

## Next

1. **Check the GitHub run** of the last push; if green, tick 123's "GitHub run" criterion and set it Done in the index (the push that carries this handover had 123 "In review").
2. **Open decisions for the maintainer:** 119's edge cases (an alias that only breaks because a build filters collections/brands still only warns; cycles across collections in non-first modes are not detected); DTCG `duration`/`cubicBezier` types (motion tokens are strings today); site domain.
3. **Needs the maintainer's Mac/accounts:** 090 first npm release (and the plan-branch → `main` question), 075 production + domain, 086 Vercel report project + secrets and a private test repo, then 087.
4. **Small, doable alone:** 117 (`outputs.css.prefix` does nothing: implement or remove), 118 (`dta init` writes `outputs.formats`).
5. **Noted, no ticket yet:** the playground's first-load JS is 59.0 of its 60 KB gzip budget (078) — the next playground feature will need to split or lazy-load; "Show in graph" for a file finding (default mode name) is not done (078); older prototypes (`Main`, `PhoneLint`, `StatusColors`) and closed tickets still use the pre-122 colour names (historical, left as is); the CLI's own text output still says "Base:" (only the report moved to words).
6. Later: 091–094, older 006/011–013/019/021/024/031/032.

## How the maintainer works (follow this)

- **Plans and tickets, not vibe coding.** Every change has a ticket; decisions go into the spec/ticket; open decisions are recorded in the ticket's Outcome. Feedback on screenshots goes into the ticket before an agent changes anything.
- **Never commit or push without an explicit "push".** Docs-only ticket updates are usually pushed together with the next feature after approval. Never push half-finished agent work; if "push" arrives while an agent is mid-change, push only what is complete (e.g. tickets) or wait for the gates. A stop hook nags about uncommitted changes — ignore it until the maintainer approves.
- **Show before pushing:** screenshots (desktop 1280 and phone 390, light and dark) or a short video for motion. Look at them yourself first and point out problems you see (the maintainer appreciates that). For new UI direction, make a design board first and wait for "looks good".
- **Keep the design system up to date with every change** (docs page, stories incl. phone width, overview/patterns).
- **Style:** Drafting Table tokens only; borders not shadows; borders complete or straight; AAA contrast (7:1 text) in both themes, checked with numbers; colour never alone (shape + word); signal orange only for changes/diffs, never errors; **example content in blue/grey only, never system colours** (122); plain words over jargon in UI (e.g. "Before" / "With this change", not base/head); motion short and functional, reduced motion keeps highlights; British spelling on the site. Avoid generic "AI-looking" UI tropes.
- **Often on the phone:** short answers, clear next step, one question at a time; explain "for dummies" when asked.
- Never use real customer brand names (BrandA/BrandB).

## Working setup that worked

- **Agents per ticket:** one background agent per ticket, told to read `CLAUDE.md`, the ticket, the spec and previous Outcomes; run all gates; save screenshots; not commit. Resume the same agent (SendMessage) for follow-up feedback on its ticket — it keeps context. Review screenshots yourself before showing them.
- **Node:** the repo wants Node 24 (`.nvmrc`); the container had Node 22. Unpack a Node 24 tarball into the session scratchpad (`node@24` binary package or the `node-linux-x64` tarball from the npm registry) and prepend its `bin` to `PATH`.
- **Run tests like CI:** `TERM=xterm-256color CI=true pnpm test`. Chromium tests: `DTA_BROWSER_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm --filter dta-site run test:contrast` (needs `pnpm site:build` first); diff e2e with `DTA_E2E=1` and the same browser path (see `.github/workflows/test.yml`). Never run `playwright install`.
- **Gates:** `pnpm run prettier:check`, `typecheck`, `guardrails:boundaries`, `pnpm test`, `snapshot:check`, `pnpm site:build`, `test:contrast`, diff e2e. Snapshot changes only when intended, re-recorded by scenario name. `prettier:check` does not scan `docs/`; run Prettier on new docs/boards yourself.
- **Generated files:** after token changes run `pnpm report:tokens`, or a site test fails. After example token or landing changes, re-record the diff run with `pnpm --filter dta-site diff:record` (throwaway base on a temporary branch/worktree; delete it afterwards).
- **CI check after a push:** `gh run list --branch plan/token-engine-overhaul`, `gh run watch <id>`. Job logs are not downloadable through the proxy; read failures via `gh api repos/Fuasmattn/design-token-authority/check-runs/<job id>/annotations`. Font metrics differ between CI and the container: e2e checks that depend on exact wrapping at 1280 can pass locally and fail in CI.
- **Push access:** attach the repo with push access (`add_repo` with `access: "push"`); the clone lives at `/home/claude/design-token-authority`.
