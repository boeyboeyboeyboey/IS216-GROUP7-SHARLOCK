import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { connectDatabase } from '../../../src/config/database.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { userModel } from '../../../src/models/User.js'
import {
  createTestApp,
  disposeTestAuthApps,
  initializeTestAuth,
  registerTestStudent,
} from '../../integration/auth/helpers.js'

let database
let authOptions
let app

beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test') throw new Error('Profile integration tests require NODE_ENV=test.')
  database = await connectDatabase(config.databaseUri)
  authOptions = await initializeTestAuth(database, config)
})

beforeEach(async () => {
  if (!database?.name?.endsWith('_test')) {
    throw new Error('Refusing profile fixture cleanup outside a disposable _test database.')
  }
  await Promise.all([
    database.db.collection('users').deleteMany({}),
    database.db.collection('auth_sessions').deleteMany({}),
  ])
  app = createTestApp(database, authOptions)
})

afterAll(async () => {
  await disposeTestAuthApps()
  await database?.close()
})

function patchProfile(account, input, { origin, token } = {}) {
  return account.agent
    .patch('/api/me/profile')
    .set('Origin', origin || authOptions.clientOrigin)
    .set('X-CSRF-Token', token || account.csrfToken)
    .send(input)
}

describe('profile API', () => {
  it('requires a current session and returns only the caller profile fields', async () => {
    await request(app).get('/api/me/profile').expect(401)
    const account = await registerTestStudent(app)
    const response = await account.agent.get('/api/me/profile').expect(200)

    expect(response.body).toEqual({
      username: account.user.username,
      avatarId: account.user.avatarId,
    })
    expect(Object.keys(response.body).sort()).toEqual(['avatarId', 'username'])
    expect(response.headers['cache-control']).toContain('no-store')
  })

  it('updates the authenticated account and persists the direct safe response', async () => {
    const account = await registerTestStudent(app)
    const updated = await patchProfile(account, {
      username: 'New_Capybara',
      avatarId: 'reader',
    }).expect(200)

    expect(updated.body).toEqual({ username: 'New_Capybara', avatarId: 'reader' })
    expect(Object.keys(updated.body).sort()).toEqual(['avatarId', 'username'])
    expect(await account.agent.get('/api/me/profile').expect(200)).toMatchObject({
      body: updated.body,
    })
    expect(await account.agent.get('/api/auth/me').expect(200)).toMatchObject({
      body: { user: { username: 'New_Capybara', avatarId: 'reader' } },
    })

    const stored = await userModel(database)
      .findById(account.user.id)
      .select('+passwordHash')
      .lean()
    expect(stored).toMatchObject({
      username: 'New_Capybara',
      usernameNormalized: 'new_capybara',
      avatarId: 'reader',
      emailNormalized: account.email,
      globalRoles: ['student'],
    })
    expect(updated.text).not.toMatch(/email|role|authVersion|password|session|membership|score/i)
  })

  it('rejects writes without valid CSRF and expected origin', async () => {
    const account = await registerTestStudent(app)
    await account.agent
      .patch('/api/me/profile')
      .set('Origin', authOptions.clientOrigin)
      .send({ username: 'New_Capybara', avatarId: 'blue' })
      .expect(403)
    await patchProfile(
      account,
      { username: 'New_Capybara', avatarId: 'blue' },
      {
        origin: 'http://untrusted.example',
      },
    ).expect(403)
  })

  it('rejects mass assignment, user IDs, unsafe keys, invalid names, and unsupported avatars', async () => {
    const account = await registerTestStudent(app)
    const invalidBodies = [
      '{"username":"New_Name","avatarId":"mint","userId":"66f0a35f2d84787cce1a1001"}',
      '{"username":"New_Name","avatarId":"mint","role":"admin"}',
      '{"username":"New_Name","avatarId":"mint","$set":{"accountStatus":"disabled"}}',
      '{"username":"New_Name","avatarId":"mint","__proto__":{"polluted":true}}',
    ]
    for (const body of invalidBodies) {
      const response = await account.agent
        .patch('/api/me/profile')
        .set('Origin', authOptions.clientOrigin)
        .set('X-CSRF-Token', account.csrfToken)
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    }
    await patchProfile(account, { username: 'bad name', avatarId: 'mint' }).expect(400)
    await patchProfile(account, {
      username: 'New_Name',
      avatarId: 'data:image/png;base64,xx',
    }).expect(400)
    expect({}.polluted).toBeUndefined()
    expect(await account.agent.get('/api/me/profile').expect(200)).toMatchObject({
      body: { username: account.user.username, avatarId: account.user.avatarId },
    })
  })

  it('maps case-insensitive duplicate and concurrent username races to safe conflicts', async () => {
    const first = await registerTestStudent(app, { username: 'Case_Name' })
    const second = await registerTestStudent(app, { username: 'Other_Name' })
    const duplicate = await patchProfile(second, {
      username: 'case_name',
      avatarId: 'blue',
    }).expect(409)
    expect(duplicate.body.error).toMatchObject({ code: 'PROFILE_CONFLICT' })
    expect(duplicate.text).not.toMatch(/usernameNormalized|duplicate key|index|emailNormalized/i)
    expect(await second.agent.get('/api/me/profile').expect(200)).toMatchObject({
      body: { username: 'Other_Name', avatarId: second.user.avatarId },
    })

    const third = await registerTestStudent(app, { username: 'Third_Name' })
    const fourth = await registerTestStudent(app, { username: 'Fourth_Name' })
    const results = await Promise.all([
      patchProfile(third, { username: 'Shared_Name', avatarId: 'peach' }),
      patchProfile(fourth, { username: 'shared_name', avatarId: 'gamer' }),
    ])
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409])
    const conflict = results.find(({ status }) => status === 409)
    expect(conflict.text).not.toMatch(/usernameNormalized|duplicate key|index|emailNormalized/i)
    expect(await first.agent.get('/api/me/profile').expect(200)).toMatchObject({
      body: { username: 'Case_Name', avatarId: first.user.avatarId },
    })
  })

  it('rejects an account disabled after registration and preserves its stored profile', async () => {
    const account = await registerTestStudent(app)
    await userModel(database).updateOne(
      { _id: account.user.id },
      { $set: { accountStatus: 'disabled' } },
    )

    await patchProfile(account, { username: 'Disabled_Name', avatarId: 'blue' }).expect(401)
    const stored = await userModel(database).findById(account.user.id).lean()
    expect(stored).toMatchObject({
      username: account.user.username,
      avatarId: account.user.avatarId,
    })
  })
})
