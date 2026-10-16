import { api } from '../../services/api.js'
import { requestCsrfToken } from '../auth/api.js'

const INVALID_ACTIVATION_CODES = new Set([
  'ACTIVATION_UNAVAILABLE',
  'ACTIVATION_INVALID',
  'ACTIVATION_EXPIRED',
  'ACTIVATION_USED',
])

export class ActivationApiError extends Error {
  constructor({ code = 'REQUEST_FAILED', status = 0, message }) {
    super(message)
    this.name = 'ActivationApiError'
    this.code = code
    this.status = status
  }
}

function toSafeActivationError(error) {
  if (error instanceof ActivationApiError) return error

  const status = Number.isInteger(error?.response?.status) ? error.response.status : 0
  const responseCode = error?.response?.data?.error?.code
  if (typeof responseCode === 'string' && INVALID_ACTIVATION_CODES.has(responseCode)) {
    return new ActivationApiError({
      code: 'INVALID_ACTIVATION',
      status,
      message:
        'This activation link is invalid, expired, or already used. Ask an administrator for a new link.',
    })
  }
  if (responseCode === 'ACTIVATION_INVALID_REQUEST') {
    return new ActivationApiError({
      code: 'INVALID_INPUT',
      status,
      message: 'Check the password requirements and try again.',
    })
  }
  if (status === 404 || status === 409) {
    return new ActivationApiError({
      code: 'INVALID_ACTIVATION',
      status,
      message:
        'This activation link is invalid, expired, or already used. Ask an administrator for a new link.',
    })
  }
  if (status === 429) {
    return new ActivationApiError({
      code: 'RATE_LIMITED',
      status,
      message: 'Too many attempts. Wait a moment and try again.',
    })
  }
  return new ActivationApiError({
    code: 'REQUEST_FAILED',
    status,
    message:
      status >= 500
        ? 'Sharlock is temporarily unavailable. Try again shortly.'
        : 'We could not complete activation. Check your connection and try again.',
  })
}

export async function activateAccount(input, signal) {
  try {
    const csrfToken = await requestCsrfToken()
    signal?.throwIfAborted()
    await api.post('/auth/activate-account', input, {
      headers: { 'X-CSRF-Token': csrfToken },
      ...(signal && { signal }),
    })
  } catch (error) {
    throw toSafeActivationError(error)
  }
}
