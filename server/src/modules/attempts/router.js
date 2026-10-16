import { Router } from 'express'
import { MemoryStore, rateLimit } from 'express-rate-limit'
import { AuthError } from '../auth/policy.js'
import { CohortError } from '../cohorts/policy.js'
import { AttemptError } from './policy.js'
import { createAttemptRegistry } from './registry.js'
import { createAttemptService } from './service.js'

const authMessages = {
  AUTHENTICATION_REQUIRED: [401, 'Sign in to continue.'],
  CAPABILITY_FORBIDDEN: [403, 'This action is unavailable.'],
  CSRF_INVALID: [403, 'Refresh the security token and try again.'],
  ORIGIN_FORBIDDEN: [403, 'This request came from an untrusted origin.'],
}

function requireMiddlewareArray(middleware, name) {
  if (
    !Array.isArray(middleware) ||
    middleware.length === 0 ||
    middleware.some((item) => typeof item !== 'function')
  ) {
    throw new TypeError(`A ${name} middleware array is required.`)
  }
  return middleware
}

function createLimiter({ windowMs, limit, retryAfterSeconds, perUser = false }) {
  const store = new MemoryStore()
  const options = {
    windowMs,
    limit,
    store,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(_request, response) {
      response.set('Cache-Control', 'no-store')
      response.set('Retry-After', String(retryAfterSeconds))
      response.status(429).json({
        error: {
          code: 'ATTEMPT_RATE_LIMITED',
          message: 'Too many saved-attempt requests. Please try again later.',
        },
        requestId: response.locals.requestId,
      })
    },
  }
  if (perUser) options.keyGenerator = (request) => `user:${request.session.userId}`
  else options.ipv6Subnet = 56
  return { middleware: rateLimit(options), store }
}

function sendError(error, response) {
  let status
  let code
  let message
  let fieldErrors

  if (error instanceof AttemptError) {
    status = error.status
    code = error.code
    message = error.message
    fieldErrors = error.fieldErrors
  } else if (error instanceof AuthError) {
    const safeError = Object.hasOwn(authMessages, error.code) ? authMessages[error.code] : null
    if (safeError) [status, message] = safeError
    code = error.code
  } else if (error instanceof CohortError) {
    status = error.status
    code = error.code
    message = error.message
    fieldErrors = error.fieldErrors
  } else {
    status = 503
    code = 'ATTEMPT_UNAVAILABLE'
    message = 'Saved attempts are temporarily unavailable.'
  }

  if (!status) {
    status = 503
    code = 'ATTEMPT_UNAVAILABLE'
    message = 'Saved attempts are temporarily unavailable.'
    fieldErrors = undefined
  }

  response.set('Cache-Control', 'no-store')
  response.status(status).json({
    error: {
      code,
      message,
      ...(fieldErrors && { fieldErrors }),
    },
    requestId: response.locals.requestId,
  })
}

function createHandler(callback) {
  return async (request, response) => {
    try {
      const result = await callback(request, response)
      response.json(result)
    } catch (error) {
      sendError(error, response)
    }
  }
}

export function createAttemptRouter(
  database,
  { requireSession, requireMutation, now, registry = createAttemptRegistry() } = {},
) {
  const sessionMiddleware = requireMiddlewareArray(requireSession, 'session')
  const mutationMiddleware = requireMiddlewareArray(requireMutation, 'mutation')
  const service = createAttemptService(database, { registry, now })
  const router = Router()
  const startUser = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    retryAfterSeconds: 900,
    perUser: true,
  })
  const startIp = createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    retryAfterSeconds: 900,
  })
  const actionUser = createLimiter({
    windowMs: 60 * 1000,
    limit: 120,
    retryAfterSeconds: 60,
    perUser: true,
  })
  const actionIp = createLimiter({
    windowMs: 60 * 1000,
    limit: 240,
    retryAfterSeconds: 60,
  })
  const readUser = createLimiter({
    windowMs: 60 * 1000,
    limit: 240,
    retryAfterSeconds: 60,
    perUser: true,
  })
  const readIp = createLimiter({
    windowMs: 60 * 1000,
    limit: 480,
    retryAfterSeconds: 60,
  })
  const noStore = (_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  }
  // express recognizes error handlers by their four-argument signature
  // eslint-disable-next-line no-unused-vars
  const routeErrorHandler = (error, _request, response, _next) => {
    sendError(error, response)
  }

  router.post(
    '/games/:gameId/attempts',
    noStore,
    ...sessionMiddleware,
    startUser.middleware,
    startIp.middleware,
    ...mutationMiddleware,
    createHandler(async (request, response) => {
      const result = await service.startAttempt(
        response.locals.authUser,
        request.params.gameId,
        request.body,
        request.query,
      )
      response.status(201)
      return result
    }),
    routeErrorHandler,
  )

  router.get(
    '/attempts/:attemptId',
    noStore,
    ...sessionMiddleware,
    readUser.middleware,
    readIp.middleware,
    createHandler((request, response) =>
      service.getAttempt(response.locals.authUser, request.params.attemptId, request.query),
    ),
    routeErrorHandler,
  )

  router.post(
    '/attempts/:attemptId/actions',
    noStore,
    ...sessionMiddleware,
    actionUser.middleware,
    actionIp.middleware,
    ...mutationMiddleware,
    createHandler((request, response) =>
      service.applyAction(
        response.locals.authUser,
        request.params.attemptId,
        request.body,
        request.query,
      ),
    ),
    routeErrorHandler,
  )

  router.post(
    '/attempts/:attemptId/complete',
    noStore,
    ...sessionMiddleware,
    actionUser.middleware,
    actionIp.middleware,
    ...mutationMiddleware,
    createHandler((request, response) =>
      service.completeAttempt(
        response.locals.authUser,
        request.params.attemptId,
        request.body,
        request.query,
      ),
    ),
    routeErrorHandler,
  )

  router.dispose = () => {
    for (const limiter of [startUser, startIp, actionUser, actionIp, readUser, readIp])
      limiter.store.shutdown()
  }
  return router
}
