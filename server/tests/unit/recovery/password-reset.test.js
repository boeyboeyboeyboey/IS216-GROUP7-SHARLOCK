import { describe, expect, it } from 'vitest'
import {
  parseStudentPasswordResetInput,
  parseStudentRecoveryIssue,
  parseStudentRecoveryLookup,
  recoveryObjectId,
  StudentRecoveryError,
  studentResetLifetimeMs,
} from '../../../src/modules/recovery/policy.js'

const validToken = 'A'.repeat(43)
const validPassword = 'AlphaBravo1!'

describe('student recovery request policy', () => {
  it('accepts only the exact school-channel attestation payload', () => {
    expect(parseStudentRecoveryIssue({ identityVerified: true })).toEqual({
      identityVerified: true,
    })

    for (const input of [
      null,
      [],
      {},
      { identityVerified: false },
      { identityVerified: 'true' },
      { identityVerified: true, evidence: 'private note' },
      Object.assign(Object.create({ identityVerified: true }), {}),
    ]) {
      expect(() => parseStudentRecoveryIssue(input)).toThrow(StudentRecoveryError)
    }
  })

  it('normalizes a valid lookup email and rejects malformed or operator-shaped input', () => {
    expect(parseStudentRecoveryLookup({ email: '  Learner+One@example.test  ' })).toEqual({
      emailNormalized: 'learner+one@example.test',
    })
    for (const input of [
      {},
      { email: 'learner@example.test', role: 'admin' },
      { email: { $ne: '' } },
      { email: 'learner@@example.test' },
      { email: ['learner@example.test'] },
    ]) {
      expect(() => parseStudentRecoveryLookup(input)).toThrow(StudentRecoveryError)
    }
  })

  it('accepts a 32-byte base64url token shape and the shared password policy', () => {
    const parsed = parseStudentPasswordResetInput({ token: validToken, password: validPassword })
    expect(parsed.token === validToken && parsed.password === validPassword).toBe(true)
    expect(studentResetLifetimeMs).toBe(30 * 60 * 1000)
  })

  it.each(['A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}!`, 'A'.repeat(43) + '='])(
    'rejects malformed reset tokens without exposing submitted values',
    (token) => {
      try {
        parseStudentPasswordResetInput({ token, password: validPassword })
        throw new Error('Expected malformed token to be rejected.')
      } catch (error) {
        expect(error).toBeInstanceOf(StudentRecoveryError)
        expect(error.code).toBe('RECOVERY_INVALID_REQUEST')
        expect(error.message.includes(token)).toBe(false)
        expect(error.message.includes(validPassword)).toBe(false)
      }
    },
  )

  it('rejects extra reset fields and malformed passwords without echoing secrets', () => {
    const rejected = [
      { token: validToken, password: validPassword, role: 'admin' },
      { token: validToken, password: 'AlphaBravo!' },
      { token: validToken, password: `A${'a'.repeat(127)}!` },
      { token: validToken, password: `${'a'.repeat(14)}\ud800` },
    ]
    for (const input of rejected) {
      try {
        parseStudentPasswordResetInput(input)
        throw new Error('Expected invalid reset input to be rejected.')
      } catch (error) {
        expect(error).toBeInstanceOf(StudentRecoveryError)
        expect(error.code).toBe('RECOVERY_INVALID_REQUEST')
        expect(error.message.includes(input.token)).toBe(false)
        expect(error.message.includes(input.password)).toBe(false)
      }
    }
  })

  it('accepts only a hexadecimal object-id string and normalizes its case', () => {
    expect(recoveryObjectId('ABCDEF0123456789abcdef01')).toBe('abcdef0123456789abcdef01')
    for (const value of ['', 1, 'g'.repeat(24), '0'.repeat(23), { $ne: null }]) {
      expect(() => recoveryObjectId(value)).toThrow(StudentRecoveryError)
    }
  })
})
