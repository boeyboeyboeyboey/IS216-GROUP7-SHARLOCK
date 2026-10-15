import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getEnrollment: vi.fn(),
  holdClassInvitation: vi.fn(),
  safeError: (error) => error,
}))
vi.mock('../api.js', () => mocks)
import {
  captureInvitationCodeFromLocation,
  captureInvitationCode,
  clearPendingInvitation,
  consumeAutomaticJoin,
  getInvitationJoinInput,
  normalizeInvitationCode,
  prepareInvitation,
  resolveEnrollmentDestination,
} from '../journey.js'

describe('class invitation journey', () => {
  beforeEach(() => {
    clearPendingInvitation()
    mocks.getEnrollment.mockReset()
    mocks.holdClassInvitation.mockReset()
    window.history.replaceState({}, '', '/join-class')
  })

  it('normalizes only the code alphabet and strips the bearer fragment synchronously', async () => {
    expect(normalizeInvitationCode('abcd-efgh-jklm-pqrs')).toBe('ABCDEFGHJKLMPQRS')
    expect(normalizeInvitationCode('ABCD-0000-JKLM-PQRS')).toBeNull()
    window.history.replaceState({}, '', '/join-class?x=1#code=abcd-efgh-jklm-pqrs')
    expect(captureInvitationCodeFromLocation()).toBe('ABCDEFGHJKLMPQRS')
    expect(window.location.href).toBe(`${window.location.origin}/join-class?x=1`)
    expect(captureInvitationCodeFromLocation()).toBeNull()
    mocks.holdClassInvitation.mockResolvedValueOnce(undefined)
    await expect(prepareInvitation()).resolves.toBe(true)
    expect(mocks.holdClassInvitation).toHaveBeenCalledWith('ABCDEFGHJKLMPQRS', undefined)
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('sends a captured invitation once and retains it in memory after a failed store request', async () => {
    window.history.replaceState({}, '', '/join-class#code=ABCDEFGHJKLMPQRS')
    captureInvitationCodeFromLocation()
    mocks.holdClassInvitation
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
    await expect(prepareInvitation()).rejects.toThrow('offline')
    await expect(prepareInvitation()).resolves.toBe(true)
    await expect(prepareInvitation()).resolves.toBe(false)
    expect(mocks.holdClassInvitation).toHaveBeenCalledTimes(2)
    expect(mocks.holdClassInvitation).toHaveBeenLastCalledWith('ABCDEFGHJKLMPQRS', undefined)
    expect(getInvitationJoinInput()).toEqual({ code: 'ABCDEFGHJKLMPQRS' })
  })

  it('keeps this tab’s held code when another tab replaces the server draft', async () => {
    captureInvitationCode('ABCDEFGHJKLMPQRS')
    mocks.holdClassInvitation.mockResolvedValueOnce(undefined)
    await prepareInvitation()
    // a second tab may replace the server draft with another invitation
    expect(getInvitationJoinInput()).toEqual({ code: 'ABCDEFGHJKLMPQRS' })
  })

  it('strips and refuses query-string, duplicate, and extra fragment values', () => {
    window.history.replaceState({}, '', '/join-class?code=ABCDEFGHJKLMPQRS&safe=1')
    expect(captureInvitationCodeFromLocation()).toBeNull()
    expect(window.location.search).toBe('?safe=1')
    window.history.replaceState({}, '', '/join-class?code=ABCDEFGHJKLMPQRS#code=ABCDEFGHJKLMPQRS')
    expect(captureInvitationCodeFromLocation()).toBeNull()
    expect(window.location.href).toBe(`${window.location.origin}/join-class`)
    window.history.replaceState({}, '', '/join-class#code=ABCDEFGHJKLMPQRS&code=ABCDEFGHJKLMPQRS')
    expect(captureInvitationCodeFromLocation()).toBeNull()
    expect(window.location.hash).toBe('')
    window.history.replaceState({}, '', '/join-class#code=ABCDEFGHJKLMPQRS&next=town')
    expect(captureInvitationCodeFromLocation()).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('leaves activation fragments untouched for the activation flow', () => {
    window.history.replaceState({}, '', '/activate-account#token=private-value')
    expect(captureInvitationCodeFromLocation()).toBeNull()
    expect(window.location.hash).toBe('#token=private-value')
  })

  it('routes class links, unfinished student onboarding, and staff without browser persistence', async () => {
    captureInvitationCode('ABCDEFGHJKLMPQRS')
    mocks.holdClassInvitation.mockResolvedValueOnce(undefined)
    await prepareInvitation()
    mocks.getEnrollment.mockResolvedValueOnce({ hasInvitation: true })
    await expect(resolveEnrollmentDestination({ globalRoles: ['student'] })).resolves.toBe(
      '/join-class',
    )
    expect(consumeAutomaticJoin()).toBe(false)
    mocks.getEnrollment.mockResolvedValueOnce({ hasInvitation: true })
    await expect(
      resolveEnrollmentDestination({ globalRoles: ['student'] }, { afterAccountAccess: true }),
    ).resolves.toBe('/join-class?carry=1')
    expect(consumeAutomaticJoin()).toBe(true)
    expect(consumeAutomaticJoin()).toBe(false)
    mocks.getEnrollment.mockResolvedValueOnce({ hasInvitation: false, onboardingCompleted: false })
    await expect(resolveEnrollmentDestination({ globalRoles: ['student'] })).resolves.toBe(
      '/join-class?onboarding=1',
    )
    await expect(resolveEnrollmentDestination({ globalRoles: ['instructor'] })).resolves.toBe('/')
    expect(mocks.getEnrollment).toHaveBeenCalledTimes(3)
  })
})
