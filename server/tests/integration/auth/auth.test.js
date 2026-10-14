import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app.js'
import { connectDatabase } from '../../../src/config/database.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { initializeAuthStorage } from '../../../src/modules/auth/storage.js'
import {
  createTestApp,
  disposeTestAuthApps,
  initializeTestAuth,
  registerTestStudent,
} from './helpers.js'

let database
let baseAuthOptions
let authOptions
let app
let currentTime

const validRegistration = {
  email: 'student@example.test',
  username: 'Student_One',
  password: 'Correct-Horse-🔒-2026',
  avatarId: 'mint',
}

function cookieValue(response) {
  const cookie = response.headers['set-cookie']?.find((value) => value.startsWith('sharlock.sid='))
  if (!cookie) throw new Error('Expected the auth response to set its session cookie.')
  return cookie.split(';', 1)[0]
}

function sessionId(cookie) {
  const value = decodeURIComponent(cookie.slice('sharlock.sid='.length))
  return value.slice(2).split('.')[0]
}

async function prepareLoginAgent(
  email = validRegistration.email,
  password = validRegistration.password,
) {
  const agent = request.agent(app)
  const csrf = await agent
    .get('/api/auth/csrf')
    .set('Origin', baseAuthOptions.clientOrigin)
    .expect(200)
  const response = await agent
    .post('/api/auth/login')
    .set('Origin', baseAuthOptions.clientOrigin)
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email, password })
  return {
    agent,
    bootstrapCookie: cookieValue(csrf),
    bootstrapToken: csrf.body.csrfToken,
    csrfToken: response.body.csrfToken,
    response,
  }
}

beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test') throw new Error('Auth integration tests require NODE_ENV=test.')
  database = await connectDatabase(config.databaseUri)
  baseAuthOptions = await initializeTestAuth(database, config)
})

beforeEach(async () => {
  if (!database?.name?.endsWith('_test')) {
    throw new Error('Refusing auth fixture cleanup outside a disposable _test database.')
  }
  await Promise.all([
    database.db.collection('users').deleteMany({}),
    database.db.collection('auth_sessions').deleteMany({}),
  ])
  currentTime = Date.now()
  authOptions = { ...baseAuthOptions, now: () => currentTime }
  app = createTestApp(database, authOptions)
})

afterAll(async () => {
  await disposeTestAuthApps()
  await database?.close()
})

describe('account and Mongo session HTTP contract', () => {
  it('creates a student account, rotates the anonymous session and restores a safe user DTO', async () => {
    const agent = request.agent(app)
    const bootstrap = await agent
      .get('/api/auth/csrf')
      .set('Origin', baseAuthOptions.clientOrigin)
      .expect(200)
    const anonymousCookie = cookieValue(bootstrap)
    expect(bootstrap.body).toEqual({ csrfToken: expect.any(String) })
    expect(bootstrap.headers['cache-control']).toBe('no-store')
    expect(bootstrap.headers['set-cookie'][0]).toContain('HttpOnly')
    expect(bootstrap.headers['set-cookie'][0]).toContain('SameSite=Lax')
    expect(bootstrap.headers['set-cookie'][0]).toContain('Path=/api')
    expect(bootstrap.headers['set-cookie'][0]).not.toMatch(/Domain=|; Secure/i)

    const registration = await agent
      .post('/api/auth/register')
      .set('Origin', baseAuthOptions.clientOrigin)
      .set('X-CSRF-Token', bootstrap.body.csrfToken)
      .send(validRegistration)
      .expect(201)
    expect(Object.keys(registration.body).sort()).toEqual(['csrfToken', 'user'])
    expect(Object.keys(registration.body.user).sort()).toEqual(
      ['avatarId', 'email', 'globalRoles', 'id', 'username'].sort(),
    )
    expect(registration.body.user).toMatchObject({
      email: 'student@example.test',
      username: 'Student_One',
      avatarId: 'mint',
      globalRoles: ['student'],
    })
    expect(registration.text).not.toMatch(/passwordHash|authVersion|createdAt|absoluteExpiresAt/)

    const restored = await agent.get('/api/auth/me').expect(200)
    expect(restored.body).toEqual({ user: registration.body.user })
    expect(restored.headers['cache-control']).toBe('no-store')

    const currentCookie = cookieValue(restored)
    expect(sessionId(currentCookie)).not.toBe(sessionId(anonymousCookie))
    await request(app).get('/api/auth/me').set('Cookie', anonymousCookie).expect(401)

    const savedUser = await database.db
      .collection('users')
      .findOne({ emailNormalized: validRegistration.email })
    expect(savedUser.passwordHash).toMatch(/^\$argon2id\$/)
    expect(savedUser.globalRoles).toEqual(['student'])
    const savedSession = await database.db.collection('auth_sessions').findOne({
      _id: sessionId(currentCookie),
    })
    expect(savedSession.session).toMatchObject({
      userId: registration.body.user.id,
      authVersion: 1,
      createdAt: expect.any(Date),
      lastSeenAt: expect.any(Date),
      absoluteExpiresAt: expect.any(Date),
    })
  })

  it('uses the same generic response for unknown, wrong-password and disabled accounts', async () => {
    const student = await registerTestStudent(app)
    const wrongPassword = await prepareLoginAgent(student.email, 'Wrong-Password-Value-2026')
    const unknownAccount = await prepareLoginAgent(
      'unknown@example.test',
      'Wrong-Password-Value-2026',
    )
    await database.db
      .collection('users')
      .updateOne(
        { emailNormalized: student.email.toLowerCase() },
        { $set: { accountStatus: 'disabled' } },
      )
    const disabledAccount = await prepareLoginAgent(student.email, student.password)

    for (const result of [
      wrongPassword.response,
      unknownAccount.response,
      disabledAccount.response,
    ]) {
      expect(result.status).toBe(401)
      expect(result.body.error).toMatchObject({
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      })
      expect(result.body.requestId).toBe(result.headers['x-request-id'])
    }
    expect(wrongPassword.response.body.error).toEqual(
      Object.fromEntries(
        Object.entries(unknownAccount.response.body.error).filter(([key]) => key !== 'requestId'),
      ),
    )
    expect(disabledAccount.response.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(
      JSON.stringify([
        wrongPassword.response.body,
        unknownAccount.response.body,
        disabledAccount.response.body,
      ]),
    ).not.toMatch(/passwordHash|private|stack/)
  })

  it('enforces trusted Origin or Referer and requires the synchronizer token', async () => {
    const agent = request.agent(app)
    const csrf = await agent.get('/api/auth/csrf').expect(200)
    const body = { ...validRegistration, email: 'referer@example.test', username: 'Referer_One' }

    await agent
      .post('/api/auth/register')
      .set('Origin', baseAuthOptions.clientOrigin)
      .send(body)
      .expect(403)
    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send(body)
      .expect(403)
    await agent
      .post('/api/auth/register')
      .set('Origin', 'null')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send(body)
      .expect(403)
    await agent
      .post('/api/auth/register')
      .set('Origin', 'http://evil.example')
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send(body)
      .expect(403)

    const refererOnlyAgent = request.agent(app)
    const refererOnly = await refererOnlyAgent.get('/api/auth/csrf').expect(200)
    await refererOnlyAgent
      .post('/api/auth/register')
      .set('Referer', `${baseAuthOptions.clientOrigin}/join`)
      .set('X-CSRF-Token', refererOnly.body.csrfToken)
      .send({ ...body, email: 'trusted-referer@example.test', username: 'Trusted_Ref' })
      .expect(201)
  })

  it('rejects unknown and prototype-named fields and handles duplicate creation races safely', async () => {
    const agent = request.agent(app)
    const csrf = await agent.get('/api/auth/csrf').expect(200)
    const invalidBody =
      '{"email":"bad-fields@example.test","username":"Bad_Fields","password":"Correct-Horse-🔒-2026","avatarId":"mint","role":"admin","constructor":"x","__proto__":{"polluted":true}}'
    const invalid = await agent
      .post('/api/auth/register')
      .set('Origin', baseAuthOptions.clientOrigin)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .set('Content-Type', 'application/json')
      .send(invalidBody)
      .expect(400)
    const errorBody = JSON.parse(invalid.text)
    expect(Object.hasOwn(errorBody.error.fieldErrors, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(errorBody.error.fieldErrors)).toBe(Object.prototype)
    expect({}.polluted).toBeUndefined()

    const agents = await Promise.all(
      [0, 1].map(async () => {
        const duplicateAgent = request.agent(app)
        const token = await duplicateAgent.get('/api/auth/csrf').expect(200)
        return { agent: duplicateAgent, token: token.body.csrfToken }
      }),
    )
    const results = await Promise.all(
      agents.map(({ agent: duplicateAgent, token }) =>
        duplicateAgent
          .post('/api/auth/register')
          .set('Origin', baseAuthOptions.clientOrigin)
          .set('X-CSRF-Token', token)
          .send({ ...validRegistration, email: 'race@example.test', username: 'Race_User' }),
      ),
    )
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409])
    const conflict = results.find(({ status }) => status === 409)
    expect(conflict.body.error).toMatchObject({
      code: 'ACCOUNT_UNAVAILABLE',
      message: 'An account could not be created with those details.',
    })
    expect(conflict.text).not.toMatch(/emailNormalized|usernameNormalized|index|duplicate key/)
  })

  it('expires anonymous CSRF sessions after ten minutes', async () => {
    const agent = request.agent(app)
    const bootstrap = await agent
      .get('/api/auth/csrf')
      .set('Origin', baseAuthOptions.clientOrigin)
      .expect(200)
    currentTime += 10 * 60 * 1000 + 1

    const expired = await agent
      .post('/api/auth/register')
      .set('Origin', baseAuthOptions.clientOrigin)
      .set('X-CSRF-Token', bootstrap.body.csrfToken)
      .send(validRegistration)
      .expect(403)
    expect(expired.body.error.code).toBe('CSRF_INVALID')
    expect(await database.db.collection('users').countDocuments({})).toBe(0)
  })

  it('uses per-request expiry and account version/status checks for restoration', async () => {
    const student = await registerTestStudent(app)
    const refreshed = await student.agent.get('/api/auth/me').expect(200)
    const cookie = cookieValue(refreshed)
    const start = currentTime

    currentTime = start + 30 * 60 * 1000 + 1
    const bootstrap = await student.agent.get('/api/auth/csrf').expect(200)
    expect(bootstrap.body).toEqual({ csrfToken: expect.any(String) })
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401)

    currentTime = start
    const absoluteStudent = await registerTestStudent(app, {
      email: 'absolute@example.test',
      username: 'Absolute_One',
    })
    const absoluteCookie = cookieValue(await absoluteStudent.agent.get('/api/auth/me').expect(200))
    for (let elapsed = 29 * 60 * 1000; elapsed < 8 * 60 * 60 * 1000; elapsed += 29 * 60 * 1000) {
      currentTime = start + elapsed
      await request(app).get('/api/auth/me').set('Cookie', absoluteCookie).expect(200)
    }
    currentTime = start + 8 * 60 * 60 * 1000
    await request(app).get('/api/auth/me').set('Cookie', absoluteCookie).expect(401)

    currentTime = start
    const disabledStudent = await registerTestStudent(app, {
      email: 'disabled@example.test',
      username: 'Disabled_One',
    })
    const disabledCookie = cookieValue(await disabledStudent.agent.get('/api/auth/me').expect(200))
    const disabledSecondSession = await prepareLoginAgent(
      disabledStudent.email,
      disabledStudent.password,
    )
    const disabledSecondCookie = cookieValue(
      await disabledSecondSession.agent.get('/api/auth/me').expect(200),
    )
    await database.db
      .collection('users')
      .updateOne(
        { emailNormalized: disabledStudent.email.toLowerCase() },
        { $set: { accountStatus: 'disabled' } },
      )
    await request(app).get('/api/auth/csrf').set('Cookie', disabledCookie).expect(401)
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', disabledSecondCookie)
      .set('Origin', baseAuthOptions.clientOrigin)
      .set('X-CSRF-Token', disabledSecondSession.csrfToken)
      .send({})
      .expect(401)

    const versionStudent = await registerTestStudent(app, {
      email: 'version@example.test',
      username: 'Version_One',
    })
    const secondVersionSession = await prepareLoginAgent(
      versionStudent.email,
      versionStudent.password,
    )
    await database.db
      .collection('users')
      .updateOne(
        { emailNormalized: versionStudent.email.toLowerCase() },
        { $inc: { authVersion: 1 } },
      )
    await secondVersionSession.agent.get('/api/auth/csrf').expect(401)
    await versionStudent.agent.get('/api/auth/me').expect(401)
  })

  it('rotates login sessions, logs out only the current same-user session and prevents stale restore', async () => {
    const firstStudent = await registerTestStudent(app, {
      email: 'first@example.test',
      username: 'First_User',
    })
    const secondSession = await prepareLoginAgent(firstStudent.email, firstStudent.password)
    expect(secondSession.response.status).toBe(200)
    expect(secondSession.csrfToken).not.toBe(secondSession.bootstrapToken)
    await request(app).get('/api/auth/me').set('Cookie', secondSession.bootstrapCookie).expect(401)

    const current = await secondSession.agent.get('/api/auth/me').expect(200)
    const cookie = cookieValue(current)
    const logout = request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('Origin', baseAuthOptions.clientOrigin)
      .set('X-CSRF-Token', secondSession.csrfToken)
      .send({})
    const restore = request(app).get('/api/auth/me').set('Cookie', cookie)
    const [logoutResult, restoreResult] = await Promise.all([logout, restore])
    expect(logoutResult.status).toBe(204)
    expect([200, 401]).toContain(restoreResult.status)
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401)
    await firstStudent.agent.get('/api/auth/me').expect(200)
  })

  it('rejects missing auth settings and initializes existing storage safely', async () => {
    expect(() => createApp(database)).toThrow(/Auth settings are required/)
    await initializeAuthStorage(database)
    const indexes = await database.db.collection('auth_sessions').indexes()
    expect(indexes.some((index) => index.key.expires === 1 && index.expireAfterSeconds === 0)).toBe(
      true,
    )
  })
})
