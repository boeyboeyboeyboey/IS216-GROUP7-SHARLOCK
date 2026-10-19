import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn() },
  requestCsrfToken: vi.fn(),
}))

vi.mock('../services/api.js', () => ({ api: mocks.api }))
vi.mock('../features/auth/api.js', () => ({ requestCsrfToken: mocks.requestCsrfToken }))

const {
  attemptErrorCode,
  attemptErrorMessage,
  completeAttempt,
  newActionId,
  readAttempt,
  sendAttemptAction,
  startAttempt,
} = await import('../services/attempts.js')

afterEach(() => vi.clearAllMocks())

describe('shared saved-attempt requests', () => {
  it('starts a personal attempt with a fresh csrf token', async () => {
    mocks.requestCsrfToken.mockResolvedValue('csrf-1')
    mocks.api.post.mockResolvedValue({ data: { attemptId: 'a1' } })
    await expect(startAttempt('phishing-post-mortem')).resolves.toEqual({ attemptId: 'a1' })
    const [path, body, options] = mocks.api.post.mock.calls[0]
    expect(path).toBe('/games/phishing-post-mortem/attempts')
    expect(body).toEqual({ context: { kind: 'personal' } })
    expect(options.headers).toEqual({ 'X-CSRF-Token': 'csrf-1' })
  })

  it('sends exactly the action envelope and the completion request', async () => {
    mocks.requestCsrfToken.mockResolvedValue('csrf-2')
    mocks.api.post.mockResolvedValue({ data: {} })
    await sendAttemptAction('a1', {
      actionId: 'id-1',
      expectedRevision: 0,
      type: 'submit-verdict',
      payload: { selectedEmailId: 'a11', evidenceIds: ['x', 'y'] },
      extra: 'dropped',
    })
    await completeAttempt('a1', { actionId: 'id-2', expectedRevision: 1, score: 100 })
    expect(mocks.api.post.mock.calls[0].slice(0, 2)).toEqual([
      '/attempts/a1/actions',
      {
        actionId: 'id-1',
        expectedRevision: 0,
        type: 'submit-verdict',
        payload: { selectedEmailId: 'a11', evidenceIds: ['x', 'y'] },
      },
    ])
    expect(mocks.api.post.mock.calls[1].slice(0, 2)).toEqual([
      '/attempts/a1/complete',
      { actionId: 'id-2', expectedRevision: 1 },
    ])
  })

  it('reads an attempt without a csrf request', async () => {
    mocks.api.get.mockResolvedValue({ data: { status: 'completed' } })
    await expect(readAttempt('a1')).resolves.toEqual({ status: 'completed' })
    expect(mocks.api.get.mock.calls[0][0]).toBe('/attempts/a1')
    expect(mocks.requestCsrfToken).not.toHaveBeenCalled()
  })

  it('stops before posting when the request was cancelled', async () => {
    const controller = new AbortController()
    mocks.requestCsrfToken.mockImplementation(async () => {
      controller.abort()
      return 'csrf-3'
    })
    await expect(
      startAttempt('phishing-post-mortem', { signal: controller.signal }),
    ).rejects.toThrow()
    expect(mocks.api.post).not.toHaveBeenCalled()
  })

  it('builds a v4 uuid when randomUUID is unavailable on an insecure page', () => {
    const original = globalThis.crypto.randomUUID
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true })
    try {
      expect(newActionId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: original,
        configurable: true,
      })
    }
  })

  it('creates uuid action ids and reads safe error fields', () => {
    expect(newActionId()).toMatch(/^[0-9a-f-]{36}$/)
    const error = { response: { data: { error: { code: 'ATTEMPT_CLOSED', message: 'Ended.' } } } }
    expect(attemptErrorCode(error)).toBe('ATTEMPT_CLOSED')
    expect(attemptErrorMessage(error, 'fallback')).toBe('Ended.')
    expect(attemptErrorCode(new Error('offline'))).toBe('')
    expect(attemptErrorMessage(new Error('offline'), 'fallback')).toBe('fallback')
  })
})
