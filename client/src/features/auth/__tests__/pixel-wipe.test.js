import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enterTown, playPixelWipe, WIPE_PHASE_MS, wipe } from '../pixel-wipe.js'

function stubMotion({ reduced = false } = {}) {
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0))
}

beforeEach(() => {
  vi.useFakeTimers()
  stubMotion()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  wipe.phase = 'idle'
})

describe('playPixelWipe', () => {
  it('covers the screen, navigates underneath, then reveals and returns to idle', async () => {
    const navigate = vi.fn().mockResolvedValue('arrived')
    const run = playPixelWipe(navigate)

    expect(wipe.phase).toBe('cover')
    expect(navigate).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(WIPE_PHASE_MS)
    expect(navigate).toHaveBeenCalledTimes(1)

    // the new page gets two frames to paint before the blocks clear
    await vi.advanceTimersByTimeAsync(10)
    expect(wipe.phase).toBe('reveal')

    await vi.advanceTimersByTimeAsync(WIPE_PHASE_MS)
    await expect(run).resolves.toBe('arrived')
    expect(wipe.phase).toBe('idle')
  })

  it('skips the animation entirely for reduced motion', async () => {
    stubMotion({ reduced: true })
    const navigate = vi.fn().mockResolvedValue('arrived')

    await expect(playPixelWipe(navigate)).resolves.toBe('arrived')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(wipe.phase).toBe('idle')
  })

  it('never leaves the overlay on screen when navigation fails', async () => {
    const run = playPixelWipe(vi.fn().mockRejectedValue(new Error('navigation failed')))
    const settled = expect(run).rejects.toThrow('navigation failed')
    await vi.advanceTimersByTimeAsync(WIPE_PHASE_MS)
    await settled
    expect(wipe.phase).toBe('idle')

    // and a later sign-in can play it again
    const again = playPixelWipe(vi.fn().mockResolvedValue('ok'))
    expect(wipe.phase).toBe('cover')
    await vi.advanceTimersByTimeAsync(WIPE_PHASE_MS + 10 + WIPE_PHASE_MS)
    await expect(again).resolves.toBe('ok')
  })

  it('does not start a second wipe while one is playing', async () => {
    const first = playPixelWipe(vi.fn().mockResolvedValue('first'))
    const secondNavigate = vi.fn().mockResolvedValue('second')

    await expect(playPixelWipe(secondNavigate)).resolves.toBe('second')
    expect(secondNavigate).toHaveBeenCalledTimes(1)
    expect(wipe.phase).toBe('cover')

    await vi.advanceTimersByTimeAsync(WIPE_PHASE_MS + 10 + WIPE_PHASE_MS)
    await first
    expect(wipe.phase).toBe('idle')
  })
})

describe('enterTown', () => {
  const router = () => ({ replace: vi.fn().mockResolvedValue(undefined) })

  it.each(['/', { path: '/' }, { path: '/', query: { classRequest: 'pending' } }, '/?x=1'])(
    'plays the wipe when the destination is the town page (%j)',
    async (destination) => {
      const target = router()
      const run = enterTown(target, destination)
      expect(wipe.phase).toBe('cover')
      await vi.advanceTimersByTimeAsync(WIPE_PHASE_MS + 10 + WIPE_PHASE_MS)
      await run
      expect(target.replace).toHaveBeenCalledWith(destination)
    },
  )

  it.each(['/join-class?onboarding=1', '/join-class', { path: '/classes' }])(
    'goes straight to other pages without a wipe (%j)',
    async (destination) => {
      const target = router()
      await enterTown(target, destination)
      expect(wipe.phase).toBe('idle')
      expect(target.replace).toHaveBeenCalledWith(destination)
    },
  )
})
