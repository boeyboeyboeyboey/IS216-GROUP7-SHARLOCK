import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'
import { assertSafeTestDatabaseUri, databaseNameFromUri } from './database-uri.js'

export const environmentPath = fileURLToPath(new URL('../../.env', import.meta.url))

export function readEnvironmentFile(path = environmentPath) {
  try {
    return parse(readFileSync(path))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw new Error('Unable to read the server environment file.', { cause: error })
  }
}

export function validateEnvironment(env) {
  const nodeEnv = env.NODE_ENV || 'development'
  if (!['development', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development or test for this localhost scaffold.')
  }

  const port = Number(env.PORT || 3000)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('PORT must be an integer between 1024 and 65535.')
  }

  const clientOrigin = env.CLIENT_ORIGIN || 'http://localhost:5173'
  try {
    const origin = new URL(clientOrigin)
    if (
      origin.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) ||
      origin.origin !== clientOrigin ||
      origin.username ||
      origin.password
    )
      throw new Error()
  } catch {
    throw new Error(
      'CLIENT_ORIGIN must be an exact HTTP loopback origin, for example http://localhost:5173.',
    )
  }

  if (!/^[a-fA-F0-9]{64,}$/.test(env.SESSION_SECRET || '')) {
    throw new Error(
      'SESSION_SECRET must contain at least 64 random hexadecimal characters. Run pnpm setup:env.',
    )
  }

  const databaseUri =
    nodeEnv === 'test'
      ? assertSafeTestDatabaseUri(env.TEST_MONGODB_URI, env.MONGODB_URI)
      : env.MONGODB_URI
  databaseNameFromUri(databaseUri)

  return Object.freeze({
    nodeEnv,
    port,
    clientOrigin,
    databaseUri,
    sessionSecret: env.SESSION_SECRET,
  })
}

export function loadEnvironment() {
  return validateEnvironment({ ...readEnvironmentFile(), ...process.env })
}
