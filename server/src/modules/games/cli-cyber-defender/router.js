import { Router } from 'express'
import {
  CliError,
  parseCommandBody,
  parseCompleteBody,
  parseEmptyBody,
  parseHintBody,
  parseRunId,
  parseStart,
  rateLimited,
} from './policy.js'
import { createCliDefenderService } from './service.js'

const WINDOW_MS = 60000
const MAX_REQUESTS_PER_WINDOW = 300
const MAX_TRACKED_CLIENTS = 500

// courtesy pacing for a public unauthenticated endpoint, not a security boundary
function createPacer(now, limit) {
  const seen = new Map()
  return function allow(key) {
    const cutoff = now() - WINDOW_MS
    const recent = (seen.get(key) ?? []).filter((stamp) => stamp > cutoff)
    if (recent.length >= limit) {
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
    error instanceof CliError
      ? error
      : new CliError(
          'CLI_UNAVAILABLE',
          'The terminal is temporarily unavailable. Please try again shortly.',
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

export function createCliDefenderRouter({
  service,
  now = Date.now,
  limit = MAX_REQUESTS_PER_WINDOW,
} = {}) {
  const game = service || createCliDefenderService()
  const allow = createPacer(now, limit)
  const router = Router()
  const base = '/games/cli-cyber-defender/runs'

  function handle(action) {
    return (request, response) => {
      response.set('Cache-Control', 'no-store')
      try {
        if (!allow(request.ip || 'unknown')) throw rateLimited()
        response.json(action(request))
      } catch (error) {
        fail(response, error)
      }
    }
  }

  router.post(
    base,
    handle((request) => game.startRun(parseStart(request.body))),
  )
  router.get(
    `${base}/:runId`,
    handle((request) => game.getRun(parseRunId(request.params.runId))),
  )
  router.post(
    `${base}/:runId/hint`,
    handle((request) =>
      game.hintRun(parseRunId(request.params.runId), parseHintBody(request.body)),
    ),
  )
  router.post(
    `${base}/:runId/pause`,
    handle((request) => {
      parseEmptyBody(request.body)
      return game.pauseRun(parseRunId(request.params.runId))
    }),
  )
  router.post(
    `${base}/:runId/resume`,
    handle((request) => {
      parseEmptyBody(request.body)
      return game.resumeRun(parseRunId(request.params.runId))
    }),
  )
  router.post(
    `${base}/:runId/commands`,
    handle((request) =>
      game.submitCommand(parseRunId(request.params.runId), parseCommandBody(request.body)),
    ),
  )
  router.post(
    `${base}/:runId/complete`,
    handle((request) =>
      game.completeRun(parseRunId(request.params.runId), parseCompleteBody(request.body)),
    ),
  )

  return router
}
