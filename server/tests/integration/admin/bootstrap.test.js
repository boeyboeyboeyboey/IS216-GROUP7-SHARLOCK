import { randomUUID } from 'node:crypto'
import { Types } from 'mongoose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { connectDatabase } from '../../../src/config/database.js'
import { assertSafeTestDatabaseUri } from '../../../src/config/database-uri.js'
import { validateEnvironment } from '../../../src/config/env.js'
import { userModel } from '../../../src/models/User.js'
import { createBootstrapService } from '../../../src/modules/admin/bootstrap.js'
import { bootstrapStateModel } from '../../../src/modules/admin/model.js'
import { initializeBootstrapStorage } from '../../../src/modules/admin/storage.js'
import { createAuditService } from '../../../src/modules/audit/service.js'
import { hashPassword, verifyPassword } from '../../../src/modules/auth/password.js'
import { createTestApp, disposeTestAuthApps, initializeTestAuth } from '../auth/helpers.js'

const password = 'AlphaBravo1!'
let database
let authOptions
let fixtureHash
let input
let ownedIds
let ownedRequestIds

function requireDisposableDatabase() {
  if (process.env.NODE_ENV !== 'test' || !database?.name.endsWith('_test')) {
    throw new Error('Refusing bootstrap fixtures outside a disposable _test database.')
  }
  assertSafeTestDatabaseUri(process.env.TEST_MONGODB_URI, process.env.MONGO_URI)
}

function accountInput(label = 'admin') {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  return {
    email: `${label}-${suffix}@example.test`,
    username: `${label}-${suffix}`,
    password,
    avatarId: 'detective',
  }
}

async function existingUser(details, globalRoles = ['student'], accountStatus = 'active') {
  const id = new Types.ObjectId()
  ownedIds.add(id.toString())
  return userModel(database).create({
    _id: id,
    emailNormalized: details.email.toLowerCase(),
    username: details.username,
    usernameNormalized: details.username.toLowerCase(),
    passwordHash: fixtureHash,
    avatarId: 'mint',
    globalRoles,
    accountStatus,
    authVersion: 1,
    passwordChangedAt: new Date(),
  })
}

function bootstrapService(options = {}) {
  const writer = createAuditService(database).recordAuditEvent
  return createBootstrapService(database, {
    ...options,
    recordAuditEvent: async (event, context) => {
      ownedIds.add(event.targetId)
      ownedRequestIds.add(event.requestId)
      return (options.recordAuditEvent || writer)(event, context)
    },
  })
}

beforeAll(async () => {
  const config = validateEnvironment(process.env)
  if (config.nodeEnv !== 'test') throw new Error('Bootstrap integration requires NODE_ENV=test.')
  assertSafeTestDatabaseUri(config.databaseUri, process.env.MONGO_URI)
  database = await connectDatabase(config.databaseUri)
  requireDisposableDatabase()
  const topology = await database.db.admin().command({ hello: 1 })
  if (!topology.setName) throw new Error('Run bootstrap integration with --replica-set.')
  await initializeBootstrapStorage(database)
  authOptions = await initializeTestAuth(database, config)
  fixtureHash = await hashPassword(password)
})

beforeEach(() => {
  requireDisposableDatabase()
  input = accountInput()
  ownedIds = new Set()
  ownedRequestIds = new Set()
})

afterEach(async () => {
  if (!database) return
  requireDisposableDatabase()
  const ids = [...ownedIds].map((id) => new Types.ObjectId(id))
  await database.db.collection('admin_bootstrap_state').deleteMany({ userId: { $in: ids } })
  await database.db
    .collection('audit_events')
    .deleteMany({ requestId: { $in: [...ownedRequestIds] } })
  await database.db
    .collection('auth_sessions')
    .deleteMany({ 'session.userId': { $in: [...ownedIds] } })
  await database.db.collection('users').deleteMany({ _id: { $in: ids } })
})

afterAll(async () => {
  await disposeTestAuthApps()
  await database?.close()
})

describe.skipIf(process.env.SHARLOCK_TEST_REPLICA_SET !== '1')(
  'transactional first-admin setup',
  () => {
    it('creates only an admin with one durable guard and safe operator audit, then permits ordinary login', async () => {
      expect([...password]).toHaveLength(12)
      const personalStudent = await existingUser(accountInput('student'))
      const result = await bootstrapService().bootstrap(input)
      ownedIds.add(result.id)
      const admin = await userModel(database).findById(result.id).select('+passwordHash').lean()
      expect(admin.globalRoles).toEqual(['admin'])
      expect(admin.emailNormalized).toBe(input.email)
      expect(await verifyPassword(admin.passwordHash, password)).toBe(true)
      const guard = await bootstrapStateModel(database).findById('first-admin').lean()
      expect(guard.userId.toString()).toBe(result.id)
      const audit = await database.db.collection('audit_events').findOne({ targetId: admin._id })
      expect(audit).toMatchObject({
        eventType: 'admin.bootstrap',
        actorKind: 'operator',
        actorId: null,
        scopeCohortId: null,
        outcome: 'success',
      })
      expect(audit.expiresAt.getTime() - audit.occurredAt.getTime()).toBe(90 * 24 * 60 * 60 * 1000)
      expect(JSON.stringify(audit)).not.toContain(password)
      expect(JSON.stringify(audit)).not.toMatch(/passwordHash|emailNormalized/)
      expect((await userModel(database).findById(personalStudent._id)).globalRoles).toEqual([
        'student',
      ])

      const app = createTestApp(database, authOptions)
      const agent = request.agent(app)
      const csrf = await agent
        .get('/api/auth/csrf')
        .set('Origin', authOptions.clientOrigin)
        .expect(200)
      const login = await agent
        .post('/api/auth/login')
        .set('Origin', authOptions.clientOrigin)
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email: input.email, password })
        .expect(200)
      expect(login.body.user.globalRoles).toEqual(['admin'])
      expect(login.body.user.id).toBe(result.id)
      const events = await agent.get('/api/admin/audit-events').expect(200)
      expect(events.body.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ targetId: result.id, actorKind: 'operator', actorId: null }),
        ]),
      )
      await agent.get('/api/auth/me').expect(200)
    })

    it.each(['alphabravo1!', 'AlphaBravo12'])(
      'rejects first-admin passwords without required composition',
      async (invalidPassword) => {
        const candidate = { ...input, password: invalidPassword }
        await expect(bootstrapService().bootstrap(candidate)).rejects.toMatchObject({
          code: 'INVALID_ACCOUNT_DETAILS',
        })
        expect(await userModel(database).countDocuments({ emailNormalized: candidate.email })).toBe(
          0,
        )
        expect(await bootstrapStateModel(database).countDocuments()).toBe(0)
        expect(await database.db.collection('audit_events').countDocuments()).toBe(0)
      },
    )

    it.each(['email', 'username'])(
      'refuses a matching normalized %s without promoting or rewriting it',
      async (field) => {
        const existing = await existingUser(input)
        const candidate = accountInput('newadmin')
        candidate[field] = input[field].toUpperCase()
        await expect(bootstrapService().bootstrap(candidate)).rejects.toMatchObject({
          code: 'BOOTSTRAP_REFUSED',
        })
        const preserved = await userModel(database)
          .findById(existing._id)
          .select('+passwordHash')
          .lean()
        expect(preserved.globalRoles).toEqual(['student'])
        expect(preserved.passwordHash).toBe(fixtureHash)
        expect(await bootstrapStateModel(database).countDocuments()).toBe(0)
        expect(await database.db.collection('audit_events').countDocuments()).toBe(0)
      },
    )

    it('refuses a pre-existing disabled administrator', async () => {
      await existingUser(accountInput('oldadmin'), ['admin'], 'disabled')
      await expect(bootstrapService().bootstrap(input)).rejects.toMatchObject({
        code: 'BOOTSTRAP_REFUSED',
      })
      expect(await bootstrapStateModel(database).countDocuments()).toBe(0)
    })

    it('keeps the guard after the admin is removed and refuses another bootstrap', async () => {
      const result = await bootstrapService().bootstrap(input)
      ownedIds.add(result.id)
      await userModel(database).deleteOne({ _id: result.id })
      await expect(bootstrapService().bootstrap(accountInput('newadmin'))).rejects.toMatchObject({
        code: 'BOOTSTRAP_REFUSED',
      })
      expect(await bootstrapStateModel(database).countDocuments()).toBe(1)
    })

    it('creates at most one admin under concurrent setup', async () => {
      const candidate = accountInput('raceadmin')
      const service = bootstrapService()
      const outcomes = await Promise.allSettled([
        service.bootstrap(input),
        service.bootstrap(candidate),
      ])
      const successes = outcomes.filter(({ status }) => status === 'fulfilled')
      expect(successes).toHaveLength(1)
      ownedIds.add(successes[0].value.id)
      const failures = outcomes.filter(({ status }) => status === 'rejected')
      expect(failures).toHaveLength(1)
      expect(failures[0].reason.code).toBe('BOOTSTRAP_REFUSED')
      expect(await userModel(database).countDocuments({ globalRoles: 'admin' })).toBe(1)
      expect(await bootstrapStateModel(database).countDocuments()).toBe(1)
      expect(await database.db.collection('audit_events').countDocuments()).toBe(1)
    })

    it('rolls back the account, guard and already-written audit if audit delivery fails', async () => {
      const writer = createAuditService(database).recordAuditEvent
      const failingService = bootstrapService({
        recordAuditEvent: async (event, context) => {
          await writer(event, context)
          throw new Error('private secret-token mongodb://credential.invalid')
        },
      })
      await expect(failingService.bootstrap(input)).rejects.toMatchObject({
        code: 'BOOTSTRAP_FAILED',
        message:
          'Administrator setup could not be confirmed. Request an approved state check before retrying.',
      })
      expect(await userModel(database).countDocuments({ emailNormalized: input.email })).toBe(0)
      expect(await bootstrapStateModel(database).countDocuments()).toBe(0)
      expect(await database.db.collection('audit_events').countDocuments()).toBe(0)
      const result = await bootstrapService().bootstrap(input)
      ownedIds.add(result.id)
      expect(await bootstrapStateModel(database).countDocuments()).toBe(1)
    })
  },
)
