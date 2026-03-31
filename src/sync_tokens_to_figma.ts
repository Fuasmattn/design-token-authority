import 'dotenv/config'
import * as fs from 'fs'

import FigmaApi from './figma_api.js'

import { green } from './utils.js'
import { generatePostVariablesPayload, readJsonFiles } from './token_import.js'

async function main() {
  if (!process.env.FIGMA_PERSONAL_ACCESS_TOKEN || !process.env.FIGMA_FILE_KEY) {
    throw new Error(
      'FIGMA_PERSONAL_ACCESS_TOKEN and FIGMA_FILE_KEY environment variables are required',
    )
  }
  const fileKey = process.env.FIGMA_FILE_KEY

  const TOKENS_DIR = 'tokens'
  const tokensFiles = fs.readdirSync(TOKENS_DIR).map((file: string) => `${TOKENS_DIR}/${file}`)

  const tokensByFile = readJsonFiles(tokensFiles)

  console.log('Read tokens files:', Object.keys(tokensByFile))

  const api = new FigmaApi(process.env.FIGMA_PERSONAL_ACCESS_TOKEN)
  const localVariables = await api.getLocalVariables(fileKey)

  const postVariablesPayload = generatePostVariablesPayload(tokensByFile, localVariables)

  if (Object.values(postVariablesPayload).every((value) => value.length === 0)) {
    console.log(green('✅ Tokens are already up to date with the Figma file'))
    return
  }

  const apiResp = await api.postVariables(fileKey, postVariablesPayload)

  console.log('POST variables API response:', apiResp)

  if (postVariablesPayload.variableCollections?.length) {
    console.log('Updated variable collections', postVariablesPayload.variableCollections)
  }

  if (postVariablesPayload.variableModes?.length) {
    console.log('Updated variable modes', postVariablesPayload.variableModes)
  }

  if (postVariablesPayload.variables?.length) {
    console.log('Updated variables', postVariablesPayload.variables)
  }

  if (postVariablesPayload.variableModeValues?.length) {
    console.log('Updated variable mode values', postVariablesPayload.variableModeValues)
  }

  console.log(green('✅ Figma file has been updated with the new tokens'))
}

main()
