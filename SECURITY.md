# Security policy

## Supported versions

Security fixes go into the latest release of `design-token-authority` and `create-dta` on npm. Older versions get no fixes: update to the latest 2.x.

| Version       | Supported |
| ------------- | --------- |
| latest 2.x    | yes       |
| older 2.x     | no        |
| 1.x (v1 tool) | no        |

DTA runs on Node.js 24. Use a current 24.x release: Node.js publishes its own security fixes, and DTA cannot fix those for you.

## Reporting a vulnerability

Please do not open a public issue. Report it privately on GitHub: **Security → Report a vulnerability** in [Fuasmattn/design-token-authority](https://github.com/Fuasmattn/design-token-authority/security/advisories/new).

Say what is affected (command, version, Node.js version), how to reproduce it, and what an attacker could do with it. DTA is maintained by one person: expect an answer within a week. A confirmed issue gets a fix in a patch release and a GitHub security advisory; you are credited unless you prefer not to be.

## What is in scope

DTA reads and writes design data and runs as part of builds and CI, so these matter most:

- **Figma credentials:** the personal access token (`FIGMA_PERSONAL_ACCESS_TOKEN`) leaking into output, logs, reports or generated files.
- **Changes to the Figma file:** `dta push` and `dta prune` changing or deleting variables without their confirmation (`--yes`, `--force` or the typed phrase).
- **Token files and Figma responses as input:** a crafted token file, plugin export or Figma API response that makes DTA write outside the project, run code, or hang.
- **`dta diff` and its GitHub actions:** a pull request from a fork that gets secrets, write access or an approval it should not have; report HTML that runs scripts from token names or values.
- **The published packages:** a vulnerable dependency in what `npm install design-token-authority` installs.

## What is not

- **The config is code.** `dta.config.ts` runs with your permissions, like any build config, and so do the commands it names (`diff.setup`, `diff.publish`). A malicious config is out of scope.
- Vulnerabilities in Node.js, Figma or GitHub themselves: report those to them.
- Development dependencies that never run outside this repository's own tests, unless they reach a release or CI secret.

## How the repository keeps dependencies safe

CI runs `pnpm audit` on every push, a release stops when `pnpm audit --prod` finds a known vulnerability, and Dependabot proposes security updates. Fixes for transitive dependencies are overrides in `pnpm-workspace.yaml`, each with the package that pulls it in.
