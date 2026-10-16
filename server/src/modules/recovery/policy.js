import { parseNewPasswordInput } from '../auth/policy.js'

export const activationLifetimeMs = 24 * 60 * 60 * 1000

export class ActivationError extends Error {
  constructor(code = 'ACTIVATION_UNAVAILABLE', status = 400) {
    const messages = {
      ACTIVATION_UNAVAILABLE:
        'This activation link is unavailable. Ask your administrator for a new link.',
      ACTIVATION_INVALID_REQUEST: 'Check the activation form and password requirements.',
      ACTIVATION_FAILED:
        'Activation could not be confirmed. Contact your administrator before retrying.',
    }
    super(Object.hasOwn(messages, code) ? messages[code] : messages.ACTIVATION_FAILED)
    this.name = 'ActivationError'
    this.code = code
    this.status = status
  }
}

export function parseActivationInput(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Reflect.ownKeys(input).length !== 2 ||
    !Object.hasOwn(input, 'token') ||
    !Object.hasOwn(input, 'password') ||
    typeof input.token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(input.token)
  )
    throw new ActivationError('ACTIVATION_INVALID_REQUEST')
  try {
    return { token: input.token, password: parseNewPasswordInput(input.password) }
  } catch {
    throw new ActivationError('ACTIVATION_INVALID_REQUEST')
  }
}

export function activationObjectId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
    throw new ActivationError('ACTIVATION_INVALID_REQUEST')
  }
  return value.toLowerCase()
}
