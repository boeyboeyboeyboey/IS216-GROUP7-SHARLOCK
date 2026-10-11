import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createSocialEngineeringRouter } from '../../../src/modules/games/social-engineering-simulator/router.js'
import { LlmError } from '../../../src/modules/games/social-engineering-simulator/llm/llmError.js'

const SESSION = '11111111-1111-1111-1111-111111111111'

// a stub service so the router tests never build an llm adapter
function stubService(overrides = {}) {
  return {
    startSession: () => ({
      sessionId: SESSION,
      persona: { id: 'it-helpdesk', displayName: 'Jordan Vale (IT Service Desk)' },
      brief: { title: 'IT Service Desk is paging you', objective: 'protect it', turnBudget: 8 },
      openingMessage: 'Hi, this is Jordan.',
    }),
    sendMessage: async () => ({
      reply: 'Could you read me the code?',
      turnsUsed: 1,
      turnBudget: 8,
      leaked: false,
      ended: false,
    }),
    complete: () => ({
      score: 100,
      maxScore: 100,
      outcome: 'resisted',
      breakdown: [],
      saved: false,
    }),
    ...overrides,
  }
}

function makeApp(service, now = Date.now) {
  const app = express()
  app.use((_request, response, next) => {
    response.locals.requestId = randomUUID()
    next()
  })
  app.use(express.json())
  app.use('/api', createSocialEngineeringRouter({ service, now }))
  return app
}

const base = '/api/games/social-engineering-simulator'

describe('social-engineering router', () => {
  it('starts a session with no-store caching', async () => {
    const response = await request(makeApp(stubService()))
      .post(`${base}/session`)
      .send({})
      .expect(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body.persona.id).toBe('it-helpdesk')
  })

  it('rejects an invalid message body with a safe envelope', async () => {
    const response = await request(makeApp(stubService()))
      .post(`${base}/message`)
      .send({ sessionId: 'not-a-uuid', content: 'hi' })
      .expect(400)
    expect(response.body.error.code).toBe('SOC_INVALID_BODY')
    expect(response.body.error.fieldErrors.sessionId).toBeTruthy()
    expect(response.body.requestId).toBeTruthy()
    expect(JSON.stringify(response.body)).not.toMatch(/\/src\/|node_modules/)
  })

  it('rejects a completion with an unknown decision', async () => {
    const response = await request(makeApp(stubService()))
      .post(`${base}/complete`)
      .send({ sessionId: SESSION, decision: 'ignore' })
      .expect(400)
    expect(response.body.error.code).toBe('SOC_INVALID_BODY')
  })

  it('passes a typed llm error through with its status and code', async () => {
    const service = stubService({
      sendMessage: async () => {
        throw new LlmError('LLM_SESSION_NOT_FOUND', 'gone', 404)
      },
    })
    const response = await request(makeApp(service))
      .post(`${base}/message`)
      .send({ sessionId: SESSION, content: 'hi' })
      .expect(404)
    expect(response.body.error.code).toBe('LLM_SESSION_NOT_FOUND')
  })

  it('hides an unexpected failure behind SOC_UNAVAILABLE', async () => {
    const service = stubService({
      startSession: () => {
        throw new Error('boom with /src/ detail')
      },
    })
    const response = await request(makeApp(service)).post(`${base}/session`).send({}).expect(503)
    expect(response.body.error.code).toBe('SOC_UNAVAILABLE')
    expect(JSON.stringify(response.body)).not.toContain('/src/')
  })

  it('paces repeated requests from one caller', async () => {
    const app = makeApp(stubService(), () => 1000)
    let limited = null
    for (let attempt = 0; attempt < 40 && !limited; attempt += 1) {
      const response = await request(app).post(`${base}/session`).send({})
      if (response.status === 429) limited = response
    }
    expect(limited).not.toBeNull()
    expect(limited.body.error.code).toBe('SOC_RATE_LIMITED')
  })
})
