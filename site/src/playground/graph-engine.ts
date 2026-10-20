/**
 * The Graph tab's half of the playground (TICKET-078): the model mapping (graph.ts) and the
 * design-system components that draw it. Playground.tsx imports this module dynamically when the
 * Graph tab first opens (also through "Show in graph" or `#graph/…`), so the bundler puts it in a
 * chunk of its own and the first load stays within its budget, like the outputs (spec decision 9).
 */
export { buildGraph, idInModes, parseNodeId, tokenDetail } from './graph'
export type { FindingRef, GraphView, TokenDetail } from './graph'
export { tokenPanelContent } from './token-panel'
export { default as GraphCanvas } from '../components/ds/GraphCanvas'
export { default as GraphList } from '../components/ds/GraphList'
export { default as GraphSwitcher } from '../components/ds/GraphSwitcher'
