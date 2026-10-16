import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ClassManagementPage from '../pages/ClassManagementPage.vue'

const mocks = vi.hoisted(() => ({
  getEnrollmentCode: vi.fn(),
  issueValidatedEnrollmentCode: vi.fn(),
  listCohortMemberships: vi.fn(),
  listManagedCohorts: vi.fn(),
  revokeEnrollmentCode: vi.fn(),
  safeError: (error) => error,
  updateMembership: vi.fn(),
}))
vi.mock('../api.js', () => mocks)

describe('instructor class management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listManagedCohorts.mockResolvedValue({
      cohorts: [
        { cohortId: 'class-a', cohortName: 'Blue Class', institutionName: 'Academy' },
        { cohortId: 'class-b', cohortName: 'Green Class', institutionName: 'Academy' },
      ],
      total: 2,
    })
    mocks.listCohortMemberships.mockResolvedValue({ memberships: [], total: 0 })
    mocks.getEnrollmentCode.mockResolvedValue({ code: null, revision: 0 })
    mocks.issueValidatedEnrollmentCode.mockResolvedValue({
      id: 'code-a',
      revision: 1,
      expiresAt: '2099-01-01T00:00:00.000Z',
      rawCode: 'ABCDEFGHJKLMPQRS',
      code: { id: 'code-a', expiresAt: '2099-01-01T00:00:00.000Z', revokedAt: null },
    })
  })

  it('clears a one-time code on class change and locks switching during a code mutation', async () => {
    const wrapper = mount(ClassManagementPage)
    await flushPromises()
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('ABCD-EFGH-JKLM-PQRS')
    await wrapper.get('#managed-class').setValue('class-b')
    await flushPromises()
    expect(wrapper.text()).not.toContain('ABCD-EFGH-JKLM-PQRS')
    expect(mocks.getEnrollmentCode).toHaveBeenLastCalledWith('class-b', expect.any(AbortSignal))
    wrapper.unmount()
  })

  it('disables class switching while a code issue request is unresolved', async () => {
    let resolveIssue
    mocks.issueValidatedEnrollmentCode.mockReturnValue(
      new Promise((resolve) => {
        resolveIssue = resolve
      }),
    )
    const wrapper = mount(ClassManagementPage)
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().includes('Generate code'))
      .trigger('click')
    expect(wrapper.get('#managed-class').element.disabled).toBe(true)
    resolveIssue({
      id: 'code-a',
      revision: 1,
      expiresAt: '2099-01-01T00:00:00.000Z',
      rawCode: 'ABCDEFGHJKLMPQRS',
      code: { id: 'code-a', expiresAt: '2099-01-01T00:00:00.000Z', revokedAt: null },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('ABCD-EFGH-JKLM-PQRS')
    wrapper.unmount()
  })
})
