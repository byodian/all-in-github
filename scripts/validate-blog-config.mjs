import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { validateBlogConfiguration } from './blog-config.mjs'

const configPath = fileURLToPath(new URL('../.blog/config.json', import.meta.url))

try {
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  const errors = validateBlogConfiguration(config)
  if (errors.length) {
    process.stderr.write(`${errors.map(error => `${error.path}: ${error.message}`).join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(`Blog configuration is valid (schema ${config.schemaVersion}, theme ${config.theme.id}).\n`)
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
