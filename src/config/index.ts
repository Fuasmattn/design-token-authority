/**
 * TICKET-008: Public config API.
 *
 * Re-exports everything consuming projects and CLI commands need.
 */

export { defineConfig, validateConfig, ConfigValidationError } from './schema.js'
export type {
  Config,
  FigmaConnection,
  LayerMapping,
  OutputTargets,
  OutputTargetCSS,
  OutputTargetTailwind,
  OutputTargetIOS,
  OutputTargetAndroid,
  LintConfig,
  LintRules,
  LintSeverity,
  LintRuleSemanticMustAlias,
  LintRuleNamingPattern,
  LintRuleColorContrast,
  LintRuleNoDuplicateValues,
} from './schema.js'

export { loadConfig, DEFAULT_CONFIG_PATH } from './loader.js'
