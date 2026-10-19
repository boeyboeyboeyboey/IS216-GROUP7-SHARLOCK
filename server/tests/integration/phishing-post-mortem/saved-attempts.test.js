import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { Types } from 'mongoose'
import { connectDatabase } from '../../../src/config/database.js'
import { assertSafeTestDatabaseUri } from '../../../src/config/database-uri.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { createAttemptRegistry } from '../../../src/modules/attempts/registry.js'
import { initializeAttemptStorage } from '../../../src/modules/attempts/storage.js'
import { createPhishingRuleset } from '../../../src/modules/games/phishing-post-mortem/ruleset.js'
import { readAnswers, readCase } from '../../unit/phishing-post-mortem/fixtures.js'
import {
  createTestApp,
  disposeTestAuthApps,
  initializeTestAuth,
  registerTestStudent,
} from '../auth/helpers.js'

const GAME = 'phishing-post-mortem'
// random() of zero always opens case-01, so the answer key below is known
const answers = readAnswers('case-01')
const content = readCase('case-01')
const decoyId = content.emails.find((email) => email.id !== answers.patientZeroId).id
const owned = { users: new Set(), attempts: new Set() }

let database
let authOptions
let registry
let app
let origin

async function createStudent() {
  const student = await registerTestStudent(app)
  owned.users.add(student.user.id)
  return student
}

function post(student, path, body) {
  return student.agent
    .post(path)
    .set('Origin', origin)
    .set('X-CSRF-Token', student.csrfToken)
    .send(body)
}

async function startCase(student) {
  const response = await post(student, `/api/games/${GAME}/attempts`, {
    context: { kind: 'personal' },
  }).expect(201)
  owned.attempts.add(response.body.attemptId)
  return response.body
}

function verdict(student, attemptId, payload, { actionId = randomUUID(), revision = 0 } = {}) {
  return post(student, `/api/attempts/${attemptId}/actions`, {
    actionId,
    expectedRevision: revision,
    type: 'submit-verdict',
    payload,
  })
}

function complete(student, attemptId, revision = 1, actionId = randomUUID()) {
  return post(student, `/api/attempts/${attemptId}/complete`, {
    actionId,
    expectedRevision: revision,
  })
}

const correctVerdict = {
  selectedEmailId: answers.patientZeroId,
  evidenceIds: [...answers.evidenceIds],
}

beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test') {
    throw new Error('Phishing integration tests require NODE_ENV=test.')
  }
  assertSafeTestDatabaseUri(config.databaseUri, process.env.MONGO_URI)
  database = await connectDatabase(config.databaseUri)
  authOptions = await initializeTestAuth(database, config)
  registry = createAttemptRegistry([createPhishingRuleset({ random: () => 0 })])
  await initializeAttemptStorage(database, registry)
})

beforeEach(() => {
  owned.users.clear()
  owned.attempts.clear()
  app = createTestApp(database, authOptions, { attempts: { registry } })
  origin = authOptions.clientOrigin
})

afterEach(async () => {
  if (database) {
    assertSafeTestDatabaseUri(process.env.TEST_MONGODB_URI, process.env.MONGO_URI)
    const attempts = [...owned.attempts].map((id) => new Types.ObjectId(id))
    const users = [...owned.users].map((id) => new Types.ObjectId(id))
    if (attempts.length) {
      await database.db.collection('game_attempts').deleteMany({ _id: { $in: attempts } })
    }
    if (users.length) {
      await database.db
        .collection('auth_sessions')
        .deleteMany({ 'session.userId': { $in: users.map(String) } })
      await database.db.collection('users').deleteMany({ _id: { $in: users } })
    }
  }
  await disposeTestAuthApps()
})

afterAll(async () => {
  await disposeTestAuthApps()
  await database?.close()
})

describe('saved phishing attempts', () => {
  it('needs a signed-in player and no longer serves the old unsaved routes', async () => {
    await request(app)
      .post(`/api/games/${GAME}/attempts`)
      .set('Origin', origin)
      .send({ context: { kind: 'personal' } })
      .expect(401)
    const oldCase = await request(app).get(`/api/games/${GAME}/case`)
    const oldVerdict = await request(app).post(`/api/games/${GAME}/verdict`).send({})
    expect(oldCase.status).toBe(404)
    expect(oldVerdict.status).not.toBe(200)
    expect(JSON.stringify(oldCase.body)).not.toContain('emails')
  })

  it('starts a saved case that carries no answer key', async () => {
    const student = await createStudent()
    const started = await startCase(student)
    expect(started).toMatchObject({
      gameId: GAME,
      rulesetVersion: 'phish-1',
      context: { kind: 'personal', cohortId: null },
      mode: 'standard',
      status: 'active',
      revision: 0,
      score: 0,
      maxScore: 100,
      persisted: true,
      deadlineAt: null,
      publicState: { caseId: 'case-01', verdict: null },
    })
    expect(started.publicState.emails).toHaveLength(20)
    const payload = JSON.stringify(started)
    expect(payload).not.toContain(answers.summary)
    expect(payload).not.toContain('patientZero')
    expect(payload).not.toContain('debrief')

    const stored = await database.db
      .collection('game_attempts')
      .findOne({ _id: new Types.ObjectId(started.attemptId) })
    expect(stored.state.emailOrder).toHaveLength(20)
    expect(stored.state.selectedEmailId).toBeNull()
  })

  it('scores one verdict on the server and saves the completed result', async () => {
    const student = await createStudent()
    const started = await startCase(student)
    const submitted = await verdict(student, started.attemptId, correctVerdict).expect(200)
    expect(submitted.body).toMatchObject({ status: 'active', revision: 1, score: 100 })
    expect(submitted.body.publicState.verdict).toEqual(correctVerdict)
    expect(submitted.body.publicState).not.toHaveProperty('debrief')

    const finished = await complete(student, started.attemptId).expect(200)
    expect(finished.body).toMatchObject({
      status: 'completed',
      score: 100,
      maxScore: 100,
      persisted: true,
      feedback: { verdictCode: 'PHISH_VERDICT_CORRECT' },
      publicState: { outcome: { emailCorrect: true } },
    })
    expect(finished.body.topicOutcomes).toHaveLength(3)
    expect(finished.body.publicState.debrief.patientZero.id).toBe(answers.patientZeroId)

    const reread = await student.agent.get(`/api/attempts/${started.attemptId}`).expect(200)
    expect(reread.body).toEqual(finished.body)
  })

  it('scores a wrong accusation as zero and still saves the debrief', async () => {
    const student = await createStudent()
    const started = await startCase(student)
    await verdict(student, started.attemptId, {
      selectedEmailId: decoyId,
      evidenceIds: [...answers.evidenceIds],
    }).expect(200)
    const finished = await complete(student, started.attemptId).expect(200)
    expect(finished.body.score).toBe(0)
    expect(finished.body.publicState.outcome.emailCorrect).toBe(false)
    expect(finished.body.publicState.debrief.chain.length).toBeGreaterThanOrEqual(5)
  })

  it('replays a lost verdict response instead of recording it twice', async () => {
    const student = await createStudent()
    const started = await startCase(student)
    const actionId = randomUUID()
    const first = await verdict(student, started.attemptId, correctVerdict, { actionId }).expect(
      200,
    )
    const retried = await verdict(student, started.attemptId, correctVerdict, {
      actionId,
    }).expect(200)
    expect(retried.body).toEqual(first.body)

    const changed = await verdict(
      student,
      started.attemptId,
      { ...correctVerdict, selectedEmailId: decoyId },
      { actionId },
    ).expect(409)
    expect(changed.body.error.code).toBe('ATTEMPT_ACTION_CONFLICT')
  })

  it('allows only one verdict per case', async () => {
    const student = await createStudent()
    const started = await startCase(student)
    await verdict(student, started.attemptId, correctVerdict).expect(200)
    const second = await verdict(
      student,
      started.attemptId,
      { ...correctVerdict, selectedEmailId: decoyId },
      { revision: 1 },
    ).expect(409)
    expect(second.body.error.code).toBe('ATTEMPT_ACTION_LIMIT')

    await complete(student, started.attemptId).expect(200)
    const afterResult = await verdict(student, started.attemptId, correctVerdict, {
      revision: 2,
    }).expect(409)
    expect(afterResult.body.error.code).toBe('ATTEMPT_CLOSED')
  })

  it('refuses completion before a verdict and forged selections', async () => {
    const student = await createStudent()
    const started = await startCase(student)
    const early = await complete(student, started.attemptId, 0).expect(409)
    expect(early.body.error.code).toBe('ATTEMPT_NOT_FINISHED')

    const forged = await verdict(student, started.attemptId, {
      ...correctVerdict,
      evidenceIds: [answers.evidenceIds[0], 'ev-made-up'],
    }).expect(400)
    expect(forged.body.error.code).toBe('PHISH_UNKNOWN_SELECTION')

    const shaped = await verdict(student, started.attemptId, {
      ...correctVerdict,
      score: 100,
    }).expect(400)
    expect(shaped.body.error.code).toBe('ATTEMPT_INVALID_REQUEST')
  })

  it("never shows one player another player's case or result", async () => {
    const owner = await createStudent()
    const other = await createStudent()
    const started = await startCase(owner)
    await other.agent.get(`/api/attempts/${started.attemptId}`).expect(404)
    await verdict(other, started.attemptId, correctVerdict).expect(404)

    await verdict(owner, started.attemptId, correctVerdict).expect(200)
    await complete(owner, started.attemptId).expect(200)
    await other.agent.get(`/api/attempts/${started.attemptId}`).expect(404)
  })
})
