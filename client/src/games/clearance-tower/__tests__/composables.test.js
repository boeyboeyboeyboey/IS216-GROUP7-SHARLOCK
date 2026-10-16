import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { useClearanceTower } from '../composables/useClearanceTower.js'
import { STEP_MS, useDayPlayback } from '../composables/useDayPlayback.js'
import { fetchLevels, startAttempt, submitAttempt } from '../clearanceTower.js'
import {
  findLevel,
  publicLevel,
} from '../../../../../server/src/modules/games/clearance-tower/levels.js'

vi.mock('../clearanceTower.js', async (original) => ({
  ...(await original()),
  fetchLevels: vi.fn(),
  startAttempt: vi.fn(),
  submitAttempt: vi.fn(),
}))

const ATTEMPT = '11111111-1111-4111-8111-111111111111'
const level = publicLevel(findLevel('the-matrix'))

// composables that register lifecycle hooks must run inside a component
function withSetup(composable) {
  let exposed
  const wrapper = mount(
    defineComponent({
      setup() {
        exposed = composable()
        return () => h('div')
      },
    }),
  )
  return { exposed, wrapper }
}

afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('useClearanceTower', () => {
  beforeEach(() => {
    fetchLevels.mockResolvedValue({ levels: [{ id: 'the-matrix' }, { id: 'the-gift' }] })
    startAttempt.mockResolvedValue({ attemptId: ATTEMPT, level })
  })

  it('opens a level with its starting policy and moves through the phases', async () => {
    const { exposed: game } = withSetup(useClearanceTower)
    await game.loadLevels()
    await game.openLevel('the-matrix')
    expect(game.phase.value).toBe('brief')
    expect(game.policy.value).toEqual({ grants: [] })
    expect(game.nextLevelId.value).toBe('the-gift')
    expect(game.allPredicted.value).toBe(false)

    game.predictions.value = { p1: 'deny', p2: 'deny', p3: 'allow' }
    expect(game.allPredicted.value).toBe(true)
    submitAttempt.mockResolvedValue({ levelId: 'the-matrix', score: 85, events: [] })
    await game.runDay()
    expect(submitAttempt).toHaveBeenCalledWith(
      ATTEMPT,
      expect.objectContaining({
        policy: { grants: [] },
        predictions: [
          { id: 'p1', verdict: 'deny' },
          { id: 'p2', verdict: 'deny' },
          { id: 'p3', verdict: 'allow' },
        ],
      }),
      expect.any(AbortSignal),
    )
    expect(game.phase.value).toBe('day')
    expect(game.bestScores.value).toEqual({ 'the-matrix': 85 })
  })

  it('keeps the policy and shows the server message when a run fails, then retries with the same action', async () => {
    const { exposed: game } = withSetup(useClearanceTower)
    await game.openLevel('the-matrix')
    game.policy.value = { grants: [{ subject: 'director', object: 'ops', rights: ['r'] }] }
    game.predictions.value = { p1: 'deny', p2: 'deny', p3: 'allow' }
    submitAttempt.mockRejectedValueOnce({
      response: { data: { error: { message: 'Too many requests. Wait a moment and try again.' } } },
    })
    await game.runDay()
    expect(game.error.value).toBe('Too many requests. Wait a moment and try again.')
    expect(game.phase.value).toBe('brief')
    expect(game.policy.value.grants).toHaveLength(1)
    expect(game.pending.value).toBe(false)

    submitAttempt.mockResolvedValueOnce({ levelId: 'the-matrix', score: 60, events: [] })
    await game.runDay()
    const [first, second] = submitAttempt.mock.calls.map((call) => call[1].actionId)
    expect(second).toBe(first)
    expect(game.error.value).toBe('')
  })

  it('cancels a pending request when the game unmounts', async () => {
    let signal
    startAttempt.mockImplementation((_levelId, received) => {
      signal = received
      return new Promise(() => {})
    })
    const { exposed: game, wrapper } = withSetup(useClearanceTower)
    game.openLevel('the-matrix')
    await flushPromises()
    wrapper.unmount()
    expect(signal.aborted).toBe(true)
  })
})

describe('useDayPlayback', () => {
  const events = ref([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }])

  it('steps through the day on a timer and stops at the end', async () => {
    vi.useFakeTimers()
    const { exposed: day } = withSetup(() => useDayPlayback(events))
    day.play()
    expect(day.shown.value.map((event) => event.id)).toEqual(['e1'])
    vi.advanceTimersByTime(STEP_MS)
    expect(day.current.value.id).toBe('e2')
    day.setSpeed(2)
    vi.advanceTimersByTime(STEP_MS / 2)
    expect(day.finished.value).toBe(true)
    expect(day.playing.value).toBe(false)
  })

  it('steps by hand, skips to the end and clears its timer on unmount', () => {
    vi.useFakeTimers()
    const { exposed: day, wrapper } = withSetup(() => useDayPlayback(events))
    day.step()
    expect(day.index.value).toBe(0)
    day.skip()
    expect(day.shown.value).toHaveLength(3)
    day.reset()
    day.play()
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
