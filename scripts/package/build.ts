/**
 * The npm package (TICKET-090): `@dta/cli` and the workspace packages it uses, bundled into
 * `dist/` as plain JavaScript (no tsx at runtime for the CLI itself), with one bundled
 * declaration file. Third-party packages stay imports; they are the package's dependencies.
 *
 *   pnpm package:build   → dist/bin.js, dist/index.js (+ shared chunks), dist/index.d.ts
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { build, type Plugin } from 'esbuild'

const root = path.resolve(import.meta.dirname, '..', '..')
const dist = path.join(root, 'dist')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  version: string
  dependencies: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** Bare imports other than the workspace's own packages stay imports of the bundle. */
const externals: Plugin = {
  name: 'externals',
  setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@dta/') || args.path.startsWith('node:')) return undefined
      const name = args.path.startsWith('@')
        ? args.path.split('/').slice(0, 2).join('/')
        : args.path.split('/')[0]
      if (!pkg.dependencies[name] && !pkg.peerDependencies?.[name]) {
        throw new Error(
          `"${args.path}" (imported by ${path.relative(root, args.importer)}) is not a dependency of the published package: add it to "dependencies" in the root package.json.`,
        )
      }
      return { path: args.path, external: true }
    })
  },
}

export async function buildPackage(): Promise<void> {
  fs.rmSync(dist, { recursive: true, force: true })
  await build({
    absWorkingDir: root,
    entryPoints: { bin: 'packages/cli/src/bin.ts', index: 'packages/cli/src/index.ts' },
    outdir: 'dist',
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    // `dta --version` without reading a package.json at a path that differs in the bundle.
    define: { __DTA_VERSION__: JSON.stringify(pkg.version) },
    chunkNames: 'chunks/[name]-[hash]',
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [externals],
  })
  const bin = path.join(dist, 'bin.js')
  fs.writeFileSync(bin, `#!/usr/bin/env node\n${fs.readFileSync(bin, 'utf8')}`)
  fs.chmodSync(bin, 0o755)
  execFileSync(
    path.join(root, 'node_modules', '.bin', 'rollup'),
    ['-c', 'scripts/package/dts.config.mjs', '--silent'],
    { cwd: root, stdio: 'inherit' },
  )
}

if (import.meta.main) {
  await buildPackage()
  console.log(`Built dist/ (design-token-authority ${pkg.version}).`)
}
