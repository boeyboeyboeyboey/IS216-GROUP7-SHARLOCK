import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  clearClassInvitation: vi.fn(),
  completeOnboarding: vi.fn(),
  getEnrollment: vi.fn(),
  joinClass: vi.fn(),
  safeError: (error) => error,
  replace: vi.fn(),
  push: vi.fn(),
  restoreSession: vi.fn(),
  route: { query: { carry: '1' } },
  consumeAutomaticJoin: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}))
vi.mock('../../auth/store.js', () => ({
  useAuthStore: () => ({ status: 'authenticated', restoreSession: mocks.restoreSession }),
}))
vi.mock('../api.js', () => ({
  clearClassInvitation: mocks.clearClassInvitation,
  completeOnboarding: mocks.completeOnboarding,
  getEnrollment: mocks.getEnrollment,
  joinClass: mocks.joinClass,
  safeError: mocks.safeError,
}))
vi.mock('../journey.js', () => ({
  captureInvitationCodeFromLocation: vi.fn(),
  captureInvitationCode: vi.fn(),
  clearHeldInvitation: vi.fn(),
  clearPendingInvitation: vi.fn(),
  consumeAutomaticJoin: mocks.consumeAutomaticJoin,
  getInvitationJoinInput: () => ({ invitation: true }),
  prepareInvitation: vi.fn().mockResolvedValue(false),
}))

import JoinClassPage from '../pages/JoinClassPage.vue'

describe('join class page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.route.query = { carry: '1' }
    mocks.consumeAutomaticJoin.mockReturnValue(true)
    mocks.getEnrollment.mockResolvedValue({ hasInvitation: true })
    mocks.restoreSession.mockResolvedValue(undefined)
    mocks.joinClass.mockRejectedValue(new Error('The class invitation has expired.'))
    mocks.clearClassInvitation.mockResolvedValue(undefined)
    mocks.completeOnboarding.mockResolvedValue(undefined)
  })

  it('keeps Skip available after a carried invitation fails and clears it before onboarding', async () => {
    const wrapper = mount(JoinClassPage)
    await flushPromises()

    const skip = wrapper
      .findAll('button')
      .find((button) => button.text().includes('Skip and explore Sharlock'))
    expect(skip).toBeDefined()
    await skip.trigger('click')
    await flushPromises()

    expect(mocks.clearClassInvitation).toHaveBeenCalledOnce()
    expect(mocks.completeOnboarding).toHaveBeenCalledOnce()
    expect(mocks.clearClassInvitation.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.completeOnboarding.mock.invocationCallOrder[0],
    )
    expect(mocks.replace).toHaveBeenLastCalledWith('/')
  })
})
