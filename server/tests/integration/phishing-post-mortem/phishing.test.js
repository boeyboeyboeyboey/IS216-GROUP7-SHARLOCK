import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app.js'
import { connectDatabase } from '../../../src/config/database.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { readAnswers, readCase } from '../../unit/phishing-post-mortem/fixtures.js'

let database
let app
const FIXED_NOW = Date.parse('2026-09-21T12:00:00Z')
// the news feature is stubbed so this suite exercises only the phishing routes
const newsStub = { store: {}, provider: { configured: false } }

beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test')
    throw new Error('Phishing integration tests require an isolated test database')
  database = await connectDatabase(config.databaseUri)
  app = createApp(database, { news: newsStub, phishing: { now: () => FIXED_NOW } })
})
afterAll(async () => {
  await database?.close()
})

describe('GET /api/games/phishing-post-mortem/case', () => {
  it('serves a full case without caching and without the answer key', async () => {
    const response = await request(app).get('/api/games/phishing-post-mortem/case').expect(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.emails).toHaveLength(20)
    expect(response.body.gameId).toBe('phishing-post-mortem')
    expect(response.body.rulesetVersion).toBe('phish-1')
    expect(response.body.maxScore).toBe(100)
    const answers = readAnswers(response.body.caseId)
    const payload = JSON.stringify(response.body)
    expect(payload).not.toContain('patientZeroId')
    expect(payload).not.toContain(answers.summary)
  })

  it('serves the other case on replay', async () => {
    const first = await request(app)
      .get('/api/games/phishing-post-mortem/case')
      .query({ after: 'case-01' })
      .expect(200)
    expect(first.body.caseId).toBe('case-02')
  })

  it('rejects an unsupported query parameter with a safe error', async () => {
    const response = await request(app)
      .get('/api/games/phishing-post-mortem/case')
      .query({ caseId: 'case-01' })
      .expect(400)
    expect(response.body.error.code).toBe('PHISH_INVALID_REQUEST')
    expect(response.body.requestId).toBeTruthy()
    expect(JSON.stringify(response.body)).not.toMatch(/\/src\/|node_modules|patientZero/)
  })
})

describe('POST /api/games/phishing-post-mortem/verdict', () => {
  const content = readCase('case-01')
  const answers = readAnswers('case-01')
  const base = {
    caseId: 'case-01',
    datasetVersion: content.datasetVersion,
    actionId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  }
  const post = (body) => request(app).post('/api/games/phishing-post-mortem/verdict').send(body)

  it('scores a complete verdict and returns the debrief', async () => {
    const response = await post({
      ...base,
      selectedEmailId: answers.patientZeroId,
      evidenceIds: answers.evidenceIds,
    }).expect(200)
    expect(response.body.score).toBe(100)
    expect(response.body.persisted).toBe(false)
    expect(response.body.debrief.patientZero.id).toBe(answers.patientZeroId)
  })

  it('scores nothing for the wrong message but still teaches the chain', async () => {
    const wrong = content.emails.find((email) => email.id !== answers.patientZeroId).id
    const response = await post({
      ...base,
      selectedEmailId: wrong,
      evidenceIds: answers.evidenceIds,
    }).expect(200)
    expect(response.body.score).toBe(0)
    expect(response.body.debrief.chain.length).toBeGreaterThanOrEqual(5)
  })

  it.each([
    ['an unknown field', { extra: true }, 400, 'PHISH_INVALID_REQUEST'],
    ['a foreign email id', { selectedEmailId: 'b09' }, 400, 'PHISH_UNKNOWN_SELECTION'],
    [
      'a forged evidence id',
      { evidenceIds: ['ev-lookalike-domain', 'ev-made-up'] },
      400,
      'PHISH_UNKNOWN_SELECTION',
    ],
    ['a stale dataset version', { datasetVersion: '1999-01-01' }, 409, 'PHISH_DATASET_CHANGED'],
    ['an unknown case', { caseId: 'case-99' }, 404, 'PHISH_CASE_NOT_FOUND'],
  ])('rejects %s', async (_label, changes, status, code) => {
    const response = await post({
      ...base,
      selectedEmailId: answers.patientZeroId,
      evidenceIds: answers.evidenceIds,
      ...changes,
    }).expect(status)
    expect(response.body.error.code).toBe(code)
    expect(response.body.requestId).toBeTruthy()
  })

  it('serializes an own __proto__ field error from a parsed JSON body', async () => {
    const rawBody =
      '{"caseId":"case-01","datasetVersion":"2026-09-21","actionId":"f47ac10b-58cc-4372-a567-0e02b2c3d479","selectedEmailId":"a11","evidenceIds":["ev-lookalike-domain","ev-click-then-credentials"],"__proto__":"unsupported"}'
    const response = await request(app)
      .post('/api/games/phishing-post-mortem/verdict')
      .set('Content-Type', 'application/json')
      .send(rawBody)
      .expect(400)
    expect(response.body.error.code).toBe('PHISH_INVALID_REQUEST')
    expect(Object.hasOwn(response.body.error.fieldErrors, '__proto__')).toBe(true)
    expect(response.body.error.fieldErrors['__proto__']).toBe('unsupported field')
  })

  it('paces repeated verdicts from the same caller', async () => {
    const body = {
      ...base,
      selectedEmailId: answers.patientZeroId,
      evidenceIds: answers.evidenceIds,
    }
    let limited = null
    for (let attempt = 0; attempt < 25 && !limited; attempt += 1) {
      const response = await post(body)
      if (response.status === 429) limited = response
    }
    expect(limited).not.toBeNull()
    expect(limited.body.error.code).toBe('PHISH_RATE_LIMITED')
  })
})
