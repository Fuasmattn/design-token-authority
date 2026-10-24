import { runCli } from './index.js'

// Credentials live in .env (written by `dta init`); a missing file is fine.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env in the working directory.
}

try {
  process.exitCode = await runCli(process.argv.slice(2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
