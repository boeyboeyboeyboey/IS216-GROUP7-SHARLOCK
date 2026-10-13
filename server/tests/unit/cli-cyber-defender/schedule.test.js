import { describe, expect, it } from 'vitest'
import { randomInt } from 'node:crypto'
import { MAX_SCORE } from '../../../src/modules/games/cli-cyber-defender/policy.js'
import {
  deriveProgress,
  generateWindows,
  pointsFor,
} from '../../../src/modules/games/cli-cyber-defender/schedule.js'

function run({ mode = 'timed', windows = [5, 5, 5, 5, 10, 10, 10, 10], resolutions = [] } = {}) {
  return {
    mode,
    startedAt: 0,
    endedAt: null,
    incidents: windows.map((windowSeconds, index) => ({
      id: `incident-0${index + 1}`,
      windowSeconds,
      resolution: resolutions[index] ?? null,
    })),
  }
}

describe('incident windows', () => {
  it('always produces eight integer windows of 10-15 seconds totalling 100', () => {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const windows = generateWindows(randomInt)
      expect(windows).toHaveLength(8)
      expect(
        windows.every((seconds) => Number.isInteger(seconds) && seconds >= 10 && seconds <= 15),
      ).toBe(true)
      expect(windows.reduce((total, seconds) => total + seconds, 0)).toBe(100)
    }
  })

  it('reaches both extremes with a biased source', () => {
    expect(generateWindows(() => 0)).toEqual([15, 15, 15, 15, 10, 10, 10, 10])
  })
})

describe('progress derivation', () => {
  it('scores 100, 200, then 300 per correct command for a maximum of 2,100', () => {
    expect([1, 2, 3, 4].map(pointsFor)).toEqual([100, 200, 300, 300])
    const resolutions = Array.from({ length: 8 }, (_, index) => ({
      at: (index + 1) * 1000,
      outcome: 'correct',
    }))
    const progress = deriveProgress(run({ resolutions }), 9000)
    expect(progress.score).toBe(2100)
    expect(progress.score).toBe(MAX_SCORE)
    expect(progress.finished).toBe(true)
    expect(progress.bestStreak).toBe(8)
  })

  it('resets the streak after a wrong command', () => {
    const progress = deriveProgress(
      run({
        resolutions: [
          { at: 1000, outcome: 'correct' },
          { at: 2000, outcome: 'correct' },
          { at: 3000, outcome: 'wrong' },
          { at: 4000, outcome: 'correct' },
        ],
      }),
      4500,
    )
    expect(progress.incidents.slice(0, 4).map((item) => item.pointsAwarded)).toEqual([
      100, 200, 0, 100,
    ])
    expect(progress.streak).toBe(1)
    expect(progress.multiplier).toBe(2)
    expect(progress.current.index).toBe(4)
    expect(progress.current.opensAt).toBe(4000)
    expect(progress.current.closesAt).toBe(14000)
  })

  it('opens the next incident as soon as the previous one resolves', () => {
    const progress = deriveProgress(run({ resolutions: [{ at: 1200, outcome: 'correct' }] }), 1300)
    expect(progress.current).toMatchObject({ index: 1, opensAt: 1200, closesAt: 6200 })
  })

  it('treats the exact deadline as missed and advances by the window', () => {
    const atDeadline = deriveProgress(run(), 5000)
    expect(atDeadline.incidents[0].outcome).toBe('missed')
    expect(atDeadline.current).toMatchObject({ index: 1, opensAt: 5000, closesAt: 10000 })
    const justBefore = deriveProgress(run(), 4999)
    expect(justBefore.current.index).toBe(0)
  })

  it('misses every remaining incident once the whole shift has elapsed', () => {
    const progress = deriveProgress(run(), 100000)
    expect(progress.finished).toBe(true)
    expect(progress.incidents.every((item) => item.outcome === 'missed')).toBe(true)
    expect(progress.score).toBe(0)
  })

  it('never expires practice incidents', () => {
    const progress = deriveProgress(run({ mode: 'practice' }), 10 * 60 * 1000)
    expect(progress.current).toMatchObject({ index: 0, closesAt: null })
  })

  it('marks unresolved practice incidents as skipped after an early end', () => {
    const practice = run({ mode: 'practice', resolutions: [{ at: 1000, outcome: 'correct' }] })
    practice.endedAt = 2000
    const progress = deriveProgress(practice, 2000)
    expect(progress.finished).toBe(true)
    expect(progress.incidents.slice(1).every((item) => item.outcome === 'skipped')).toBe(true)
    expect(progress.score).toBe(100)
  })

  it('does not change the run it reads', () => {
    const timed = run()
    const before = JSON.stringify(timed)
    deriveProgress(timed, 100000)
    expect(JSON.stringify(timed)).toBe(before)
  })
})
