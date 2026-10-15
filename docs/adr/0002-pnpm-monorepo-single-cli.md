# pnpm monorepo with internal packages behind one CLI

New code lives in `packages/*` in this repo, managed with pnpm workspaces (no Turbo/Nx for now). Packages are `@dta/core`, `@dta/figma`, `@dta/build`, `@dta/lint` and `@dta/cli`; `core` depends on none of the others. Users only ever run `npx dta …` with a `dta.config.ts` (JSON fallback); the `@dta/*` packages are module boundaries, not a public API. pnpm was chosen over npm workspaces for strict dependency isolation between packages.
