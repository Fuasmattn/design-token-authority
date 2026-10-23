import { dts } from 'rollup-plugin-dts'
const workspace = /^@dta\//
export default {
  input: 'packages/cli/src/index.ts',
  output: { file: process.env.DTS_OUT ?? 'dist/index.d.ts', format: 'es' },
  // Workspace packages are inlined; everything else (zod, node) stays an import.
  external: (id) => !workspace.test(id) && !id.startsWith('.') && !id.startsWith('/'),
  plugins: [dts({ tsconfig: 'scripts/package/tsconfig.dts.json' })],
}
