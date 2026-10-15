import { databaseNameFromUri } from '../../server/src/config/database-uri.js'
import { avatarPresets } from '../../server/src/modules/auth/avatars.js'
import { parseRegistrationInput } from '../../server/src/modules/auth/policy.js'

const CANCELLATION_MESSAGE = 'Setup cancelled. No account changes were made.'
const TOO_LONG_MESSAGE = 'Input exceeded the allowed length. No account was created.'
const UNKNOWN_SETUP_MESSAGE =
  'Administrator setup could not be completed. Verify the configured database and try again.'
const UNCERTAIN_SETUP_MESSAGE =
  'Administrator setup could not be confirmed. Request an approved state check before retrying.'

const SAFE_BOOTSTRAP_FAILURES = Object.freeze({
  DATABASE_UNAVAILABLE: Object.freeze({
    message: 'The selected database could not be checked. Verify connectivity before retrying.',
    status: 'failed',
  }),
  TRANSACTIONS_REQUIRED: Object.freeze({
    message: 'Setup requires a transaction-capable replica set or sharded cluster.',
    status: 'refused',
  }),
  INVALID_ACCOUNT_DETAILS: Object.freeze({
    message:
      'Registration details were not accepted. Check the email, username, preset avatar, and password requirements.',
    status: 'refused',
  }),
  BOOTSTRAP_REFUSED: Object.freeze({
    message: 'An account or initial administrator already exists. No account was promoted.',
    status: 'refused',
  }),
  BOOTSTRAP_FAILED: Object.freeze({
    message: UNCERTAIN_SETUP_MESSAGE,
    status: 'uncertain',
  }),
})

function databaseCategory(uri) {
  try {
    const { hostname, protocol } = new URL(uri)
    if (!['mongodb:', 'mongodb+srv:'].includes(protocol)) return undefined
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname.toLowerCase())
      ? 'local'
      : 'remote'
  } catch {
    return undefined
  }
}

function safeBootstrapFailure(error, BootstrapError, bootstrapStarted) {
  if (typeof BootstrapError !== 'function' || !(error instanceof BootstrapError)) return undefined
  if (!Object.hasOwn(SAFE_BOOTSTRAP_FAILURES, error.code)) {
    return {
      message: bootstrapStarted ? UNCERTAIN_SETUP_MESSAGE : UNKNOWN_SETUP_MESSAGE,
      status: bootstrapStarted ? 'uncertain' : 'failed',
    }
  }

  if (error.code === 'DATABASE_UNAVAILABLE' && bootstrapStarted) {
    return { message: UNCERTAIN_SETUP_MESSAGE, status: 'uncertain' }
  }
  return SAFE_BOOTSTRAP_FAILURES[error.code]
}

function cancelled(error) {
  return error?.code === 'TERMINAL_CANCELLED'
}

export async function runBootstrapAdmin({
  terminal,
  config,
  connect,
  storage,
  service,
  parseInput = parseRegistrationInput,
  avatars = avatarPresets,
}) {
  let database
  let rawInput
  let validatedInput
  const secrets = { password: '', confirmation: '' }
  let bootstrapStarted = false
  let result

  try {
    if (!terminal?.isTTY) {
      terminal?.write?.('First-admin setup requires a private interactive terminal.\n')
      return { status: 'refused' }
    }

    let databaseName
    try {
      databaseName = databaseNameFromUri(config?.databaseUri, 'MONGO_URI', 'sharlock_dev')
    } catch {
      terminal.write(
        'Configured database URI must select a valid, non-system database. No account changes were made.\n',
      )
      return { status: 'refused' }
    }
    const category = databaseCategory(config.databaseUri)
    terminal.write(`Target database: ${databaseName}${category ? ` (${category})` : ''}\n`)

    const confirmedDatabase = await terminal.readLine(
      'Type the database name exactly to continue: ',
      {
        maxLength: databaseName.length,
      },
    )
    if (confirmedDatabase !== databaseName) {
      terminal.write('Database confirmation did not match. No changes were made.\n')
      return { status: 'refused' }
    }

    const createConfirmation = await terminal.readLine(
      'Type CREATE FIRST ADMIN exactly to continue: ',
      { maxLength: 18 },
    )
    if (createConfirmation !== 'CREATE FIRST ADMIN') {
      terminal.write('Administrator setup was not confirmed. No changes were made.\n')
      return { status: 'refused' }
    }

    const email = await terminal.readLine('Administrator email: ', { maxLength: 254 })
    const username = await terminal.readLine('Administrator username: ', { maxLength: 32 })
    terminal.write('Available preset avatars:\n')
    for (const [index, avatar] of avatars.entries()) {
      terminal.write(`${index + 1}. ${avatar.label} (${avatar.id})\n`)
    }
    const avatarChoice = await terminal.readLine('Choose an avatar number: ', { maxLength: 2 })
    const avatar = avatars[Number(avatarChoice) - 1]
    if (!avatar || String(Number(avatarChoice)) !== avatarChoice) {
      terminal.write('The selected avatar was not available. No changes were made.\n')
      return { status: 'refused' }
    }

    secrets.password = await terminal.readSecret('New password: ', { maxLength: 128 })
    secrets.confirmation = await terminal.readSecret('Confirm password: ', { maxLength: 128 })
    if (secrets.password !== secrets.confirmation) {
      terminal.write('Password entries did not match. No changes were made.\n')
      return { status: 'refused' }
    }

    rawInput = { email, username, password: secrets.password, avatarId: avatar.id }
    try {
      validatedInput = parseInput(rawInput)
    } catch {
      terminal.write(
        'Registration details were not accepted. Check the email, username, and password requirements.\n',
      )
      return { status: 'refused' }
    }

    database = await connect(config.databaseUri)
    if (database.name !== databaseName) {
      terminal.write(
        'The connected database did not match the confirmed target. No account was created.\n',
      )
      return { status: 'refused' }
    }
    await service.assertTransactionSupport(database)
    await storage.initializeBootstrapStorage(database)

    bootstrapStarted = true
    await service.createBootstrapService(database).bootstrap(rawInput)
    terminal.write('First administrator created successfully.\n')
    result = { status: 'created' }
  } catch (error) {
    if (cancelled(error)) {
      if (bootstrapStarted) {
        terminal.write(`${UNCERTAIN_SETUP_MESSAGE}\n`)
        result = { status: 'uncertain' }
      } else {
        terminal.write(`${CANCELLATION_MESSAGE}\n`)
        result = { status: 'cancelled' }
      }
    } else if (error?.code === 'TERMINAL_INPUT_TOO_LONG') {
      if (bootstrapStarted) {
        terminal.write(`${UNCERTAIN_SETUP_MESSAGE}\n`)
        result = { status: 'uncertain' }
      } else {
        terminal.write(`${TOO_LONG_MESSAGE}\n`)
        result = { status: 'refused' }
      }
    } else if (error?.code === 'TERMINAL_INVALID_INPUT') {
      if (bootstrapStarted) {
        terminal.write(`${UNCERTAIN_SETUP_MESSAGE}\n`)
        result = { status: 'uncertain' }
      } else {
        terminal.write('Input contained unsupported control characters. No account was created.\n')
        result = { status: 'refused' }
      }
    } else {
      const safeFailure = safeBootstrapFailure(error, service?.BootstrapError, bootstrapStarted)
      if (safeFailure) {
        terminal.write(`${safeFailure.message}\n`)
        result = { status: safeFailure.status }
      } else {
        terminal.write(`${bootstrapStarted ? UNCERTAIN_SETUP_MESSAGE : UNKNOWN_SETUP_MESSAGE}\n`)
        result = { status: bootstrapStarted ? 'uncertain' : 'failed' }
      }
    }
  } finally {
    secrets.password = ''
    secrets.confirmation = ''
    if (rawInput) rawInput.password = ''
    if (validatedInput) validatedInput.password = ''
    if (database && typeof database.close === 'function') {
      try {
        await database.close()
      } catch (error) {
        void error
      }
    }
    if (terminal && typeof terminal.close === 'function') {
      try {
        await terminal.close()
      } catch (error) {
        void error
      }
    }
  }

  return result
}
