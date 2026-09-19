import { describe, expect, it, vi } from 'vitest'
import { createOllamaProvider } from '../../src/modules/games/social-engineering-simulator/llm/providers/ollama.js'
import { LlmError } from '../../src/modules/games/social-engineering-simulator/llm/llmError.js'

function jsonResponse(body, { ok = true } = {}) {
  return { ok, json: async () => body }
}

describe('createOllamaProvider', () => {
  const systemPrompt = 'You are a fictional colleague.'
  const messages = [{ role: 'user', content: 'Hi' }]

  it('returns the reply content on success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: { content: 'Hello there' } }))
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2:1b',
      fetchImpl,
    })

    const result = await provider.chat({ systemPrompt, messages })

    expect(result).toEqual({ content: 'Hello there' })
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    const [, options] = fetchImpl.mock.calls[0]
    expect(JSON.parse(options.body)).toEqual({
      model: 'llama3.2:1b',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false,
    })
  })

  it('sends an Authorization header when authToken is provided', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: { content: 'Hello there' } }))
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2:1b',
      authToken: 'gateway-token',
      fetchImpl,
    })

    await provider.chat({ systemPrompt, messages })

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer gateway-token' },
      }),
    )
  })

  it('throws LLM_UPSTREAM_UNAVAILABLE on a non-OK HTTP response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false }))
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2:1b',
      fetchImpl,
    })

    await expect(provider.chat({ systemPrompt, messages })).rejects.toMatchObject({
      code: 'LLM_UPSTREAM_UNAVAILABLE',
    })
  })

  it('throws LLM_UPSTREAM_UNAVAILABLE on malformed JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('bad json')
      },
    })
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2:1b',
      fetchImpl,
    })

    await expect(provider.chat({ systemPrompt, messages })).rejects.toBeInstanceOf(LlmError)
  })

  it('throws LLM_UPSTREAM_UNAVAILABLE on empty or missing content', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: { content: '   ' } }))
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2:1b',
      fetchImpl,
    })

    await expect(provider.chat({ systemPrompt, messages })).rejects.toMatchObject({
      code: 'LLM_UPSTREAM_UNAVAILABLE',
    })
  })

  it('throws LLM_UPSTREAM_UNAVAILABLE when the network call itself fails', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'))
    const provider = createOllamaProvider({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'llama3.2:1b',
      fetchImpl,
    })

    await expect(provider.chat({ systemPrompt, messages })).rejects.toMatchObject({
      code: 'LLM_UPSTREAM_UNAVAILABLE',
    })
  })
})
