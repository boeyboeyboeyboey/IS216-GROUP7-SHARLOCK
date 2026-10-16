import { describe, expect, it } from 'vitest'
import { withTimeout } from '../../../src/modules/games/social-engineering-simulator/llmTimeout.js'
import { createGameAdapters } from '../../../src/modules/games/social-engineering-simulator/llmConfig.js'

describe('withTimeout', () => {
  it('replaces the caller signal with one that aborts after the timeout', async () => {
    let seen
    const fake = async (url, init) => {
      seen = init.signal
      return {}
    }
    const callerSignal = new AbortController().signal
    await withTimeout(fake, 20)('http://h', { signal: callerSignal })
    expect(seen).not.toBe(callerSignal)
    expect(seen.aborted).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(seen.aborted).toBe(true)
  })
})

describe('createGameAdapters', () => {
  it('builds a cloud attacker and a local colleague', () => {
    const { attacker, colleague } = createGameAdapters({
      llmApiKey: 'k',
      llmModel: 'gemini-x',
      llmColleagueBaseUrl: 'http://h:8080',
      llmColleagueModel: 'llama3.2:3b-fast',
    })
    expect(attacker.mode).toBe('cloud')
    expect(colleague.mode).toBe('local')
  })

  it('has no colleague without colleague settings', () => {
    expect(createGameAdapters({ llmApiKey: 'k' }).colleague).toBeNull()
  })

  it('does not throw for a model without an api key', () => {
    const { attacker } = createGameAdapters({ llmModel: 'gemini-x' })
    expect(attacker.configured).toBe(false)
  })
})
