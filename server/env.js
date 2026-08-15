import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Minimal zero-dependency .env loader. Reads KEY=VALUE lines from the
 * project root .env file (if present) without overriding existing
 * process.env values.
 */
function loadEnvFile() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile()

/** Read an environment variable with an optional fallback. */
export function env(name, fallback = '') {
  return process.env[name] ?? fallback
}
