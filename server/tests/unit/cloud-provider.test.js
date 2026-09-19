import { describe, expect, it } from 'vitest'
import { createCloudProvider } from '../../src/modules/games/social-engineering-simulator/llm/providers/cloud.js'

describe('createCloudProvider', () => {
  it('always throws LLM_CLOUD_NOT_IMPLEMENTED', async () => {
    const provider = createCloudProvider({ apiKey: 'sk-example-key' })

    await expect(
      provider.chat({ systemPrompt: 'You are a fictional colleague.', messages: [] }),
    ).rejects.toMatchObject({ code: 'LLM_CLOUD_NOT_IMPLEMENTED' })
  })
})
