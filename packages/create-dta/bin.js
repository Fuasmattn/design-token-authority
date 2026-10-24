#!/usr/bin/env node
// `npm create dta` (and `pnpm create dta`, `yarn create dta`, `bun create dta`): installs
// design-token-authority in the project, with the package manager that ran this, then runs
// `design-token-authority init` (TICKET-090). The config init writes imports `defineConfig`
// from the package, so it must be installed for the config to load. Arguments pass through:
// `npm create dta -- --yes`.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const PACKAGE = 'design-token-authority'
const { version } = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const cwd = process.cwd()

/** Whether the project's package.json already depends on the package. */
function declared() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'))
    return Boolean(pkg.dependencies?.[PACKAGE] ?? pkg.devDependencies?.[PACKAGE])
  } catch {
    return false
  }
}

// `npm_config_user_agent` names the package manager that runs `create`: "pnpm/10.28.0 npm/? …".
const manager = /^(pnpm|yarn|bun)\//.exec(process.env.npm_config_user_agent ?? '')?.[1] ?? 'npm'
const ADD = {
  npm: ['install', '--save-dev'],
  pnpm: ['add', '-D'],
  yarn: ['add', '--dev'],
  bun: ['add', '-d'],
}

try {
  if (!declared()) {
    const args = [...ADD[manager], `${PACKAGE}@^${version}`]
    console.log(`Installing ${PACKAGE}: ${manager} ${args.join(' ')}`)
    execFileSync(manager, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  }
  const { runCli } = await import(PACKAGE)
  process.exitCode = await runCli(['init', ...process.argv.slice(2)])
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
