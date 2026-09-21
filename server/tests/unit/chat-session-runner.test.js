import { describe, expect, it, vi } from 'vitest'
import { createChatSessionStore } from '../../src/modules/games/social-engineering-simulator/llm/chatSessionStore.js'
import { createChatSessionRunner } from '../../src/modules/games/social-engineering-simulator/llm/chatSessionRunner.js'

function fakeAdapter(replies) {
  const chat = vi.fn(async () => ({ content: replies.shift() }))
  return { chat }
}

describe('createChatSessionRunner', () => {
  const systemPrompt = 'You are a fictional colleague.'

  it('starts a session by delegating to the store', () => {
    const store = createChatSessionStore()
    const runner = createChatSessionRunner({ store, adapter: fakeAdapter([]) })

    const id = runner.start()

    expect(store.get(id)).toEqual([])
  })

  it('appends the user turn and the reply, resending the whole transcript each call', async () => {
    const store = createChatSessionStore()
    const adapter = fakeAdapter(['first reply', 'second reply'])
    const runner = createChatSessionRunner({ store, adapter })
    const id = runner.start()

    const first = await runner.send(id, { systemPrompt, content: 'hi' })
    expect(first).toBe('first reply')
    expect(adapter.chat).toHaveBeenLastCalledWith({
      systemPrompt,
      messages: [{ role: 'user', content: 'hi' }],
    })

    const second = await runner.send(id, { systemPrompt, content: 'follow up' })
    expect(second).toBe('second reply')
    expect(adapter.chat).toHaveBeenLastCalledWith({
      systemPrompt,
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'first reply' },
        { role: 'user', content: 'follow up' },
      ],
    })
  })

  it('rejects sending to a session that was never started or already ended', async () => {
    const store = createChatSessionStore()
    const runner = createChatSessionRunner({ store, adapter: fakeAdapter([]) })

    await expect(
      runner.send('missing-session', { systemPrompt, content: 'hi' }),
    ).rejects.toMatchObject({ code: 'LLM_SESSION_NOT_FOUND' })
  })

  it('end() clears the transcript so the session can no longer be used', async () => {
    const store = createChatSessionStore()
    const runner = createChatSessionRunner({ store, adapter: fakeAdapter(['reply']) })
    const id = runner.start()
    await runner.send(id, { systemPrompt, content: 'hi' })

    runner.end(id)

    await expect(runner.send(id, { systemPrompt, content: 'again' })).rejects.toMatchObject({
      code: 'LLM_SESSION_NOT_FOUND',
    })
  })
})
