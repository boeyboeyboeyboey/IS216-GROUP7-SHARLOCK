import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  requestCsrfToken: vi.fn(),
}))

vi.mock('../../../services/api.js', () => ({ api: mocks.api }))
vi.mock('../../auth/api.js', () => ({ requestCsrfToken: mocks.requestCsrfToken }))

import {
  createCohort,
  createInstitution,
  createInstructor,
  listCohorts,
  listInstitutions,
  reissueInstructorActivation,
  updateInstructorAssignments,
} from '../api.js'

describe('admin workspace API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses bounded list requests with the optional class institution filter', async () => {
    mocks.api.get.mockResolvedValue({ data: { institutions: [], cohorts: [], page: 1, total: 0 } })

    await listInstitutions()
    await listCohorts({ page: 2, limit: 50, institutionId: '0123456789abcdef01234567' })

    expect(mocks.api.get).toHaveBeenNthCalledWith(1, '/admin/institutions', {
      params: { page: 1, limit: 20 },
      signal: undefined,
    })
    expect(mocks.api.get).toHaveBeenNthCalledWith(2, '/admin/cohorts', {
      params: { page: 2, limit: 50, institutionId: '0123456789abcdef01234567' },
      signal: undefined,
    })
  })

  it('uses a fresh CSRF token and exact payload for each mutation without replay', async () => {
    mocks.requestCsrfToken
      .mockResolvedValueOnce('csrf-one')
      .mockResolvedValueOnce('csrf-two')
      .mockResolvedValueOnce('csrf-three')
      .mockResolvedValueOnce('csrf-four')
      .mockResolvedValueOnce('csrf-five')
    mocks.api.post
      .mockResolvedValueOnce({ data: { id: 'institution-id' } })
      .mockResolvedValueOnce({ data: { id: 'cohort-id' } })
      .mockResolvedValueOnce({
        data: {
          instructor: { id: '0123456789abcdef01234567' },
          activationUrl: `${window.location.origin}/activate-account#token=${'A'.repeat(43)}`,
          expiresAt: '2026-10-16T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        data: {
          activationUrl: `${window.location.origin}/activate-account#token=${'B'.repeat(43)}`,
          expiresAt: '2026-10-16T00:00:00.000Z',
        },
      })
    mocks.api.put.mockResolvedValueOnce({
      data: { instructor: { id: '0123456789abcdef01234567' } },
    })

    const institution = { name: 'Example Academy', slug: 'example-academy' }
    const cohort = {
      institutionId: '0123456789abcdef01234567',
      name: 'Blue Class',
      term: '2026 Term 3',
    }
    const instructor = {
      email: 'teacher@example.test',
      username: 'Example_Teacher',
      avatarId: 'mint',
    }
    const assignments = { cohortIds: ['0123456789abcdef01234567'], expectedRevision: 3 }

    await createInstitution(institution)
    await createCohort(cohort)
    const created = await createInstructor(instructor)
    await reissueInstructorActivation('0123456789abcdef01234567')
    await updateInstructorAssignments('0123456789abcdef01234567', assignments)

    expect(mocks.requestCsrfToken).toHaveBeenCalledTimes(5)
    expect(mocks.api.post).toHaveBeenNthCalledWith(1, '/admin/institutions', institution, {
      signal: undefined,
      headers: { 'X-CSRF-Token': 'csrf-one' },
    })
    expect(mocks.api.post).toHaveBeenNthCalledWith(2, '/admin/cohorts', cohort, {
      signal: undefined,
      headers: { 'X-CSRF-Token': 'csrf-two' },
    })
    expect(mocks.api.post).toHaveBeenNthCalledWith(3, '/admin/instructors', instructor, {
      signal: undefined,
      headers: { 'X-CSRF-Token': 'csrf-three' },
    })
    expect(mocks.api.post).toHaveBeenNthCalledWith(
      4,
      '/admin/instructors/0123456789abcdef01234567/activation',
      undefined,
      { signal: undefined, headers: { 'X-CSRF-Token': 'csrf-four' } },
    )
    expect(mocks.api.put).toHaveBeenCalledWith(
      '/admin/instructors/0123456789abcdef01234567/assignments',
      assignments,
      { signal: undefined, headers: { 'X-CSRF-Token': 'csrf-five' } },
    )
    expect(created.activationUrl).toBe(
      `${window.location.origin}/activate-account#token=${'A'.repeat(43)}`,
    )
    expect(created.activationUrl).not.toContain('?')
  })

  it('rejects unsafe returned activation URLs and maps server errors without raw text', async () => {
    mocks.requestCsrfToken.mockResolvedValue('csrf-one')
    for (const activationUrl of [
      'https://attacker.example/activate-account?token=private',
      `http://operator:private@${window.location.host}/activate-account#token=${'C'.repeat(43)}`,
    ]) {
      mocks.api.post.mockResolvedValueOnce({
        data: { activationUrl, expiresAt: '2026-10-16T00:00:00.000Z' },
      })
      await expect(
        createInstructor({
          email: 'teacher@example.test',
          username: 'Example_Teacher',
          avatarId: 'mint',
        }),
      ).rejects.toMatchObject({ code: 'ADMIN_UNAVAILABLE' })
    }

    mocks.api.post.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { error: { code: 'ADMIN_CONFLICT', message: 'private server detail' } },
      },
    })
    await expect(
      createInstitution({ name: 'Example Academy', slug: 'example-academy' }),
    ).rejects.toMatchObject({
      name: 'AdminApiError',
      code: 'ADMIN_CONFLICT',
      message: 'This change conflicts with existing records. Review the details and try again.',
    })
    expect(mocks.api.post).toHaveBeenCalledTimes(3)
    expect(mocks.requestCsrfToken).toHaveBeenCalledTimes(3)
    expect(mocks.api.post.mock.calls[2][2].headers['X-CSRF-Token']).toBe('csrf-one')
  })
})
