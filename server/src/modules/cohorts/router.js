import { Router } from 'express'
import { CohortError, parseListQuery } from './policy.js'
import { createCohortService } from './service.js'

function sendCohortError(error, _request, response, next) {
  if (!(error instanceof CohortError)) {
    next(error)
    return
  }
  response.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.fieldErrors && { fieldErrors: error.fieldErrors }),
    },
    requestId: response.locals.requestId,
  })
}

function requireMiddlewareArray(middleware) {
  if (
    !Array.isArray(middleware) ||
    middleware.length === 0 ||
    middleware.some((item) => typeof item !== 'function')
  ) {
    throw new TypeError('A session middleware array is required.')
  }
  return middleware
}

export function createCohortRouter(database, { requireSession } = {}) {
  const sessionMiddleware = requireMiddlewareArray(requireSession)
  const service = createCohortService(database)
  const router = Router()

  router.get('/me/memberships', ...sessionMiddleware, async (request, response, next) => {
    try {
      const result = await service.listMemberships(
        response.locals.authUser,
        parseListQuery(request.query),
      )
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  router.get('/me/teaching-assignments', ...sessionMiddleware, async (request, response, next) => {
    try {
      const result = await service.listTeachingAssignments(
        response.locals.authUser,
        parseListQuery(request.query),
      )
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  router.use(sendCohortError)
  return router
}
