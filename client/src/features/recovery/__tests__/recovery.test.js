import { flushPromises, mount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecoveryIssueForm from '../components/RecoveryIssueForm.vue'
import RecoveryStudentLookup from '../components/RecoveryStudentLookup.vue'
import ResetPasswordForm from '../components/ResetPasswordForm.vue'

const mocks = vi.hoisted(() => ({
  auth: null,
  clearResetLinkCapture: vi.fn(),
  resetLinkCaptureState: null,
  resetPassword: vi.fn(),
  router: { replace: vi.fn() },
  safeRecoveryError: vi.fn((error) => error),
}))

vi.mock('../api.js', () => ({
  resetPassword: mocks.resetPassword,
  safeRecoveryError: mocks.safeRecoveryError,
}))
vi.mock('../../auth/store.js', () => ({ useAuthStore: () => mocks.auth }))
vi.mock('../../../router/index.js', async () => {
  const { reactive: makeReactive } = await import('vue')
  const state = makeReactive({ status: 'missing', token: '' })
  mocks.resetLinkCaptureState = state
  mocks.clearResetLinkCapture.mockImplementation(() => {
    state.status = 'missing'
    state.token = ''
  })
  return {
    clearResetLinkCapture: mocks.clearResetLinkCapture,
    resetLinkCaptureState: state,
  }
})
vi.mock('vue-router', async (importOriginal) => {
  const original = await importOriginal()
  return { ...original, useRouter: () => mocks.router }
})

import ResetPasswordPage from '../pages/ResetPasswordPage.vue'

const student = { id: '111111111111111111111111', username: 'Casey_Student' }
const goodPassword = 'CorrectHorse!Long'

function setValidResetLink() {
  mocks.resetLinkCaptureState.status = 'ready'
  mocks.resetLinkCaptureState.token = 'T'.repeat(43)
}

function setAnonymousAuth() {
  mocks.auth = reactive({
    status: 'anonymous',
    user: null,
    requestError: null,
    restoreSession: vi.fn().mockResolvedValue(null),
    logout: vi.fn(),
  })
}

describe('recovery components and reset flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setAnonymousAuth()
    setValidResetLink()
    mocks.resetPassword.mockResolvedValue(undefined)
    mocks.safeRecoveryError.mockImplementation((error) => error)
  })

  it('requires the school-channel attestation before issuing a link', async () => {
    const wrapper = mount(RecoveryIssueForm, {
      props: { eligibleStudent: student },
    })
    const submit = wrapper.get('button[type="submit"]')
    expect(submit.element.disabled).toBe(true)
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(submit.element.disabled).toBe(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('issue')).toEqual([[{ identityVerified: true }]])
  })

  it('normalizes the lookup email and selects only the returned match', async () => {
    const wrapper = mount(RecoveryStudentLookup, {
      props: { match: { ...student, email: 'casey@example.test' } },
    })
    await wrapper.get('#recovery-student-email').setValue('  casey@example.test  ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('lookup')).toEqual([[{ email: 'casey@example.test' }]])
    await wrapper.get('button[type="button"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([[{ ...student, email: 'casey@example.test' }]])
  })

  it('keeps reset secrets in memory and redirects to normal sign-in after a 204', async () => {
    const wrapper = mount(ResetPasswordPage)
    await flushPromises()
    await wrapper.get('#reset-password').setValue(goodPassword)
    await wrapper.get('#reset-password-confirmation').setValue(goodPassword)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.resetPassword).toHaveBeenCalledWith(
      'T'.repeat(43),
      goodPassword,
      expect.any(AbortSignal),
    )
    expect(mocks.router.replace).toHaveBeenCalledWith({
      path: '/login',
      query: { passwordReset: '1' },
    })
    expect(mocks.clearResetLinkCapture).toHaveBeenCalledTimes(1)
    expect(wrapper.find('#reset-password').exists()).toBe(false)
    expect(wrapper.find('#reset-password-confirmation').exists()).toBe(false)
    expect(wrapper.text()).toContain('Your password was updated. Sign in with your new password.')
    wrapper.unmount()
  })

  it('keeps a signed-in student behind an explicit sign-out step', async () => {
    mocks.auth.status = 'authenticated'
    mocks.auth.user = { id: 'student-id' }
    mocks.auth.restoreSession.mockResolvedValue(mocks.auth.user)
    mocks.auth.logout.mockImplementation(async () => {
      mocks.auth.status = 'anonymous'
      mocks.auth.user = null
    })
    const wrapper = mount(ResetPasswordPage)
    await flushPromises()
    expect(wrapper.find('#reset-password').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.auth.logout).toHaveBeenCalledOnce()
    expect(wrapper.find('#reset-password').exists()).toBe(true)
    expect(mocks.resetLinkCaptureState.token).toBe('T'.repeat(43))
    wrapper.unmount()
  })

  it('shows a generic unavailable message for invalid, expired, or reused links', async () => {
    mocks.resetPassword.mockRejectedValue({
      code: 'RECOVERY_UNAVAILABLE',
      message: 'secret detail',
    })
    const wrapper = mount(ResetPasswordPage)
    await flushPromises()
    await wrapper.get('#reset-password').setValue(goodPassword)
    await wrapper.get('#reset-password-confirmation').setValue(goodPassword)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('#reset-password-error').text()).toBe(
      'This reset link is no longer available. Ask a staff member to prepare a new one.',
    )
    expect(wrapper.text()).not.toContain('secret detail')
    wrapper.unmount()
  })

  it('shows only the minimum password guidance and never truncates user input', async () => {
    const wrapper = mount(ResetPasswordForm)
    const input = wrapper.get('#reset-password')
    expect(input.attributes('maxlength')).toBeUndefined()
    expect(wrapper.get('#reset-password-hint').text()).toContain('at least 12 characters')
    expect(wrapper.text()).not.toMatch(/12\s*[–-]\s*128|128 characters/i)
    await input.setValue('x'.repeat(150))
    expect(input.element.value).toHaveLength(150)
    wrapper.unmount()
  })
})
