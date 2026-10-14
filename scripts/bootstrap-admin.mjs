import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { connectDatabase } from '../server/src/config/database.js'
import { loadEnvironment } from '../server/src/config/env.js'
import { avatarPresets } from '../server/src/modules/auth/avatars.js'
import { parseRegistrationInput } from '../server/src/modules/auth/policy.js'
import {
  assertTransactionSupport,
  BootstrapError,
  createBootstrapService,
} from '../server/src/modules/admin/bootstrap.js'
import { initializeBootstrapStorage } from '../server/src/modules/admin/storage.js'
import { createTerminalInput } from './lib/terminal-input.mjs'
import { runBootstrapAdmin } from './lib/bootstrap-admin.mjs'

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write('First-admin setup requires a private interactive terminal.\n')
    return { status: 'refused' }
  }
  if (process.argv.length > 2) {
    process.stderr.write('First-admin setup does not accept command-line arguments.\n')
    return { status: 'refused' }
  }

  let config
  try {
    config = loadEnvironment()
  } catch {
    process.stderr.write(
      'Configuration could not be loaded. Verify local server setup and retry.\n',
    )
    return { status: 'failed' }
  }

  const terminal = createTerminalInput()
  return runBootstrapAdmin({
    terminal,
    config,
    connect: connectDatabase,
    storage: { initializeBootstrapStorage },
    service: { BootstrapError, assertTransactionSupport, createBootstrapService },
    parseInput: parseRegistrationInput,
    avatars: avatarPresets,
  })
}

const invokedDirectly =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (invokedDirectly) {
  const result = await main()
  if (result.status !== 'created') process.exitCode = 1
}
