import { createConnection, Types } from 'mongoose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertTransactionSupport,
  createBootstrapService,
} from '../../../src/modules/admin/bootstrap.js'
import { bootstrapStateModel } from '../../../src/modules/admin/model.js'

const connections = []

afterEach(async () => {
  await Promise.all(connections.splice(0).map((connection) => connection.close()))
})

function topologyDatabase(topology) {
  const command = vi.fn().mockResolvedValue(topology)
  return { database: { readyState: 1, db: { admin: () => ({ command }) } }, command }
}

describe('first-admin transaction preflight', () => {
  it.each([
    { setName: 'test-rs', maxWireVersion: 7 },
    { msg: 'isdbgrid', maxWireVersion: 8 },
  ])('accepts a supported topology without writing or reconfiguring it', async (topology) => {
    const { database, command } = topologyDatabase(topology)
    await assertTransactionSupport(database)
    expect(command).toHaveBeenCalledExactlyOnceWith({ hello: 1 }, { timeoutMS: 5000 })
  })

  it.each([
    { maxWireVersion: 25 },
    { setName: '', maxWireVersion: 25 },
    { setName: 'test-rs', maxWireVersion: 6 },
    { msg: 'isdbgrid', maxWireVersion: 7 },
    { setName: 'test-rs' },
  ])('refuses unsupported or incomplete topology metadata', async (topology) => {
    const { database } = topologyDatabase(topology)
    await expect(assertTransactionSupport(database)).rejects.toMatchObject({
      code: 'TRANSACTIONS_REQUIRED',
    })
  })

  it('reports fixed guidance for disconnected databases and private driver failures', async () => {
    await expect(assertTransactionSupport({ readyState: 0 })).rejects.toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
    })
    const { database, command } = topologyDatabase({})
    command.mockRejectedValue(new Error('mongodb://private:secret@example.invalid/private'))
    await expect(assertTransactionSupport(database)).rejects.toMatchObject({
      code: 'DATABASE_UNAVAILABLE',
      message: 'The selected database could not be checked.',
    })
  })
})

describe('bootstrap identity and permanent guard', () => {
  it('rejects public role escalation fields before database or password work', async () => {
    const database = createConnection()
    connections.push(database)
    const service = createBootstrapService(database, { recordAuditEvent: vi.fn() })
    await expect(
      service.bootstrap({
        email: 'admin@example.test',
        username: 'test-admin',
        password: 'Synthetic-Test-Password-2026',
        avatarId: 'detective',
        globalRoles: ['admin'],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ACCOUNT_DETAILS' })
  })

  it('has one fixed non-expiring guard identity and rejects extra or missing data', async () => {
    const database = createConnection()
    connections.push(database)
    const Guard = bootstrapStateModel(database)
    const valid = { _id: 'first-admin', userId: new Types.ObjectId(), createdAt: new Date() }
    await expect(new Guard(valid).validate()).resolves.toBeUndefined()
    await expect(new Guard({ ...valid, _id: 'second-admin' }).validate()).rejects.toThrow()
    await expect(new Guard({ _id: 'first-admin' }).validate()).rejects.toThrow()
    expect(() => new Guard({ ...valid, expiresAt: new Date() })).toThrow()
    expect(Guard.schema.indexes().some(([, options]) => 'expireAfterSeconds' in options)).toBe(
      false,
    )
  })
})
