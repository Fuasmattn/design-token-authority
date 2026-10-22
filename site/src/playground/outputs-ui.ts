/**
 * The Outputs tab's UI (TICKET-124): its design-system components, the grouping, sizes, the
 * generated `dta.config.ts` and the CLI steps (outputs.ts). Playground.tsx imports this module
 * dynamically when the Outputs tab first opens, at the same time as the build (outputs-engine.ts),
 * so the bundler puts it in a small chunk of its own: the options and the hand-off show while
 * Style Dictionary is still on its way, and the page's first load carries neither.
 */
export { default as CliHandoff } from '../components/ds/CliHandoff'
export { default as CopyButton } from '../components/ds/CopyButton'
export { default as OutputFiles } from '../components/ds/OutputFiles'
export { default as OutputOptions } from '../components/ds/OutputOptions'
export { NPM_RELEASED } from '../landing/content'
export {
  byteLength,
  cliSteps,
  CONFIG_FILE,
  formatSize,
  generateConfig,
  groupOutputs,
  outputFileGroups,
  outputLabel,
} from './outputs'
export type { OutputGroup } from './outputs'
