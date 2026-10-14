import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRateLimits } from '../../../src/modules/auth/rate-limits.js'

const secret = 'a'.repeat(64)
const activeLimits = new Set()

afterEach(() => {
  for (const limits of activeLimits) limits.dispose()
  activeLimits.clear()
  vi.restoreAllMocks()
})

function makeLimits(now) {
  const limits = createRateLimits({ secret, now })
  activeLimits.add(limits)
  return limits
}

describe('failed login rate limits', () => {
  it('counts only credential failures for the same email and IP, then expires them', () => {
    let currentTime = 1000
    const limits = makeLimits(() => currentTime)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      limits.reserveFailedLogin('learner@example.test', '127.0.0.1').fail()
    }
    try {
      limits.reserveFailedLogin('learner@example.test', '127.0.0.1')
      throw new Error('Expected the failed-login limiter to reject the sixth attempt.')
    } catch (error) {
      expect(error).toMatchObject({ code: 'RATE_LIMITED', status: 429 })
      expect(error.retryAfterMs).toBeGreaterThan(0)
    }
    expect(() => limits.reserveFailedLogin('other@example.test', '127.0.0.1')).not.toThrow()
    const anotherIp = limits.reserveFailedLogin('learner@example.test', '127.0.0.2')
    anotherIp.succeed()

    currentTime += 15 * 60 * 1000 + 1
    const retry = limits.reserveFailedLogin('learner@example.test', '127.0.0.1')
    retry.release()
  })

  it('reserves concurrent failure slots and releases successful attempts', () => {
    const limits = makeLimits(Date.now)
    const reservations = Array.from({ length: 5 }, () =>
      limits.reserveFailedLogin('learner@example.test', '127.0.0.1'),
    )
    try {
      limits.reserveFailedLogin('learner@example.test', '127.0.0.1')
      throw new Error('Expected concurrent failure slots to be reserved.')
    } catch (error) {
      expect(error).toMatchObject({ status: 429 })
    }

    reservations[0].succeed()
    const retry = limits.reserveFailedLogin('learner@example.test', '127.0.0.1')
    retry.fail()
    reservations.slice(1).forEach((reservation) => reservation.fail())
    expect(() => limits.reserveFailedLogin('learner@example.test', '127.0.0.1')).toThrow()
  })
})
