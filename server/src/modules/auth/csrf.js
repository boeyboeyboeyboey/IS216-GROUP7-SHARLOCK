import { csrfSync } from 'csrf-sync'
import { AuthError } from './policy.js'

export function createCsrfTools() {
  const csrf = csrfSync({
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (request) => request.get('x-csrf-token'),
  })

  const protect = (request, response, next) => {
    csrf.csrfSynchronisedProtection(request, response, (error) => {
      if (error) {
        next(new AuthError('CSRF_INVALID', 'Refresh the security token and try again.', 403))
        return
      }
      next()
    })
  }

  return Object.freeze({ generateToken: csrf.generateToken, protect })
}

export function requireExpectedOrigin(clientOrigin) {
  return (request, _response, next) => {
    const origin = request.get('origin')
    let sourceOrigin = origin
    if (origin === undefined) {
      const referer = request.get('referer')
      if (referer !== undefined) {
        try {
          const parsed = new URL(referer)
          if (!parsed.username && !parsed.password) sourceOrigin = parsed.origin
        } catch {
          sourceOrigin = undefined
        }
      }
    }

    if (sourceOrigin !== clientOrigin) {
      next(new AuthError('ORIGIN_FORBIDDEN', 'This request came from an untrusted origin.', 403))
      return
    }
    next()
  }
}
