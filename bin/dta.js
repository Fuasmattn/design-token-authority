#!/usr/bin/env node
// Runs the TypeScript sources through tsx: they import each other with `.js` specifiers, which
// Node's own type stripping does not resolve. A compiled build is part of publishing.
import { register } from 'tsx/esm/api'

register()
await import('../packages/cli/src/bin.ts')
