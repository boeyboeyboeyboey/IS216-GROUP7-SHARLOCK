import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPage from '../pages/AdminPage.vue'
import InstitutionCohortForm from '../components/InstitutionCohortForm.vue'
import InstructorProvisionForm from '../components/InstructorProvisionForm.vue'

const mocks = vi.hoisted(() => {
  class TestAdminApiError extends Error {
    constructor(code, message) {
      super(message)
      this.name = 'AdminApiError'
      this.code = code
    }
  }
  return {
    AdminApiError: TestAdminApiError,
    listInstitutions: vi.fn(),
    listCohorts: vi.fn(),
    listInstructors: vi.fn(),
    createInstitution: vi.fn(),
    createCohort: vi.fn(),
    createInstructor: vi.fn(),
    reissueInstructorActivation: vi.fn(),
    updateInstructorAssignments: vi.fn(),
  }
})

vi.mock('../api.js', () => mocks)

const recoveryMocks = vi.hoisted(() => ({
  issueAdminRecovery: vi.fn(),
  lookupStudent: vi.fn(),
  safeRecoveryError: (error) => error,
}))
vi.mock('../../recovery/api.js', () => recoveryMocks)

const institution = {
  id: '111111111111111111111111',
  name: 'Synthetic Academy',
  slug: 'synthetic-academy',
  status: 'active',
}
const cohort = {
  id: '222222222222222222222222',
  institutionId: institution.id,
  institutionName: institution.name,
  name: 'Blue Class',
  term: '2026 Term 3',
  status: 'active',
}
const instructor = {
  id: '333333333333333333333333',
  email: 'teacher@example.test',
  username: 'Synthetic_Teacher',
  avatarId: 'mint',
  accountStatus: 'active',
  assignmentRevision: 1,
  cohortIds: [],
}

function setDefaultLists({ instructorRows = [], institutionRows = [institution] } = {}) {
  mocks.listInstitutions.mockResolvedValue({
    institutions: institutionRows,
    page: 1,
    total: institutionRows.length,
  })
  mocks.listCohorts.mockImplementation(async ({ limit }) => ({
    cohorts: limit === 50 ? [cohort] : [cohort],
    page: 1,
    total: 1,
  }))
  mocks.listInstructors.mockResolvedValue({
    instructors: instructorRows,
    page: 1,
    total: instructorRows.length,
  })
}

describe('admin workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultLists()
    mocks.createInstitution.mockResolvedValue({ id: institution.id })
    mocks.createCohort.mockResolvedValue({ id: cohort.id })
    mocks.createInstructor.mockResolvedValue({ instructor })
    recoveryMocks.lookupStudent.mockResolvedValue({ student: null })
    recoveryMocks.issueAdminRecovery.mockResolvedValue({
      resetUrl: `http://localhost:5174/reset-password#token=${'R'.repeat(43)}`,
      expiresAt: '2099-01-01T00:00:00.000Z',
    })
  })

  it('emits only the approved institution and class fields', async () => {
    const wrapper = mount(InstitutionCohortForm, {
      props: {
        institutions: [institution],
        selectedInstitutionId: institution.id,
      },
    })
    await wrapper.get('#admin-institution-name').setValue('Synthetic Academy')
    await wrapper.get('#admin-institution-slug').setValue('synthetic-academy')
    await wrapper.findAll('form')[0].trigger('submit')

    await wrapper.get('#admin-cohort-institution').setValue(institution.id)
    await wrapper.get('#admin-cohort-name').setValue('Blue Class')
    await wrapper.get('#admin-cohort-term').setValue('2026 Term 3')
    await wrapper.findAll('form')[1].trigger('submit')

    expect(wrapper.emitted('create-institution')[0][0]).toEqual({
      name: 'Synthetic Academy',
      slug: 'synthetic-academy',
    })
    expect(wrapper.emitted('create-cohort')[0][0]).toEqual({
      institutionId: institution.id,
      name: 'Blue Class',
      term: '2026 Term 3',
    })
    wrapper.unmount()
  })

  it('shows the shared 32-character username limit for instructor setup', async () => {
    const wrapper = mount(InstructorProvisionForm)
    const username = wrapper.get('#admin-instructor-username')
    expect(username.attributes('maxlength')).toBe('32')
    expect(wrapper.get('#admin-instructor-username-hint').text()).toContain('3–32')

    await wrapper.get('#admin-instructor-email').setValue('teacher@example.test')
    await username.setValue('A'.repeat(32))
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('provision')[0][0]).toEqual({
      email: 'teacher@example.test',
      username: 'A'.repeat(32),
      avatarId: 'mint',
    })
    wrapper.unmount()
  })

  it('shows the one-time link after provisioning and clears it when the dialog closes', async () => {
    const activationUrl = `http://localhost:5174/activate-account#token=${'C'.repeat(43)}`
    mocks.createInstructor.mockResolvedValueOnce({
      instructor,
      activationUrl,
      expiresAt: '2026-10-16T00:00:00.000Z',
    })
    const wrapper = mount(AdminPage)
    await flushPromises()

    await wrapper.get('#admin-instructor-email').setValue('teacher@example.test')
    await wrapper.get('#admin-instructor-username').setValue('Synthetic_Teacher')
    await wrapper
      .findAll('form')
      .find((form) => form.text().includes('Instructor email'))
      .trigger('submit')
    await flushPromises()

    expect(mocks.createInstructor).toHaveBeenCalledWith(
      { email: 'teacher@example.test', username: 'Synthetic_Teacher', avatarId: 'mint' },
      expect.any(AbortSignal),
    )
    expect(wrapper.get('#admin-activation-link').element.value).toBe(activationUrl)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Close and clear link')
      .trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('C'.repeat(43))
    wrapper.unmount()
  })

  it('preserves a stale assignment draft until the administrator reloads it manually', async () => {
    setDefaultLists({ instructorRows: [instructor] })
    mocks.updateInstructorAssignments.mockRejectedValue(
      new mocks.AdminApiError('ADMIN_STALE_ASSIGNMENTS', 'private backend detail'),
    )
    const wrapper = mount(AdminPage)
    await flushPromises()

    const checkbox = wrapper.get('.admin-workspace__assignment input')
    await checkbox.setValue(true)
    const saveButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Save assignments'))
    await saveButton.trigger('click')
    await flushPromises()

    expect(mocks.updateInstructorAssignments).toHaveBeenCalledWith(
      instructor.id,
      { cohortIds: [cohort.id], expectedRevision: 1 },
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('Your draft is preserved.')
    expect(checkbox.element.checked).toBe(true)
    expect(mocks.listInstructors).toHaveBeenCalledTimes(1)

    mocks.listInstructors.mockResolvedValueOnce({
      instructors: [{ ...instructor, assignmentRevision: 2, cohortIds: [] }],
      page: 1,
      total: 1,
    })
    const reloadButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reload assignments')
    await reloadButton.trigger('click')
    await flushPromises()

    expect(checkbox.element.checked).toBe(false)
    expect(mocks.listInstructors).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('looks up the exact student, requires attestation, and clears the issued link on close', async () => {
    const target = {
      id: '444444444444444444444444',
      username: 'Casey_Student',
      email: 'casey@example.test',
      avatarId: 'mint',
    }
    recoveryMocks.lookupStudent.mockResolvedValueOnce({ student: target })
    const wrapper = mount(AdminPage)
    await flushPromises()

    await wrapper.get('#recovery-student-email').setValue(target.email)
    await wrapper.get('.recovery-lookup').trigger('submit')
    await flushPromises()
    expect(recoveryMocks.lookupStudent).toHaveBeenCalledWith(target.email, expect.any(AbortSignal))
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Select student')
      .trigger('click')
    const checkbox = wrapper.get('input[type="checkbox"]')
    expect(wrapper.get('.recovery-issue-form button[type="submit"]').element.disabled).toBe(true)
    await checkbox.setValue(true)
    await wrapper.get('.recovery-issue-form').trigger('submit')
    await flushPromises()

    expect(recoveryMocks.issueAdminRecovery).toHaveBeenCalledWith(
      target.id,
      expect.any(AbortSignal),
    )
    expect(wrapper.get('dialog').text()).toContain('Deliver this reset link privately')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Close and clear link')
      .trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.find('input#recovery-link-value').exists()).toBe(false)
    expect(wrapper.find('.recovery-issue-form').exists()).toBe(true)
    expect(wrapper.find('.recovery-issue-form input[type="checkbox"]').element.checked).toBe(true)
    wrapper.unmount()
  })
})
