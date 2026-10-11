import { describe, expect, it, vi } from 'vitest'
import { createCloudProvider } from '../../src/modules/games/social-engineering-simulator/llm/providers/cloud.js'

function okResponse(text) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  }
}

describe('createCloudProvider (gemini)', () => {
  it('returns the candidate text and maps assistant turns to the model role', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse('Hold on, I just need the code.'))
    const provider = createCloudProvider({ apiKey: 'test-key', model: 'gemini-2.5-flash', fetchImpl })

    const result = await provider.chat({
      systemPrompt: 'You are a fictional colleague.',
      messages: [
        { role: 'assistant', content: 'opening line' },
        { role: 'user', content: 'no' },
      ],
    })

    expect(result).toEqual({ content: 'Hold on, I just need the code.' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('/models/gemini-2.5-flash:generateContent')
    expect(init.headers['x-goog-api-key']).toBe('test-key')
    const body = JSON.parse(init.body)
    expect(body.system_instruction.parts[0].text).toBe('You are a fictional colleague.')
    expect(body.contents.map((c) => c.role)).toEqual(['model', 'user'])
  })

  it('throws LLM_UPSTREAM_UNAVAILABLE when the host cannot be reached', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network'))
    const provider = createCloudProvider({ apiKey: 'test-key', fetchImpl })

    await expect(provider.chat({ systemPrompt: 's', messages: [] })).rejects.toMatchObject({
      code: 'LLM_UPSTREAM_UNAVAILABLE',
    })
  })

  it('throws LLM_UPSTREAM_UNAVAILABLE on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    const provider = createCloudProvider({ apiKey: 'test-key', fetchImpl })

    await expect(provider.chat({ systemPrompt: 's', messages: [] })).rejects.toMatchObject({
      code: 'LLM_UPSTREAM_UNAVAILABLE',
    })
  })

  it('throws LLM_UPSTREAM_UNAVAILABLE when the reply has no candidate text (safety block)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) })
    const provider = createCloudProvider({ apiKey: 'test-key', fetchImpl })

    await expect(provider.chat({ systemPrompt: 's', messages: [] })).rejects.toMatchObject({
      code: 'LLM_UPSTREAM_UNAVAILABLE',
    })
  })
})
