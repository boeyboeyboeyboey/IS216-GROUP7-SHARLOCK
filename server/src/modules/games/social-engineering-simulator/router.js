import { Router } from 'express'
import { LlmError } from './llm/llmError.js'
import { SocialEngError, parseComplete, parseMessage, parseStart, rateLimited } from './policy.js'
import { createSocialEngineeringService } from './service.js'

const WINDOW_MS = 60000
const MAX_REQUESTS_PER_WINDOW = 30
const MAX_TRACKED_CLIENTS = 500

// courtesy pacing for a public unauthenticated endpoint, not a security boundary
function createPacer(now) {
  const seen = new Map()
  return function allow(key) {
    const cutoff = now() - WINDOW_MS
    const recent = (seen.get(key) ?? []).filter((stamp) => stamp > cutoff)
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      seen.set(key, recent)
      return false
    }
    recent.push(now())
    seen.set(key, recent)
    if (seen.size > MAX_TRACKED_CLIENTS) seen.delete(seen.keys().next().value)
    return true
  }
}

function fail(response, error) {
  const safe =
    error instanceof SocialEngError || error instanceof LlmError
      ? error
      : new SocialEngError(
          'SOC_UNAVAILABLE',
          'The simulation is temporarily unavailable. Please try again shortly.',
          503,
        )
  response.status(safe.status).json({
    error: {
      code: safe.code,
      message: safe.message,
      ...(safe.fieldErrors && { fieldErrors: safe.fieldErrors }),
    },
    requestId: response.locals.requestId,
  })
}

export function createSocialEngineeringRouter({ service, now = Date.now } = {}) {
  const game = service || createSocialEngineeringService()
  const allow = createPacer(now)
  const router = Router()
  const base = '/games/social-engineering-simulator'

  router.post(`${base}/session`, (request, response) => {
    response.set('Cache-Control', 'no-store')
    try {
      if (!allow(request.ip || 'unknown')) throw rateLimited()
      parseStart(request.body)
      response.json(game.startSession())
    } catch (error) {
      fail(response, error)
    }
  })

  router.post(`${base}/message`, async (request, response) => {
    response.set('Cache-Control', 'no-store')
    try {
      if (!allow(request.ip || 'unknown')) throw rateLimited()
      const { sessionId, content } = parseMessage(request.body)
      response.json(await game.sendMessage(sessionId, content))
    } catch (error) {
      fail(response, error)
    }
  })

  router.post(`${base}/complete`, (request, response) => {
    response.set('Cache-Control', 'no-store')
    try {
      if (!allow(request.ip || 'unknown')) throw rateLimited()
      const { sessionId, decision } = parseComplete(request.body)
      response.json(game.complete(sessionId, decision))
    } catch (error) {
      fail(response, error)
    }
  })

  return router
}
