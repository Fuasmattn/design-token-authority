/**
 * Real output for the outputs stories: the brand-ab example built by the playground's own code
 * (analyse.ts, outputs-engine.ts, outputs.ts) with every output chosen, as the Outputs view
 * shows it.
 */
import { analyse } from '../playground/analyse'
import { EXAMPLE_FILES } from '../playground/example'
import { buildFiles } from '../playground/outputs-engine'
import {
  ALL_FORMATS,
  byteLength,
  CONFIG_FILE,
  formatSize,
  generateConfig,
  groupOutputs,
  outputFileGroups,
} from '../playground/outputs'

export async function exampleOutputs() {
  const { model, structure } = analyse(EXAMPLE_FILES)
  if (!model || !structure) throw new Error('brand-ab does not read')
  const brands = structure.brands
  const { files } = await buildFiles(model, { brands, formats: ALL_FORMATS })
  const config = generateConfig({ brands, formats: ALL_FORMATS })
  const groups = outputFileGroups(groupOutputs(files))
  return {
    files,
    groups,
    config: { name: CONFIG_FILE, size: formatSize(byteLength(config)), content: config },
  }
}
