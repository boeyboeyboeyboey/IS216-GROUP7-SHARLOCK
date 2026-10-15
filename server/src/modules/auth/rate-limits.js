import { createHmac } from 'node:crypto'
import { MemoryStore, rateLimit } from 'express-rate-limit'
import { AuthError } from './policy.js'

const FIFTEEN_MINUTES = 15 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

function sendRateLimitError(request, response, message, retryAfter = 1) {
  response.set('Cache-Control', 'no-store')
  response.set('Retry-After', String(Math.max(1, Math.ceil(retryAfter / 1000))))
  response.status(429).json({
    error: { code: 'RATE_LIMITED', message },
    requestId: response.locals.requestId,
  })
}

function requestLimiter({ windowMs, limit, message }) {
  const store = new MemoryStore()
  const middleware = rateLimit({
    windowMs,
    limit,
    store,
    ipv6Subnet: 56,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler(request, response) {
      const retryAfter = request.rateLimit?.resetTime
        ? request.rateLimit.resetTime.getTime() - Date.now()
        : 1000
      sendRateLimitError(request, response, message, retryAfter)
    },
  })
  return { middleware, store }
}

export function createRateLimits({ secret, now = Date.now } = {}) {
  if (typeof secret !== 'string' || !/^[a-fA-F0-9]{64,}$/.test(secret)) {
    throw new TypeError('A validated session secret is required for auth rate limits.')
  }

  const csrf = requestLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 60,
    message: 'Too many security checks. Please try again later.',
  })
  const registration = requestLimiter({
    windowMs: ONE_HOUR,
    limit: 5,
    message: 'Too many account requests. Please try again later.',
  })
  const loginIp = requestLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 30,
    message: 'Too many sign-in attempts. Please try again later.',
  })
  const activation = requestLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    message: 'Too many activation attempts. Please try again later.',
  })

  const failedLogins = new Map()
  const cleanup = setInterval(() => {
    const currentTime = now()
    for (const [key, entry] of failedLogins) {
      if (entry.pending === 0 && entry.expiresAt <= currentTime) failedLogins.delete(key)
    }
  }, 60_000).unref()

  function keyFor(emailNormalized, ipAddress) {
    return createHmac('sha256', secret).update(`${ipAddress}\u0000${emailNormalized}`).digest('hex')
  }

  function reserveFailedLogin(emailNormalized, ipAddress) {
    const key = keyFor(emailNormalized, ipAddress)
    const currentTime = now()
    let entry = failedLogins.get(key)
    if (!entry || entry.expiresAt <= currentTime) {
      entry = { failures: 0, pending: 0, expiresAt: currentTime + FIFTEEN_MINUTES }
      failedLogins.set(key, entry)
    }

    if (entry.failures + entry.pending >= 5) {
      throw new AuthError(
        'RATE_LIMITED',
        'Too many sign-in attempts for these details. Please try again later.',
        429,
        undefined,
        Math.max(1, entry.expiresAt - currentTime),
      )
    }

    entry.pending += 1
    let settled = false
    function release(failed) {
      if (settled) return
      settled = true
      entry.pending = Math.max(0, entry.pending - 1)
      if (failed) {
        entry.failures += 1
        entry.expiresAt = now() + FIFTEEN_MINUTES
      } else if (entry.pending === 0 && entry.failures === 0) {
        failedLogins.delete(key)
      }
    }

    return Object.freeze({
      fail: () => release(true),
      succeed: () => release(false),
      release: () => release(false),
    })
  }

  return Object.freeze({
    csrf: csrf.middleware,
    registration: registration.middleware,
    loginIp: loginIp.middleware,
    activation: activation.middleware,
    reserveFailedLogin,
    dispose() {
      clearInterval(cleanup)
      failedLogins.clear()
      csrf.store.shutdown()
      registration.store.shutdown()
      loginIp.store.shutdown()
      activation.store.shutdown()
    },
  })
}

export function rateLimitResponse(request, response, error) {
  const retryAfterMs = Number.isFinite(error.retryAfterMs) ? error.retryAfterMs : 1000
  sendRateLimitError(request, response, error.message, retryAfterMs)
}
