import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  api: { post: vi.fn() },
  requestCsrfToken: vi.fn(),
}))
vi.mock('../../../services/api.js', () => ({ api: mocks.api }))
vi.mock('../../auth/api.js', () => ({ requestCsrfToken: mocks.requestCsrfToken }))

import {
  issueAdminRecovery,
  issueInstructorRecovery,
  lookupStudent,
  RecoveryApiError,
  resetPassword,
} from '../api.js'

const userId = '111111111111111111111111'
const cohortId = '222222222222222222222222'
const token = 'T'.repeat(43)
const resetUrl = `${window.location.origin}/reset-password#token=${token}`
const expiresAt = '2099-01-01T00:00:00.000Z'
const student = {
  id: userId,
  username: 'Casey_Student',
  email: 'casey@example.test',
  avatarId: 'mint',
}

describe('recovery API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requestCsrfToken.mockResolvedValue('csrf-token')
  })

  it('looks up only the minimal eligible-student record and supports no match', async () => {
    mocks.api.post
      .mockResolvedValueOnce({ data: { student } })
      .mockResolvedValueOnce({ data: { student: null } })

    await expect(lookupStudent('casey@example.test')).resolves.toEqual({ student })
    await expect(lookupStudent('nobody@example.test')).resolves.toEqual({ student: null })
    expect(mocks.api.post.mock.calls.map(([path, body]) => [path, body])).toEqual([
      ['/admin/recovery/lookup', { email: 'casey@example.test' }],
      ['/admin/recovery/lookup', { email: 'nobody@example.test' }],
    ])
    expect(mocks.api.post.mock.calls[0][2]).toEqual({
      signal: undefined,
      headers: { 'X-CSRF-Token': 'csrf-token' },
    })
  })

  it('sends exact identity attestations for admin and assigned-instructor issuance', async () => {
    mocks.api.post.mockResolvedValue({ data: { resetUrl, expiresAt } })

    await expect(issueAdminRecovery(userId)).resolves.toEqual({ resetUrl, expiresAt })
    await expect(issueInstructorRecovery(cohortId, userId)).resolves.toEqual({
      resetUrl,
      expiresAt,
    })
    expect(mocks.api.post.mock.calls.map(([path, body]) => [path, body])).toEqual([
      [`/admin/users/${userId}/recovery`, { identityVerified: true }],
      [`/cohorts/${cohortId}/students/${userId}/recovery`, { identityVerified: true }],
    ])
  })

  it('rejects unsafe issued links and never exposes server error text', async () => {
    mocks.api.post
      .mockResolvedValueOnce({
        data: { resetUrl: `https://outside.example/reset-password#token=${token}`, expiresAt },
      })
      .mockRejectedValueOnce({
        response: {
          status: 400,
          data: { error: { code: 'RECOVERY_UNAVAILABLE', message: `secret ${token}` } },
        },
      })

    await expect(issueAdminRecovery(userId)).rejects.toMatchObject({
      code: 'RECOVERY_FAILED',
      name: 'RecoveryApiError',
    })
    await expect(lookupStudent('casey@example.test')).rejects.toMatchObject({
      code: 'RECOVERY_UNAVAILABLE',
      message: 'The recovery request could not be completed. Refresh and try again.',
    })
    expect(mocks.api.post.mock.calls[1][2].headers).toEqual({ 'X-CSRF-Token': 'csrf-token' })
  })

  it('submits a token and password without creating an authenticated session', async () => {
    mocks.api.post.mockResolvedValue({ status: 204, data: undefined })

    await expect(resetPassword(token, 'CorrectHorse!Long')).resolves.toBeUndefined()
    expect(mocks.api.post).toHaveBeenCalledWith(
      '/auth/reset-password',
      {
        token,
        password: 'CorrectHorse!Long',
      },
      {
        signal: undefined,
        headers: { 'X-CSRF-Token': 'csrf-token' },
      },
    )
    expect(mocks.api.post).toHaveBeenCalledTimes(1)
  })

  it('does not send a request after its caller aborts during CSRF retrieval', async () => {
    let resolveCsrf
    mocks.requestCsrfToken.mockReturnValue(new Promise((resolve) => (resolveCsrf = resolve)))
    const controller = new AbortController()
    const request = resetPassword(token, 'CorrectHorse!Long', controller.signal)
    controller.abort()
    resolveCsrf('csrf-token')

    await expect(request).rejects.toBeInstanceOf(RecoveryApiError)
    expect(mocks.api.post).not.toHaveBeenCalled()
  })
})
