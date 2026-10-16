import { describe, expect, it } from 'vitest'
import {
  capturePendingInvitation,
  clearPendingInvitation,
  getPendingInvitation,
  INVITATION_CARRY_MS,
  pendingInvitationValues,
} from '../../../src/modules/cohorts/invitation-session.js'

describe('class invitation session carry', () => {
  const time = 1_800_000_000_000
  const hash = 'a'.repeat(64)

  it('carries only a bounded hash through rotation without extending its lifetime', () => {
    const request = { session: {} }
    capturePendingInvitation(request, hash, () => time)
    const values = pendingInvitationValues(request, () => time + 1000)
    expect(values).toEqual({
      classInvitation: { codeHash: hash, expiresAt: time + INVITATION_CARRY_MS },
    })
    expect(values.classInvitation).not.toBe(request.session.classInvitation)
    expect(getPendingInvitation({ session: values }, () => time + INVITATION_CARRY_MS)).toBeNull()
  })

  it('rejects malformed, expired and artificially extended capabilities', () => {
    for (const invitation of [
      { codeHash: 'raw-code', expiresAt: time + 1000 },
      { codeHash: hash, expiresAt: time },
      { codeHash: hash, expiresAt: time + INVITATION_CARRY_MS + 1 },
      { codeHash: hash, expiresAt: 'later' },
    ]) {
      const request = { session: { classInvitation: invitation } }
      expect(getPendingInvitation(request, () => time)).toBeNull()
      expect(pendingInvitationValues(request, () => time)).toEqual({})
    }
  })

  it('clears the invitation without changing identity or csrf state', () => {
    const request = { session: { userId: 'student', csrfToken: 'csrf' } }
    capturePendingInvitation(request, hash, () => time)
    clearPendingInvitation(request)
    expect(request.session).toEqual({ userId: 'student', csrfToken: 'csrf' })
    expect(getPendingInvitation(request, () => time)).toBeNull()
  })
})
