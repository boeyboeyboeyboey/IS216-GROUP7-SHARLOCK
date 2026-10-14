import { Router } from 'express'
import { createCsrfTools, requireExpectedOrigin } from './csrf.js'
import { createRateLimits, rateLimitResponse } from './rate-limits.js'
import {
  AuthError,
  parseEmptyInput,
  parseEmptyQuery,
  parseLoginInput,
  parseRegistrationInput,
} from './policy.js'
import { createAuthService } from './service.js'
import { createProtectedSessionAccess, loadSessionActor } from './access.js'
import {
  clearSessionCookie,
  createAnonymousSessionValues,
  createAuthenticatedSessionValues,
  createAuthSessionMiddleware,
  destroySession,
  rotateSession,
  saveSession,
  sessionIsExpired,
  setSessionCookieLifetime,
} from './session.js'

function sendUnauthorized(request, response) {
  response.status(401).json({
    error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' },
    requestId: response.locals.requestId,
  })
}

function sendUser(response, user, csrfToken) {
  response.status(200).json({ user, csrfToken })
}

function requestError(error, _request, response, next) {
  if (!(error instanceof AuthError)) {
    next(error)
    return
  }

  if (error.status === 429) {
    rateLimitResponse(_request, response, error)
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

export function createAuthRouter(database, settings) {
  const sessionRuntime = createAuthSessionMiddleware(database, settings)
  const authSettings = sessionRuntime.settings
  const authService = createAuthService(database, { now: authSettings.now })
  const rateLimits = createRateLimits({ secret: authSettings.sessionSecret, now: authSettings.now })
  const csrf = createCsrfTools()
  const requireOrigin = requireExpectedOrigin(authSettings.clientOrigin)
  const router = Router()

  router.use((_request, response, next) => {
    response.set('Cache-Control', 'no-store')
    next()
  })
  router.use(sessionRuntime.middleware)
  router.use((request, _response, next) => {
    setSessionCookieLifetime(request, authSettings.now)
    next()
  })
  router.use(async (request, response, next) => {
    const sessionData = request.session
    const expired = sessionIsExpired(sessionData, authSettings.now)

    try {
      if (sessionData?.userId) {
        const user = await loadSessionActor(request, authService)
        if (!user) {
          await destroySession(request)
          clearSessionCookie(response, authSettings.secureCookie)
          sendUnauthorized(request, response)
          return
        }
        if (expired) {
          await destroySession(request)
          clearSessionCookie(response, authSettings.secureCookie)
          if (request.method === 'GET' && request.path === '/csrf') {
            request.sessionStore.generate(request)
            next()
            return
          }
          sendUnauthorized(request, response)
          return
        }
        response.locals.authUser = user
      } else if (
        expired &&
        request.method === 'POST' &&
        ['/register', '/login', '/logout'].includes(request.path)
      ) {
        await destroySession(request)
        clearSessionCookie(response, authSettings.secureCookie)
        next(new AuthError('CSRF_INVALID', 'Refresh the security token and try again.', 403))
        return
      }

      next()
    } catch (error) {
      next(error)
    }
  })

  router.get('/csrf', rateLimits.csrf, async (request, response, next) => {
    try {
      parseEmptyQuery(request.query)
      const mustCreateSession = sessionIsExpired(request.session, authSettings.now)
      if (mustCreateSession || !request.session.csrfToken) {
        await rotateSession(request, createAnonymousSessionValues(authSettings.now))
        const csrfToken = csrf.generateToken(request, true)
        setSessionCookieLifetime(request, authSettings.now)
        await saveSession(request)
        response.json({ csrfToken })
        return
      }

      response.json({ csrfToken: csrf.generateToken(request) })
    } catch (error) {
      next(error)
    }
  })

  router.post(
    '/register',
    rateLimits.registration,
    requireOrigin,
    csrf.protect,
    async (request, response, next) => {
      try {
        parseEmptyQuery(request.query)
        const input = parseRegistrationInput(request.body)
        const account = await authService.register(input)
        await rotateSession(
          request,
          createAuthenticatedSessionValues(account.userId, account.authVersion, authSettings.now),
        )
        const csrfToken = csrf.generateToken(request, true)
        setSessionCookieLifetime(request, authSettings.now)
        await saveSession(request)
        response.status(201).json({ user: account.user, csrfToken })
      } catch (error) {
        next(error)
      }
    },
  )

  router.post(
    '/login',
    rateLimits.loginIp,
    requireOrigin,
    csrf.protect,
    async (request, response, next) => {
      let failureSlot
      try {
        parseEmptyQuery(request.query)
        const input = parseLoginInput(request.body)
        failureSlot = rateLimits.reserveFailedLogin(input.emailNormalized, request.ip)
        const account = await authService.login(input)
        failureSlot.succeed()
        await rotateSession(
          request,
          createAuthenticatedSessionValues(account.userId, account.authVersion, authSettings.now),
        )
        const csrfToken = csrf.generateToken(request, true)
        setSessionCookieLifetime(request, authSettings.now)
        await saveSession(request)
        sendUser(response, account.user, csrfToken)
      } catch (error) {
        if (failureSlot) {
          if (error.code === 'INVALID_CREDENTIALS') failureSlot.fail()
          else failureSlot.release()
        }
        next(error)
      }
    },
  )

  router.get('/me', async (request, response, next) => {
    try {
      parseEmptyQuery(request.query)
      const sessionData = request.session
      if (!sessionData?.userId || sessionIsExpired(sessionData, authSettings.now)) {
        await destroySession(request)
        clearSessionCookie(response, authSettings.secureCookie)
        sendUnauthorized(request, response)
        return
      }

      const user = response.locals.authUser
      if (!user) {
        await destroySession(request)
        clearSessionCookie(response, authSettings.secureCookie)
        sendUnauthorized(request, response)
        return
      }

      response.json({ user })
    } catch (error) {
      next(error)
    }
  })

  router.post('/logout', requireOrigin, csrf.protect, async (request, response, next) => {
    try {
      parseEmptyQuery(request.query)
      parseEmptyInput(request.body)
      await destroySession(request)
      clearSessionCookie(response, authSettings.secureCookie)
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  })

  router.use(requestError)

  return Object.freeze({
    router,
    requireSession: createProtectedSessionAccess(sessionRuntime, authService),
    dispose: rateLimits.dispose,
  })
}
