import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../../auth/store.js'
import ActivationPage from '../pages/ActivationPage.vue'

const activationMocks = vi.hoisted(() => {
  class TestActivationApiError extends Error {
    constructor(code, message) {
      super(message)
      this.name = 'ActivationApiError'
      this.code = code
    }
  }
  return {
    ActivationApiError: TestActivationApiError,
    activateAccount: vi.fn(),
  }
})

vi.mock('../api.js', () => activationMocks)

const token = 'A'.repeat(43)
const routeStub = { template: '<div>Route</div>' }

async function mountActivation(path, { blockReplace = false } = {}) {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/activate-account', component: routeStub },
      { path: '/login', component: routeStub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore(pinia)
  auth.restoreSession = vi.fn(async () => {
    expect(window.location.hash).toBe('')
    return auth.user
  })
  if (blockReplace) router.replace = vi.fn().mockRejectedValue(new Error('private route error'))
  const wrapper = mount(ActivationPage, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, pinia, auth }
}

describe('instructor activation page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.replaceState(null, '', '/')
    activationMocks.activateAccount.mockResolvedValue(undefined)
  })

  it('strips the token fragment before showing the form and posts only password and token', async () => {
    const { wrapper, router, auth } = await mountActivation(`/activate-account#token=${token}`)

    expect(router.currentRoute.value.hash).toBe('')
    expect(window.location.hash).toBe('')
    expect(auth.restoreSession).toHaveBeenCalledWith({ force: true })
    expect(activationMocks.activateAccount).not.toHaveBeenCalled()

    await wrapper.get('#activation-password').setValue('AlphaBravo1!')
    await wrapper.get('#activation-confirmation').setValue('AlphaBravo1!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(activationMocks.activateAccount).toHaveBeenCalledTimes(1)
    expect(activationMocks.activateAccount).toHaveBeenCalledWith(
      {
        token,
        password: 'AlphaBravo1!',
      },
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('Your account is ready')
    expect(wrapper.text()).toContain('Continue to sign in')
    expect(wrapper.html()).not.toContain(token)
    expect(window.location.href).not.toContain(token)
    expect(wrapper.find('#activation-password').exists()).toBe(false)
    wrapper.unmount()
    expect(activationMocks.activateAccount.mock.calls[0][1].aborted).toBe(true)
  })

  it('keeps confirmation local and blocks password mismatch or invalid composition', async () => {
    const { wrapper } = await mountActivation(`/activate-account#token=${token}`)
    await wrapper.get('#activation-password').setValue('AlphaBravo1!')
    await wrapper.get('#activation-confirmation').setValue('AlphaBravo2!')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('#activation-confirmation-error').text()).toBe('Passwords must match.')
    expect(activationMocks.activateAccount).not.toHaveBeenCalled()

    await wrapper.get('#activation-password').setValue('AlphaBravo12')
    await wrapper.get('#activation-confirmation').setValue('AlphaBravo12')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.get('#activation-password').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('#activation-password-error').text()).toContain('special character')
    expect(activationMocks.activateAccount).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it.each([
    ['/activate-account#token=too-short', 'fragment'],
    [`/activate-account?token=${token}`, 'query string'],
  ])('rejects a token supplied through the %s and clears it', async (path) => {
    const { wrapper, router } = await mountActivation(path)

    expect(wrapper.text()).toContain('This activation link is unavailable')
    expect(router.currentRoute.value.fullPath).toBe('/activate-account')
    expect(window.location.href).not.toContain(token)
    expect(activationMocks.activateAccount).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not check the session when fragment removal fails', async () => {
    const { wrapper, auth } = await mountActivation(`/activate-account#token=${token}`, {
      blockReplace: true,
    })

    expect(auth.restoreSession).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('This activation link is unavailable')
    expect(activationMocks.activateAccount).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('offers explicit sign-out before sign-in when another account is already active', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore(pinia)
    auth.user = { id: '0123456789abcdef01234567', username: 'Synthetic_Admin' }
    auth.status = 'authenticated'
    auth.restoreSession = vi.fn().mockResolvedValue(auth.user)
    auth.logout = vi.fn().mockResolvedValue(undefined)
    const router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/activate-account', component: routeStub },
        { path: '/login', component: routeStub },
      ],
    })
    await router.push(`/activate-account#token=${token}`)
    await router.isReady()
    const wrapper = mount(ActivationPage, { global: { plugins: [pinia, router] } })
    await flushPromises()
    await wrapper.get('#activation-password').setValue('AlphaBravo1!')
    await wrapper.get('#activation-confirmation').setValue('AlphaBravo1!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(auth.logout).not.toHaveBeenCalled()
    expect(wrapper.get('button').text()).toContain('Sign out and go to sign in')
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(auth.logout).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.path).toBe('/login')
    wrapper.unmount()
  })
})
