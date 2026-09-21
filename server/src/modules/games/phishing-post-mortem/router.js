import { Router } from 'express'
import { PhishingError, parseCaseQuery, parseVerdict, rateLimited } from './policy.js'
import { createPhishingService } from './service.js'

const WINDOW_MS = 60000
const MAX_VERDICTS_PER_WINDOW = 20
const MAX_TRACKED_CLIENTS = 500

// courtesy pacing for a public unauthenticated endpoint, not a security boundary
function createPacer(now) {
  const seen = new Map()
  return function allow(key) {
    const cutoff = now() - WINDOW_MS
    const recent = (seen.get(key) ?? []).filter((stamp) => stamp > cutoff)
    if (recent.length >= MAX_VERDICTS_PER_WINDOW) {
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
    error instanceof PhishingError
      ? error
      : new PhishingError(
          'PHISH_UNAVAILABLE',
          'The case file is temporarily unavailable. Please try again shortly.',
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

export function createPhishingRouter({ service, now = Date.now } = {}) {
  const game = service || createPhishingService()
  const allow = createPacer(now)
  const router = Router()

  router.get('/games/phishing-post-mortem/case', (request, response) => {
    response.set('Cache-Control', 'no-store')
    try {
      response.json(game.startCase(parseCaseQuery(request.query)))
    } catch (error) {
      fail(response, error)
    }
  })

  router.post('/games/phishing-post-mortem/verdict', (request, response) => {
    response.set('Cache-Control', 'no-store')
    try {
      if (!allow(request.ip || 'unknown')) throw rateLimited()
      response.json(game.scoreVerdict(parseVerdict(request.body)))
    } catch (error) {
      fail(response, error)
    }
  })

  return router
}
