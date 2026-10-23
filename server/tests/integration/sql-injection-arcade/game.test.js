import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { connectDatabase } from '../../../src/config/database.js'
import { assertSafeTestDatabaseUri } from '../../../src/config/database-uri.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { initializeCohortStorage } from '../../../src/modules/cohorts/storage.js'
import { initializeAttemptStorage } from '../../../src/modules/attempts/storage.js'
import { createProductionAttemptRegistry } from '../../../src/modules/attempts/production-registry.js'
import { institutionModel } from '../../../src/models/Institution.js'
import { cohortModel } from '../../../src/models/Cohort.js'
import { membershipModel } from '../../../src/models/Membership.js'
import {
  createTestApp,
  disposeTestAuthApps,
  initializeTestAuth,
  registerTestStudent,
} from '../auth/helpers.js'

let database, app, auth, origin
beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test') throw new Error('A disposable test database is required')
  assertSafeTestDatabaseUri(config.databaseUri, process.env.MONGO_URI)
  database = await connectDatabase(config.databaseUri)
  auth = await initializeTestAuth(database, config)
  origin = auth.clientOrigin
  await initializeCohortStorage(database)
  await initializeAttemptStorage(database, createProductionAttemptRegistry())
})
beforeEach(() => {
  app = createTestApp(database, auth)
})
afterAll(async () => {
  await disposeTestAuthApps()
  await database?.close()
})
const gamePath = '/api/games/sql-injection-arcade/attempts'
function post(student, path, body) {
  return student.agent
    .post(path)
    .set('Origin', origin)
    .set('X-CSRF-Token', student.csrfToken)
    .send(body)
}
function action(snapshot, type, payload) {
  return { actionId: randomUUID(), expectedRevision: snapshot.revision, type, payload }
}
async function classFor(student, status = 'active') {
  const institution = await institutionModel(database).create({
    name: 'SQL Test School',
    slug: `sql-${randomUUID()}`,
    status: 'active',
  })
  const cohort = await cohortModel(database).create({
    name: 'SQL Test Class',
    institutionId: institution._id,
    term: '2026',
    status: 'active',
  })
  const membership = await membershipModel(database).create({
    userId: student.user.id,
    cohortId: cohort._id,
    status,
  })
  return { cohort, membership }
}

describe('saved SQL journey', () => {
  it('saves a solved/repaired result, retries once, rejects races and never stores raw inputs', async () => {
    const student = await registerTestStudent(app)
    const start = await post(student, gamePath, { context: { kind: 'personal' } }).expect(201)
    const id = start.body.attemptId
    const path = `/api/attempts/${id}`
    const payload = action(start.body, 'test-payload', {
      username: "' OR 1=1 --",
      password: 'private-fictional-input',
    })
    const solved = await post(student, `${path}/actions`, payload).expect(200)
    expect(solved.body.score).toBe(80)
    expect((await post(student, `${path}/actions`, payload).expect(200)).body).toEqual(solved.body)
    await post(student, `${path}/actions`, { ...payload, actionId: randomUUID() }).expect(409)
    await post(student, `${path}/complete`, {
      actionId: randomUUID(),
      expectedRevision: solved.body.revision,
    }).expect(409)
    const repaired = await post(
      student,
      `${path}/actions`,
      action(solved.body, 'select-repair', { optionId: 'bind' }),
    ).expect(200)
    const finish = { actionId: randomUUID(), expectedRevision: repaired.body.revision }
    const results = await Promise.all([
      post(student, `${path}/complete`, finish),
      post(student, `${path}/complete`, finish),
    ])
    expect(results.map((result) => result.status)).toEqual([200, 200])
    expect(results[0].body).toEqual(results[1].body)
    expect(results[0].body).toMatchObject({
      score: 100,
      status: 'completed',
      persisted: true,
      mode: 'practice',
    })
    expect((await student.agent.get(path).expect(200)).body).toEqual(results[0].body)
    const document = await database.db.collection('game_attempts').findOne({
      gameId: 'sql-injection-arcade',
      playerId: new (await import('mongoose')).Types.ObjectId(student.user.id),
    })
    expect(JSON.stringify(document)).not.toContain('private-fictional-input')
    expect(JSON.stringify(document)).not.toContain("' OR 1=1 --")
    expect(document.competitiveEligible).toBe(false)
    const other = await registerTestStudent(app)
    await other.agent.get(path).expect(404)
    await post(other, `${path}/complete`, finish).expect(404)
  })

  it('offers only eligible contexts and rechecks pending/removed class access', async () => {
    const student = await registerTestStudent(app)
    const active = await classFor(student)
    const pending = await classFor(student, 'pending')
    const contexts = await student.agent.get('/api/attempt-contexts?page=1&limit=50').expect(200)
    expect(contexts.body.cohorts.map((item) => item.cohortId)).toEqual([String(active.cohort._id)])
    await student.agent.get('/api/attempt-contexts?limit=51').expect(400)
    await student.agent.get('/api/attempt-contexts?page=1&page=2').expect(400)
    await student.agent.get('/api/attempt-contexts?userId=other').expect(400)
    await post(student, gamePath, {
      context: { kind: 'cohort', cohortId: String(pending.cohort._id) },
    }).expect(404)
    const start = await post(student, gamePath, {
      context: { kind: 'cohort', cohortId: String(active.cohort._id) },
    }).expect(201)
    await membershipModel(database).updateOne(
      { _id: active.membership._id },
      { $set: { status: 'removed' } },
    )
    await student.agent.get(`/api/attempts/${start.body.attemptId}`).expect(404)
    await post(
      student,
      `/api/attempts/${start.body.attemptId}/actions`,
      action(start.body, 'test-payload', { username: '', password: '' }),
    ).expect(404)
    const other = await registerTestStudent(app)
    await post(other, gamePath, {
      context: { kind: 'cohort', cohortId: String(active.cohort._id) },
    }).expect(404)
  })

  it('requires sessions, origin and CSRF and refuses client scores', async () => {
    await request(app).get('/api/attempt-contexts').expect(401)
    await request(app)
      .post(gamePath)
      .send({ context: { kind: 'personal' } })
      .expect(401)
    const student = await registerTestStudent(app)
    await student.agent
      .post(gamePath)
      .set('Origin', origin)
      .send({ context: { kind: 'personal' } })
      .expect(403)
    await post(student, gamePath, { context: { kind: 'personal' } })
      .set('Origin', 'http://untrusted.example')
      .expect(403)
    await post(student, gamePath, { context: { kind: 'personal' }, score: 100 }).expect(400)
  })
})
