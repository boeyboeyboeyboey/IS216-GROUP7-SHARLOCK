import { describe, expect, it } from 'vitest'
import { activationLifetimeMs, parseActivationInput } from '../../../src/modules/recovery/policy.js'

describe('instructor activation input', () => {
  const valid = { token: 'A'.repeat(43), password: 'AlphaBravo1!' }

  it('accepts only a bounded opaque token and the shared new-password policy', () => {
    expect(parseActivationInput(valid)).toEqual(valid)
    expect(activationLifetimeMs).toBe(24 * 60 * 60 * 1000)
  })

  it.each([
    null,
    [],
    { ...valid, token: 'A'.repeat(42) },
    { ...valid, token: 'A'.repeat(44) },
    { ...valid, token: `${'A'.repeat(42)}!` },
    { ...valid, password: 'alphabravo1!' },
    { ...valid, password: 'AlphaBravo12' },
    { ...valid, password: 'Alpha1!' },
    { ...valid, password: `AlphaBravo!${String.fromCharCode(0xd800)}` },
    { ...valid, userId: '0123456789abcdef01234567' },
    { ...valid, globalRoles: ['admin'] },
    Object.create(valid),
  ])(
    'rejects malformed, forged or composition-invalid input without returning its values',
    (input) => {
      try {
        parseActivationInput(input)
        expect.fail('invalid activation input was accepted')
      } catch (error) {
        expect(error).toMatchObject({ code: 'ACTIVATION_INVALID_REQUEST', status: 400 })
        expect(error.message).not.toContain(valid.token)
        expect(error.message).not.toContain(valid.password)
      }
    },
  )
})
