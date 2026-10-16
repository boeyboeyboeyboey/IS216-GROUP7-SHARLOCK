import {
  clearSessionCookie,
  destroySession,
  sessionIsExpired,
  setSessionCookieLifetime,
} from './session.js'

export async function loadSessionActor(request, authService) {
  if (!request.session?.userId) return null
  return authService.findActiveSessionUser(request.session.userId, request.session.authVersion)
}

export function createProtectedSessionAccess(sessionRuntime, authService) {
  const { settings } = sessionRuntime
  return [
    (_request, response, next) => {
      response.set('Cache-Control', 'no-store')
      next()
    },
    sessionRuntime.middleware,
    (request, _response, next) => {
      setSessionCookieLifetime(request, settings.now)
      next()
    },
    async (request, response, next) => {
      const user = await loadSessionActor(request, authService)
      if (!user || sessionIsExpired(request.session, settings.now)) {
        await destroySession(request)
        clearSessionCookie(response, settings.secureCookie)
        response.status(401).json({
          error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to continue.' },
          requestId: response.locals.requestId,
        })
        return
      }
      response.locals.authUser = user
      next()
    },
  ]
}
