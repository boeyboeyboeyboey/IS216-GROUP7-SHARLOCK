import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../../../src/app.js'
import { assertSafeTestDatabaseUri } from '../../../src/config/database-uri.js'
import { initializeAuthStorage } from '../../../src/modules/auth/storage.js'

const authApps = new Set()
const appOrigins = new WeakMap()

export async function initializeTestAuth(database, config) {
  if (config?.nodeEnv !== 'test') {
    throw new Error('Auth integration tests require NODE_ENV=test.')
  }
  assertSafeTestDatabaseUri(config.databaseUri)
  await initializeAuthStorage(database)
  return {
    nodeEnv: config.nodeEnv,
    clientOrigin: config.clientOrigin,
    sessionSecret: config.sessionSecret,
  }
}

export function createTestApp(database, authOptions, featureOptions = {}) {
  const app = createApp(database, { ...featureOptions, auth: authOptions })
  appOrigins.set(app, authOptions.clientOrigin)
  authApps.add(app)
  return app
}

export async function disposeTestAuthApps() {
  const apps = [...authApps]
  authApps.clear()
  await Promise.all(apps.map((app) => app.locals.disposeAuth?.()))
}

export async function registerTestStudent(app, overrides = {}) {
  const origin = appOrigins.get(app)
  if (!origin) throw new Error('Create the app with createTestApp before registering a student.')

  const agent = request.agent(app)
  const uniqueId = randomUUID().replaceAll('-', '')
  const registration = {
    email: `auth-${uniqueId}@example.test`,
    username: `learner-${uniqueId.slice(0, 12)}`,
    password: 'Synthetic-Test-Password-2026',
    avatarId: 'mint',
    ...overrides,
  }
  const csrf = await agent.get('/api/auth/csrf').set('Origin', origin).expect(200)
  const response = await agent
    .post('/api/auth/register')
    .set('Origin', origin)
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send(registration)
    .expect(201)

  return {
    agent,
    user: response.body.user,
    csrfToken: response.body.csrfToken,
    email: registration.email,
    password: registration.password,
  }
}
