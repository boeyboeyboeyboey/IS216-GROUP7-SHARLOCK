import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { useAttempt } from '../useAttempt.js'
import { writeAttempt, readAttempt } from '../api.js'
vi.mock('../api.js', () => ({
  writeAttempt: vi.fn(),
  readAttempt: vi.fn(),
  safeAttemptError: (error) => ({ message: 'Retry request', status: error.status || 0 }),
}))
let wrapper
afterEach(() => {
  wrapper?.unmount()
  vi.resetAllMocks()
})
function setup() {
  let game
  wrapper = mount(
    defineComponent({
      setup() {
        game = useAttempt('sql-injection-arcade')
        return () => null
      },
    }),
  )
  return game
}
const snapshot = {
  gameId: 'sql-injection-arcade',
  attemptId: 'example-id',
  revision: 0,
  status: 'active',
}
describe('shared attempt requests', () => {
  it('retries a lost action response with exactly the original ID and revision', async () => {
    const game = setup()
    readAttempt.mockResolvedValue(snapshot)
    await game.load('example-id')
    writeAttempt
      .mockRejectedValueOnce(new Error('Network lost'))
      .mockResolvedValueOnce({ ...snapshot, revision: 1 })
    await game.mutate('test-payload', { username: 'fictional', password: '' })
    const original = writeAttempt.mock.calls[0][1]
    expect(game.retryable.value).toBe(true)
    expect(await game.mutate('test-payload', {})).toBe(false)
    expect(await game.load('example-id')).toBe(false)
    await game.retry()
    expect(writeAttempt.mock.calls[1][1]).toEqual(original)
    expect(game.snapshot.value.revision).toBe(1)
    expect(game.retryable.value).toBe(false)
  })
  it('allows a fresh read after a deterministic revision rejection', async () => {
    const game = setup()
    readAttempt.mockResolvedValue(snapshot)
    await game.load('example-id')
    writeAttempt.mockRejectedValue({ status: 409 })
    await game.mutate('test-payload', { username: '', password: '' })
    expect(game.retryable.value).toBe(false)
    expect(await game.load('example-id')).toBe(true)
  })
})
