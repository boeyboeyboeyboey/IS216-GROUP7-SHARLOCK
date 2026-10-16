import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app.js'
import { connectDatabase } from '../../../src/config/database.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { LEVELS } from '../../../src/modules/games/clearance-tower/levels.js'
import { createClearanceService } from '../../../src/modules/games/clearance-tower/service.js'
import { predictionList, SOLUTIONS } from '../../unit/clearance-tower/solutions.js'

let database
let app
const base = '/api/games/clearance-tower'
// the news feature is stubbed so this suite exercises only the clearance tower routes
const newsStub = { store: {}, provider: { configured: false } }

let counter = 0
const actionId = () => `it-action-${String((counter += 1)).padStart(4, '0')}`

function solutionBody(levelId) {
  const { policy, predictions } = SOLUTIONS[levelId]
  return { actionId: actionId(), policy, predictions: predictionList(predictions) }
}

beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test')
    throw new Error('Clearance tower integration tests require an isolated test database')
  database = await connectDatabase(config.databaseUri)
  app = createApp(database, {
    news: newsStub,
    clearanceTower: { service: createClearanceService() },
  })
})
afterAll(async () => {
  await database?.close()
})

describe('clearance tower http api', () => {
  it('plays every level to its known score without caching or leaking the day early', async () => {
    const list = await request(app).get(`${base}/levels`).expect(200)
    expect(list.headers['cache-control']).toBe('no-store')
    expect(list.body.levels.map((level) => level.id)).toEqual(LEVELS.map((level) => level.id))

    for (const level of LEVELS) {
      const start = await request(app)
        .post(`${base}/attempts`)
        .send({ levelId: level.id })
        .expect(200)
      expect(start.body).toMatchObject({ gameId: 'clearance-tower', saved: false })
      const before = JSON.stringify(start.body)
      for (const prompt of level.predictions) expect(before).not.toContain(prompt.explanation)
      for (const event of level.day.filter((item) => item.kind !== 'work'))
        expect(before).not.toContain(event.story)

      const result = await request(app)
        .post(`${base}/attempts/${start.body.attemptId}/submit`)
        .send(solutionBody(level.id))
        .expect(200)
      expect(result.body).toMatchObject({ levelId: level.id, score: SOLUTIONS[level.id].score })
      expect(result.body.events).toHaveLength(level.day.length)
      expect(result.body.predictionReview.every((item) => item.correct)).toBe(true)
    }
  })

  it('returns the shared error shape for bad input and unknown attempts', async () => {
    const badStart = await request(app)
      .post(`${base}/attempts`)
      .send({ levelId: 'the-matrix', score: 100 })
      .expect(400)
    expect(badStart.body).toMatchObject({
      error: { code: 'CLEAR_INVALID_BODY', fieldErrors: { score: 'unsupported field' } },
      requestId: expect.any(String),
    })

    await request(app)
      .post(`${base}/attempts/not-a-real-id/submit`)
      .send(solutionBody('the-matrix'))
      .expect(404)
    const unknown = await request(app)
      .post(`${base}/attempts/00000000-0000-4000-8000-000000000000/submit`)
      .send(solutionBody('the-matrix'))
      .expect(404)
    expect(unknown.body.error.code).toBe('CLEAR_ATTEMPT_NOT_FOUND')
  })

  it('serializes an own __proto__ field error from raw json', async () => {
    const start = await request(app).post(`${base}/attempts`).send({ levelId: 'the-matrix' })
    const raw = `{"actionId":"it-action-raw1","policy":{"grants":[]},"predictions":[],"__proto__":{"admin":true}}`
    const response = await request(app)
      .post(`${base}/attempts/${start.body.attemptId}/submit`)
      .set('Content-Type', 'application/json')
      .send(raw)
      .expect(400)
    expect(Object.keys(response.body.error.fieldErrors)).toContain('__proto__')
  })

  it('records one submission per attempt', async () => {
    const start = await request(app).post(`${base}/attempts`).send({ levelId: 'reshuffle' })
    const url = `${base}/attempts/${start.body.attemptId}/submit`
    const body = solutionBody('reshuffle')
    const first = await request(app).post(url).send(body).expect(200)
    const repeat = await request(app).post(url).send(body).expect(200)
    expect(repeat.body).toEqual(first.body)
    const second = await request(app).post(url).send(solutionBody('reshuffle')).expect(409)
    expect(second.body.error.code).toBe('CLEAR_ATTEMPT_SUBMITTED')
  })

  it('paces a client that floods the api', async () => {
    const paced = createApp(database, {
      news: newsStub,
      clearanceTower: { service: createClearanceService(), limit: 2 },
    })
    await request(paced).get(`${base}/levels`).expect(200)
    await request(paced).get(`${base}/levels`).expect(200)
    const limited = await request(paced).get(`${base}/levels`).expect(429)
    expect(limited.body.error.code).toBe('CLEAR_RATE_LIMITED')
  })
})
