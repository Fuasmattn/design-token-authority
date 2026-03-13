import 'dotenv/config'
import * as fs from 'fs'

import FigmaApi from './figma_api.js'

import { green } from './utils.js'
import { tokenFilesFromLocalVariables } from './token_export.js'

/**
 * Usage:
 *
 * // Defaults to writing to the tokens directory
 * npm run sync-figma-to-tokens
 *
 * // Writes to the specified directory
 * npm run sync-figma-to-tokens -- --output directory_name
 */

async function main() {
  if (!process.env.FIGMA_PERSONAL_ACCESS_TOKEN || !process.env.FIGMA_FILE_KEY) {
    throw new Error('FIGMA_PERSONAL_ACCESS_TOKEN and FIGMA_FILE_KEY environment variables are required')
  }
  const fileKey = process.env.FIGMA_FILE_KEY

  const api = new FigmaApi(process.env.FIGMA_PERSONAL_ACCESS_TOKEN)
  const localVariables = await api.getLocalVariables(fileKey)

  const tokensFiles = tokenFilesFromLocalVariables(localVariables)

  let outputDir = 'tokens'
  const outputArgIdx = process.argv.indexOf('--output')
  if (outputArgIdx !== -1) {
    outputDir = process.argv[outputArgIdx + 1]
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir)
  }

  Object.entries(tokensFiles).forEach(([fileName, fileContent]) => {
    const trimmedFileName = fileName.replace(' ', '')
    fs.writeFileSync(`${outputDir}/${trimmedFileName}`, JSON.stringify(fileContent, null, 2))
    console.log(`Wrote ${trimmedFileName}`)
  })

  console.log(green(`✅ Tokens files have been written to the ${outputDir} directory`))
}

main()
