import { normalizeEmailAddress, parseNewPasswordInput } from '../auth/policy.js'

export const activationLifetimeMs = 24 * 60 * 60 * 1000
export const studentResetLifetimeMs = 30 * 60 * 1000

export class StudentRecoveryError extends Error {
  constructor(code = 'RECOVERY_UNAVAILABLE', status = 400) {
    const messages = {
      RECOVERY_UNAVAILABLE:
        'This recovery request is unavailable. Ask an eligible staff member for help.',
      RECOVERY_INVALID_REQUEST:
        'Check the recovery request. Use a password with at least 12 characters, an uppercase letter and a punctuation or symbol character.',
      RECOVERY_FORBIDDEN: 'This action is unavailable.',
      RECOVERY_FAILED: 'Recovery could not be completed. Ask an eligible staff member for help.',
    }
    super(Object.hasOwn(messages, code) ? messages[code] : messages.RECOVERY_FAILED)
    this.name = 'StudentRecoveryError'
    this.code = code
    this.status = status
  }
}

function exactRecoveryInput(input, fields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
  const prototype = Object.getPrototypeOf(input)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
  if (
    Reflect.ownKeys(input).some((key) => typeof key !== 'string' || !fields.includes(key)) ||
    fields.some((field) => !Object.hasOwn(input, field))
  ) {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
  return input
}

export function parseStudentRecoveryIssue(input) {
  if (exactRecoveryInput(input, ['identityVerified']).identityVerified !== true) {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
  return { identityVerified: true }
}

export function parseStudentRecoveryLookup(input) {
  const parsed = exactRecoveryInput(input, ['email'])
  try {
    return { emailNormalized: normalizeEmailAddress(parsed.email) }
  } catch {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
}

export function parseStudentPasswordResetInput(input) {
  const parsed = exactRecoveryInput(input, ['token', 'password'])
  if (typeof parsed.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(parsed.token)) {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
  try {
    return { token: parsed.token, password: parseNewPasswordInput(parsed.password) }
  } catch {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
}

export function recoveryObjectId(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) {
    throw new StudentRecoveryError('RECOVERY_INVALID_REQUEST')
  }
  return value.toLowerCase()
}

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
