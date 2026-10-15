import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'

const mocks = vi.hoisted(() => ({
  user: { id: 'student', globalRoles: ['student'] },
  login: vi.fn(),
  register: vi.fn(),
  replace: vi.fn(),
  resolve: vi.fn(),
}))
vi.mock('../store.js', () => ({ useAuthStore: () => ({
  user: mocks.user,
  login: mocks.login,
  register: mocks.register,
  requestError: null,
}) }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('../../cohorts/journey.js', () => ({ resolveEnrollmentDestination: mocks.resolve }))

const Form = defineComponent({
  emits: ['submit'],
  setup(_props, { emit, expose }) {
    expose({ clearSecrets: vi.fn() })
    return () => h('button', { onClick: () => emit('submit', { email: 'student@example.test' }) }, 'Submit credentials')
  },
})
const wrappers = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.login.mockResolvedValue(mocks.user)
  mocks.register.mockResolvedValue(mocks.user)
  mocks.replace.mockResolvedValue()
})

describe('account enrollment continuation', () => {
  it.each([
    ['login', LoginPage],
    ['register', RegisterPage],
  ])('retries class setup without repeating %s credentials', async (operation, Page) => {
    mocks.resolve.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce('/join-class?onboarding=1')
    const wrapper = mount(Page, { global: { stubs: {
      LoginForm: Form, RegisterForm: Form, RouterLink: true, PixelIcon: true, SessionNotice: true,
    } } })
    wrappers.push(wrapper)
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('Class setup is unavailable')
    expect(mocks[operation]).toHaveBeenCalledOnce()
    expect(mocks.resolve).toHaveBeenCalledWith(mocks.user, expect.objectContaining({ afterAccountAccess: true }))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks[operation]).toHaveBeenCalledOnce()
    expect(mocks.replace).toHaveBeenCalledWith('/join-class?onboarding=1')
  })

  it('cancels continuation on departure and does not navigate after a stale response', async () => {
    let finish
    mocks.resolve.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const wrapper = mount(LoginPage, { global: { stubs: {
      LoginForm: Form, RouterLink: true, PixelIcon: true, SessionNotice: true,
    } } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    const signal = mocks.resolve.mock.calls[0][1].signal
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
    finish('/join-class?carry=1')
    await flushPromises()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
