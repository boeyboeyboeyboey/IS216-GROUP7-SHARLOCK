import { describe, expect, it } from 'vitest'
import { LlmError } from '../../src/modules/games/social-engineering-simulator/llm/llmError.js'

describe('LlmError', () => {
  it('carries a code, message and default status', () => {
    const error = new LlmError('LLM_NOT_CONFIGURED', 'No LLM provider is configured.')
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('LlmError')
    expect(error.code).toBe('LLM_NOT_CONFIGURED')
    expect(error.message).toBe('No LLM provider is configured.')
    expect(error.status).toBe(503)
  })

  it('accepts an explicit status override', () => {
    const error = new LlmError('LLM_UPSTREAM_UNAVAILABLE', 'The LLM host returned an error.', 502)
    expect(error.status).toBe(502)
  })
})
