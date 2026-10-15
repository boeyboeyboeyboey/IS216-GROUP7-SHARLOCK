import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  api: { post: vi.fn() },
  requestCsrfToken: vi.fn(),
}))

vi.mock('../../../services/api.js', () => ({ api: mocks.api }))
vi.mock('../../auth/api.js', () => ({ requestCsrfToken: mocks.requestCsrfToken }))

import { activateAccount } from '../api.js'

const input = { token: 'A'.repeat(43), password: 'AlphaBravo1!' }

describe('account activation API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a fresh CSRF token and posts only the token and new password', async () => {
    mocks.requestCsrfToken.mockResolvedValue('activation-csrf')
    mocks.api.post.mockResolvedValue({ status: 204 })

    await activateAccount(input)

    expect(mocks.api.post).toHaveBeenCalledTimes(1)
    expect(mocks.api.post).toHaveBeenCalledWith('/auth/activate-account', input, {
      headers: { 'X-CSRF-Token': 'activation-csrf' },
    })
    expect(Object.keys(mocks.api.post.mock.calls[0][1])).toEqual(['token', 'password'])
  })

  it('maps invalid links and rejected form data to fixed safe messages without replay', async () => {
    mocks.requestCsrfToken.mockResolvedValue('activation-csrf')
    mocks.api.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: { code: 'ACTIVATION_UNAVAILABLE', message: 'private token detail' } },
      },
    })
    await expect(activateAccount(input)).rejects.toMatchObject({
      code: 'INVALID_ACTIVATION',
      message:
        'This activation link is invalid, expired, or already used. Ask an administrator for a new link.',
    })

    mocks.api.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: { code: 'ACTIVATION_INVALID_REQUEST', message: 'private policy detail' } },
      },
    })
    await expect(activateAccount(input)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      message: 'Check the password requirements and try again.',
    })
    expect(mocks.api.post).toHaveBeenCalledTimes(2)
    expect(mocks.requestCsrfToken).toHaveBeenCalledTimes(2)
  })

  it('hides unknown backend details', async () => {
    mocks.requestCsrfToken.mockResolvedValue('activation-csrf')
    mocks.api.post.mockRejectedValue({
      response: {
        status: 503,
        data: { error: { code: 'PRIVATE_CODE', message: 'private response content' } },
      },
    })

    await expect(activateAccount(input)).rejects.toMatchObject({
      code: 'REQUEST_FAILED',
      message: 'Sharlock is temporarily unavailable. Try again shortly.',
    })
  })

  it('does not send activation after the view leaves during CSRF preparation', async () => {
    let finish
    mocks.requestCsrfToken.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const controller = new AbortController()
    const activation = activateAccount(input, controller.signal)
    controller.abort()
    finish('activation-csrf')
    await expect(activation).rejects.toMatchObject({ code: 'REQUEST_FAILED' })
    expect(mocks.api.post).not.toHaveBeenCalled()
  })
})
