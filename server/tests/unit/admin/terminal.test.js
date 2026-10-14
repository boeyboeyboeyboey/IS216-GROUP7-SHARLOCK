import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { BootstrapError } from '../../../src/modules/admin/bootstrap.js'
import { runBootstrapAdmin } from '../../../../scripts/lib/bootstrap-admin.mjs'
import { createTerminalInput } from '../../../../scripts/lib/terminal-input.mjs'

class FakeInput extends EventEmitter {
  isTTY = true
  isRaw = false
  paused = true

  setRawMode(value) {
    this.isRaw = value
  }

  isPaused() {
    return this.paused
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  send(value) {
    this.emit('data', Buffer.isBuffer(value) ? value : Buffer.from(value))
  }
}

class FakeOutput {
  isTTY = true
  chunks = []

  write(value) {
    this.chunks.push(String(value))
    return true
  }

  get text() {
    return this.chunks.join('')
  }
}

function createFakeTerminal() {
  const stdin = new FakeInput()
  const stdout = new FakeOutput()
  return { stdin, stdout, terminal: createTerminalInput({ stdin, stdout }) }
}

describe('private terminal input', () => {
  it('handles pasted non-BMP characters and backspace by Unicode code point', async () => {
    const { stdin, stdout, terminal } = createFakeTerminal()
    const line = terminal.readLine('Username: ', { maxLength: 12 })
    const pasted = Buffer.from('Ada🔒')
    stdin.send(pasted.subarray(0, 5))
    stdin.send(pasted.subarray(5))
    stdin.send('\u007f')
    stdin.send(' B\r')

    await expect(line).resolves.toBe('Ada B')
    expect(stdout.text).toBe('Username: Ada🔒\b \b B\n')
    expect(stdin.isRaw).toBe(false)
    expect(stdin.paused).toBe(true)
    expect(stdin.listenerCount('data')).toBe(0)
    expect(stdin.listenerCount('end')).toBe(0)
    expect(stdin.listenerCount('error')).toBe(0)
    terminal.close()
  })

  it('keeps secret characters out of terminal echo and enforces the code point limit', async () => {
    const { stdin, stdout, terminal } = createFakeTerminal()
    const secret = terminal.readSecret('Password: ', { maxLength: 3 })
    stdin.send('🔑ab')
    stdin.send('\r')

    await expect(secret).resolves.toBe('🔑ab')
    expect(stdout.text).toBe('Password: \n')
    expect(stdout.text).not.toContain('🔑')
    expect(stdout.text).not.toContain('abc')
    expect(stdin.isRaw).toBe(false)
    expect(stdin.listenerCount('data')).toBe(0)
    terminal.close()
  })

  it.each([
    ['ASCII', 'p'.repeat(129)],
    ['Unicode', '🔒'.repeat(129)],
  ])(
    'rejects a secret longer than 128 %s code points instead of truncating it',
    async (_label, value) => {
      const { stdin, stdout, terminal } = createFakeTerminal()
      const secret = terminal.readSecret('Password: ', { maxLength: 128 })
      stdin.send(value)
      stdin.send('\r')

      await expect(secret).rejects.toMatchObject({ code: 'TERMINAL_INPUT_TOO_LONG' })
      expect(stdout.text).toBe('Password: ')
      expect(stdin.isRaw).toBe(false)
      expect(stdin.listenerCount('data')).toBe(0)
      terminal.close()
    },
  )

  it('rejects an overlong visible confirmation instead of accepting its matching prefix', async () => {
    const { stdin, terminal } = createFakeTerminal()
    const confirmation = terminal.readLine('Database: ', { maxLength: 3 })
    stdin.send('dbx-extra\r')

    await expect(confirmation).rejects.toMatchObject({ code: 'TERMINAL_INPUT_TOO_LONG' })
    terminal.close()
  })

  it('lets backspace remove an overflow character without truncating the accepted prefix', async () => {
    const { stdin, terminal } = createFakeTerminal()
    const secret = terminal.readSecret('Password: ', { maxLength: 128 })
    stdin.send(`${'p'.repeat(129)}\u007f\r`)

    await expect(secret).resolves.toBe('p'.repeat(128))
    terminal.close()
  })

  it('rejects pasted tabs without echoing or returning a partial secret', async () => {
    const { stdin, stdout, terminal } = createFakeTerminal()
    const secret = terminal.readSecret('Password: ', { maxLength: 128 })
    stdin.send('visible-prefix\tprivate-suffix\r')

    await expect(secret).rejects.toMatchObject({ code: 'TERMINAL_INVALID_INPUT' })
    expect(stdout.text).toBe('Password: ')
    expect(stdout.text).not.toContain('visible-prefix')
    expect(stdin.isRaw).toBe(false)
    expect(stdin.listenerCount('data')).toBe(0)
    terminal.close()
  })

  it.each([
    ['Ctrl-C', (stdin) => stdin.send('\u0003')],
    ['EOF', (stdin) => stdin.emit('end')],
  ])('cancels on %s and restores raw mode and listeners', async (_label, cancel) => {
    const { stdin, stdout, terminal } = createFakeTerminal()
    const secret = terminal.readSecret('Password: ', { maxLength: 20 })
    stdin.send('hidden-value')
    cancel(stdin)

    await expect(secret).rejects.toMatchObject({ code: 'TERMINAL_CANCELLED' })
    expect(stdout.text).toBe('Password: ')
    expect(stdin.isRaw).toBe(false)
    expect(stdin.paused).toBe(true)
    expect(stdin.listenerCount('data')).toBe(0)
    expect(stdin.listenerCount('end')).toBe(0)
    expect(stdin.listenerCount('error')).toBe(0)
    terminal.close()
  })
})

const databaseUri = 'mongodb://operator:private@127.0.0.1:27018/sharlock_school'
const registration = {
  email: ' Admin.One@example.test ',
  username: ' Admin_One ',
  password: 'Correct-Horse-🔒-2026',
  avatarId: 'mint',
}

class FakePromptTerminal {
  isTTY = true
  output = ''
  linePrompts = []
  secretPrompts = []

  constructor({ lines = [], secrets = [] } = {}) {
    this.lines = [...lines]
    this.secrets = [...secrets]
  }

  write(message) {
    this.output += message
  }

  async readLine(prompt, options) {
    this.linePrompts.push([prompt, options])
    const value = this.lines.shift()
    if (value instanceof Error) throw value
    return value
  }

  async readSecret(prompt, options) {
    this.secretPrompts.push([prompt, options])
    const value = this.secrets.shift()
    if (value instanceof Error) throw value
    return value
  }

  close = () => {}
}

function makeBootstrapRun({
  lines = ['sharlock_school', 'CREATE FIRST ADMIN', registration.email, registration.username, '1'],
  secrets = [registration.password, registration.password],
  config = { databaseUri },
} = {}) {
  const terminal = new FakePromptTerminal({ lines, secrets })
  const calls = []
  const database = { close: async () => calls.push('close') }
  const storage = {
    initializeBootstrapStorage: async () => calls.push('storage'),
  }
  let receivedInput
  let receivedRawInput
  const bootstrap = async (input) => {
    receivedInput = { ...input }
    receivedRawInput = input
    calls.push('bootstrap')
    return { id: '0123456789abcdef01234567' }
  }
  const service = {
    BootstrapError,
    assertTransactionSupport: async () => calls.push('transaction-check'),
    createBootstrapService: () => {
      calls.push('service')
      return { bootstrap }
    },
  }
  const connect = async () => {
    calls.push('connect')
    return database
  }
  const run = () =>
    runBootstrapAdmin({
      terminal,
      config,
      connect,
      storage,
      service,
    })

  return {
    terminal,
    calls,
    database,
    storage,
    service,
    connect,
    run,
    get receivedInput() {
      return receivedInput
    },
    get receivedRawInput() {
      return receivedRawInput
    },
  }
}

describe('first-admin CLI boundary', () => {
  it('confirms the exact database and hands only the validated raw registration to the service', async () => {
    const fixture = makeBootstrapRun()

    await expect(fixture.run()).resolves.toEqual({ status: 'created' })

    expect(fixture.terminal.linePrompts[0]).toEqual([
      'Type the database name exactly to continue: ',
      { maxLength: 'sharlock_school'.length },
    ])
    expect(fixture.terminal.linePrompts[1][0]).toContain('CREATE FIRST ADMIN')
    expect(fixture.calls).toEqual([
      'connect',
      'transaction-check',
      'storage',
      'service',
      'bootstrap',
      'close',
    ])
    expect(fixture.receivedInput).toEqual(registration)
    expect(fixture.receivedRawInput.password).toBe('')
    expect(fixture.terminal.output).toContain('Target database: sharlock_school (local)')
    expect(fixture.terminal.output).toContain('First administrator created successfully.')
    expect(fixture.terminal.output).not.toContain('operator:private')
    expect(fixture.terminal.output).not.toContain('127.0.0.1')
    expect(fixture.terminal.output).not.toContain(registration.password)
    expect(fixture.terminal.output).not.toContain('0123456789abcdef01234567')
  })

  it('does not connect or create storage when hidden password entry is cancelled', async () => {
    const cancellation = Object.assign(new Error('private cancel detail'), {
      code: 'TERMINAL_CANCELLED',
    })
    const fixture = makeBootstrapRun({
      secrets: [registration.password, cancellation],
    })

    await expect(fixture.run()).resolves.toEqual({ status: 'cancelled' })

    expect(fixture.calls).toEqual([])
    expect(fixture.terminal.output).toContain('Setup cancelled. No account changes were made.')
    expect(fixture.terminal.output).not.toContain('private cancel detail')
    expect(fixture.terminal.output).not.toContain(registration.password)
  })

  it.each([
    [
      'database name',
      ['wrong_database', 'CREATE FIRST ADMIN', registration.email, registration.username, '1'],
    ],
    [
      'create phrase',
      ['sharlock_school', 'CREATE ADMIN', registration.email, registration.username, '1'],
    ],
  ])('refuses a mismatched %s before opening the database', async (_label, lines) => {
    const fixture = makeBootstrapRun({ lines })

    await expect(fixture.run()).resolves.toEqual({ status: 'refused' })

    expect(fixture.calls).toEqual([])
    expect(fixture.terminal.output).toContain('No changes were made.')
  })

  it('refuses mismatched password confirmation before opening the database', async () => {
    const fixture = makeBootstrapRun({
      secrets: [registration.password, 'Different-Passphrase-2026'],
    })

    await expect(fixture.run()).resolves.toEqual({ status: 'refused' })

    expect(fixture.calls).toEqual([])
    expect(fixture.terminal.output).toContain(
      'Password entries did not match. No changes were made.',
    )
    expect(fixture.terminal.output).not.toContain(registration.password)
    expect(fixture.terminal.output).not.toContain('Different-Passphrase-2026')
  })

  it.each([
    ['missing URI', {}],
    [
      'URI without an explicit database',
      { databaseUri: 'mongodb://operator:private@127.0.0.1:27018' },
    ],
    [
      'URI with a system database',
      { databaseUri: 'mongodb://operator:private@127.0.0.1:27018/admin' },
    ],
  ])('refuses a %s without connecting', async (_label, config) => {
    const fixture = makeBootstrapRun({ config })

    await expect(fixture.run()).resolves.toEqual({ status: 'refused' })

    expect(fixture.calls).toEqual([])
    expect(fixture.terminal.output).not.toContain('operator:private')
    expect(fixture.terminal.output).not.toContain('127.0.0.1')
    expect(fixture.terminal.output).toContain('explicit, non-system database')
    expect(fixture.terminal.output).toContain('No account changes were made.')
  })

  it('refuses an overlong terminal field before opening the database', async () => {
    const overflow = Object.assign(new Error('private overflow detail'), {
      code: 'TERMINAL_INPUT_TOO_LONG',
    })
    const fixture = makeBootstrapRun({ secrets: [overflow] })

    await expect(fixture.run()).resolves.toEqual({ status: 'refused' })

    expect(fixture.calls).toEqual([])
    expect(fixture.terminal.output).toContain('Input exceeded the allowed length.')
    expect(fixture.terminal.output).toContain('No account was created.')
    expect(fixture.terminal.output).not.toContain('private overflow detail')
  })

  it('rejects unsupported pasted controls before opening the database', async () => {
    const invalid = Object.assign(new Error('private control detail'), {
      code: 'TERMINAL_INVALID_INPUT',
    })
    const fixture = makeBootstrapRun({ secrets: [invalid] })

    await expect(fixture.run()).resolves.toEqual({ status: 'refused' })

    expect(fixture.calls).toEqual([])
    expect(fixture.terminal.output).toContain(
      'Input contained unsupported control characters. No account was created.',
    )
    expect(fixture.terminal.output).not.toContain('private control detail')
  })

  it('checks topology before storage and prints only the service safe message', async () => {
    const fixture = makeBootstrapRun()
    const error = new BootstrapError(
      'TRANSACTIONS_REQUIRED',
      `private topology details: ${registration.password}`,
    )
    error.stack = 'private stack details'
    fixture.service.assertTransactionSupport = async () => {
      fixture.calls.push('transaction-check')
      throw error
    }

    await expect(fixture.run()).resolves.toEqual({ status: 'refused' })

    expect(fixture.calls).toEqual(['connect', 'transaction-check', 'close'])
    expect(fixture.terminal.output).toContain(
      'Setup requires a transaction-capable replica set or sharded cluster.',
    )
    expect(fixture.terminal.output).not.toContain('private topology details')
    expect(fixture.terminal.output).not.toContain('private stack details')
    expect(fixture.terminal.output).not.toContain(registration.password)
  })

  it('maps BOOTSTRAP_FAILED to approved state-check guidance without showing its message', async () => {
    const fixture = makeBootstrapRun()
    fixture.service.createBootstrapService = () => ({
      bootstrap: async () => {
        throw new BootstrapError('BOOTSTRAP_FAILED', `private failure: ${registration.password}`)
      },
    })

    await expect(fixture.run()).resolves.toEqual({ status: 'uncertain' })

    expect(fixture.terminal.output).toContain('Administrator setup could not be confirmed.')
    expect(fixture.terminal.output).toContain('Request an approved state check before retrying.')
    expect(fixture.terminal.output).not.toContain('private failure')
    expect(fixture.terminal.output).not.toContain(registration.password)
    expect(fixture.terminal.output).not.toContain('No account changes were made.')
    expect(fixture.calls).toContain('storage')
    expect(fixture.calls).toContain('close')
  })

  it.each(['UNEXPECTED_PRIVATE_CODE', '__proto__', 'constructor'])(
    'does not reveal unknown BootstrapError code %s or claim rollback after bootstrap starts',
    async (code) => {
      const fixture = makeBootstrapRun()
      fixture.service.createBootstrapService = () => ({
        bootstrap: async () => {
          throw new BootstrapError(code, `private details: ${registration.password}`)
        },
      })

      await expect(fixture.run()).resolves.toEqual({ status: 'uncertain' })

      expect(fixture.terminal.output).toContain('Request an approved state check before retrying.')
      expect(fixture.terminal.output).not.toContain(code)
      expect(fixture.terminal.output).not.toContain('private details')
      expect(fixture.terminal.output).not.toContain(registration.password)
      expect(fixture.terminal.output).not.toContain('No account changes were made.')
    },
  )

  it('treats a cancellation-shaped error after bootstrap starts as an uncertain outcome', async () => {
    const fixture = makeBootstrapRun()
    fixture.service.createBootstrapService = () => ({
      bootstrap: async () => {
        throw Object.assign(new Error('private cancellation detail'), {
          code: 'TERMINAL_CANCELLED',
        })
      },
    })

    await expect(fixture.run()).resolves.toEqual({ status: 'uncertain' })

    expect(fixture.terminal.output).toContain('Request an approved state check before retrying.')
    expect(fixture.terminal.output).not.toContain('private cancellation detail')
    expect(fixture.terminal.output).not.toContain('No account changes were made.')
  })
})
