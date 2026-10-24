import type { Adapter } from './types.js'
import { tokenHausAdapter } from './tokenhaus.js'

export type { Adapter } from './types.js'

/**
 * Every supported third-party export format, in detection order. This is the only place
 * that lists adapters: to drop one, delete its file and its entry here.
 */
export const adapters: Adapter[] = [tokenHausAdapter]
