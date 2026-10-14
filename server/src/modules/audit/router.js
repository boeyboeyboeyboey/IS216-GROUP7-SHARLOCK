import { Router } from 'express'
import { CohortError } from '../cohorts/policy.js'
import { createAuditService } from './service.js'
import { AuditError } from './policy.js'

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

function sendAuditError(error, _request, response, next) {
  if (error instanceof AuditError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
      requestId: response.locals.requestId,
    })
    return
  }
  if (error instanceof CohortError && [401, 403].includes(error.status)) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message },
      requestId: response.locals.requestId,
    })
    return
  }
  next(error)
}

export function createAuditRouter(database, { requireSession, now = Date.now } = {}) {
  const sessionMiddleware = requireMiddlewareArray(requireSession)
  const service = createAuditService(database, { now })
  const router = Router()

  router.get('/admin/audit-events', ...sessionMiddleware, async (request, response, next) => {
    try {
      const result = await service.listEvents(response.locals.authUser, request.query)
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  router.use(sendAuditError)
  return router
}
