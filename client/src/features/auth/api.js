import { api } from '../../services/api.js'

const FIELD_NAMES = new Set([
  'email',
  'username',
  'password',
  'passwordConfirmation',
  'avatarId',
  'code',
  '_',
])

const SAFE_MESSAGES = Object.freeze({
  AUTHENTICATION_REQUIRED: 'Your session has ended. Sign in again to continue.',
  INVALID_CREDENTIALS: 'Email or password is incorrect.',
  ACCOUNT_UNAVAILABLE: 'An account could not be created with those details.',
  VALIDATION_ERROR: 'Check the highlighted fields and try again.',
  CSRF_INVALID: 'Your security check expired. Review the form and try again.',
  ORIGIN_FORBIDDEN: 'This request could not be verified. Refresh and try again.',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  PASSWORD_SERVICE_BUSY: 'Sign-in is temporarily busy. Please try again shortly.',
  VERIFICATION_CODE_INVALID: 'That code is not right. Check it and try again.',
  VERIFICATION_CODE_EXPIRED: 'That code has expired. Request a new one.',
  VERIFICATION_ATTEMPTS_EXCEEDED: 'Too many wrong codes. Request a new code to try again.',
  VERIFICATION_NOT_PENDING: 'Your sign-up session ended. Sign in to get a new code.',
})

const FIELD_MESSAGES = Object.freeze({
  email: 'Enter a valid email address.',
  username: 'Use 3 to 32 letters, numbers, underscores or hyphens.',
  password: 'That password could not be accepted. Please choose a different password.',
  passwordConfirmation: 'Passwords must match.',
  avatarId: 'Choose one of the available avatars.',
  code: 'Enter the 6-digit code.',
  _: 'Check the highlighted fields and try again.',
})

export class SafeAuthError extends Error {
  constructor({ code = 'REQUEST_FAILED', status = 0, message, fieldErrors, retryAfter }) {
    super(message || 'Sharlock could not complete that request. Please try again.')
    this.name = 'SafeAuthError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors || Object.freeze({})
    this.retryAfter = retryAfter || null
  }
}

function safeFieldErrors(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({})
  const errors = Object.create(null)
  for (const key of Object.keys(value)) {
    if (FIELD_NAMES.has(key)) errors[key] = FIELD_MESSAGES[key]
  }
  return Object.freeze(errors)
}

export function toSafeAuthError(error) {
  if (error instanceof SafeAuthError) return error

  const status = Number.isInteger(error?.response?.status)
    ? error.response.status
    : Number.isInteger(error?.status)
      ? error.status
      : 0
  const payload = error?.response?.data?.error || error
  const code = typeof payload?.code === 'string' ? payload.code : 'REQUEST_FAILED'
  const knownMessage = Object.hasOwn(SAFE_MESSAGES, code) ? SAFE_MESSAGES[code] : null
  const message =
    knownMessage ||
    (status === 429
      ? SAFE_MESSAGES.RATE_LIMITED
      : status >= 500
        ? 'Sharlock is temporarily unavailable. Please try again shortly.'
        : status === 0
          ? 'We could not reach Sharlock. Check your connection and try again.'
          : 'Sharlock could not complete that request. Please try again.')
  const retryAfterHeader = error?.response?.headers?.['retry-after']
  const retryAfter = Number.isFinite(Number(retryAfterHeader))
    ? Math.max(1, Number(retryAfterHeader))
    : null

  return new SafeAuthError({
    code,
    status,
    message,
    fieldErrors: safeFieldErrors(payload?.fieldErrors),
    retryAfter,
  })
}

function csrfHeaders(csrfToken) {
  return { headers: { 'X-CSRF-Token': csrfToken } }
}

export async function requestCsrfToken() {
  const response = await api.get('/auth/csrf')
  if (typeof response.data?.csrfToken !== 'string' || !response.data.csrfToken) {
    throw new SafeAuthError({ message: 'The security check could not be prepared. Try again.' })
  }
  return response.data.csrfToken
}

export async function requestCurrentUser() {
  const response = await api.get('/auth/me')
  return response.data?.user
}

export async function requestLogin(payload, csrfToken) {
  const response = await api.post('/auth/login', payload, csrfHeaders(csrfToken))
  return response.data
}

export async function requestRegistration(payload, csrfToken) {
  const response = await api.post('/auth/register', payload, csrfHeaders(csrfToken))
  return response.data
}

export async function requestVerifyEmail(payload, csrfToken) {
  const response = await api.post('/auth/verify-email', payload, csrfHeaders(csrfToken))
  return response.data
}

export async function requestResendVerification(csrfToken) {
  const response = await api.post('/auth/verify-email/resend', null, csrfHeaders(csrfToken))
  return response.data
}

export async function requestLogout(csrfToken) {
  await api.post('/auth/logout', null, csrfHeaders(csrfToken))
}
