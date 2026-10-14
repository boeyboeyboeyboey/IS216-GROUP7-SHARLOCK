import argon2 from 'argon2'
import { AuthError } from './policy.js'

export const passwordHashOptions = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
})

const DUMMY_PASSWORD = 'sharlock-auth-dummy-verification-value'
const maximumOperations = 2

export class PasswordBusyError extends AuthError {
  constructor() {
    super('PASSWORD_SERVICE_BUSY', 'Sign-in is temporarily busy. Please try again shortly.', 503)
    this.name = 'PasswordBusyError'
  }
}

export function createPasswordGate() {
  let activeOperations = 0
  return async function runPasswordOperation(operation) {
    if (activeOperations >= maximumOperations) throw new PasswordBusyError()
    activeOperations += 1
    try {
      return await operation()
    } finally {
      activeOperations -= 1
    }
  }
}

const dummyPasswordHash = await argon2.hash(DUMMY_PASSWORD, passwordHashOptions)
const runPasswordOperation = createPasswordGate()

export function hashPassword(password) {
  return runPasswordOperation(() => argon2.hash(password, passwordHashOptions))
}

export function verifyPassword(passwordHash, password) {
  return runPasswordOperation(() => argon2.verify(passwordHash, password))
}

export function verifyDummyPassword(password) {
  return runPasswordOperation(() => argon2.verify(dummyPasswordHash, password))
}
