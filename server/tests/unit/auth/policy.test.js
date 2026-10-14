import { describe, expect, it } from 'vitest'
import {
  parseEmptyInput,
  parseEmptyQuery,
  parseLoginInput,
  parseRegistrationInput,
} from '../../../src/modules/auth/policy.js'

const validRegistration = {
  email: '  Learner+One@example.test  ',
  username: ' Case_Name-1 ',
  password: 'Correct-Horse-🔒-2026',
  avatarId: 'mint',
}

describe('auth request policy', () => {
  it('normalizes only the email and username fields', () => {
    const parsed = parseRegistrationInput(validRegistration)
    expect(parsed).toEqual({
      emailNormalized: 'learner+one@example.test',
      username: { display: 'Case_Name-1', normalized: 'case_name-1' },
      password: validRegistration.password,
      avatarId: 'mint',
    })
  })

  it('preserves well-formed password text and counts Unicode code points', () => {
    const password = ' 1234567890123 '
    expect([...password]).toHaveLength(15)
    expect(parseLoginInput({ email: 'learner@example.test', password }).password).toBe(password)
    expect(() =>
      parseLoginInput({ email: 'learner@example.test', password: 'a'.repeat(14) }),
    ).toThrow()
    expect(() =>
      parseLoginInput({ email: 'learner@example.test', password: 'a'.repeat(129) }),
    ).toThrow()
    expect(() =>
      parseLoginInput({ email: 'learner@example.test', password: `${'a'.repeat(14)}\ud800` }),
    ).toThrow()
  })

  it.each([
    'learner',
    'learner@',
    'learner@@example.test',
    'learner..name@example.test',
    'learner@-example.test',
    'learner@exam_ple.test',
    'learner@éxample.test',
  ])('rejects a malformed or non-ASCII email: %s', (email) => {
    expect(() => parseLoginInput({ email, password: 'correct-horse-battery' })).toThrow()
  })

  it('rejects unknown, role, prototype and Mongo operator fields with safe errors', () => {
    const payload = JSON.parse(
      '{"email":"learner@example.test","password":"correct-horse-battery","role":"admin","$where":"x","__proto__":{"polluted":true}}',
    )
    try {
      parseLoginInput(payload)
      throw new Error('Expected strict field validation to fail.')
    } catch (error) {
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(Object.getPrototypeOf(error.fieldErrors)).toBe(null)
      expect(error.fieldErrors.role).toBe('This field is not allowed.')
      expect(error.fieldErrors.$where).toBe('This field is not allowed.')
      expect(Object.hasOwn(error.fieldErrors, '__proto__')).toBe(true)
      expect(error.fieldErrors.__proto__).toBe('This field is not allowed.')
      expect({}.polluted).toBeUndefined()
    }
  })

  it('requires own properties instead of inherited request values', () => {
    const body = Object.create({ email: 'learner@example.test' })
    body.password = 'correct-horse-battery'
    expect(() => parseLoginInput(body)).toThrow(/highlighted fields/)
  })

  it('rejects malformed input types, avatar IDs and out-of-contract logout fields', () => {
    expect(() => parseRegistrationInput([])).toThrow()
    expect(() => parseRegistrationInput({ ...validRegistration, avatarId: 'admin' })).toThrow()
    expect(() => parseRegistrationInput({ ...validRegistration, username: 'ab' })).toThrow()
    expect(() => parseEmptyInput({ role: 'student' })).toThrow()
    expect(() => parseEmptyInput({})).not.toThrow()
    expect(() => parseEmptyInput(undefined)).not.toThrow()
  })

  it('rejects all query fields and operator-style query keys', () => {
    expect(() => parseEmptyQuery({ page: '1' })).toThrow()
    expect(() => parseEmptyQuery({ $ne: 'x' })).toThrow()
    expect(() => parseEmptyQuery({})).not.toThrow()
  })
})
