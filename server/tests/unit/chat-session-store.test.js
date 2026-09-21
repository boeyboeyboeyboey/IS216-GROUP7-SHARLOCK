import { describe, expect, it } from 'vitest'
import { createChatSessionStore } from '../../src/modules/games/social-engineering-simulator/llm/chatSessionStore.js'

describe('createChatSessionStore', () => {
  it('starts a session with an empty bounded transcript', () => {
    const store = createChatSessionStore()
    const id = store.start()

    expect(typeof id).toBe('string')
    expect(store.get(id)).toEqual([])
  })

  it('appends messages and returns them in order', () => {
    const store = createChatSessionStore()
    const id = store.start()

    store.append(id, { role: 'user', content: 'hi' })
    store.append(id, { role: 'assistant', content: 'hello' })

    expect(store.get(id)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])
  })

  it('drops the oldest messages once maxMessages is exceeded', () => {
    const store = createChatSessionStore({ maxMessages: 3 })
    const id = store.start()

    for (let i = 0; i < 5; i += 1) store.append(id, { role: 'user', content: `msg-${i}` })

    expect(store.get(id)).toEqual([
      { role: 'user', content: 'msg-2' },
      { role: 'user', content: 'msg-3' },
      { role: 'user', content: 'msg-4' },
    ])
  })

  it('append on an unknown session is a no-op and returns null', () => {
    const store = createChatSessionStore()
    expect(store.append('missing', { role: 'user', content: 'hi' })).toBeNull()
  })

  it('end() deletes the session so it can no longer be read or appended to', () => {
    const store = createChatSessionStore()
    const id = store.start()
    store.append(id, { role: 'user', content: 'hi' })

    store.end(id)

    expect(store.get(id)).toBeNull()
    expect(store.append(id, { role: 'user', content: 'again' })).toBeNull()
  })

  it('sweeps sessions idle past idleTtlMs, freeing their storage without an explicit end()', () => {
    let clock = 0
    const store = createChatSessionStore({ idleTtlMs: 1000, now: () => clock })

    const id = store.start()
    expect(store.size()).toBe(1)

    clock += 1500
    expect(store.size()).toBe(0)
    expect(store.get(id)).toBeNull()
  })

  it('keeps an active session alive across sweeps as long as it is touched', () => {
    let clock = 0
    const store = createChatSessionStore({ idleTtlMs: 1000, now: () => clock })
    const id = store.start()

    clock += 500
    store.append(id, { role: 'user', content: 'still here' })

    clock += 700
    expect(store.get(id)).toEqual([{ role: 'user', content: 'still here' }])
  })
})
