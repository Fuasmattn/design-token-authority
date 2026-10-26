# Maintenance: dependency updates and chores

Status: approved 2026-10-26. Tickets 156–167 (Phase 13 in the index).

## Goal

Keep the dependencies current and the repository clean without changing what users get. No new features ride along.

## Decisions

1. **One dependency per ticket for majors**, one batch ticket for patch and minor updates. A major that breaks something is reverted alone.
2. **Nothing breaks, checked, not assumed.** Every ticket passes the safety check below before it is reviewed.
3. **Output stays the same.** A CLI snapshot that changes is a finding, not something to re-record. Re-record only when the ticket explains why the new output is correct, one scenario at a time, reviewed as a diff.
4. **Screenshots stay the same** unless the ticket is about the renderer (`playwright-core`); then the differences are shown to the maintainer before merging.
5. **`@types/node` stays on the Node.js 24 major** (Dependabot ignores its majors on purpose).
6. **Update the lockfile with pnpm only**; the root `packageManager` pins the pnpm version.

## Safety check

The same jobs CI runs (`.github/workflows/test.yml`), on Node.js from `.nvmrc`:

```bash
pnpm install --frozen-lockfile
pnpm run prettier:check
pnpm run typecheck
pnpm run guardrails:boundaries
pnpm test
pnpm run snapshot:check
pnpm audit
pnpm site:build && pnpm --filter dta-site test:contrast
DTA_E2E=1 pnpm vitest run --project @dta/cli packages/cli/test/diff-visual.test.ts packages/cli/test/init-diff-e2e.test.ts
pnpm package:build && pnpm vitest run --project create-dta   # the packed npm packages
```

Then one green CI run on the branch, and for site-facing changes a look at the Vercel preview at 1280 and 390 px.
