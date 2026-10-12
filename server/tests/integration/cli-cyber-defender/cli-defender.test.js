import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/app.js'
import { connectDatabase } from '../../../src/config/database.js'
import { loadEnvironment } from '../../../src/config/env.js'
import { formatCommand } from '../../../src/modules/games/cli-cyber-defender/parser.js'
import { SCENARIOS } from '../../../src/modules/games/cli-cyber-defender/scenarios.js'
import { createCliDefenderService } from '../../../src/modules/games/cli-cyber-defender/service.js'

let database
let app
const clock = { now: Date.parse('2026-10-12T08:00:00Z') }
const base = '/api/games/cli-cyber-defender/runs'
// the news feature is stubbed so this suite exercises only the cli routes
const newsStub = { store: {}, provider: { configured: false } }

function answerFor(current) {
  const scenario = SCENARIOS.find((item) => item.alert.title === current.alert.title)
  return formatCommand(scenario.expected.verb, scenario.expected.target)
}

let counter = 0
const actionId = () => `it-action-${String((counter += 1)).padStart(4, '0')}`

beforeAll(async () => {
  const config = loadEnvironment()
  if (config.nodeEnv !== 'test')
    throw new Error('CLI integration tests require an isolated test database')
  database = await connectDatabase(config.databaseUri)
  app = createApp(database, {
    news: newsStub,
    cliDefender: { service: createCliDefenderService({ now: () => clock.now }) },
  })
})
afterAll(async () => {
  await database?.close()
})

describe('cli cyber defender http api', () => {
  it('plays a timed shift end to end without caching or leaking answers', async () => {
    const start = await request(app).post(base).send({ mode: 'timed' }).expect(200)
    expect(start.headers['cache-control']).toBe('no-store')
    expect(start.body).toMatchObject({ mode: 'timed', status: 'active', saved: false })
    const payload = JSON.stringify(start.body)
    for (const scenario of SCENARIOS) expect(payload).not.toContain(scenario.explanation)

    let snapshot = start.body
    while (snapshot.current) {
      clock.now += 1500
      const response = await request(app)
        .post(`${base}/${snapshot.runId}/commands`)
        .send({
          actionId: actionId(),
          incidentId: snapshot.current.incidentId,
          command: answerFor(snapshot.current),
        })
        .expect(200)
      snapshot = response.body
    }
    expect(snapshot.score).toBe(2100)

    const read = await request(app).get(`${base}/${snapshot.runId}`).expect(200)
    expect(read.body.status).toBe('finished')

    const done = await request(app)
      .post(`${base}/${snapshot.runId}/complete`)
      .send({ actionId: actionId() })
      .expect(200)
    expect(done.body).toMatchObject({ score: 2100, maxScore: 2100, saved: false })
    expect(done.body.debrief).toHaveLength(8)
  })

  it('reports a closed incident once its window has passed', async () => {
    const start = await request(app).post(base).send({ mode: 'timed' }).expect(200)
    clock.now = start.body.current.closesAt
    const late = await request(app)
      .post(`${base}/${start.body.runId}/commands`)
      .send({
        actionId: actionId(),
        incidentId: start.body.current.incidentId,
        command: answerFor(start.body.current),
      })
      .expect(409)
    expect(late.body.error.code).toBe('CLI_INCIDENT_CLOSED')
    expect(late.body.requestId).toBeTruthy()
  })

  it('pauses and resumes a timed shift over http', async () => {
    const start = await request(app).post(base).send({ mode: 'timed' }).expect(200)
    const { runId } = start.body
    const paused = await request(app).post(`${base}/${runId}/pause`).send({}).expect(200)
    expect(paused.body).toMatchObject({ paused: true })
    expect(paused.body.current.alert).toBeNull()
    clock.now += 10 * 60 * 1000 - 1
    const blocked = await request(app)
      .post(`${base}/${runId}/commands`)
      .send({ actionId: actionId(), incidentId: 'incident-01', command: 'help' })
      .expect(409)
    expect(blocked.body.error.code).toBe('CLI_RUN_PAUSED')
    const resumed = await request(app).post(`${base}/${runId}/resume`).send({}).expect(200)
    expect(resumed.body.paused).toBe(false)
    expect(resumed.body.current.incidentId).toBe('incident-01')
    await request(app).post(`${base}/${runId}/pause`).send({ force: true }).expect(400)
  })

  it('rejects malformed bodies with field errors and no internals', async () => {
    const response = await request(app).post(base).send({ mode: 'timed', score: 9999 }).expect(400)
    expect(response.body.error).toMatchObject({
      code: 'CLI_INVALID_BODY',
      fieldErrors: { score: 'unsupported field' },
    })
    expect(JSON.stringify(response.body)).not.toMatch(/stack|at .*\.js/)
  })

  it('returns 404 for unknown or malformed run ids', async () => {
    await request(app).get(`${base}/00000000-0000-4000-8000-000000000000`).expect(404)
    const bad = await request(app).get(`${base}/not-a-run`).expect(404)
    expect(bad.body.error.code).toBe('CLI_RUN_NOT_FOUND')
  })

  it('paces a client that floods the endpoint', async () => {
    const paced = createApp(database, {
      news: newsStub,
      cliDefender: { limit: 2 },
    })
    await request(paced).post(base).send({ mode: 'practice' }).expect(200)
    await request(paced).post(base).send({ mode: 'practice' }).expect(200)
    const third = await request(paced).post(base).send({ mode: 'practice' }).expect(429)
    expect(third.body.error.code).toBe('CLI_RATE_LIMITED')
  })
})
